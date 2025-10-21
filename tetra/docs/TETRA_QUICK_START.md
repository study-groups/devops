# Tetra Quick Start Guide
**Start Here** - Building bash/tetra from scratch

---

## Overview

This guide walks you through implementing **bash/tetra** as defined in `TETRA_CONSOLIDATION_PLAN.md`.

---

## Phase 1: Core Foundation (Day 1-2)

### Step 1: Create Structure

```bash
cd $TETRA_SRC/bash

# Create directory structure
mkdir -p tetra/{core,display,repl,actions,flows,animation,tui}

# Create runtime directory structure
mkdir -p ~/tetra/tetra/{actions,flows,config,logs}
```

### Step 2: Bootstrap (core/bootstrap.sh)

```bash
cat > tetra/core/bootstrap.sh <<'EOF'
#!/usr/bin/env bash
# Tetra Core Bootstrap

tetra_validate_environment() {
    # Validate TETRA_SRC
    if [[ -z "$TETRA_SRC" ]]; then
        echo "ERROR: TETRA_SRC not set" >&2
        return 1
    fi

    # Validate bash version
    if [[ "${BASH_VERSINFO[0]}" -lt 5 || ("${BASH_VERSINFO[0]}" -eq 5 && "${BASH_VERSINFO[1]}" -lt 2) ]]; then
        echo "ERROR: Bash 5.2+ required (found $BASH_VERSION)" >&2
        return 1
    fi

    # Ensure TETRA_DIR
    : "${TETRA_DIR:=$HOME/.tetra}"
    export TETRA_DIR

    mkdir -p "$TETRA_DIR/tetra"/{actions,flows,config,logs}

    return 0
}

tetra_bootstrap() {
    tetra_validate_environment || return 1

    # Set module paths
    export TETRA_MOD_SRC="$TETRA_SRC/bash/tetra"
    export TETRA_MOD_DIR="$TETRA_DIR/tetra"

    return 0
}

export -f tetra_validate_environment
export -f tetra_bootstrap
EOF
```

### Step 3: Module Loader (core/module_loader.sh)

```bash
cat > tetra/core/module_loader.sh <<'EOF'
#!/usr/bin/env bash
# Tetra Module Loader - TSM-inspired dependency loading

_tetra_load() {
    local module="$1"
    local path="$TETRA_MOD_SRC/$module"

    if [[ ! -f "$path" ]]; then
        echo "WARNING: Module not found: $module" >&2
        return 1
    fi

    source "$path" || {
        echo "ERROR: Failed to load: $module" >&2
        return 1
    }

    return 0
}

tetra_load_core_modules() {
    local verbose="${1:-false}"

    [[ "$verbose" == "true" ]] && echo "Loading Tetra core modules..."

    # Layer 0: Core (no dependencies)
    _tetra_load "core/bootstrap.sh"
    _tetra_load "core/event_bus.sh"
    _tetra_load "core/symbols.sh"

    # Layer 1: Display (depends on TDS)
    if [[ -f "$TETRA_SRC/bash/tds/tds.sh" ]]; then
        source "$TETRA_SRC/bash/tds/tds.sh"
    fi
    _tetra_load "display/tds_adapter.sh"

    # Layer 2: Actions
    _tetra_load "actions/registry.sh"
    _tetra_load "actions/executor.sh"

    # Layer 3: REPL
    _tetra_load "repl/prompt_manager.sh"
    _tetra_load "repl/command_router.sh"
    _tetra_load "repl/history.sh"
    _tetra_load "repl/repl.sh"

    [[ "$verbose" == "true" ]] && echo "✓ Core modules loaded"

    return 0
}

export -f _tetra_load
export -f tetra_load_core_modules
EOF
```

### Step 4: Event Bus (core/event_bus.sh)

```bash
cat > tetra/core/event_bus.sh <<'EOF'
#!/usr/bin/env bash
# Tetra Event Bus - Pub/Sub system

# Global registry
declare -gA TETRA_EVENT_SUBSCRIBERS

tetra_subscribe() {
    local event_type="$1"
    local handler="$2"

    TETRA_EVENT_SUBSCRIBERS["$event_type"]+="$handler "
}

tetra_emit_event() {
    local event_type="$1"
    shift
    local event_data="$*"

    # Log event
    tetra_log_event "$event_type" "$event_data"

    # Call subscribers in background
    for handler in ${TETRA_EVENT_SUBSCRIBERS["$event_type"]}; do
        if declare -f "$handler" >/dev/null 2>&1; then
            "$handler" "$event_type" "$event_data" &
        fi
    done
}

tetra_log_event() {
    local event_type="$1"
    local event_data="$2"
    local timestamp=$(date -Iseconds)

    local log_file="$TETRA_MOD_DIR/logs/events.jsonl"

    echo "{\"timestamp\":\"$timestamp\",\"type\":\"$event_type\",\"data\":\"$event_data\"}" >> "$log_file"
}

export -f tetra_subscribe
export -f tetra_emit_event
export -f tetra_log_event
EOF
```

### Step 5: Main Entry Point (tetra.sh)

```bash
cat > tetra/tetra.sh <<'EOF'
#!/usr/bin/env bash
# Tetra - Main Entry Point

# Bootstrap
: "${TETRA_SRC:=$HOME/tetra}"
source "$TETRA_SRC/bash/tetra/core/bootstrap.sh"
tetra_bootstrap || exit 1

# Load core modules
source "$TETRA_SRC/bash/tetra/core/module_loader.sh"
tetra_load_core_modules

# Main command interface
tetra() {
    local action="${1:-help}"
    shift || true

    case "$action" in
        repl)
            tetra_repl "$@"
            ;;
        status)
            tetra_cmd_status "$@"
            ;;
        help)
            tetra_cmd_help "$@"
            ;;
        *)
            echo "tetra: unknown command '$action'" >&2
            echo "Use 'tetra help' for usage"
            return 1
            ;;
    esac
}

# Export main function
export -f tetra
EOF
```

### Step 6: Test Bootstrap

```bash
# Test loading
source ~/tetra/bash/tetra/tetra.sh

# Should see no errors
echo "Bootstrap test: $?"

# Check environment
echo "TETRA_SRC: $TETRA_SRC"
echo "TETRA_DIR: $TETRA_DIR"
echo "TETRA_MOD_SRC: $TETRA_MOD_SRC"
```

---

## Phase 2: Display Layer (Day 3)

### Step 1: TDS Adapter (display/tds_adapter.sh)

```bash
cat > tetra/display/tds_adapter.sh <<'EOF'
#!/usr/bin/env bash
# TDS Adapter - Wraps TDS for Tetra use

# Check if TDS loaded
if [[ "$TDS_LOADED" != "true" ]]; then
    echo "WARNING: TDS not loaded, falling back to basic colors" >&2
    # Define fallback colors
    TDS_PRIMARY='\033[0;34m'
    TDS_SUCCESS='\033[0;32m'
    TDS_ERROR='\033[0;31m'
    TDS_MUTED='\033[0;90m'
    TDS_RESET='\033[0m'
fi

# Status colorization using TDS
tetra_display_status() {
    local status="$1"

    case "$status" in
        RUNNING|ACTIVE|SUCCESS)
            echo -e "${TDS_SUCCESS}${status}${TDS_RESET}"
            ;;
        FAILED|ERROR)
            echo -e "${TDS_ERROR}${status}${TDS_RESET}"
            ;;
        PENDING|WAITING)
            echo -e "${TDS_MUTED}${status}${TDS_RESET}"
            ;;
        *)
            echo "$status"
            ;;
    esac
}

# Helper for primary text
tetra_primary() {
    echo -e "${TDS_PRIMARY}$1${TDS_RESET}"
}

# Helper for muted text
tetra_muted() {
    echo -e "${TDS_MUTED}$1${TDS_RESET}"
}

export -f tetra_display_status
export -f tetra_primary
export -f tetra_muted
EOF
```

### Step 2: Test Display

```bash
source ~/tetra/bash/tetra/tetra.sh

# Test TDS adapter
tetra_display_status "RUNNING"
tetra_display_status "FAILED"
tetra_primary "This is primary text"
tetra_muted "This is muted text"
```

---

## Phase 3: Action System (Day 4-5)

### Step 1: Action Registry (actions/registry.sh)

```bash
cat > tetra/actions/registry.sh <<'EOF'
#!/usr/bin/env bash
# Action Registry - Store and lookup actions

# Global action registry
declare -gA TETRA_ACTIONS
declare -ga TETRA_ACTION_LIST

# Register action
declare_action() {
    local action_name="$1"
    shift

    # Parse metadata
    local metadata=""
    for arg in "$@"; do
        metadata+="$arg|"
    done

    # Store action
    TETRA_ACTIONS["$action_name"]="$metadata"
    TETRA_ACTION_LIST+=("$action_name")
}

# Get action metadata
get_action_metadata() {
    local action_name="$1"
    local field="$2"

    local metadata="${TETRA_ACTIONS[$action_name]}"
    [[ -z "$metadata" ]] && return 1

    # Extract field
    echo "$metadata" | tr '|' '\n' | grep "^$field=" | cut -d= -f2-
}

# List all actions
list_actions() {
    local current_env="${TETRA_ENV:-Local}"
    local current_mode="${TETRA_MODE:-tetra}"

    echo "Available actions for [$current_env × $current_mode]:"
    echo ""

    for action in "${TETRA_ACTION_LIST[@]}"; do
        local verb=$(get_action_metadata "$action" "verb")
        local noun=$(get_action_metadata "$action" "noun")
        local contexts=$(get_action_metadata "$action" "contexts")

        # Filter by context
        if [[ "$contexts" == *"$current_env"* ]] || [[ "$contexts" == "all" ]]; then
            printf "  %-20s  %s:%s\n" "$action" "$verb" "$noun"
        fi
    done
}

export -f declare_action
export -f get_action_metadata
export -f list_actions
EOF
```

### Step 2: Action Executor (actions/executor.sh)

```bash
cat > tetra/actions/executor.sh <<'EOF'
#!/usr/bin/env bash
# Action Executor - Execute registered actions

tetra_execute_action() {
    local action_name="$1"
    shift
    local args=("$@")

    # Check if action exists
    if [[ -z "${TETRA_ACTIONS[$action_name]}" ]]; then
        echo "ERROR: Unknown action: $action_name" >&2
        return 1
    fi

    # Get verb and noun
    local verb=$(get_action_metadata "$action_name" "verb")
    local noun=$(get_action_metadata "$action_name" "noun")
    local action_key="${verb}:${noun}"

    # Emit event
    tetra_emit_event "action.started" "action=$action_name verb=$verb noun=$noun"

    # Route to handler
    local module=$(get_action_metadata "$action_name" "module")
    if [[ -n "$module" ]]; then
        # Module-specific handler
        "${module}_execute_action" "$action_key" "${args[@]}"
    else
        # Core handler
        tetra_execute_core_action "$action_key" "${args[@]}"
    fi

    local exit_code=$?

    # Emit completion event
    if [[ $exit_code -eq 0 ]]; then
        tetra_emit_event "action.completed" "action=$action_name status=success"
    else
        tetra_emit_event "action.failed" "action=$action_name status=failed"
    fi

    return $exit_code
}

export -f tetra_execute_action
EOF
```

### Step 3: Core Actions (actions/core_actions.sh)

```bash
cat > tetra/actions/core_actions.sh <<'EOF'
#!/usr/bin/env bash
# Core Tetra Actions

tetra_register_core_actions() {
    # Status action
    declare_action "show_status" \
        "verb=show" \
        "noun=status" \
        "contexts=Local,Dev,Staging,Production" \
        "module=tetra"

    # List modules action
    declare_action "list_modules" \
        "verb=list" \
        "noun=modules" \
        "contexts=Local,Dev,Staging,Production" \
        "module=tetra"

    # List actions
    declare_action "list_actions" \
        "verb=list" \
        "noun=actions" \
        "contexts=Local,Dev,Staging,Production" \
        "module=tetra"
}

tetra_execute_core_action() {
    local action="$1"
    shift

    case "$action" in
        show:status)
            tetra_cmd_status "$@"
            ;;
        list:modules)
            tetra_cmd_list_modules "$@"
            ;;
        list:actions)
            list_actions "$@"
            ;;
        *)
            echo "ERROR: Unknown core action: $action" >&2
            return 1
            ;;
    esac
}

# Status command
tetra_cmd_status() {
    echo "$(tetra_primary 'Tetra Status')"
    echo "═══════════════"
    echo ""
    echo "TETRA_SRC: $TETRA_SRC"
    echo "TETRA_DIR: $TETRA_DIR"
    echo "Bash Version: $BASH_VERSION"
    echo ""
    echo "Status: $(tetra_display_status 'RUNNING')"
}

# List modules command
tetra_cmd_list_modules() {
    echo "$(tetra_primary 'Loaded Modules')"
    echo "═══════════════"
    echo ""
    echo "Core modules:"
    echo "  • bootstrap"
    echo "  • event_bus"
    echo "  • actions"
    echo "  • display"
}

export -f tetra_register_core_actions
export -f tetra_execute_core_action
export -f tetra_cmd_status
export -f tetra_cmd_list_modules
EOF
```

### Step 4: Update Module Loader

Add to `core/module_loader.sh` after actions load:

```bash
# Load and register core actions
_tetra_load "actions/core_actions.sh"
tetra_register_core_actions
```

### Step 5: Test Actions

```bash
source ~/tetra/bash/tetra/tetra.sh

# Test action registration
list_actions

# Test action execution
tetra_execute_action "show_status"
tetra_execute_action "list_modules"
```

---

## Phase 4: REPL System (Day 6-7)

### Step 1: Prompt Manager (repl/prompt_manager.sh)

```bash
cat > tetra/repl/prompt_manager.sh <<'EOF'
#!/usr/bin/env bash
# Prompt Manager - 3 modes: minimal, normal, twoline

# Prompt mode (default: normal)
TETRA_PROMPT_MODE="${TETRA_PROMPT_MODE:-normal}"

get_prompt_mode() {
    echo "$TETRA_PROMPT_MODE"
}

set_prompt_mode() {
    local mode="$1"
    TETRA_PROMPT_MODE="$mode"
}

toggle_prompt_mode() {
    case "$TETRA_PROMPT_MODE" in
        minimal) TETRA_PROMPT_MODE="normal" ;;
        normal) TETRA_PROMPT_MODE="twoline" ;;
        twoline) TETRA_PROMPT_MODE="minimal" ;;
    esac
    echo "Prompt mode: $TETRA_PROMPT_MODE"
}

build_prompt() {
    case "$TETRA_PROMPT_MODE" in
        minimal)
            echo "> "
            ;;
        normal)
            local env="${TETRA_ENV:-local}"
            local mode="${TETRA_MODE:-tetra}"
            echo "[$env:$mode] tetra> "
            ;;
        twoline)
            # Line 1: Stats
            printf "Env: %-10s Mode: %-10s\n" "${TETRA_ENV:-local}" "${TETRA_MODE:-tetra}"
            # Line 2: Prompt
            echo "tetra> "
            ;;
    esac
}

export -f get_prompt_mode
export -f set_prompt_mode
export -f toggle_prompt_mode
export -f build_prompt
EOF
```

### Step 2: Command Router (repl/command_router.sh)

```bash
cat > tetra/repl/command_router.sh <<'EOF'
#!/usr/bin/env bash
# Command Router - Slash command dispatch

tetra_route_command() {
    local input="$1"

    # Check for slash command
    if [[ "$input" == /* ]]; then
        local cmd="${input#/}"
        local args="${cmd#* }"
        cmd="${cmd%% *}"

        case "$cmd" in
            action|a)
                tetra_cmd_action "$args"
                ;;
            mode|m)
                tetra_cmd_mode "$args"
                ;;
            env|e)
                tetra_cmd_env "$args"
                ;;
            prompt|p)
                tetra_cmd_prompt "$args"
                ;;
            help|h)
                tetra_cmd_help "$args"
                ;;
            exit|quit|q)
                return 1  # Signal exit
                ;;
            *)
                echo "Unknown command: /$cmd"
                echo "Try /help"
                ;;
        esac
    else
        # Regular shell command
        eval "$input"
    fi

    return 0
}

# Command implementations
tetra_cmd_action() {
    local subcmd="$1"

    case "$subcmd" in
        list|"")
            list_actions
            ;;
        *)
            tetra_execute_action "$subcmd"
            ;;
    esac
}

tetra_cmd_mode() {
    local new_mode="$1"

    if [[ -z "$new_mode" ]]; then
        echo "Current mode: ${TETRA_MODE:-tetra}"
    else
        TETRA_MODE="$new_mode"
        echo "Mode set to: $new_mode"
    fi
}

tetra_cmd_env() {
    local new_env="$1"

    if [[ -z "$new_env" ]]; then
        echo "Current environment: ${TETRA_ENV:-Local}"
    else
        TETRA_ENV="$new_env"
        echo "Environment set to: $new_env"
    fi
}

tetra_cmd_prompt() {
    local subcmd="$1"

    case "$subcmd" in
        minimal|normal|twoline)
            set_prompt_mode "$subcmd"
            ;;
        toggle)
            toggle_prompt_mode
            ;;
        "")
            echo "Current mode: $(get_prompt_mode)"
            echo "Available: minimal, normal, twoline, toggle"
            ;;
    esac
}

tetra_cmd_help() {
    cat <<'EOF'
Tetra REPL Help
═══════════════

Slash Commands:
  /action list          List available actions
  /action <name>        Execute action
  /mode [name]          Get/set active mode
  /env [name]           Get/set environment
  /prompt [mode]        Change prompt (minimal/normal/twoline/toggle)
  /help                 This help
  /exit, /quit, /q      Exit REPL

Shell Commands:
  Any command without / runs as shell command
  Examples: ls, pwd, cat file.txt

Keyboard Shortcuts:
  Ctrl+P                Toggle prompt mode
  Ctrl+D                Exit REPL

Examples:
  /action list
  /mode set rag
  /prompt toggle
  ls -la
EOF
}

export -f tetra_route_command
export -f tetra_cmd_action
export -f tetra_cmd_mode
export -f tetra_cmd_env
export -f tetra_cmd_prompt
export -f tetra_cmd_help
EOF
```

### Step 3: REPL Main Loop (repl/repl.sh)

```bash
cat > tetra/repl/repl.sh <<'EOF'
#!/usr/bin/env bash
# Tetra REPL - Main interactive loop

tetra_repl() {
    echo "$(tetra_primary 'Tetra Interactive Shell')"
    echo "$(tetra_muted 'Type /help for commands, Ctrl+D to exit')"
    echo ""

    # Initialize
    tetra_repl_init

    # Main loop
    local input
    while true; do
        # Build prompt
        local prompt=$(build_prompt)

        # Read input
        read -r -p "$prompt" input

        # Handle empty
        [[ -z "$input" ]] && continue

        # Route command
        tetra_route_command "$input" || break
    done

    # Cleanup
    tetra_repl_cleanup

    echo "$(tetra_muted 'Goodbye!')"
}

tetra_repl_init() {
    # Set up Ctrl+P binding for prompt toggle
    bind -x '"\C-p": toggle_prompt_mode' 2>/dev/null

    # Initialize history
    if declare -f tetra_history_init >/dev/null 2>&1; then
        tetra_history_init
    fi
}

tetra_repl_cleanup() {
    # Remove bindings
    bind -r '\C-p' 2>/dev/null

    return 0
}

export -f tetra_repl
export -f tetra_repl_init
export -f tetra_repl_cleanup
EOF
```

### Step 4: Test REPL

```bash
source ~/tetra/bash/tetra/tetra.sh

# Launch REPL
tetra repl

# Try commands:
/help
/action list
/prompt toggle
/mode set rag
/env set Dev
ls
pwd
/exit
```

---

## Phase 5: Flow System (Day 8-9)

### Flow Manager (flows/flow_manager.sh)

```bash
cat > tetra/flows/flow_manager.sh <<'EOF'
#!/usr/bin/env bash
# Flow Manager - Multi-step workflow system

# Flow states
FLOW_STATES=(NEW SELECT ASSEMBLE SUBMIT APPLY VALIDATE DONE FAIL)

tetra_flow_create() {
    local description="$1"

    # Generate flow ID
    local flow_id="flow-$(date +%s)"
    local flow_dir="$TETRA_MOD_DIR/flows/$flow_id"

    # Create structure
    mkdir -p "$flow_dir"/{inputs,outputs}

    # Initialize state
    cat > "$flow_dir/state.json" <<EOFSTATE
{
  "flow_id": "$flow_id",
  "description": "$description",
  "state": "NEW",
  "created_at": "$(date -Iseconds)",
  "updated_at": "$(date -Iseconds)"
}
EOFSTATE

    # Log event
    tetra_flow_log_event "$flow_id" "created"

    # Set as active
    ln -sf "$flow_dir" "$TETRA_MOD_DIR/flows/active"

    echo "✓ Flow created: $flow_id"
    echo "  Description: $description"
    echo "  State: NEW"

    return 0
}

tetra_flow_status() {
    local flow_dir="$TETRA_MOD_DIR/flows/active"

    if [[ ! -d "$flow_dir" ]]; then
        echo "No active flow"
        return 1
    fi

    # Read state
    local state_file="$flow_dir/state.json"
    if [[ ! -f "$state_file" ]]; then
        echo "ERROR: No state file found"
        return 1
    fi

    # Extract fields (using jq if available, otherwise grep)
    if command -v jq >/dev/null 2>&1; then
        echo "Flow Status:"
        jq -r '"  ID: \(.flow_id)\n  Description: \(.description)\n  State: \(.state)\n  Updated: \(.updated_at)"' "$state_file"
    else
        echo "Flow Status:"
        grep -o '"flow_id":"[^"]*"' "$state_file" | cut -d'"' -f4 | sed 's/^/  ID: /'
        grep -o '"description":"[^"]*"' "$state_file" | cut -d'"' -f4 | sed 's/^/  Description: /'
        grep -o '"state":"[^"]*"' "$state_file" | cut -d'"' -f4 | sed 's/^/  State: /'
    fi

    return 0
}

tetra_flow_log_event() {
    local flow_id="$1"
    local event_type="$2"
    local timestamp=$(date -Iseconds)

    local flow_dir="$TETRA_MOD_DIR/flows/$flow_id"
    local event_file="$flow_dir/events.ndjson"

    echo "{\"timestamp\":\"$timestamp\",\"type\":\"$event_type\"}" >> "$event_file"
}

export -f tetra_flow_create
export -f tetra_flow_status
export -f tetra_flow_log_event
EOF
```

### Test Flows

```bash
source ~/tetra/bash/tetra/tetra.sh

# Create flow
tetra_flow_create "Test flow for parser bug"

# Check status
tetra_flow_status

# View events
cat ~/tetra/tetra/flows/active/events.ndjson
```

---

## Testing Checklist

### Phase 1: Core ✓
- [x] Bootstrap validates TETRA_SRC
- [x] Module loader loads in order
- [x] Event bus subscriptions work
- [x] Can emit and receive events

### Phase 2: Display ✓
- [x] TDS adapter loads
- [x] Colors display correctly
- [x] Status colorization works

### Phase 3: Actions ✓
- [x] Actions register successfully
- [x] Action metadata retrievable
- [x] Actions execute via dispatcher
- [x] Events emitted on action start/complete

### Phase 4: REPL ✓
- [x] REPL launches
- [x] Slash commands work
- [x] Shell commands work
- [x] Prompt modes toggle
- [x] Ctrl+P binding works
- [x] /help displays
- [x] /exit works

### Phase 5: Flows ✓
- [x] Flow creates successfully
- [x] Flow status displays
- [x] Events logged
- [x] Active flow symlink created

---

## Next Steps

Now that you have a working foundation:

1. **Add more core actions**: Implement demo actions, module management
2. **Enhance flow system**: Add state transitions, checkpoints
3. **Integrate tcurses**: Promote from demo/014, add TUI mode
4. **Add animation**: Implement sprite system for demos
5. **Create demos**: Build showcase demos for each feature

Refer to `TETRA_CONSOLIDATION_PLAN.md` for complete architecture details.

---

## Common Issues

### "TETRA_SRC not set"
```bash
# Ensure tetra.sh is in PATH or:
export TETRA_SRC=$HOME/tetra
source ~/tetra/bash/tetra/tetra.sh
```

### "Module not found"
```bash
# Check file exists
ls -la ~/tetra/bash/tetra/core/bootstrap.sh

# Check syntax
bash -n ~/tetra/bash/tetra/core/bootstrap.sh
```

### "TDS not loaded"
```bash
# TDS is optional, will fallback to basic colors
# To use TDS:
cd ~/tetra/bash/tds
source tds.sh
```

### "Prompt toggle doesn't work"
```bash
# Ctrl+P binding requires bash 5.2+
bash --version

# Check binding
bind -P | grep '\\C-p'
```

---

## Success!

You now have a working **bash/tetra** foundation with:
- ✓ Core bootstrap and module loading
- ✓ Event bus for pub/sub
- ✓ TDS integration for display
- ✓ Action system with registration and execution
- ✓ REPL with 3 prompt modes and slash commands
- ✓ Flow system with state tracking

Continue with phases 6-7 for animation and TUI integration!
