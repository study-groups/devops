#!/usr/bin/env bash

# TSM Handler Base Interface
# Defines the standard interface that all TSM handlers must implement
# Based on demo/basic/010 handler pattern

# Validate if this handler can execute the given action
# Returns: 0 if can handle, 1 if cannot
handler_can_execute() {
    local verb="$1"
    local noun="$2"
    local env="${3:-}"
    local mode="${4:-}"

    # Default implementation - should be overridden by concrete handlers
    echo "ERROR: handler_can_execute not implemented in handler" >&2
    return 1
}

# Execute the action and return results
# Returns: stdout content, exit code indicates success/failure
handler_execute() {
    local verb="$1"
    local noun="$2"
    local env="${3:-}"
    local mode="${4:-}"
    shift 4
    local args=("$@")

    # Default implementation - should be overridden by concrete handlers
    echo "ERROR: handler_execute not implemented in handler" >&2
    return 1
}

# Get description of what this action does
# Returns: Human-readable description
handler_describe() {
    local verb="$1"
    local noun="$2"

    # Default implementation - should be overridden
    echo "No description available for $verb $noun"
}

# Get list of supported verbs for this handler
# Returns: Space-separated list of verbs this handler supports
handler_get_verbs() {
    # Default implementation - should be overridden
    echo ""
}

# Validate handler implementation
# Returns: 0 if handler is properly implemented, 1 if not
handler_validate() {
    local handler_name="$1"

    # Check if required functions are implemented
    if ! declare -f handler_can_execute >/dev/null; then
        echo "ERROR: $handler_name missing handler_can_execute function" >&2
        return 1
    fi

    if ! declare -f handler_execute >/dev/null; then
        echo "ERROR: $handler_name missing handler_execute function" >&2
        return 1
    fi

    return 0
}