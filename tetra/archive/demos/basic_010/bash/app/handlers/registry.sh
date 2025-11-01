#!/usr/bin/env bash

# TUI Action Handler Registry
# Manages discovery, loading, and execution of action handlers

# Handler registry
declare -A HANDLER_REGISTRY=()
declare -A HANDLER_CACHE=()
declare -A HANDLER_METADATA=()

# Registry configuration
HANDLERS_DIR="${HANDLERS_DIR:-$(dirname "${BASH_SOURCE[0]}")}"
HANDLER_CONFIG="${HANDLER_CONFIG:-$HANDLERS_DIR/../../../config/tui_actions.conf}"

# Initialize the handler registry
init_handler_registry() {
    handler_log "INFO" "Initializing handler registry from $HANDLERS_DIR"

    # Clear existing registry
    HANDLER_REGISTRY=()
    HANDLER_CACHE=()
    HANDLER_METADATA=()

    # Load configuration if available
    if [[ -f "$HANDLER_CONFIG" ]]; then
        load_handler_config
    fi

    # Auto-discover handlers in handlers directory
    discover_handlers

    # Load default handlers for core actions
    register_default_handlers

    handler_log "INFO" "Handler registry initialized with ${#HANDLER_REGISTRY[@]} handlers"
}

# Load handler configuration from file
load_handler_config() {
    if [[ ! -f "$HANDLER_CONFIG" ]]; then
        return 0
    fi

    handler_log "INFO" "Loading handler configuration from $HANDLER_CONFIG"

    while IFS='=' read -r action handler_path; do
        # Skip comments and empty lines
        [[ "$action" =~ ^#.*$ || -z "$action" ]] && continue

        # Register the handler mapping
        HANDLER_REGISTRY["$action"]="$handler_path"
        handler_log "DEBUG" "Configured handler: $action → $handler_path"
    done < "$HANDLER_CONFIG"
}

# Auto-discover handlers in the handlers directory
discover_handlers() {
    local handler_files=("$HANDLERS_DIR"/*_handler.sh)

    for handler_file in "${handler_files[@]}"; do
        [[ ! -f "$handler_file" ]] && continue

        local handler_name=$(basename "$handler_file" .sh)

        # Skip base handler
        [[ "$handler_name" == "base_handler" ]] && continue

        # Try to determine what actions this handler supports
        if discover_handler_actions "$handler_file"; then
            handler_log "DEBUG" "Discovered handler: $handler_file"
        fi
    done
}

# Discover what actions a handler file supports
discover_handler_actions() {
    local handler_file="$1"
    local discovered=false

    # Look for action patterns in the handler file
    if grep -q "^handle_.*() {" "$handler_file"; then
        # Extract action patterns
        while IFS= read -r line; do
            if [[ "$line" =~ ^handle_([a-z]+)_([a-z]+)\(\) ]]; then
                local verb="${BASH_REMATCH[1]}"
                local noun="${BASH_REMATCH[2]}"
                local action="$verb:$noun"

                HANDLER_REGISTRY["$action"]="$handler_file"
                discovered=true
                handler_log "DEBUG" "Discovered action: $action → $handler_file"
            fi
        done < "$handler_file"
    fi

    return $([ "$discovered" = true ] && echo 0 || echo 1)
}

# Register default handlers for core actions
register_default_handlers() {
    # Register built-in handlers for core TUI actions
    local core_actions=(
        "show:demo"
        "show:colors"
        "show:input"
        "show:tui"
        "configure:demo"
        "configure:colors"
        "test:tui"
    )

    for action in "${core_actions[@]}"; do
        if [[ -z "${HANDLER_REGISTRY[$action]}" ]]; then
            # Use default handler if no specific handler found
            HANDLER_REGISTRY["$action"]="$HANDLERS_DIR/default_handler.sh"
            handler_log "DEBUG" "Registered default handler for: $action"
        fi
    done
}

# Find handler for a given action
find_handler() {
    local verb="$1"
    local noun="$2"
    local env="$3"
    local mode="$4"
    local action="$verb:$noun"

    # Check direct mapping first
    if [[ -n "${HANDLER_REGISTRY[$action]}" ]]; then
        echo "${HANDLER_REGISTRY[$action]}"
        return 0
    fi

    # Check wildcard patterns
    for pattern in "${!HANDLER_REGISTRY[@]}"; do
        case "$pattern" in
            "$verb:*")
                echo "${HANDLER_REGISTRY[$pattern]}"
                return 0
                ;;
            "*:$noun")
                echo "${HANDLER_REGISTRY[$pattern]}"
                return 0
                ;;
        esac
    done

    # Fallback to default handler
    local default_handler="$HANDLERS_DIR/default_handler.sh"
    if [[ -f "$default_handler" ]]; then
        echo "$default_handler"
        return 0
    fi

    # No handler found
    return 1
}

# Load and cache handler
load_handler() {
    local handler_path="$1"
    local action="$2"

    # Check if already cached
    if [[ -n "${HANDLER_CACHE[$action]}" ]]; then
        return 0
    fi

    # Verify handler file exists
    if [[ ! -f "$handler_path" ]]; then
        handler_log "ERROR" "Handler file not found: $handler_path" "$action"
        return 1
    fi

    # Source the handler
    if source "$handler_path"; then
        HANDLER_CACHE["$action"]="$handler_path"
        handler_log "DEBUG" "Loaded handler: $handler_path" "$action"
        return 0
    else
        handler_log "ERROR" "Failed to load handler: $handler_path" "$action"
        return 1
    fi
}

# Execute action using appropriate handler
execute_action_with_handler() {
    local verb="$1"
    local noun="$2"
    local env="$3"
    local mode="$4"
    shift 4
    local args=("$@")

    local action="$verb:$noun"
    local handler_path

    # Find appropriate handler
    if ! handler_path=$(find_handler "$verb" "$noun" "$env" "$mode"); then
        handler_log "ERROR" "No handler found for action: $action"
        return 1
    fi

    # Load handler
    if ! load_handler "$handler_path" "$action"; then
        handler_log "ERROR" "Failed to load handler for action: $action"
        return 1
    fi

    # Validate that handler can execute this action
    if ! handler_can_execute "$verb" "$noun" "$env" "$mode"; then
        handler_log "ERROR" "Handler cannot execute action: $action"
        return 1
    fi

    # Validate input parameters
    if ! handler_validate "$verb" "$noun" "$env" "$mode" "${args[@]}"; then
        handler_log "ERROR" "Input validation failed for action: $action"
        return 1
    fi

    # Execute the action
    handler_log "INFO" "Executing action: $action with handler: $(basename "$handler_path")"

    local result
    local exit_code

    if result=$(handler_execute "$verb" "$noun" "$env" "$mode" "${args[@]}"); then
        exit_code=0
        handler_log "INFO" "Action executed successfully: $action"
    else
        exit_code=$?
        handler_log "ERROR" "Action execution failed: $action (exit code: $exit_code)"
    fi

    # Cleanup
    handler_cleanup "$verb" "$noun" "$env" "$mode"

    # Return results
    echo "$result"
    return $exit_code
}

# Get action description using handler
get_action_description_from_handler() {
    local verb="$1"
    local noun="$2"
    local env="$3"
    local mode="$4"

    local action="$verb:$noun"
    local handler_path

    # Find and load handler
    if handler_path=$(find_handler "$verb" "$noun" "$env" "$mode") && \
       load_handler "$handler_path" "$action"; then
        handler_describe "$verb" "$noun" "$env" "$mode"
    else
        echo "No description available for $action"
    fi
}

# Get handler metadata
get_handler_metadata() {
    local verb="$1"
    local noun="$2"
    local action="$verb:$noun"

    # Check cache first
    if [[ -n "${HANDLER_METADATA[$action]}" ]]; then
        echo "${HANDLER_METADATA[$action]}"
        return 0
    fi

    local handler_path
    if handler_path=$(find_handler "$verb" "$noun" "" "") && \
       load_handler "$handler_path" "$action"; then
        local metadata=$(handler_get_metadata "$verb" "$noun")
        HANDLER_METADATA["$action"]="$metadata"
        echo "$metadata"
    else
        echo "{\"error\": \"No handler found for $action\"}"
    fi
}

# List all registered handlers
list_handlers() {
    echo "Registered Action Handlers:"
    echo "==========================="
    for action in "${!HANDLER_REGISTRY[@]}"; do
        echo "$action → ${HANDLER_REGISTRY[$action]}"
    done
}

# Reload handler registry
reload_handlers() {
    handler_log "INFO" "Reloading handler registry"
    init_handler_registry
}

# Validate handler integrity
validate_handler() {
    local handler_path="$1"

    if [[ ! -f "$handler_path" ]]; then
        echo "ERROR: Handler file not found: $handler_path"
        return 1
    fi

    # Check if handler implements required interface
    if ! grep -q "handler_execute" "$handler_path"; then
        echo "ERROR: Handler missing required handler_execute function: $handler_path"
        return 1
    fi

    echo "Handler validation passed: $handler_path"
    return 0
}

# Source base handler interface
if [[ -f "$HANDLERS_DIR/base_handler.sh" ]]; then
    source "$HANDLERS_DIR/base_handler.sh"
else
    echo "WARNING: Base handler interface not found" >&2
fi