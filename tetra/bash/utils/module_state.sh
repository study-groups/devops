#!/usr/bin/env bash

# Tetra Module State System - Custom Function State Tracking
# Replaces problematic bash associative arrays with delimited string approach
# Similar to module_metadata.sh but for tracking function loading state

# Function state storage using delimited strings
# Format: module|function|status|timestamp
TETRA_FUNCTION_STATE=""

# Set function state
tetra_set_function_state() {
    local module="$1"
    local function_name="$2"
    local status="$3"
    local timestamp="${4:-$(date +%s)}"

    # Validate inputs
    if [[ -z "$module" || -z "$function_name" || -z "$status" ]]; then
        echo "Error: Module, function name, and status are required" >&2
        return 1
    fi

    # Remove existing entry for this function (before escaping)
    tetra_remove_function_state "$module" "$function_name"

    # Escape delimiter characters in input
    module="${module//|/__PIPE__}"
    function_name="${function_name//|/__PIPE__}"
    status="${status//|/__PIPE__}"

    # Format: module|function|status|timestamp
    local entry="${module}|${function_name}|${status}|${timestamp}"

    # Add new entry
    if [[ -z "$TETRA_FUNCTION_STATE" ]]; then
        TETRA_FUNCTION_STATE="$entry"
    else
        TETRA_FUNCTION_STATE="${TETRA_FUNCTION_STATE}"$'\n'"${entry}"
    fi
}

# Get function state
tetra_get_function_state() {
    local module="$1"
    local function_name="$2"
    local escaped_module="${module//|/__PIPE__}"
    local escaped_function="${function_name//|/__PIPE__}"

    if [[ -z "$TETRA_FUNCTION_STATE" ]]; then
        echo "unknown"
        return 1
    fi

    # Use while read to avoid IFS manipulation entirely
    while IFS='|' read -r entry_module entry_function entry_status _; do
        # Unescape for comparison
        if [[ "$entry_module" == "$escaped_module" && "$entry_function" == "$escaped_function" ]]; then
            echo "${entry_status//__PIPE__/|}"
            return 0
        fi
    done <<< "$TETRA_FUNCTION_STATE"
    echo "unknown"
    return 1
}

# Remove function state entry
tetra_remove_function_state() {
    local module="$1"
    local function_name="$2"
    local escaped_module="${module//|/__PIPE__}"
    local escaped_function="${function_name//|/__PIPE__}"

    if [[ -z "$TETRA_FUNCTION_STATE" ]]; then
        return 0
    fi

    # Use while read to avoid IFS manipulation entirely
    local new_state=""
    while IFS= read -r entry; do
        [[ -z "$entry" ]] && continue
        local entry_module="${entry%%|*}"
        local rest="${entry#*|}"
        local entry_function="${rest%%|*}"

        if [[ "$entry_module" != "$escaped_module" || "$entry_function" != "$escaped_function" ]]; then
            if [[ -z "$new_state" ]]; then
                new_state="$entry"
            else
                new_state="${new_state}"$'\n'"${entry}"
            fi
        fi
    done <<< "$TETRA_FUNCTION_STATE"
    TETRA_FUNCTION_STATE="$new_state"
}

# Check if function actually exists in current shell
tetra_function_exists() {
    local function_name="$1"
    declare -F "$function_name" >/dev/null 2>&1
}

# List all tracked functions
tetra_list_function_states() {
    if [[ -z "$TETRA_FUNCTION_STATE" ]]; then
        echo "No function states tracked"
        return 0
    fi

    echo "Module|Function|Status|Timestamp"
    echo "--------------------------------"

    # Use while read to avoid IFS manipulation entirely
    while IFS= read -r entry; do
        [[ -z "$entry" ]] && continue
        # Unescape pipe characters for display
        echo "${entry//__PIPE__/|}"
    done <<< "$TETRA_FUNCTION_STATE"
}

# Debug: Show current state
tetra_debug_function_state() {
    echo "=== TETRA Function State Debug ==="
    echo "Raw state: '$TETRA_FUNCTION_STATE'"
    echo ""
    tetra_list_function_states
}