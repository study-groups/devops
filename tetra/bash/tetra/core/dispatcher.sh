#!/usr/bin/env bash
# Tetra Action Dispatcher
# Routes action requests to appropriate module executors

# Parse action string into components
tetra_parse_action() {
    local action_str="$1"

    # Handle different formats:
    # 1. verb:noun (e.g., "select:files")
    # 2. module.verb:noun (e.g., "rag.select:files")

    local module="" verb="" noun=""

    if [[ "$action_str" =~ ^([a-z]+)\.([a-z_]+):([a-z_]+)$ ]]; then
        # Format: module.verb:noun
        module="${BASH_REMATCH[1]}"
        verb="${BASH_REMATCH[2]}"
        noun="${BASH_REMATCH[3]}"
    elif [[ "$action_str" =~ ^([a-z_]+):([a-z_]+)$ ]]; then
        # Format: verb:noun
        verb="${BASH_REMATCH[1]}"
        noun="${BASH_REMATCH[2]}"
    elif [[ "$action_str" =~ ^([a-z]+)\.([a-z_]+)$ ]]; then
        # Format: module.verb (no noun)
        module="${BASH_REMATCH[1]}"
        verb="${BASH_REMATCH[2]}"
    elif [[ "$action_str" =~ ^([a-z_]+)$ ]]; then
        # Format: just verb (special orchestrator commands)
        verb="$action_str"
    else
        echo "ERROR: Invalid action format: $action_str" >&2
        return 1
    fi

    # Output as variables
    echo "MODULE=$module"
    echo "VERB=$verb"
    echo "NOUN=$noun"
    return 0
}

# Resolve action to module
tetra_resolve_action() {
    local verb="$1"
    local noun="$2"
    local module_hint="$3"

    local fq_action="${verb}:${noun}"

    # If module hint provided, verify it owns the action
    if [[ -n "$module_hint" ]]; then
        if tetra_action_exists "$fq_action"; then
            local action_module="$(tetra_get_action_module "$fq_action")"
            if [[ "$action_module" == "$module_hint" ]]; then
                echo "$action_module"
                return 0
            else
                echo "ERROR: Action $fq_action not owned by module $module_hint (owned by $action_module)" >&2
                return 1
            fi
        else
            echo "ERROR: Action not found: $fq_action" >&2
            return 1
        fi
    fi

    # No module hint - discover from action registry
    if tetra_action_exists "$fq_action"; then
        tetra_get_action_module "$fq_action"
        return 0
    fi

    echo "ERROR: Unknown action: $fq_action" >&2
    return 1
}

# Dispatch action to module
tetra_dispatch_action() {
    local action="$1"
    shift
    local args=("$@")

    # Parse action string
    local parse_result
    parse_result="$(tetra_parse_action "$action")" || return 1

    # Extract components - use a while loop to properly parse
    local module="" verb="" noun=""
    while IFS='=' read -r key value; do
        case "$key" in
            MODULE) module="$value" ;;
            VERB) verb="$value" ;;
            NOUN) noun="$value" ;;
        esac
    done <<< "$parse_result"

    # Handle orchestrator meta-actions
    if [[ -z "$noun" ]] && [[ -z "$module" ]]; then
        case "$verb" in
            help)
                tetra_show_help
                return 0
                ;;
            version)
                echo "tetra orchestrator v$TETRA_ORCHESTRATOR_VERSION"
                echo "Loaded modules: ${TETRA_MODULE_LIST[*]}"
                return 0
                ;;
            *)
                # Not a meta-action, continue to module dispatch
                ;;
        esac
    fi

    # Handle two-word commands (e.g., "list modules", "show status")
    if [[ -z "$noun" ]] && [[ -n "${args[0]}" ]]; then
        # Check if this forms a valid action
        local potential_noun="${args[0]}"
        local test_action="${verb}:${potential_noun}"

        if tetra_action_exists "$test_action"; then
            noun="$potential_noun"
            shift 1  # Remove noun from args
            args=("$@")
        else
            # Check for orchestrator meta-actions
            if [[ "$verb" == "list" ]] && [[ "$potential_noun" == "modules" ]]; then
                tetra_list_loaded_modules
                return 0
            elif [[ "$verb" == "list" ]] && [[ "$potential_noun" == "actions" ]]; then
                tetra_list_actions
                return 0
            elif [[ "$verb" == "show" ]] && [[ "$potential_noun" == "status" ]]; then
                tetra_show_status
                return 0
            fi
        fi
    fi

    # Resolve to module
    local resolved_module
    resolved_module="$(tetra_resolve_action "$verb" "$noun" "$module")" || return 1

    # Check if module is loaded
    if ! tetra_module_loaded "$resolved_module"; then
        echo "ERROR: Module not loaded: $resolved_module" >&2
        return 1
    fi

    # Call module's execute function
    local execute_fn="${resolved_module}_execute_action"
    if ! declare -f "$execute_fn" >/dev/null 2>&1; then
        echo "ERROR: Module $resolved_module has no execute function: $execute_fn" >&2
        return 1
    fi

    # Dispatch to module
    local fq_action="${verb}:${noun}"
    "$execute_fn" "$fq_action" "${args[@]}"
    return $?
}

# Show orchestrator status
tetra_show_status() {
    echo "Tetra Orchestrator Status"
    echo "========================="
    echo ""
    echo "Version: $TETRA_ORCHESTRATOR_VERSION"
    echo "TETRA_SRC: $TETRA_SRC"
    echo "TETRA_DIR: $TETRA_DIR"
    echo "Environment: $TETRA_ENV"
    echo "Mode: ${TETRA_MODE:-none}"
    echo ""
    echo "Loaded Modules (${#TETRA_MODULE_LIST[@]}):"
    for module in "${TETRA_MODULE_LIST[@]}"; do
        local module_path="${TETRA_MODULES[$module]}"
        local action_count=0
        for action in "${TETRA_ACTION_LIST[@]}"; do
            [[ "${TETRA_ACTIONS[$action.module]}" == "$module" ]] && ((action_count++))
        done
        echo "  - $module ($action_count actions) @ $module_path"
    done
    echo ""
    echo "Registered Actions (${#TETRA_ACTION_LIST[@]}):"
    for action in "${TETRA_ACTION_LIST[@]}"; do
        local module="${TETRA_ACTIONS[$action.module]}"
        local contexts="${TETRA_ACTIONS[$action.contexts]}"
        local modes="${TETRA_ACTIONS[$action.modes]}"
        echo "  - $action [$module]"
        [[ -n "$contexts" ]] && echo "    contexts: $contexts"
        [[ -n "$modes" ]] && echo "    modes: $modes"
    done
}

# Export functions
export -f tetra_parse_action
export -f tetra_resolve_action
export -f tetra_dispatch_action
export -f tetra_show_status
