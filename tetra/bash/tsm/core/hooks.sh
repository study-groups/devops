#!/usr/bin/env bash

# TSM Pre-Hook System
# File-based hooks for runtime environment setup
# Hook files live at $TETRA_DIR/tsm/hooks/*.sh

# Hooks directory location
TSM_HOOKS_DIR="${TETRA_DIR}/tsm/hooks"

# Resolve hook file path
# Priority: 1. Service-specific hook, 2. Type-based hook
# Usage: tsm_resolve_hook "service-name" "process-type"
# Returns: path to hook file, or empty if none found
tsm_resolve_hook() {
    local name="$1"   # service name
    local type="$2"   # process type (python, node)

    # 1. Service-specific hook (e.g., hooks/quasar.sh)
    [[ -f "$TSM_HOOKS_DIR/${name}.sh" ]] && { echo "$TSM_HOOKS_DIR/${name}.sh"; return 0; }

    # 2. Type-based hook (e.g., hooks/python.sh)
    [[ -f "$TSM_HOOKS_DIR/${type}.sh" ]] && { echo "$TSM_HOOKS_DIR/${type}.sh"; return 0; }

    return 1
}

# Build prehook command (returns source command for hook file)
# Priority: explicit file/path > service-specific > type-based
tsm_build_prehook() {
    local explicit="$1"       # From --pre-hook flag (file path or hook name)
    local process_type="$2"   # Auto-detected (python, node, etc.)
    local service_name="$3"   # Service name for service-specific hooks

    # Priority 1: Explicit --pre-hook (can be file path or hook name)
    if [[ -n "$explicit" ]]; then
        if [[ -f "$explicit" ]]; then
            # It's a file path
            echo "source '$explicit'"
            return 0
        elif [[ -f "$TSM_HOOKS_DIR/${explicit}.sh" ]]; then
            # It's a hook name (e.g., "python" -> hooks/python.sh)
            echo "source '$TSM_HOOKS_DIR/${explicit}.sh'"
            return 0
        else
            # It's a raw command (backward compat)
            echo "$explicit"
            return 0
        fi
    fi

    # Priority 2 & 3: Resolve from hooks directory
    local hook_file
    hook_file=$(tsm_resolve_hook "$service_name" "$process_type") || return 1

    echo "source '$hook_file'"
}

# List available hook files
tsm_list_prehooks() {
    echo "Available Pre-Hooks ($TSM_HOOKS_DIR):"
    if [[ -d "$TSM_HOOKS_DIR" ]]; then
        for hook_file in "$TSM_HOOKS_DIR"/*.sh; do
            [[ -f "$hook_file" ]] || continue
            local hook_name=$(basename "$hook_file" .sh)
            echo "  $hook_name"
        done
    else
        echo "  (hooks directory not found)"
    fi
}

# Get hook file path for a runtime type (convenience function)
tsm_get_prehook() {
    local runtime="$1"
    local hook_file="$TSM_HOOKS_DIR/${runtime}.sh"
    [[ -f "$hook_file" ]] && echo "$hook_file"
}

export -f tsm_resolve_hook
export -f tsm_build_prehook
export -f tsm_list_prehooks
export -f tsm_get_prehook
