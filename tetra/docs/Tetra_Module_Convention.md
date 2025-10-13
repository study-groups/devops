# Tetra Module Convention

**Version:** 1.0
**Reference Implementation:** `bash/watchdog/`
**Status:** Established

## Overview

The Tetra Module Convention defines how Tetra modules integrate with TUI applications (specifically demo 014) through action-based discovery. This enables:

1. **Auto-discovery** - TUI finds module actions automatically
2. **Context filtering** - Actions appear in appropriate execution contexts
3. **Mode filtering** - Actions filtered by operation mode (Inspect/Transfer/Execute)
4. **TES metadata** - All actions declare routing and execution semantics

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

### Operation Modes

| Mode | Meaning | Allowed Operations |
|------|---------|-------------------|
| `Inspect` | Read-only | View configs, check status, read logs |
| `Transfer` | File operations | Fetch/push files, sync directories |
| `Execute` | Command execution | Run commands, restart services |

### Filtering Logic

Actions are displayed when:
- Current context is in action's `contexts` list
- Current mode is in action's `modes` list

Example:
```bash
declare_action "monitor_system" \
    "contexts=Local" \              # Only in Local context
    "modes=Inspect"                 # Only in Inspect mode

# Appears in: Local × Inspect
# Hidden in: Local × Execute, Dev × Inspect, etc.
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

- **1.0** (2025-10-12) - Initial convention established with watchdog module
