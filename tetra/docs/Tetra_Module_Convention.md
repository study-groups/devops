# Tetra Module Convention

**Version:** 2.0
**TCS Version:** 3.0
**Reference Implementation:** `bash/watchdog/`, `bash/vox/`
**Status:** Canonical

---

## Related Documentation
- [Tetra Core Specification](Tetra_Core_Specification.md) - Foundational concepts (TCS 3.0)
- [TES SSH Extension](TES_SSH_Extension.md) - SSH deployment specifics
- [TES Storage Extension](TES_Storage_Extension.md) - Cloud storage integration

---

## Overview

The Tetra Module Convention defines how Tetra modules integrate with TUI applications (specifically demo 014) and comply with [TCS 3.0](Tetra_Core_Specification.md). This enables:

1. **Auto-discovery** - TUI finds module actions automatically
2. **Context filtering** - Actions appear in appropriate execution contexts
3. **Mode filtering** - Mode = List[Module], defining which modules are active
4. **TES metadata** - All actions declare routing and execution semantics with `::`
5. **Database pattern** - Timestamp-based primary keys for module data

## Module Structure

### Required Files

```
bash/<module>/
├── includes.sh                # Module entry point
├── <module>.sh                # Core functionality
├── actions.sh                 # TUI integration (REQUIRED for discovery)
└── README.md                  # Module documentation
```

### Optional Files

```
bash/<module>/
├── core/                      # Core components
├── helpers/                   # Helper functions
└── tests/                     # Module tests
```

## Action Declaration Pattern

### File: `bash/<module>/actions.sh`

```bash
#!/usr/bin/env bash

# Import module functionality
source "$(dirname "${BASH_SOURCE[0]}")/<module>.sh"

# Register actions with TUI
<module>_register_actions() {
    # Ensure declare_action exists (from demo 014)
    if ! declare -f declare_action >/dev/null 2>&1; then
        echo "Warning: declare_action not available" >&2
        return 1
    fi

    # Declare actions using demo 014's pattern
    declare_action "<action_name>" \
        "verb=<verb>" \
        "noun=<noun>" \
        "exec_at=@local" \
        "source_at=@{context}" \
        "contexts=Local,Dev,Staging,Production" \
        "modes=Inspect,Transfer,Execute" \
        "tes_operation=read|write|execute|local" \
        "immediate=true|false" \
        "inputs=param1,param2" \
        "effects=@{context}[/path/to/file]" \
        "can=What this action can do" \
        "cannot=What this action cannot do"
}

# Execute actions
<module>_execute_action() {
    local action="$1"
    shift
    local args=("$@")

    case "$action" in
        <verb>:<noun>)
            # Implementation
            ;;
        *)
            echo "Unknown action: $action"
            return 1
            ;;
    esac
}

# Export for discovery
export -f <module>_register_actions
export -f <module>_execute_action
```

## Action Metadata

### Required Fields

| Field | Description | Example |
|-------|-------------|---------|
| `verb` | Action verb | `monitor`, `trace`, `deploy` |
| `noun` | Action noun | `system`, `url`, `config` |
| `exec_at` | Where command runs | `@local`, `@{context}` |
| `contexts` | Valid execution contexts (CSV) | `Local,Dev,Staging` |
| `modes` | Valid operation modes (CSV) | `Inspect,Transfer,Execute` |
| `tes_operation` | TES operation type | `read`, `write`, `execute`, `local` |

### Optional Fields

| Field | Description | Example |
|-------|-------------|---------|
| `source_at` | Where data comes from | `@{context}`, `@local` |
| `target_at` | Where data goes to | `@{context}`, `@local` |
| `inputs` | Required parameters | `url,nginx_path` |
| `effects` | Side effects | `@local[~/Downloads/]` |
| `immediate` | Execute without confirmation | `true`, `false` |
| `can` | Capabilities description | `Show system metrics` |
| `cannot` | Limitations description | `Cannot modify state` |

## Context and Mode Filtering

### Execution Contexts

| Context | Meaning | Use Case |
|---------|---------|----------|
| `HELP` | Meta-environment | Explanatory actions only |
| `Local` | Local machine | Local operations, no SSH |
| `Dev` | Development server | Full access, testing |
| `Staging` | Pre-production | Read-heavy, controlled writes |
| `Production` | Live systems | Read-only, emergency writes |

### Mode Definition (TCS 3.0)

**Important**: In TCS 3.0, Mode is defined as **List[Module]**, NOT an enum.

```bash
Mode = List[Module]

# Examples:
Mode = [vox, qa]           # Audio and Q&A tools active
Mode = [deploy, tkm]       # Deployment and key management
Mode = [watchdog]          # Monitoring only
```

**Legacy Support**: For backward compatibility with demo 014, the old mode names (Inspect, Transfer, Execute) are still supported in action metadata, but they are being phased out in favor of module-based modes.

### Context Algebra (TCS 3.0)

```bash
Context = Environment × Mode
        = Environment × List[Module]

# Functor: Context → Actions
F: (Environment, Mode) ↦ Set[FullyQualifiedAction]

# Example:
F(Local, [vox, qa]) = {
  vox.play, vox.generate, vox.list,
  qa.query, qa.answer, qa.search
}
```

### Filtering Logic

Actions are displayed when:
- Current environment is in action's `contexts` list
- Action's module is in the active Mode list (or legacy mode matches)

Example:
```bash
declare_action "monitor_system" \
    "contexts=Local" \              # Only in Local context
    "modes=Inspect"                 # Legacy mode support

# Appears in: Local × [watchdog] (when watchdog module active)
# Hidden in: Local × [vox, qa], Dev × [watchdog]
```

## TES (Tetra Endpoint Specification)

### TES Operations

| Operation | Meaning | Example |
|-----------|---------|---------|
| `local` | Pure local execution | System monitoring |
| `read` | Read from remote | Fetch config file |
| `write` | Write to remote | Push config file |
| `execute` | Run remote command | SSH command execution |

### TES Routing

| Field | Description | Example |
|-------|-------------|---------|
| `exec_at` | Where command runs | `@local` (always local for now) |
| `source_at` | Where data originates | `@{context}`, `@dev`, `@local` |
| `target_at` | Where data is written | `@{context}`, `@staging`, `@local` |

### Context Substitution

`@{context}` resolves to current environment:
- `Local` → `@local`
- `Dev` → `@dev`
- `Staging` → `@staging`
- `Production` → `@production`

## Module Database Pattern (TCS 3.0)

### Overview

All tetra modules MUST follow the TCS 3.0 database pattern for persistent data storage. This ensures consistency across modules and enables cross-module correlation.

### Directory Structure

```
$TETRA_DIR/<module>/
├── db/                   # Primary key database (REQUIRED)
│   └── {timestamp}.ext   # Timestamp-based files
├── config/               # Module configuration
├── logs/                 # Module-specific logs
└── cache/                # Optional content-addressed cache
```

### Primary Key Convention

**Rule**: All database files use Unix timestamp as primary key (1-second resolution).

**Format**: `{timestamp}.{extension}` or `{timestamp}.{module}.{variant}.{extension}`

**Examples**:
```bash
# QA module
1760229927.answer
1760229927.prompt

# VOX module
1760229927.vox.sally.mp3
1760229927.vox.sally.meta
1760229927.vox.sally.spans

# RAG module
1760229927.chunk
1760229927.index
```

**Guarantee**: No collisions - operations never start faster than 1-second intervals.

### Required Path Functions

Every module MUST implement these functions in a `<module>_paths.sh` file:

```bash
# Module source (strong global)
: "${MOD_SRC:=$TETRA_SRC/bash/<module>}"

# Module runtime directory
: "${MOD_DIR:=$TETRA_DIR/<module>}"

# Database directory
mod_get_db_dir() {
    echo "$MOD_DIR/db"
}

# Timestamp generation
mod_generate_timestamp() {
    date +%s
}

# Timestamped path construction
mod_get_db_path() {
    local timestamp="$1"
    local extension="$2"
    echo "$(mod_get_db_dir)/${timestamp}.${extension}"
}
```

### Example: VOX Module Implementation

```bash
# bash/vox/vox_paths.sh

: "${VOX_SRC:=$TETRA_SRC/bash/vox}"
: "${VOX_DIR:=$TETRA_DIR/vox}"

vox_get_db_dir() {
    echo "$VOX_DIR/db"
}

vox_get_db_audio_path() {
    local timestamp="$1"
    local voice="$2"
    echo "$(vox_get_db_dir)/${timestamp}.vox.${voice}.mp3"
}

vox_generate_timestamp() {
    date +%s
}
```

### Cross-Module Correlation

**Rule**: When processing content from another module, preserve the original timestamp as primary key.

```bash
# QA generates answer
qa.query "question"
# → Creates: $QA_DIR/db/1760229927.answer

# VOX processes QA answer
vox play @qa:1760229927 sally
# → Creates: $VOX_DIR/db/1760229927.vox.sally.mp3
#            (same timestamp!)

# Find all resources related to timestamp 1760229927
find $TETRA_DIR -name "1760229927.*"
# Output:
# ~/tetra/qa/db/1760229927.answer
# ~/tetra/vox/db/1760229927.vox.sally.mp3
# ~/tetra/vox/db/1760229927.vox.sally.meta
```

### Type Contracts with `::`

Every module action MUST declare its type contract using the `::` operator (see [TCS 3.0](Tetra_Core_Specification.md#6-type-contracts-with-)):

```bash
# VOX module contracts
vox.play :: (@qa:timestamp, voice:string) → Audio[stdout]
  where Effect[cache, log]

vox.generate :: (voice:string, text:stdin) → @vox:timestamp.voice.mp3
  where Effect[cache, log, metadata]

vox.list :: ([filter:string]) → Text[stdout]
  where Effect[read]
```

## Discovery System

### Module Discovery

Demo 014 discovers modules by:
1. Scanning `$TETRA_SRC/bash/*/actions.sh`
2. Sourcing each `actions.sh` file
3. Calling `<module>_register_actions()` if it exists
4. Storing module in `DISCOVERED_MODULES` array

### Action Execution

When user executes an action:
1. Demo checks if action has `contexts`/`modes` metadata
2. If yes → routes to `execute_module_action()`
3. Finds owning module
4. Calls `<module>_execute_action(action, args...)`

## Example: Watchdog Module

### Directory Structure

```
bash/watchdog/
├── watchdog.sh               # System monitoring core
├── remote.sh                 # Infrastructure tracing
├── includes.sh               # Module entry point
├── actions.sh                # TUI integration ← KEY FILE
└── README.md                 # Documentation
```

### Action Declarations

```bash
# bash/watchdog/actions.sh

watchdog_register_actions() {
    # Local system monitoring
    declare_action "monitor_system" \
        "verb=monitor" "noun=system" \
        "exec_at=@local" \
        "source_at=@local" \
        "contexts=Local" \
        "modes=Inspect" \
        "tes_operation=read"

    # Remote infrastructure tracing
    declare_action "trace_url" \
        "verb=trace" "noun=url" \
        "exec_at=@local" \
        "source_at=@{context}" \
        "contexts=Dev,Staging,Production" \
        "modes=Inspect" \
        "tes_operation=read" \
        "inputs=url,nginx_path"
}

watchdog_execute_action() {
    local action="$1"
    shift

    case "$action" in
        monitor:system)
            system_summary
            ;;
        trace:url)
            source "$WATCHDOG_ACTIONS_DIR/remote.sh"
            "$WATCHDOG_ACTIONS_DIR/remote.sh" "$@"
            ;;
    esac
}
```

### Integration Result

**Local × Inspect:**
- `monitor:system` appears automatically

**Dev × Inspect:**
- `trace:url` appears automatically

**Staging × Execute:**
- No watchdog actions (no matches)

## Creating a New Module

### Step 1: Create Module Structure

```bash
mkdir -p bash/mymodule
touch bash/mymodule/mymodule.sh
touch bash/mymodule/includes.sh
touch bash/mymodule/actions.sh
touch bash/mymodule/README.md
```

### Step 2: Implement Core Functionality

```bash
# bash/mymodule/mymodule.sh
#!/usr/bin/env bash

mymodule_do_something() {
    echo "Doing something..."
}
```

### Step 3: Create Actions Integration

```bash
# bash/mymodule/actions.sh
#!/usr/bin/env bash

source "$(dirname "${BASH_SOURCE[0]}")/mymodule.sh"

mymodule_register_actions() {
    declare_action "do_something" \
        "verb=do" "noun=something" \
        "contexts=Local" \
        "modes=Execute" \
        "tes_operation=local"
}

mymodule_execute_action() {
    local action="$1"
    case "$action" in
        do:something)
            mymodule_do_something
            ;;
    esac
}

export -f mymodule_register_actions
export -f mymodule_execute_action
```

### Step 4: Test in Demo 014

```bash
cd demo/basic/014
./demo.sh

# Navigate to Local × Execute
# Your action should appear!
```

## Best Practices

### Action Naming

- **Verbs**: Use standard CRUD verbs: `show`, `view`, `status`, `fetch`, `push`, `sync`, `deploy`, `monitor`, `trace`
- **Nouns**: Be specific: `system`, `config`, `url`, `logs`, `service`
- **Format**: Always `verb:noun` (colon separator)

### Context Filtering

- **Local**: Actions that work offline, no network required
- **Dev**: Actions with write access, can modify state
- **Staging**: Read-heavy with controlled writes
- **Production**: Read-only, critical operations only

### Mode Filtering

- **Inspect**: Pure read operations, no side effects
- **Transfer**: File operations, network transfers
- **Execute**: Commands, service management, state changes

### Error Handling

```bash
mymodule_execute_action() {
    local action="$1"

    case "$action" in
        my:action)
            # Check prerequisites
            if [[ -z "$REQUIRED_VAR" ]]; then
                echo "Error: REQUIRED_VAR not set"
                return 1
            fi

            # Execute
            mymodule_function || {
                echo "Error: Operation failed"
                return 1
            }

            echo "Success!"
            ;;
    esac
}
```

## Future Enhancements

1. **Async Actions** - Background execution support
2. **Progress Tracking** - Long-running action progress
3. **Action Chaining** - Compose actions into workflows
4. **Parameter Prompting** - Interactive input for `inputs` field
5. **Action Dependencies** - Declare prerequisite actions

## References

- **Reference Implementation**: `bash/watchdog/actions.sh`
- **Discovery System**: `demo/basic/014/bash/actions/module_discovery.sh`
- **Demo Integration**: `demo/basic/014/demo.sh`
- **Action Registry**: `demo/basic/014/bash/actions/registry.sh`

## Version History

- **2.0** (2025-10-13) - TCS 3.0 compliance
  - Added TCS 3.0 references throughout
  - Fixed Mode definition (List[Module], not enum)
  - Added Module Database Pattern section
  - Added Type Contracts with `::` operator
  - Added cross-module correlation patterns
  - Updated reference implementations to include VOX
- **1.0** (2025-10-12) - Initial convention established with watchdog module
