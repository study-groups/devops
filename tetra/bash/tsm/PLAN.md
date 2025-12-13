# TSM Refactor: Unified Start, File-Based Hooks, Directory Consolidation

## Problems

### 1. Three Parallel Start Implementations
| Function | File | Log Path | PID Path |
|----------|------|----------|----------|
| `tsm_start_any_command()` | core/start.sh | `$TSM_PROCESSES_DIR/$name/` | `$process_dir/${name}.pid` |
| `_tsm_start_process()` | process/lifecycle.sh | `$TSM_LOGS_DIR/$name.out` | `$TSM_PIDS_DIR/$name.pid` |
| `_tsm_start_command_process()` | process/lifecycle.sh | `$TSM_LOGS_DIR/$name.out` | `$TSM_PIDS_DIR/$name.pid` |

Restart uses legacy `_tsm_start_command_process()`, bypassing hooks/metadata.

### 2. Pre-Hooks Fail in Subshell
`bash -c` subshell calls `tetra_python_activate` which doesn't exist (not exported).

### 3. Service Start Re-Invokes CLI
`tetra_tsm_start_service()` builds args then calls `tsm start` in a subshell:
- Double parsing, double validation
- Context lost crossing subshell boundary

### 4. Hardcoded Service Path
`process/management.sh:317`:
```bash
local service_file="$TETRA_DIR/tsm/services-available/${first_arg}.tsm"
```
Ignores multi-org structure at `$TETRA_DIR/orgs/*/tsm/services-available/`.

### 5. Directory Scatter
```
$TETRA_DIR/
├── tsm/
│   ├── services-available/     # OLD location
│   └── services-enabled/       # One of many
└── orgs/
    ├── tetra/tsm/
    │   ├── services-available/ # Correct location
    │   └── services-enabled/   # Redundant
    └── other-org/tsm/
        └── services-enabled/   # Redundant
```

---

## Solution

### Part 1: Unified Start Implementation

**Single canonical start function.** All paths lead to `tsm_start_any_command()`.

```
┌─────────────────────────────────────────────────────────────┐
│  tsm start <args>                                           │
│      │                                                      │
│      ▼                                                      │
│  tetra_tsm_start() [parse flags]                            │
│      │                                                      │
│      ├── is service? ─► _tsm_load_service_config()          │
│      │                       │                              │
│      │                       ▼                              │
│      └─────────────────► tsm_start_any_command()            │
│                              │                              │
│                              ▼                              │
│                          [single implementation]            │
│                          • PM2-style dirs                   │
│                          • file-based hooks                 │
│                          • JSON metadata                    │
└─────────────────────────────────────────────────────────────┘
```

**Delete:**
- `_tsm_start_process()` in lifecycle.sh
- `_tsm_start_command_process()` in lifecycle.sh

**Modify:**
- `_tsm_restart_unified()` → call `tsm_start_any_command()`
- `tetra_tsm_start_service()` → call `tsm_start_any_command()` directly (no CLI re-invoke)
- `tetra_tsm_start()` → use `_tsm_find_service()` instead of hardcoded path

---

### Part 2: File-Based Hooks

**Create `$TETRA_DIR/tsm/hooks/`:**
```
$TETRA_DIR/tsm/hooks/
├── python.sh    # pyenv activation
├── node.sh      # nvm activation
└── tetra.sh     # full tetra shell
```

**python.sh:**
```bash
#!/usr/bin/env bash
export PYENV_ROOT="$TETRA_DIR/pyenv"
export PATH="$PYENV_ROOT/bin:$PATH"
eval "$(pyenv init -)"
```

**node.sh:**
```bash
#!/usr/bin/env bash
export NVM_DIR="$TETRA_DIR/nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
```

**tetra.sh:**
```bash
#!/usr/bin/env bash
source "$TETRA_DIR/tetra.sh"
```

**Hook Resolution Order:**
1. Explicit `--pre-hook` flag
2. `$TETRA_DIR/tsm/hooks/<service-name>.sh`
3. `$TETRA_DIR/tsm/hooks/<process-type>.sh` (python, node)
4. None

---

### Part 3: Directory Consolidation

**After:**
```
$TETRA_DIR/
├── tsm/
│   ├── hooks/                  # File-based hooks
│   │   ├── python.sh
│   │   ├── node.sh
│   │   └── tetra.sh
│   └── services-enabled/       # SINGLE location, symlinks to any org
└── orgs/
    ├── tetra/tsm/services-available/
    ├── pixeljam/tsm/services-available/
    └── other-org/tsm/services-available/
```

**Changes:**
- Remove `TSM_DEFAULT_ORG` - require explicit `org/service`
- Single `services-enabled` at `$TETRA_DIR/tsm/services-enabled/`
- Service definitions only in `$TETRA_DIR/orgs/*/tsm/services-available/`

---

## Code Changes

### core/start.sh

Replace inline hook strings with file sourcing:

```bash
# In tsm_start_any_command(), replace env_setup building with:

local hook_file=""
if [[ -n "$explicit_prehook" ]]; then
    # Explicit --pre-hook takes priority
    hook_file="$explicit_prehook"
elif declare -f tsm_resolve_hook >/dev/null 2>&1; then
    hook_file=$(tsm_resolve_hook "$explicit_name" "$process_type")
fi

local env_setup=""
if [[ -n "$hook_file" && -f "$hook_file" ]]; then
    env_setup="source '$hook_file'"
fi

# Add user env file if specified
if [[ -n "$env_file" && -f "$env_file" ]]; then
    env_setup="${env_setup:+$env_setup$'\n'}source '$env_file'"
fi
```

### core/hooks.sh

Replace associative array with file resolution:

```bash
TSM_HOOKS_DIR="${TETRA_DIR}/tsm/hooks"

# Resolve hook file (explicit > service-specific > type-based)
tsm_resolve_hook() {
    local name="$1"   # service name
    local type="$2"   # process type (python, node)

    # 1. Service-specific hook
    [[ -f "$TSM_HOOKS_DIR/${name}.sh" ]] && { echo "$TSM_HOOKS_DIR/${name}.sh"; return 0; }

    # 2. Type-based hook
    [[ -f "$TSM_HOOKS_DIR/${type}.sh" ]] && { echo "$TSM_HOOKS_DIR/${type}.sh"; return 0; }

    return 1
}

# Build prehook command (simplified - just returns file path or empty)
tsm_build_prehook() {
    local explicit="$1"
    local process_type="$2"
    local service_name="$3"

    # Explicit takes priority
    [[ -n "$explicit" && -f "$explicit" ]] && { echo "source '$explicit'"; return 0; }

    # Resolve from hooks directory
    local hook_file
    hook_file=$(tsm_resolve_hook "$service_name" "$process_type") || return 1

    echo "source '$hook_file'"
}

export -f tsm_resolve_hook
export -f tsm_build_prehook
```

### process/lifecycle.sh

Delete `_tsm_start_process()` and `_tsm_start_command_process()`.

Update `_tsm_restart_unified()`:

```bash
_tsm_restart_unified() {
    local name="$1"
    local command="$2"
    local port="$3"
    local type="$4"
    local preserve_id="$5"
    local cwd="$6"

    # Use unified start - run from correct directory
    (
        cd "$cwd" 2>/dev/null || cd "$PWD"
        tsm_start_any_command "$command" "" "$port" "$name" ""
    ) || {
        echo "tsm: failed to restart '$name'" >&2
        return 1
    }

    # Update metadata with preserved TSM ID
    local meta_file="$TSM_PROCESSES_DIR/$name/meta.json"
    if [[ -f "$meta_file" ]]; then
        local temp_file="${meta_file}.tmp"
        jq --arg id "$preserve_id" '.tsm_id = ($id | tonumber) | .restarts += 1' \
            "$meta_file" > "$temp_file" && mv "$temp_file" "$meta_file"
    fi

    local pid=$(jq -r '.pid' "$meta_file" 2>/dev/null)
    local port_info=""
    [[ -n "$port" && "$port" != "none" ]] && port_info=", Port: $port"
    echo "tsm: restarted '$name' (TSM ID: $preserve_id, PID: $pid$port_info)"
}
```

### process/management.sh

Fix service detection to use multi-org:

```bash
tetra_tsm_start() {
    # ... flag parsing unchanged ...

    # Check if first arg is a known service (USE MULTI-ORG LOOKUP)
    local first_arg="${command_args[0]}"
    local _org _service_file
    if _tsm_find_service "$first_arg" _org _service_file 2>/dev/null; then
        echo "🚀 Starting service: $_org/$first_arg"
        tetra_tsm_start_service "$first_arg"
        return $?
    fi

    # ... rest unchanged ...
}
```

### services/definitions.sh

Simplify `tetra_tsm_start_service()` to call `tsm_start_any_command()` directly:

```bash
tetra_tsm_start_service() {
    local service_ref="$1"
    local org service_file

    if ! _tsm_find_service "$service_ref" org service_file; then
        echo "❌ Service not found: $service_ref"
        return 1
    fi

    # Guard: TETRA_SRC required
    [[ -z "$TETRA_SRC" ]] && { echo "❌ TETRA_SRC not set" >&2; return 1; }

    # Load service config
    local TSM_NAME TSM_COMMAND TSM_CWD TSM_ENV TSM_PORT TSM_PRE_COMMAND
    local _tsm_decl_output
    _tsm_decl_output=$(
        export TETRA_SRC="$TETRA_SRC"
        export TETRA_DIR="$TETRA_DIR"
        source "$service_file" 2>&1 && \
        declare -p TSM_NAME TSM_COMMAND TSM_CWD TSM_ENV TSM_PORT TSM_PRE_COMMAND 2>/dev/null
    )

    [[ "$_tsm_decl_output" != *"declare"* ]] && { echo "❌ Failed to load: $service_file" >&2; return 1; }
    eval "$(echo "$_tsm_decl_output" | sed 's/^declare -x /declare /' | sed 's/^declare -- /declare /')"

    # Resolve CWD
    [[ "$TSM_CWD" == "." || -z "$TSM_CWD" ]] && TSM_CWD="$PWD"

    # Resolve env file (skip if TSM_ENV="none")
    local env_file=""
    if [[ "${TSM_ENV:-local}" != "none" ]]; then
        env_file="$TSM_CWD/env/${TSM_ENV:-local}.env"
        [[ ! -f "$env_file" ]] && { echo "❌ Env file not found: $env_file" >&2; return 1; }
    fi

    # Check if already running
    local process_name="${TSM_NAME}-${TSM_PORT:-auto}"
    if tetra_tsm_is_running "$process_name" 2>/dev/null; then
        echo "⚠️  Already running: $process_name"
        return 0
    fi

    echo "Starting $TSM_NAME on port ${TSM_PORT:-auto}..."

    # DIRECT CALL - no CLI re-invocation
    (
        cd "$TSM_CWD"
        tsm_start_any_command "$TSM_COMMAND" "$env_file" "$TSM_PORT" "$TSM_NAME" "$TSM_PRE_COMMAND"
    )
}
```

Require explicit org for save:

```bash
tetra_tsm_save() {
    local service_ref="$1"

    # Require explicit org/service format
    if [[ "$service_ref" != */* ]]; then
        echo "Usage: tsm save <org/service-name> <command> [args...]"
        echo "Example: tsm save tetra/myservice python app.py"
        return 1
    fi

    # ... rest unchanged ...
}
```

Update enable/disable to use single services-enabled:

```bash
TSM_SERVICES_ENABLED="$TETRA_DIR/tsm/services-enabled"

tetra_tsm_enable() {
    local service_ref="$1"
    local org service_file

    _tsm_find_service "$service_ref" org service_file || { echo "❌ Not found: $service_ref"; return 1; }

    mkdir -p "$TSM_SERVICES_ENABLED"

    local service_name="${service_ref##*/}"
    local link_name="${org}-${service_name}.tsm"
    local enabled_link="$TSM_SERVICES_ENABLED/$link_name"

    [[ -L "$enabled_link" ]] && { echo "⚠️  Already enabled: $service_ref"; return 0; }

    ln -s "$service_file" "$enabled_link"
    echo "✅ Enabled: $service_ref"
}

tetra_tsm_disable() {
    local service_ref="$1"
    local org service_file

    _tsm_find_service "$service_ref" org service_file || { echo "❌ Not found: $service_ref"; return 1; }

    local service_name="${service_ref##*/}"
    local link_name="${org}-${service_name}.tsm"
    local enabled_link="$TSM_SERVICES_ENABLED/$link_name"

    [[ ! -L "$enabled_link" ]] && { echo "⚠️  Not enabled: $service_ref"; return 0; }

    rm "$enabled_link"
    echo "✅ Disabled: $service_ref"
}
```

---

## Data Migration

```bash
#!/usr/bin/env bash
# Run from $TETRA_DIR

# 1. Create hooks directory
mkdir -p tsm/hooks

# 2. Create hook files
cat > tsm/hooks/python.sh << 'EOF'
#!/usr/bin/env bash
export PYENV_ROOT="$TETRA_DIR/pyenv"
export PATH="$PYENV_ROOT/bin:$PATH"
eval "$(pyenv init -)"
EOF

cat > tsm/hooks/node.sh << 'EOF'
#!/usr/bin/env bash
export NVM_DIR="$TETRA_DIR/nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
EOF

cat > tsm/hooks/tetra.sh << 'EOF'
#!/usr/bin/env bash
source "$TETRA_DIR/tetra.sh"
EOF

chmod +x tsm/hooks/*.sh

# 3. Move old services to tetra org (if any exist at old location)
if [[ -d tsm/services-available ]]; then
    mkdir -p orgs/tetra/tsm/services-available
    mv tsm/services-available/*.tsm orgs/tetra/tsm/services-available/ 2>/dev/null || true
    rmdir tsm/services-available 2>/dev/null || true
fi

# 4. Consolidate services-enabled (re-link to use org prefix)
mkdir -p tsm/services-enabled
for org_dir in orgs/*/tsm/services-enabled; do
    [[ -d "$org_dir" ]] || continue
    org=$(basename "$(dirname "$(dirname "$org_dir")")")

    for link in "$org_dir"/*.tsm; do
        [[ -L "$link" ]] || continue
        service=$(basename "$link")
        target=$(readlink "$link")

        # Create new link with org prefix
        new_link="tsm/services-enabled/${org}-${service}"
        if [[ ! -e "$new_link" ]]; then
            # Resolve to absolute path
            abs_target="$TETRA_DIR/orgs/$org/tsm/services-available/$service"
            ln -s "$abs_target" "$new_link"
        fi
    done

    # Remove old org-specific services-enabled
    rm -rf "$org_dir"
done

echo "Migration complete"
```

---

## Files Summary

| Action | File |
|--------|------|
| CREATE | `$TETRA_DIR/tsm/hooks/python.sh` |
| CREATE | `$TETRA_DIR/tsm/hooks/node.sh` |
| CREATE | `$TETRA_DIR/tsm/hooks/tetra.sh` |
| MODIFY | `core/hooks.sh` - file-based resolution |
| MODIFY | `core/start.sh` - source hook files |
| MODIFY | `process/lifecycle.sh` - delete legacy starts, fix restart |
| MODIFY | `process/management.sh` - use `_tsm_find_service()` |
| MODIFY | `services/definitions.sh` - direct call, single services-enabled |
| DELETE | `$TETRA_DIR/tsm/services-available/` (move to orgs/tetra/) |
| DELETE | `$TETRA_DIR/orgs/*/tsm/services-enabled/` (consolidate) |

---

## Implementation Order

### Phase 1: Unified Start (No Breaking Changes)
1. Update `_tsm_restart_unified()` to use `tsm_start_any_command()`
2. Update `tetra_tsm_start_service()` to call directly (no CLI re-invoke)
3. Fix `tetra_tsm_start()` service detection path
4. Delete legacy `_tsm_start_process()` and `_tsm_start_command_process()`
5. Test: `tsm start`, `tsm restart`, service start

### Phase 2: File-Based Hooks
1. Create `$TETRA_DIR/tsm/hooks/` directory
2. Create `python.sh`, `node.sh`, `tetra.sh`
3. Update `core/hooks.sh` with `tsm_resolve_hook()`
4. Update `core/start.sh` to source hook files
5. Test: Python service with pyenv, Node service with nvm

### Phase 3: Directory Consolidation
1. Run migration script
2. Update `services/definitions.sh` enable/disable
3. Require explicit org for `tsm save`
4. Test: `tsm services`, `tsm enable`, `tsm disable`

---

## Verification Checklist

- [ ] `tsm start node server.js` works
- [ ] `tsm start python -m http.server 8000` works
- [ ] `tsm start quasar` (service) works
- [ ] `tsm restart <name>` preserves TSM ID
- [ ] Python services activate pyenv
- [ ] Node services activate nvm
- [ ] `tsm enable tetra/quasar` creates link in single location
- [ ] `tsm services --enabled` shows all enabled from single dir
- [ ] `tsm save tetra/newservice cmd` works
- [ ] `tsm save newservice cmd` errors with usage hint
