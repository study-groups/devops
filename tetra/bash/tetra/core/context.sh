#!/usr/bin/env bash
# Tetra Context Calculator
# Implements [Org × Env × Mode] → Actions functor

# Valid environments
TETRA_VALID_ENVS=(
    "HELP"
    "Local"
    "Dev"
    "Staging"
    "Production"
)

# Get current organization
tetra_get_org() {
    echo "${TETRA_ORG:-default}"
}

# Set organization
tetra_set_org() {
    local new_org="$1"
    export TETRA_ORG="$new_org"
    return 0
}

# Get current environment
tetra_get_env() {
    echo "${TETRA_ENV:-Local}"
}

# Set environment
tetra_set_env() {
    local new_env="$1"

    # Validate environment
    local valid=false
    for env in "${TETRA_VALID_ENVS[@]}"; do
        if [[ "$env" == "$new_env" ]]; then
            valid=true
            break
        fi
    done

    if [[ "$valid" == false ]]; then
        echo "ERROR: Invalid environment: $new_env" >&2
        echo "Valid environments: ${TETRA_VALID_ENVS[*]}" >&2
        return 1
    fi

    export TETRA_ENV="$new_env"
    return 0
}

# Get current mode (comma-separated list of active modules)
tetra_get_mode() {
    echo "${TETRA_MODE:-}"
}

# Set mode
tetra_set_mode() {
    local new_mode="$1"

    # Validate modules in mode
    if [[ -n "$new_mode" ]]; then
        IFS=',' read -ra mode_modules <<< "$new_mode"
        for module in "${mode_modules[@]}"; do
            if ! tetra_module_loaded "$module"; then
                echo "ERROR: Module not loaded: $module" >&2
                return 1
            fi
        done
    fi

    export TETRA_MODE="$new_mode"
    return 0
}

# Add module to mode
tetra_mode_add() {
    local module="$1"

    if ! tetra_module_loaded "$module"; then
        echo "ERROR: Module not loaded: $module" >&2
        return 1
    fi

    local current_mode="$(tetra_get_mode)"

    # Check if already in mode
    if [[ ",$current_mode," =~ ,$module, ]]; then
        # Already present
        return 0
    fi

    # Add to mode
    if [[ -z "$current_mode" ]]; then
        export TETRA_MODE="$module"
    else
        export TETRA_MODE="$current_mode,$module"
    fi

    return 0
}

# Remove module from mode
tetra_mode_remove() {
    local module="$1"
    local current_mode="$(tetra_get_mode)"

    # Split into array
    IFS=',' read -ra mode_modules <<< "$current_mode"

    # Filter out module
    local new_modules=()
    for m in "${mode_modules[@]}"; do
        [[ "$m" != "$module" ]] && new_modules+=("$m")
    done

    # Rejoin
    local new_mode
    if [[ ${#new_modules[@]} -eq 0 ]]; then
        new_mode=""
    else
        new_mode="$(IFS=','; echo "${new_modules[*]}")"
    fi

    export TETRA_MODE="$new_mode"
    return 0
}

# Check if module is in current mode
tetra_mode_has() {
    local module="$1"
    local current_mode="$(tetra_get_mode)"

    [[ ",$current_mode," =~ ,$module, ]]
}

# Calculate context: [Env × Mode] → Actions
# Returns list of actions available in current context
tetra_calculate_context() {
    local env="${1:-$(tetra_get_env)}"
    local mode="${2:-$(tetra_get_mode)}"

    # If mode is empty, all actions are available
    # If mode is set, only actions from modules in mode OR with matching mode metadata

    local available_actions=()

    for action in "${TETRA_ACTION_LIST[@]}"; do
        # Get action metadata
        local action_module="${TETRA_ACTIONS[$action.module]}"
        local action_contexts="${TETRA_ACTIONS[$action.contexts]}"
        local action_modes="${TETRA_ACTIONS[$action.modes]}"

        # Check environment constraint
        # Empty contexts = available in all environments
        if [[ -n "$action_contexts" ]]; then
            if [[ ! "$action_contexts" =~ $env ]]; then
                # Action not available in this environment
                continue
            fi
        fi

        # Check mode constraint
        # Empty mode = all actions available
        # Non-empty mode = only actions from modules in mode OR matching mode metadata
        if [[ -n "$mode" ]]; then
            # Check if action's module is in current mode
            local module_in_mode=false
            IFS=',' read -ra mode_modules <<< "$mode"
            for m in "${mode_modules[@]}"; do
                if [[ "$m" == "$action_module" ]]; then
                    module_in_mode=true
                    break
                fi
            done

            # Check if action has mode metadata matching current mode
            local mode_matches=false
            if [[ -n "$action_modes" ]]; then
                for m in "${mode_modules[@]}"; do
                    if [[ "$action_modes" =~ $m ]]; then
                        mode_matches=true
                        break
                    fi
                done
            fi

            # Action available if module in mode OR mode metadata matches
            if [[ "$module_in_mode" == false ]] && [[ "$mode_matches" == false ]]; then
                # Not available in this mode
                continue
            fi
        fi

        # Action is available
        available_actions+=("$action")
    done

    # Output available actions
    for action in "${available_actions[@]}"; do
        echo "$action"
    done

    return 0
}

# Get context summary
tetra_context_summary() {
    local org="$(tetra_get_org)"
    local env="$(tetra_get_env)"
    local mode="$(tetra_get_mode)"

    echo "Context: [$org × $env × ${mode:-all}]"
    echo ""

    local available_actions
    mapfile -t available_actions < <(tetra_calculate_context "$env" "$mode")

    echo "Available Actions: ${#available_actions[@]}"
    for action in "${available_actions[@]}"; do
        local module="${TETRA_ACTIONS[$action.module]}"
        echo "  - $action [$module]"
    done

    return 0
}

# Check if action is available in current context
tetra_action_available() {
    local action="$1"
    local env="${2:-$(tetra_get_env)}"
    local mode="${3:-$(tetra_get_mode)}"

    local available_actions
    mapfile -t available_actions < <(tetra_calculate_context "$env" "$mode")

    for a in "${available_actions[@]}"; do
        if [[ "$a" == "$action" ]]; then
            return 0
        fi
    done

    return 1
}

# Export functions
export -f tetra_get_org
export -f tetra_set_org
export -f tetra_get_env
export -f tetra_set_env
export -f tetra_get_mode
export -f tetra_set_mode
export -f tetra_mode_add
export -f tetra_mode_remove
export -f tetra_mode_has
export -f tetra_calculate_context
export -f tetra_context_summary
export -f tetra_action_available
