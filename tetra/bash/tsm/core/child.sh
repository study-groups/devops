#!/usr/bin/env bash

# TSM Child Services - Parent/child service relationships
# Children don't get ports - they use Unix domain sockets for IPC

# Child service metadata extensions
# In .tsm service files:
#   TSM_PARENT="plenith"           # Parent service name
#   TSM_SOCKET_PATH="/tmp/tsm/..."  # Socket path (auto-generated if not set)
#   TSM_CHILDREN="pulsar quasar"   # Space-separated list of child services (for parents)

# Get socket path for a child service
tsm_child_socket_path() {
    local name="$1"
    echo "$TSM_SOCKETS_DIR/${name}.sock"
}

# Check if a service is a child (has a parent)
tsm_is_child_service() {
    local name="$1"
    local meta_file=$(tsm_get_meta_file "$name")

    if [[ -f "$meta_file" ]]; then
        local parent=$(jq -r '.parent // empty' "$meta_file" 2>/dev/null)
        [[ -n "$parent" ]]
    else
        return 1
    fi
}

# Get parent of a child service
tsm_get_parent() {
    local name="$1"
    local meta_file=$(tsm_get_meta_file "$name")

    if [[ -f "$meta_file" ]]; then
        jq -r '.parent // empty' "$meta_file" 2>/dev/null
    fi
}

# Get children of a parent service
tsm_get_children() {
    local parent_name="$1"
    local meta_file=$(tsm_get_meta_file "$parent_name")

    if [[ -f "$meta_file" ]]; then
        jq -r '.children // [] | .[]' "$meta_file" 2>/dev/null
    fi
}

# Start a child service (used by parent during startup)
# Sets up socket path and parent relationship
tsm_start_child() {
    local child_name="$1"
    local parent_name="$2"

    # Ensure sockets directory exists
    mkdir -p "$TSM_SOCKETS_DIR"

    # Generate socket path
    local socket_path=$(tsm_child_socket_path "$child_name")

    # Remove stale socket if exists
    [[ -S "$socket_path" ]] && rm -f "$socket_path"

    # Export for child process
    export TSM_SOCKET_PATH="$socket_path"
    export TSM_PARENT="$parent_name"

    # Find and start the child service definition
    local service_file
    service_file=$(tsm_find_service_file "$child_name")

    if [[ -z "$service_file" ]]; then
        tsm_error "Child service not found: $child_name"
        return 1
    fi

    # Load service definition
    source "$service_file"

    # Start the service
    tetra_tsm_start "$child_name"
}

# Stop all children of a parent
tsm_stop_children() {
    local parent_name="$1"

    local children=$(tsm_get_children "$parent_name")

    for child in $children; do
        if tsm_process_exists "$child"; then
            echo "Stopping child: $child"
            tetra_tsm_stop "$child"
        fi
    done
}

# Check if all children of a parent are healthy
tsm_children_healthy() {
    local parent_name="$1"

    local children=$(tsm_get_children "$parent_name")

    for child in $children; do
        if ! tsm_process_exists "$child"; then
            return 1
        fi

        # Check socket health if socket-based
        local socket_path=$(tsm_child_socket_path "$child")
        if [[ -S "$socket_path" ]]; then
            if ! tsm_socket_health "$child" 2>/dev/null; then
                return 1
            fi
        fi
    done

    return 0
}

# Register a child with its parent (called during child startup)
tsm_register_child() {
    local child_name="$1"
    local parent_name="$2"
    local socket_path="$3"

    local child_meta=$(tsm_get_meta_file "$child_name")

    if [[ -f "$child_meta" ]]; then
        # Update child metadata with parent info
        local temp_file="${child_meta}.tmp"
        jq --arg parent "$parent_name" --arg socket "$socket_path" \
            '. + {parent: $parent, socket_path: $socket}' \
            "$child_meta" > "$temp_file"
        mv "$temp_file" "$child_meta"
    fi

    # Update parent metadata with child
    local parent_meta=$(tsm_get_meta_file "$parent_name")

    if [[ -f "$parent_meta" ]]; then
        local temp_file="${parent_meta}.tmp"
        jq --arg child "$child_name" \
            '.children = ((.children // []) + [$child] | unique)' \
            "$parent_meta" > "$temp_file"
        mv "$temp_file" "$parent_meta"
    fi
}

# Unregister a child from its parent (called during child shutdown)
tsm_unregister_child() {
    local child_name="$1"

    local parent_name=$(tsm_get_parent "$child_name")
    [[ -z "$parent_name" ]] && return 0

    local parent_meta=$(tsm_get_meta_file "$parent_name")

    if [[ -f "$parent_meta" ]]; then
        local temp_file="${parent_meta}.tmp"
        jq --arg child "$child_name" \
            '.children = ((.children // []) - [$child])' \
            "$parent_meta" > "$temp_file"
        mv "$temp_file" "$parent_meta"
    fi

    # Clean up socket
    local socket_path=$(tsm_child_socket_path "$child_name")
    [[ -S "$socket_path" ]] && rm -f "$socket_path"
}

# List all child services with status
tsm_list_children() {
    local parent_name="$1"

    echo "Children of $parent_name:"
    echo "========================="

    local children=$(tsm_get_children "$parent_name")

    if [[ -z "$children" ]]; then
        echo "No children registered"
        return 0
    fi

    for child in $children; do
        local status="unknown"
        local socket_status=""

        if tsm_process_exists "$child"; then
            status="online"
        else
            status="offline"
        fi

        local socket_path=$(tsm_child_socket_path "$child")
        if [[ -S "$socket_path" ]]; then
            if tsm_socket_health "$child" 2>/dev/null; then
                socket_status="socket:healthy"
            else
                socket_status="socket:no-response"
            fi
        else
            socket_status="socket:none"
        fi

        printf "  %-20s %s (%s)\n" "$child" "$status" "$socket_status"
    done
}

# Export functions
export -f tsm_child_socket_path
export -f tsm_is_child_service
export -f tsm_get_parent
export -f tsm_get_children
export -f tsm_start_child
export -f tsm_stop_children
export -f tsm_children_healthy
export -f tsm_register_child
export -f tsm_unregister_child
export -f tsm_list_children
