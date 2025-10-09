# TUI Grammar & Action System - Planning Document

## Overview

Create a compositional grammar for TUI (Terminal UI) interactions that unifies:
- Action declarations with type signatures
- Multi-layer routing (TUI components, module storage, app streams)
- PData capability-based permissions
- Remote resource binding (SSH, files, processes)
- Clean separation between declaration (`::`) and execution (`→`)

## Implementation Plan: Demos 011-015

### Demo 011: ENV-based Configuration ✅ (COMPLETED)

**Purpose:** Establish foundation with configuration-driven design

**Files:**
```
demo/basic/011/
├── tui.conf      # All design tokens as ENV_VARs
└── demo.sh       # Basic TUI with configurable layout
```

**Key concepts:**
- All TUI design elements as ENV_VARs
- Header/Content/CLI/Footer layout
- Makes HTML/CSS generation straightforward
- Example: `TUI_SEPARATOR_CHAR="-"`, `TUI_HEADER_HEIGHT=4`

---

### Demo 012: Action Routing with @annotations

**Purpose:** Introduce routing annotations and the `::` operator

**Files to create:**
```
demo/basic/012/
├── tui.conf                 # Inherit from 011
├── action_registry.sh       # Action declarations with signatures
├── router.sh                # Route output based on @annotations
└── demo.sh                  # Main app with routing demo
```

**Key concepts:**
- Action signatures: `show:log :: @tui[content] @app[stdout]`
- Routing parser: extract `@target[component]` from signature
- Route dispatcher: send output to correct component
- Examples: `@tui[content]`, `@tui[footer]`, `@app[stdout]`

**Example declarations:**
```bash
declare -A ACTION_show_demo=(
    [verb]="show"
    [noun]="demo"
    [routes]="@tui[content]"
)

declare -A ACTION_test_demo=(
    [verb]="test"
    [noun]="demo"
    [routes]="@tui[content],@tui[footer]"
)
```

---

### Demo 013: Module Endpoint Binding

**Purpose:** Add module-specific storage with `::` resource binding

**Files to create:**
```
demo/basic/013/
├── tui.conf
├── action_registry.sh       # Enhanced with resource bindings
├── router.sh                # Multi-layer routing
├── modules/
│   ├── nginx.sh            # @nginx[access_log] endpoint
│   └── deploy.sh           # @deploy[run_log] endpoint
└── demo.sh                  # Module routing demo
```

**Key concepts:**
- Module endpoints: `@nginx[access_log] :: /var/log/nginx/access.log`
- Resource URIs: `file://path`, `ssh://user@host/path`
- Resolution: template variables like `{run_id}`, `{user}`
- Examples: Local files, SSH resources, PData mounts

**Example module:**
```bash
# modules/nginx.sh
declare -A MODULE_ENDPOINTS=(
    [@nginx[access_log]]="/var/log/nginx/access.log"
    [@nginx[error_log]]="/var/log/nginx/error.log"
)

resolve_nginx_endpoint() {
    local route="$1"
    echo "${MODULE_ENDPOINTS[$route]}"
}
```

**Example action with binding:**
```bash
declare -A ACTION_show_nginx_logs=(
    [verb]="show"
    [noun]="nginx_logs"
    [resource]="file:///var/log/nginx/access.log"
    [routes]="@tui[content],@nginx[access_log]"
)
```

---

### Demo 014: Capability Validation (PData Integration)

**Purpose:** Add permission checking with PData capability syntax

**Files to create:**
```
demo/basic/014/
├── tui.conf
├── action_registry.sh       # Add capability requirements
├── capability_validator.sh  # PData-style permission checking
├── modules/
│   ├── nginx.sh
│   └── deploy.sh
└── demo.sh                  # Capability validation demo
```

**Key concepts:**
- Capability syntax: `read:~log/nginx/**`, `write:~/data/deploy/**`
- Action requirements: `show:secrets :: requires [read:~log/**]`
- Validation before execution
- Examples: User vs admin capabilities, denied actions

**PData capability syntax:**
```bash
# Operation:mount_path/pattern
read:~/data/{user}/docs/**              # Read user docs (recursive)
write:~/data/games/mods/**              # Write to specific subtree
list:~data/**;read:~data/**             # Compound (semicolon-separated)
exec:~/data/projects/app/**             # Execute permission
```

**Example action with capabilities:**
```bash
declare -A ACTION_show_secrets=(
    [verb]="show"
    [noun]="secrets"
    [requires]="read:~log/**"
    [resource]="file:///etc/passwd"
    [routes]="@tui[content]"
)
```

**Validation example:**
```bash
validate_capability() {
    local user="$1"
    local required_cap="$2"

    local operation="${required_cap%%:*}"
    local path="${required_cap#*:}"

    # Check against user's token capabilities
    case "$user:$operation:$path" in
        "admin:read:~log/"*) return 0 ;;
        "user:read:~/data/{user}/"*) return 0 ;;
        *) return 1 ;;
    esac
}
```

---

### Demo 015: Complete Grammar System

**Purpose:** Unified grammar with all operators and full execution model

**Files to create:**
```
demo/basic/015/
├── grammar/
│   ├── operators.sh         # Define all operators (::, →, ×, @)
│   ├── parser.sh            # Parse action signatures
│   └── types.sh             # Type definitions
├── execution/
│   ├── validator.sh         # Capability validation
│   ├── resolver.sh          # Resource binding resolution
│   ├── executor.sh          # Action execution
│   └── router.sh            # Multi-layer routing
├── modules/
│   ├── nginx.sh
│   ├── deploy.sh
│   └── registry.sh          # Module registration
├── examples/
│   ├── local_file.sh        # file:// example
│   ├── remote_ssh.sh        # ssh:// example
│   └── config_at_distance.sh # Monitor remote, execute local
└── demo.sh                  # Complete system demo
```

**Key concepts:**
- Full operator implementation
- Complete execution pipeline
- All three execution modes (local, remote, config-at-distance)
- Modular architecture for reuse in bash/tview

---

## Grammar Specification

### Operators

| Operator | Symbol | Name | Semantics | Example |
|----------|--------|------|-----------|---------|
| Cross product | `×` | CROSS_OP | Compose context | `ENV × MODE` |
| Contains | `:` | PAIR_SEP | Action pairing | `show:log` |
| Declares contract | `::` | ENDPOINT_OP | Type signature | `ACTION :: Type` |
| Flows to | `→` | FLOW_OP | Execution flow | `ACTION → @target` |
| Route directive | `@` | ROUTE_OP | Target annotation | `@tui[content]` |

### Operator Variable Names

```bash
# In code, use these variable names
CROSS_OP="×"           # ENV_CROSS_MODE
FLOW_OP="→"            # ACTION_FLOW_TARGET
ROUTE_OP="@"           # STREAM_AT_COMPONENT
ENDPOINT_OP="::"       # COMPONENT_BIND_RESOURCE
PAIR_SEP=":"           # VERB_PAIR_NOUN
```

### Action Declaration Syntax

**Full form:**
```bash
declare -A ACTION_{name}=(
    [verb]="VERB"
    [noun]="NOUN"
    [requires]="CAPABILITY"      # PData: operation:path
    [binds]="RESOURCE_URI"       # Terminal object (deprecated, use [resource])
    [resource]="RESOURCE_URI"    # Terminal object
    [routes]="@target,@target"   # Comma-separated routing directives
    [contexts]="ENV:MODE,ENV:MODE"  # Valid execution contexts
)
```

**Compact helper:**
```bash
declare_action() {
    local action_name="$1"
    shift
    local -n action_def="ACTION_${action_name}"

    while [[ $# -gt 0 ]]; do
        local key="${1%%=*}"
        local value="${1#*=}"
        action_def["$key"]="$value"
        shift
    done
}

# Usage
declare_action "show_nginx_logs" \
    "verb=show" \
    "noun=nginx_logs" \
    "requires=read:~log/nginx/**" \
    "resource=ssh://root@prod/var/log/nginx/access.log" \
    "routes=@tui[content],@nginx[access_log],@app[stdout]"
```

### Routing Layers

The three-layer routing model separates concerns:

#### Layer 1: TUI Components (Display)
Where to show output in the terminal UI

- `@tui[header]` - Top status bar (4 lines)
- `@tui[content]` - Main content area (fills remaining space)
- `@tui[cli]` - Interactive CLI prompt (1-2 lines)
- `@tui[footer]` - Bottom status/help line (1 line)

#### Layer 2: Module Storage (Persistence)
Module-specific storage endpoints (module resolves internally)

- `@nginx[access_log]` → `/var/log/nginx/access.log`
- `@nginx[error_log]` → `/var/log/nginx/error.log`
- `@deploy[run_log]` → `$DEPLOY_RUNS_DIR/{run_id}/output.log`
- `@deploy[state]` → `$DEPLOY_RUNS_DIR/{run_id}/state.json`

**Key insight:** Module knows its own storage layout. TUI framework just passes the `@module[tag]` directive.

#### Layer 3: App Streams (Firehose)
Application event/data streams (while real stdio renders TUI)

- `@app[stdout]` - Metaphorical stdout (real stdout is TUI rendering)
- `@app[stderr]` - Error stream
- `@app[events]` - Event bus for pub/sub
- `@app[metrics]` - Real-time metrics feed

**Key insight:** Real stdio is used for TUI rendering. These are *virtual* streams for app logic.

### Resource URI Schemes

```bash
file:///absolute/path              # Absolute filesystem path
file://$VAR/path                   # Variable expansion
file://./relative/path             # Relative to working directory

ssh://user@host/path               # Remote file via SSH
ssh://user@host:port/path          # SSH with custom port

proc://command                     # Process execution
proc://command arg1 arg2           # With arguments

env://VAR_NAME                     # Environment variable
env://HOME/subdir                  # Env var with path suffix

http://api.example.com/endpoint    # HTTP resource
https://api.example.com/data       # HTTPS resource
```

**Template expansion:**
```bash
file://$DEPLOY_RUNS_DIR/{run_id}/output.log
     ↓
file:///home/user/tetra/deploy/runs/1234567/output.log

ssh://root@{env}/var/log/nginx/access.log
     ↓
ssh://root@prod.example.com/var/log/nginx/access.log
```

### PData Capability Syntax

**Format:** `operation:mount_path/pattern`

**Operations:**
- `list` - Directory listing
- `read` - File read
- `write` - File write/create
- `delete` - File/directory delete
- `exec` - Execute permission

**Mount points:**
- `~data` - User data space
- `~log` - System logs
- `~cache` - System cache
- `~system` - Full system (admin only)
- `~uploads` - Upload directory
- `~/data/{user}` - User-specific home (template)

**Patterns:**
- `*` - Single level wildcard
- `**` - Recursive wildcard
- `{user}` - Template variable (replaced at runtime)

**Examples:**
```bash
read:~log/nginx/**                           # Read nginx logs (recursive)
write:~/data/{user}/docs/**                  # Write to user docs
list:~data/**;read:~data/**                  # Compound (multiple operations)
delete:~/data/users/*                        # Delete users (single level)
exec:~/data/projects/app/**                  # Execute in project directory
```

**Capability expansion (roles → capabilities):**
```bash
# From PData roles.csv
admin → cap:system:admin
user → cap:data:userspace;cap:home:basic
dev → cap:data:userspace;cap:home:basic;cap:projects:access

# From PData capabilities.csv
cap:home:basic → list:~/data/{user}/**;read:~/data/{user}/**;write:~/data/{user}/**
cap:system:admin → list:~system/**;read:~system/**;write:~system/**
```

---

## Complete Examples

### Example 1: View Remote Nginx Logs

**Declaration:**
```bash
declare_action "show_nginx_logs" \
    "verb=show" \
    "noun=nginx_logs" \
    "requires=read:~log/nginx/**" \
    "resource=ssh://root@prod/var/log/nginx/access.log" \
    "routes=@tui[content],@nginx[access_log],@app[stdout]"
```

**Execution flow:**
```bash
ENV:PROD × MODE:Monitor → show:nginx_logs
                        ↓
        [1. Validate capability: read:~log/nginx/**] ✓
                        ↓
        [2. Resolve resource: ssh://root@prod/...] ✓
                        ↓
        [3. Execute: ssh tail -n 50 access.log] ✓
                        ↓
        [4. Route output:]
            → @tui[content]       # Display in TUI
            → @nginx[access_log]  # Store at module endpoint
            → @app[stdout]        # Publish to firehose
```

**Visual output:**
```
┌─────────────────────────────────────────────────────────┐
│ TUI Framework | PROD × Monitor                          │
│ Env: APP [DEV]                                          │
│ Mode: Learn Try [Test]                                  │
│ Action: [show:nginx_logs] :: @tui[content],@nginx[...] │
├─────────────────────────────────────────────────────────┤
│ 🔍 Remote Nginx Logs (PROD)                            │
│ ────────────────────────────────────────────────────── │
│                                                          │
│ 192.168.1.1 - - [03/Oct/2025:14:23:45] GET /health 200│
│ 192.168.1.2 - - [03/Oct/2025:14:23:46] GET /api/data │
│ 192.168.1.3 - - [03/Oct/2025:14:23:47] POST /login   │
│ 192.168.1.4 - - [03/Oct/2025:14:23:48] GET /users    │
│                                                          │
│ Module: @nginx[access_log]                              │
│ Endpoint: /var/log/nginx/access.log                     │
│ Resource: ssh://root@prod/var/log/nginx/access.log     │
├─────────────────────────────────────────────────────────┤
│ Capability: read:~log/nginx/** ✓ | View: content       │
└─────────────────────────────────────────────────────────┘
```

---

### Example 2: Execute Deployment Pipeline

**Declaration:**
```bash
declare_action "execute_deployment" \
    "verb=execute" \
    "noun=deployment" \
    "requires=write:~/data/deploy/runs/**;exec:~/data/projects/**" \
    "resource=file://$DEPLOY_RUNS_DIR/{run_id}/output.log" \
    "routes=@tui[content],@deploy[run_log],@app[stdout]"
```

**Execution flow:**
```bash
ENV:STAGING × MODE:Deploy → execute:deployment
                           ↓
        [1. Validate capabilities:]
            write:~/data/deploy/runs/** ✓
            exec:~/data/projects/** ✓
                           ↓
        [2. Resolve resource:]
            file://$DEPLOY_RUNS_DIR/1234567/output.log
                           ↓
        [3. Execute pipeline stages:]
            → Pull env file from source
            → Push env file to target
            → Merge code (git)
            → Build application (npm)
            → Restart services (systemd)
                           ↓
        [4. Stream output live:]
            → @tui[content]      # Live display
            → @deploy[run_log]   # Persistent log
            → @app[stdout]       # Event stream
```

**Visual output (live streaming):**
```
┌─────────────────────────────────────────────────────────┐
│ TUI Framework | STAGING × Deploy                        │
│ Action: [execute:deployment] (3/8)                      │
├─────────────────────────────────────────────────────────┤
│ 🚀 Deployment Pipeline - Run ID: 1234567               │
│ ────────────────────────────────────────────────────── │
│                                                          │
│ [✓] Step 1: Pull env file from source                  │
│ [✓] Step 2: Push env file to target                    │
│ [→] Step 3: Merge code                                  │
│     Checking out staging branch...                      │
│     Pulling latest changes...                           │
│     Merge complete: 3 files changed                     │
│ [ ] Step 4: Build application                           │
│ [ ] Step 5: Restart services                            │
│                                                          │
│ Log: @deploy[run_log] → /tetra/deploy/runs/1234567/... │
├─────────────────────────────────────────────────────────┤
│ Capabilities: write:~/data/deploy/** + exec:~/data/... │
└─────────────────────────────────────────────────────────┘
```

---

### Example 3: Configuration at Distance

**Scenario:** View remote config file from local machine (monitor remote, execute local)

**Declaration:**
```bash
declare_action "show_remote_config" \
    "verb=show" \
    "noun=remote_config" \
    "requires=read:~/data/staging/config/**" \
    "resource=ssh://staging@host/home/staging/app/config.toml" \
    "routes=@tui[content],@app[stdout]"
```

**Execution flow:**
```bash
ENV:STAGING × MODE:Monitor → show:remote_config
                            ↓
        [LOCAL context, REMOTE resource]
                            ↓
        [1. Validate: read:~/data/staging/config/**] ✓
                            ↓
        [2. Resolve: ssh://staging@host/...] ✓
                            ↓
        [3. Execute locally:]
            ssh staging@host cat /home/staging/app/config.toml
                            ↓
        [4. Display result locally in @tui[content]]
```

**Visual output:**
```
┌─────────────────────────────────────────────────────────┐
│ TUI Framework | STAGING × Monitor                       │
│ Action: [show:remote_config]                            │
├─────────────────────────────────────────────────────────┤
│ 📄 Remote Configuration (Staging)                       │
│ ────────────────────────────────────────────────────── │
│                                                          │
│ [server]                                                │
│ port = 3000                                             │
│ host = "0.0.0.0"                                        │
│                                                          │
│ [database]                                              │
│ url = "postgresql://staging-db/app"                     │
│ pool_size = 10                                          │
│                                                          │
│ [logging]                                               │
│ level = "info"                                          │
│ format = "json"                                         │
│                                                          │
│ Resource: ssh://staging@host/home/staging/app/config...│
│ Mode: Configuration at Distance (view remote, exec loc) │
├─────────────────────────────────────────────────────────┤
│ Capability: read:~/data/staging/config/** ✓             │
└─────────────────────────────────────────────────────────┘
```

---

## Variable Naming Conventions

### Operator Constants
```bash
# Define once, use everywhere
CROSS_OP="×"           # Context composition: ENV_CROSS_MODE
FLOW_OP="→"            # Execution flow: ACTION_FLOW_TARGET
ROUTE_OP="@"           # Target routing: STREAM_AT_COMPONENT
ENDPOINT_OP="::"       # Resource binding: COMPONENT_BIND_RESOURCE
PAIR_SEP=":"           # Action pairing: VERB_PAIR_NOUN
```

### Action Declarations
```bash
# Associative array per action
declare -A ACTION_{action_name}=(
    [verb]="..."
    [noun]="..."
    [requires]="..."
    [resource]="..."
    [routes]="..."
)

# Example
declare -A ACTION_show_logs
declare -A ACTION_execute_deployment
declare -A ACTION_configure_app
```

### Module Endpoints
```bash
# Registry of module-specific storage
declare -A MODULE_ENDPOINTS=(
    [@nginx[access_log]]="/var/log/nginx/access.log"
    [@nginx[error_log]]="/var/log/nginx/error.log"
    [@deploy[run_log]]='$DEPLOY_RUNS_DIR/${RUN_ID}/output.log'
    [@deploy[state]]='$DEPLOY_RUNS_DIR/${RUN_ID}/state.json'
)
```

### TUI Component Buffers
```bash
# Separate buffers for each TUI component
declare -A TUI_BUFFERS=(
    [@tui[header]]=""
    [@tui[content]]=""
    [@tui[cli]]=""
    [@tui[footer]]=""
)

# Update buffer
route_to_tui() {
    local component="$1"
    local output="$2"
    TUI_BUFFERS["$component"]="$output"
}
```

### App Streams
```bash
# Virtual streams (real stdio renders TUI)
declare -a APP_STDOUT_STREAM=()
declare -a APP_STDERR_STREAM=()
declare -A APP_EVENT_BUS=()

# Publish to stream
route_to_app_stream() {
    local stream="$1"
    local output="$2"

    case "$stream" in
        "@app[stdout]")
            APP_STDOUT_STREAM+=("$output")
            ;;
        "@app[events]")
            # Publish to event bus
            ;;
    esac
}
```

---

## Execution Pipeline (5 Steps)

Every action execution follows this pipeline:

### Step 1: Validate Capabilities
```bash
validate_capability() {
    local user="$1"
    local required_cap="$2"

    # Parse capability: "read:~log/nginx/**"
    local operation="${required_cap%%:*}"
    local path="${required_cap#*:}"

    # Check against user's token capabilities
    # (In real implementation, this would call PData's authSrv.tokenHasCap)
    case "$user:$operation:$path" in
        "admin:read:~log/"*) return 0 ;;
        "user:read:~/data/{user}/"*) return 0 ;;
        *) return 1 ;;
    esac
}
```

### Step 2: Resolve Resource
```bash
resolve_resource() {
    local resource_uri="$1"
    local context="$2"  # e.g., "PROD:Monitor"

    # Parse URI scheme
    local scheme="${resource_uri%%://*}"
    local path="${resource_uri#*://}"

    case "$scheme" in
        ssh)
            # ssh://root@prod/var/log/nginx/access.log
            local user_host="${path%%/*}"
            local remote_path="/${path#*/}"
            echo "ssh:$user_host:$remote_path"
            ;;
        file)
            # file:///etc/app.conf or file://$VAR/path
            local file_path="${path#//}"
            # Expand variables in path
            eval echo "file:$file_path"
            ;;
        *)
            echo "unknown:$resource_uri"
            ;;
    esac
}
```

### Step 3: Execute Action
```bash
execute_action_impl() {
    local resolved_resource="$1"

    case "$resolved_resource" in
        ssh:*)
            # Execute via SSH
            local spec="${resolved_resource#ssh:}"
            local user_host="${spec%%:*}"
            local remote_path="${spec#*:}"
            ssh "$user_host" "cat $remote_path"
            ;;
        file:*)
            # Read local file
            local file_path="${resolved_resource#file:}"
            cat "$file_path"
            ;;
        proc:*)
            # Execute process
            local command="${resolved_resource#proc:}"
            eval "$command"
            ;;
    esac
}
```

### Step 4: Route Output
```bash
route_output() {
    local routes="$1"
    local output="$2"

    IFS=',' read -ra route_list <<< "$routes"
    for route in "${route_list[@]}"; do
        case "$route" in
            @tui[*])
                route_to_tui "$route" "$output"
                ;;
            @nginx[*]|@deploy[*])
                local endpoint=$(resolve_module_endpoint "$route")
                echo "$output" > "$endpoint"
                ;;
            @app[*])
                route_to_app_stream "$route" "$output"
                ;;
        esac
    done
}
```

### Step 5: Render TUI
```bash
render_tui() {
    clear

    # Render header
    echo "${TUI_BUFFERS[@tui[header]]}"

    # Render content
    echo "${TUI_BUFFERS[@tui[content]]}"

    # Render CLI (if visible)
    [[ "$TUI_CLI_VISIBLE" == "true" ]] && echo "${TUI_BUFFERS[@tui[cli]]}"

    # Render footer
    echo "${TUI_BUFFERS[@tui[footer]]}"
}
```

---

## File Structure Standards

Each demo follows this structure:

```
demo/basic/{NNN}/
├── CLAUDE.md           # Demo-specific context and notes
├── tui.conf            # ENV_VAR configuration (design tokens)
├── action_registry.sh  # Action declarations (declarative)
├── router.sh           # Routing logic (optional, if complex)
├── demo.sh             # Main executable (execution)
├── modules/            # Optional module implementations
│   ├── {module}.sh
│   └── registry.sh
└── examples/           # Optional usage examples
    └── {scenario}.sh
```

**Conventions:**
- `tui.conf` - Pure ENV_VAR exports, no logic
- `action_registry.sh` - Declarative only (declare -A)
- `demo.sh` - Executable with main() entry point
- Module files - Self-contained, register endpoints
- All scripts use `#!/usr/bin/env bash`

---

## Success Criteria

### Functional Requirements
- ✅ Clean operator semantics (`::`, `→`, `×`, `@`)
- ✅ Clear separation: declaration vs execution
- ✅ Multi-layer routing (TUI/Module/Stream)
- ✅ PData capability integration
- ✅ Remote resource binding (SSH, files)
- ✅ Module endpoint resolution
- ✅ Template variable expansion (`{user}`, `{run_id}`)

### Design Requirements
- ✅ HTML/CSS generation readiness (ENV_VAR driven)
- ✅ Modular architecture (reusable in bash/tview)
- ✅ Consistent naming conventions
- ✅ Self-documenting code structure

### Example Coverage
- ✅ Local file operations
- ✅ Remote SSH operations
- ✅ Configuration at distance
- ✅ Multi-stage pipelines
- ✅ Real-time streaming output
- ✅ Capability validation (allow/deny)

---

## Integration Points

### With PData
```bash
# PData provides capability checking
authSrv.tokenHasCap(token, operation, path)

# TUI grammar uses PData syntax
requires="read:~log/nginx/**"

# Validation delegates to PData
if ! validate_capability "$user" "$requires"; then
    echo "Permission denied"
    return 1
fi
```

### With bash/deploy
```bash
# Deploy module registers endpoints
declare -A MODULE_ENDPOINTS=(
    [@deploy[run_log]]='$DEPLOY_RUNS_DIR/${RUN_ID}/output.log'
    [@deploy[state]]='$DEPLOY_RUNS_DIR/${RUN_ID}/state.json'
)

# Actions reference deploy endpoints
routes="@tui[content],@deploy[run_log]"

# Execution stores to module endpoint
route_output "$routes" "$output"
```

### With bash/tview
```bash
# Extract grammar library
source "$TETRA_SRC/demo/basic/015/grammar/operators.sh"
source "$TETRA_SRC/demo/basic/015/grammar/parser.sh"

# Use in tview
declare_action "show_tview_status" \
    "verb=show" \
    "noun=tview_status" \
    "routes=@tview[content]"
```

---

## Next Steps

### Immediate (Demos 012-015)
1. ✅ Finalize demo 012 with routing annotations
2. ⏳ Build demo 013 with module endpoints
3. ⏳ Add demo 014 with capability validation
4. ⏳ Complete demo 015 with full grammar system

### Integration (Post-demos)
5. Extract grammar into reusable library
6. Integrate with bash/tview
7. Add HTML/CSS code generation
8. Document API for module authors

### Extensions (Future)
9. Add type checking (stronger contracts)
10. Implement event bus (@app[events])
11. Add metrics collection (@app[metrics])
12. Create interactive action builder (TUI for grammar)

---

## Appendix: Quick Reference

### Operator Cheat Sheet
```
×  Cross product   ENV × MODE
:  Pairing         verb:noun
:: Contract        ACTION :: Type
→  Flow            ACTION → @target
@  Route           @component[tag]
```

### Common Patterns
```bash
# Local file read
show:config :: file:///etc/app.conf → @tui[content]

# Remote SSH
show:logs :: ssh://user@host/path → @tui[content],@module[tag]

# With capability
show:secrets :: requires [read:~log/**] :: file://... → @tui[content]

# Multi-route
execute:deploy :: @tui[content],@deploy[log],@app[stdout]
```

### PData Capability Examples
```
read:~log/**                    # System logs
write:~/data/{user}/**          # User home
list:~data/projects/**          # List projects
exec:~/data/projects/app/**     # Execute in project
delete:~/data/temp/*            # Delete temp files
```

---

**Document Version:** 1.0
**Last Updated:** 2025-10-03
**Author:** TUI Grammar Working Group
**Status:** Planning → Implementation
