#!/usr/bin/env bash

# TView Actions - ACTION_DEF registry and management system
# Implements the core E × M + A = R formula with action discovery

# Demo environments and modes
declare -ga DEMO_ENVIRONMENTS=("DEMO" "LOCAL" "REMOTE")
declare -ga DEMO_MODES=("LEARN" "BUILD" "TEST")

# Global action registry
declare -gA ACTION_REGISTRY=()

# Action resolution cache
declare -gA ACTION_CACHE=()

# Register an ACTION_DEF in the global registry
register_action() {
    local action_name="$1"
    local action_def="$2"  # JSON-like string or associative array reference

    ACTION_REGISTRY["$action_name"]="$action_def"

    # Clear cache when new actions are registered
    ACTION_CACHE=()
}

# Get ACTION_DEF by name
get_action_def() {
    local action_name="$1"

    echo "${ACTION_REGISTRY[$action_name]:-}"
}

# Parse ACTION_DEF field
get_action_field() {
    local action_def="$1"
    local field="$2"

    # Simple parsing for demo (assumes field=value format)
    echo "$action_def" | grep -o "${field}=[^|]*" | cut -d'=' -f2- | tr -d '"'
}

# Check if action is valid for environment
is_action_valid_for_env() {
    local action_def="$1"
    local environment="$2"

    local valid_envs=$(get_action_field "$action_def" "environments")

    # If no environments specified, assume valid for all
    if [[ -z "$valid_envs" ]]; then
        return 0
    fi

    # Check if environment is in the list
    [[ ",$valid_envs," == *",$environment,"* ]]
}

# Resolve action nouns (creation time + runtime)
resolve_action_nouns() {
    local action_def="$1"
    local environment="$2"
    local runtime_context="$3"

    local creation_nouns=$(get_action_field "$action_def" "nouns_creation")
    local runtime_nouns=$(get_action_field "$action_def" "nouns_runtime")

    # Resolve creation nouns (already resolved)
    local resolved_nouns="$creation_nouns"

    # Resolve runtime nouns from context
    if [[ -n "$runtime_nouns" ]]; then
        # Simple variable substitution for demo
        local resolved_runtime=$(echo "$runtime_nouns" | envsubst)
        if [[ -n "$resolved_nouns" ]]; then
            resolved_nouns+=",${resolved_runtime}"
        else
            resolved_nouns="$resolved_runtime"
        fi
    fi

    echo "$resolved_nouns"
}

# Discover actions from module directory
discover_module_actions() {
    local mode="$1"
    local environment="$2"

    local module_dir="demo/tview/modules/$(echo "$mode" | tr '[:upper:]' '[:lower:]')"

    # Check if module exists
    if [[ ! -f "$module_dir/actions.sh" ]]; then
        return 1
    fi

    # Source module actions
    source "$module_dir/actions.sh"

    # Call module's get_actions function
    if declare -f get_actions >/dev/null 2>&1; then
        get_actions "$environment"
    else
        return 1
    fi
}

# Get actions for E × M context
get_actions_for_context() {
    local environment="$1"
    local mode="$2"

    # Check cache first
    local cache_key="${environment}:${mode}"
    if [[ -n "${ACTION_CACHE[$cache_key]:-}" ]]; then
        echo "${ACTION_CACHE[$cache_key]}"
        return 0
    fi

    # Discover actions from module
    local actions
    if actions=$(discover_module_actions "$mode" "$environment" 2>/dev/null); then
        # Cache the result
        ACTION_CACHE["$cache_key"]="$actions"
        echo "$actions"
        return 0
    fi

    # Fallback actions if module not found
    echo "help:Help"
    echo "refresh:Refresh"
    return 1
}

# Execute action by ID
execute_action() {
    local action_id="$1"
    local environment="$2"
    local mode="$3"
    local runtime_context="${4:-}"

    # Try to execute via module
    local module_dir="demo/tview/modules/$(echo "$mode" | tr '[:upper:]' '[:lower:]')"

    if [[ -f "$module_dir/actions.sh" ]]; then
        source "$module_dir/actions.sh"

        if declare -f execute_action >/dev/null 2>&1; then
            execute_action "$action_id" "$environment" "$runtime_context"
            return $?
        fi
    fi

    # Fallback execution
    case "$action_id" in
        "help")
            show_help "$environment" "$mode"
            ;;
        "refresh")
            refresh_context "$environment" "$mode"
            ;;
        *)
            echo "Action '$action_id' not implemented for $environment:$mode"
            return 1
            ;;
    esac
}

# Built-in actions
show_help() {
    local environment="$1"
    local mode="$2"

    echo "Help for $environment:$mode"
    echo "=========================="
    echo ""
    echo "Available actions:"

    local actions
    if actions=$(get_actions_for_context "$environment" "$mode"); then
        while IFS= read -r action_line; do
            if [[ -n "$action_line" ]]; then
                local action_id=$(echo "$action_line" | cut -d':' -f1)
                local action_name=$(echo "$action_line" | cut -d':' -f2)
                printf "  %-15s %s\n" "$action_id" "$action_name"
            fi
        done <<< "$actions"
    fi

    echo ""
    echo "Press any key to continue..."
    read -n1 -s
}

refresh_context() {
    local environment="$1"
    local mode="$2"

    echo "Refreshing $environment:$mode context..."

    # Clear action cache for this context
    local cache_key="${environment}:${mode}"
    unset ACTION_CACHE["$cache_key"]

    # Reload module if it exists
    local module_dir="demo/tview/modules/$(echo "$mode" | tr '[:upper:]' '[:lower:]')"

    if [[ -f "$module_dir/actions.sh" ]]; then
        source "$module_dir/actions.sh"
        echo "Module reloaded successfully"
    else
        echo "No module found for $mode"
    fi

    sleep 1  # Brief pause to show message
}

# Validate environment
validate_environment() {
    local env="$1"

    for valid_env in "${DEMO_ENVIRONMENTS[@]}"; do
        if [[ "$env" == "$valid_env" ]]; then
            return 0
        fi
    done

    return 1
}

# Validate mode
validate_mode() {
    local mode="$1"

    for valid_mode in "${DEMO_MODES[@]}"; do
        if [[ "$mode" == "$valid_mode" ]]; then
            return 0
        fi
    done

    return 1
}

# Get available environments
get_environments() {
    printf '%s\n' "${DEMO_ENVIRONMENTS[@]}"
}

# Get available modes
get_modes() {
    printf '%s\n' "${DEMO_MODES[@]}"
}

# Navigation helpers
get_next_environment() {
    local current="$1"

    for i in "${!DEMO_ENVIRONMENTS[@]}"; do
        if [[ "${DEMO_ENVIRONMENTS[$i]}" == "$current" ]]; then
            local next_index=$(( (i + 1) % ${#DEMO_ENVIRONMENTS[@]} ))
            echo "${DEMO_ENVIRONMENTS[$next_index]}"
            return 0
        fi
    done

    # If not found, return first
    echo "${DEMO_ENVIRONMENTS[0]}"
}

get_prev_environment() {
    local current="$1"

    for i in "${!DEMO_ENVIRONMENTS[@]}"; do
        if [[ "${DEMO_ENVIRONMENTS[$i]}" == "$current" ]]; then
            local prev_index=$(( (i - 1 + ${#DEMO_ENVIRONMENTS[@]}) % ${#DEMO_ENVIRONMENTS[@]} ))
            echo "${DEMO_ENVIRONMENTS[$prev_index]}"
            return 0
        fi
    done

    # If not found, return last
    echo "${DEMO_ENVIRONMENTS[-1]}"
}

get_next_mode() {
    local current="$1"

    for i in "${!DEMO_MODES[@]}"; do
        if [[ "${DEMO_MODES[$i]}" == "$current" ]]; then
            local next_index=$(( (i + 1) % ${#DEMO_MODES[@]} ))
            echo "${DEMO_MODES[$next_index]}"
            return 0
        fi
    done

    # If not found, return first
    echo "${DEMO_MODES[0]}"
}

get_prev_mode() {
    local current="$1"

    for i in "${!DEMO_MODES[@]}"; do
        if [[ "${DEMO_MODES[$i]}" == "$current" ]]; then
            local prev_index=$(( (i - 1 + ${#DEMO_MODES[@]}) % ${#DEMO_MODES[@]} ))
            echo "${DEMO_MODES[$prev_index]}"
            return 0
        fi
    done

    # If not found, return last
    echo "${DEMO_MODES[-1]}"
}

# Initialize action system
init_actions() {
    # Clear registries
    ACTION_REGISTRY=()
    ACTION_CACHE=()

    # Set up environment variables for noun resolution
    export DEMO_HOST="demo-host"
    export LOCAL_HOST="localhost"
    export REMOTE_HOST="remote-host"
    export CURRENT_USER=$(whoami)
    export DEMO_PATH="demo/"
}

# Cleanup action system
cleanup_actions() {
    ACTION_REGISTRY=()
    ACTION_CACHE=()
}