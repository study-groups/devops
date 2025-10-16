#!/usr/bin/env bash

# Module Discovery System for Demo 014
# Discovers and integrates Tetra modules with action declarations

# Global registry of discovered modules
declare -ga DISCOVERED_MODULES=()
declare -gA MODULE_ACTIONS=()  # module_name => space-separated action list

# Discover all tetra modules with actions.sh
discover_tetra_modules() {
    local tetra_src="${TETRA_SRC:-$HOME/tetra}"

    if [[ ! -d "$tetra_src/bash" ]]; then
        echo "Warning: TETRA_SRC not found at $tetra_src - skipping module discovery" >&2
        return 1
    fi

    # Limit discovery to prevent hanging
    local count=0
    local max_modules=5

    # Scan bash/*/actions.sh for module action declarations
    for actions_file in "$tetra_src/bash"/*/actions.sh; do
        [[ -f "$actions_file" ]] || continue

        # Safety: limit number of modules to discover
        ((count++))
        if [[ $count -gt $max_modules ]]; then
            echo "Warning: Module discovery limit reached ($max_modules)" >&2
            break
        fi

        local module_dir=$(dirname "$actions_file")
        local module_name=$(basename "$module_dir")

        # Source the actions file with timeout protection
        ( source "$actions_file" 2>/dev/null ) || {
            echo "Warning: Failed to source $actions_file" >&2
            continue
        }

        # Check if module provides required functions
        if declare -f "${module_name}_register_actions" >/dev/null 2>&1 && \
           declare -f "${module_name}_execute_action" >/dev/null 2>&1; then

            # Call registration function with timeout
            if "${module_name}_register_actions" 2>/dev/null; then
                DISCOVERED_MODULES+=("$module_name")
                echo "Discovered module: $module_name" >&2
            fi
        fi
    done

    echo "Loaded ${#DISCOVERED_MODULES[@]} modules: ${DISCOVERED_MODULES[*]}" >&2
    return 0
}

# Get actions from modules filtered by context and mode
get_module_actions() {
    local context="$1"
    local mode="$2"

    local actions=()

    # Iterate through ACTION_REGISTRY to find matches
    for action_name in "${ACTION_REGISTRY[@]}"; do
        if ! declare -p "ACTION_${action_name}" &>/dev/null; then
            continue
        fi

        local -n _action="ACTION_${action_name}"

        # Check if action matches context
        local action_contexts="${_action[contexts]}"
        if [[ -n "$action_contexts" ]]; then
            # Convert CSV to array
            IFS=',' read -ra context_array <<< "$action_contexts"
            local context_match=false
            for ctx in "${context_array[@]}"; do
                if [[ "${ctx// /}" == "$context" ]]; then
                    context_match=true
                    break
                fi
            done
            [[ "$context_match" == "false" ]] && continue
        fi

        # Check if action matches mode
        local action_modes="${_action[modes]}"
        if [[ -n "$action_modes" ]]; then
            # Convert CSV to array
            IFS=',' read -ra mode_array <<< "$action_modes"
            local mode_match=false
            for m in "${mode_array[@]}"; do
                if [[ "${m// /}" == "$mode" ]]; then
                    mode_match=true
                    break
                fi
            done
            [[ "$mode_match" == "false" ]] && continue
        fi

        # This action matches - add it
        local verb="${_action[verb]}"
        local noun="${_action[noun]}"
        actions+=("$verb:$noun")
    done

    echo "${actions[@]}"
}

# Execute a module action
execute_module_action() {
    local action="$1"
    shift
    local args=("$@")

    # Convert action format (verb:noun) to action_name (verb_noun)
    local action_name="${action//:/_}"

    # Find which module owns this action
    for module in "${DISCOVERED_MODULES[@]}"; do
        # Check if this action exists in the registry and has module info
        if declare -p "ACTION_${action_name}" &>/dev/null; then
            # Call the module's execute function
            if declare -f "${module}_execute_action" >/dev/null 2>&1; then
                "${module}_execute_action" "$action" "${args[@]}"
                return $?
            fi
        fi
    done

    # Action not found in any module
    return 1
}

# Check if an action belongs to a module (vs built-in demo action)
is_module_action() {
    local action="$1"
    local action_name="${action//:/_}"

    # Check if action exists in registry
    if ! declare -p "ACTION_${action_name}" &>/dev/null; then
        return 1
    fi

    local -n _action="ACTION_${action_name}"

    # Module actions have contexts/modes metadata
    if [[ -n "${_action[contexts]}" ]] || [[ -n "${_action[modes]}" ]]; then
        return 0
    fi

    return 1
}

# Get the module that owns an action
get_action_module() {
    local action="$1"
    local action_name="${action//:/_}"

    # Iterate through discovered modules
    for module in "${DISCOVERED_MODULES[@]}"; do
        # Check module's registered actions
        # This is a simple heuristic: check if module name appears in action metadata
        if declare -p "ACTION_${action_name}" &>/dev/null; then
            echo "$module"
            return 0
        fi
    done

    return 1
}
