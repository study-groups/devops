#!/usr/bin/env bash
# Tetra Action Discovery
# Discovers and registers actions from loaded modules

# Action registration function (called by modules)
declare_action() {
    local action_name="$1"
    shift

    # Parse metadata key=value pairs
    local verb="" noun="" exec_at="" contexts="" modes="" tes_operation=""
    local description="" module=""

    for param in "$@"; do
        case "$param" in
            verb=*)      verb="${param#*=}" ;;
            noun=*)      noun="${param#*=}" ;;
            exec_at=*)   exec_at="${param#*=}" ;;
            contexts=*)  contexts="${param#*=}" ;;
            modes=*)     modes="${param#*=}" ;;
            tes_operation=*) tes_operation="${param#*=}" ;;
            description=*) description="${param#*=}" ;;
            module=*)    module="${param#*=}" ;;
        esac
    done

    # If module not explicitly provided, use context from environment
    if [[ -z "$module" ]] && [[ -n "$_TETRA_CURRENT_MODULE" ]]; then
        module="$_TETRA_CURRENT_MODULE"
    fi

    # Build fully qualified action: verb:noun
    local fq_action="${verb}:${noun}"

    # Store in registry
    TETRA_ACTIONS["$fq_action.module"]="$module"
    TETRA_ACTIONS["$fq_action.verb"]="$verb"
    TETRA_ACTIONS["$fq_action.noun"]="$noun"
    TETRA_ACTIONS["$fq_action.exec_at"]="$exec_at"
    TETRA_ACTIONS["$fq_action.contexts"]="$contexts"
    TETRA_ACTIONS["$fq_action.modes"]="$modes"
    TETRA_ACTIONS["$fq_action.tes_operation"]="$tes_operation"
    TETRA_ACTIONS["$fq_action.description"]="$description"

    # Add to action list if not already present
    if [[ ! " ${TETRA_ACTION_LIST[*]} " =~ " ${fq_action} " ]]; then
        TETRA_ACTION_LIST+=("$fq_action")
    fi

    return 0
}

# Discover actions from a single module
tetra_discover_module_actions() {
    local module_name="$1"
    local module_dir="${TETRA_MODULES[$module_name]}"

    if [[ -z "$module_dir" ]]; then
        echo "WARNING: Module not loaded: $module_name" >&2
        return 1
    fi

    # Check if module has actions.sh
    local actions_file="$module_dir/actions.sh"
    if [[ ! -f "$actions_file" ]]; then
        # Not an error - libraries don't have actions
        return 0
    fi

    # Source actions file
    if ! source "$actions_file" 2>/dev/null; then
        echo "WARNING: Failed to source actions: $actions_file" >&2
        return 1
    fi

    # Call module's register function
    local register_fn="${module_name}_register_actions"
    if declare -f "$register_fn" >/dev/null 2>&1; then
        # Set module context for declare_action calls
        export _TETRA_CURRENT_MODULE="$module_name"

        # Call registration function
        "$register_fn"

        # Clean up context
        unset _TETRA_CURRENT_MODULE
    else
        echo "WARNING: Module $module_name has actions.sh but no ${register_fn}() function" >&2
        return 1
    fi

    return 0
}

# Discover all actions from all loaded modules
tetra_discover_actions() {
    local action_count=0

    for module_name in "${TETRA_MODULE_LIST[@]}"; do
        if tetra_discover_module_actions "$module_name"; then
            local module_action_count=0
            # Count actions for this module
            for action in "${TETRA_ACTION_LIST[@]}"; do
                if [[ "${TETRA_ACTIONS[$action.module]}" == "$module_name" ]]; then
                    ((module_action_count++))
                fi
            done
            ((action_count += module_action_count))
        fi
    done

    return 0
}

# List all discovered actions
tetra_list_actions() {
    for action in "${TETRA_ACTION_LIST[@]}"; do
        echo "$action"
    done
}

# List actions for a specific module
tetra_list_module_actions() {
    local module_name="$1"

    for action in "${TETRA_ACTION_LIST[@]}"; do
        if [[ "${TETRA_ACTIONS[$action.module]}" == "$module_name" ]]; then
            echo "$action"
        fi
    done
}

# Get action metadata
tetra_get_action_module() {
    local action="$1"
    echo "${TETRA_ACTIONS[$action.module]}"
}

tetra_get_action_verb() {
    local action="$1"
    echo "${TETRA_ACTIONS[$action.verb]}"
}

tetra_get_action_noun() {
    local action="$1"
    echo "${TETRA_ACTIONS[$action.noun]}"
}

tetra_get_action_contexts() {
    local action="$1"
    echo "${TETRA_ACTIONS[$action.contexts]}"
}

tetra_get_action_modes() {
    local action="$1"
    echo "${TETRA_ACTIONS[$action.modes]}"
}

# Check if action exists
tetra_action_exists() {
    local action="$1"
    [[ -n "${TETRA_ACTIONS[$action.module]}" ]]
}

# Filter actions by context (Env × Mode)
tetra_filter_actions_by_context() {
    local env="$1"
    local mode="$2"

    for action in "${TETRA_ACTION_LIST[@]}"; do
        local contexts="${TETRA_ACTIONS[$action.contexts]}"
        local modes="${TETRA_ACTIONS[$action.modes]}"

        # Check if action is available in this context
        # Empty means available in all contexts
        if [[ -z "$contexts" ]] || [[ "$contexts" =~ $env ]]; then
            if [[ -z "$modes" ]] || [[ "$modes" =~ $mode ]]; then
                echo "$action"
            fi
        fi
    done
}

# Export functions
export -f declare_action
export -f tetra_discover_module_actions
export -f tetra_discover_actions
export -f tetra_list_actions
export -f tetra_list_module_actions
export -f tetra_get_action_module
export -f tetra_get_action_verb
export -f tetra_get_action_noun
export -f tetra_get_action_contexts
export -f tetra_get_action_modes
export -f tetra_action_exists
export -f tetra_filter_actions_by_context
