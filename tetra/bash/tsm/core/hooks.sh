#!/usr/bin/env bash

# TSM Pre-Hook System
# Manages runtime environment setup hooks

# Pre-hook registry (associative array: runtime -> hook command)
declare -gA TSM_PREHOOKS

# Initialize standard pre-hooks
_tsm_init_prehooks() {
    # Python: activate pyenv
    TSM_PREHOOKS[python]='
export PATH="$PYENV_ROOT/bin:$PYENV_ROOT/shims:$PATH"
eval "$(pyenv init --path 2>/dev/null || true)"
eval "$(pyenv virtualenv-init - 2>/dev/null || true)"
'

    # Node: activate nvm (if not already in PATH)
    TSM_PREHOOKS[node]='
if [[ -z "$NVM_DIR" ]]; then
    export NVM_DIR="$TETRA_DIR/nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
    nvm use node >/dev/null 2>&1 || true
fi
'
}

# Initialize on load
_tsm_init_prehooks

# Get pre-hook for a runtime type
tsm_get_prehook() {
    local runtime="$1"
    echo "${TSM_PREHOOKS[$runtime]:-}"
}

# Register a custom pre-hook
tsm_register_prehook() {
    local name="$1"
    local hook_command="$2"

    if [[ -z "$name" || -z "$hook_command" ]]; then
        echo "Usage: tsm_register_prehook <name> <hook_command>" >&2
        return 1
    fi

    TSM_PREHOOKS[$name]="$hook_command"
}

# List all registered pre-hooks
tsm_list_prehooks() {
    if [[ ${#TSM_PREHOOKS[@]} -eq 0 ]]; then
        echo "No pre-hooks registered"
        return
    fi

    echo "Registered Pre-Hooks:"
    for runtime in "${!TSM_PREHOOKS[@]}"; do
        echo "  $runtime"
    done
}

# Build pre-hook command from multiple sources
# Priority: explicit > registered > auto-detected
tsm_build_prehook() {
    local explicit_hook="$1"      # From --pre-hook flag
    local process_type="$2"       # Auto-detected (python, node, etc.)
    local from_service="$3"       # From TSM_PRE_COMMAND in service def

    local hook_cmd=""

    # Priority 1: Explicit --pre-hook flag
    if [[ -n "$explicit_hook" ]]; then
        # Check if it's a function name or raw command
        if declare -f "$explicit_hook" >/dev/null 2>&1; then
            # It's a function - call it
            hook_cmd="$explicit_hook"
        elif [[ -n "${TSM_PREHOOKS[$explicit_hook]}" ]]; then
            # It's a registered pre-hook name
            hook_cmd="${TSM_PREHOOKS[$explicit_hook]}"
        else
            # It's a raw command
            hook_cmd="$explicit_hook"
        fi
    # Priority 2: Service definition TSM_PRE_COMMAND
    elif [[ -n "$from_service" ]]; then
        if declare -f "$from_service" >/dev/null 2>&1; then
            hook_cmd="$from_service"
        elif [[ -n "${TSM_PREHOOKS[$from_service]}" ]]; then
            hook_cmd="${TSM_PREHOOKS[$from_service]}"
        else
            hook_cmd="$from_service"
        fi
    # Priority 3: Auto-detected from process type
    elif [[ -n "$process_type" && -n "${TSM_PREHOOKS[$process_type]}" ]]; then
        hook_cmd="${TSM_PREHOOKS[$process_type]}"
    fi

    echo "$hook_cmd"
}

export -f tsm_get_prehook
export -f tsm_register_prehook
export -f tsm_list_prehooks
export -f tsm_build_prehook
