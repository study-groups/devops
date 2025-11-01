#!/usr/bin/env bash

# tubes_core.sh - Core FIFO and routing functionality

# Source paths
source "${TUBES_SRC}/tubes_paths.sh"

# Create a new tube (named FIFO endpoint)
tubes_create() {
    local tube_name="$1"
    local description="${2:-Terminal endpoint}"

    [[ -z "$tube_name" ]] && {
        echo "Error: Tube name required" >&2
        return 1
    }

    local tube_path=$(tubes_get_tube_path "$tube_name")
    local control_path=$(tubes_get_control_path "$tube_name")

    # Check if tube already exists
    if [[ -p "$tube_path" ]]; then
        echo "Tube '$tube_name' already exists at $tube_path"
        return 0
    fi

    # Create FIFOs
    mkfifo "$tube_path" 2>/dev/null || {
        echo "Error: Failed to create tube FIFO" >&2
        return 1
    }

    mkfifo "$control_path" 2>/dev/null || {
        rm -f "$tube_path"
        echo "Error: Failed to create control FIFO" >&2
        return 1
    }

    # Register the tube
    tubes_register "$tube_name" "$description"

    echo "Created tube: @tube:$tube_name"
    echo "  Data:    $tube_path"
    echo "  Control: $control_path"
}

# Register tube in registry
tubes_register() {
    local tube_name="$1"
    local description="$2"
    local registry=$(tubes_get_registry)
    local timestamp=$(tubes_generate_timestamp)

    # Initialize registry if doesn't exist
    if [[ ! -f "$registry" ]]; then
        echo '{"tubes":{}}' > "$registry"
    fi

    # Update registry using jq
    if command -v jq >/dev/null 2>&1; then
        local temp_registry=$(mktemp)
        local tty_value=$(tty 2>/dev/null || echo 'none')
        local fifo_path=$(tubes_get_tube_path "$tube_name")
        local control_path=$(tubes_get_control_path "$tube_name")

        # Use jq args instead of argjson for better escaping
        jq \
           --arg name "$tube_name" \
           --arg desc "$description" \
           --arg ts "$timestamp" \
           --arg pid "$$" \
           --arg tty "$tty_value" \
           --arg fifo "$fifo_path" \
           --arg ctrl "$control_path" \
           '.tubes[$name] = {
               "name": $name,
               "description": $desc,
               "created_at": $ts,
               "pid": ($pid | tonumber),
               "tty": $tty,
               "fifo": $fifo,
               "control": $ctrl
           }' \
           "$registry" > "$temp_registry"
        mv "$temp_registry" "$registry"
    else
        # Fallback without jq (basic implementation)
        echo "Warning: jq not found, registry update limited" >&2
    fi
}

# Destroy a tube
tubes_destroy() {
    local tube_name="$1"

    [[ -z "$tube_name" ]] && {
        echo "Error: Tube name required" >&2
        return 1
    }

    local tube_path=$(tubes_get_tube_path "$tube_name")
    local control_path=$(tubes_get_control_path "$tube_name")

    # Remove FIFOs
    rm -f "$tube_path" "$control_path"

    # Unregister
    tubes_unregister "$tube_name"

    echo "Destroyed tube: $tube_name"
}

# Unregister tube from registry
tubes_unregister() {
    local tube_name="$1"
    local registry=$(tubes_get_registry)

    if [[ -f "$registry" ]] && command -v jq >/dev/null 2>&1; then
        local temp_registry=$(mktemp)
        jq "del(.tubes[\"$tube_name\"])" "$registry" > "$temp_registry"
        mv "$temp_registry" "$registry"
    fi
}

# List all active tubes
tubes_list() {
    local registry=$(tubes_get_registry)

    if [[ ! -f "$registry" ]]; then
        echo "No tubes registered"
        return 0
    fi

    if command -v jq >/dev/null 2>&1; then
        echo "Active Tubes:"
        echo "============="
        # Use simpler column formatting for macOS compatibility
        jq -r '.tubes | to_entries[] | "\(.key)\t\(.value.description)\t\(.value.tty)"' "$registry" | \
            column -t -s $'\t' 2>/dev/null || \
            jq -r '.tubes | to_entries[] | "\(.key)  \(.value.description)  \(.value.tty)"' "$registry"
    else
        echo "Registry: $registry"
        cat "$registry"
    fi
}

# Send message to a tube
tubes_send() {
    local tube_name="$1"
    local message="$2"

    [[ -z "$tube_name" ]] && {
        echo "Error: Tube name required" >&2
        return 1
    }

    local tube_path=$(tubes_get_tube_path "$tube_name")

    if [[ ! -p "$tube_path" ]]; then
        echo "Error: Tube '$tube_name' does not exist" >&2
        return 1
    fi

    # Send message (non-blocking with timeout)
    echo "$message" > "$tube_path" &
    local send_pid=$!

    # Timeout after 5 seconds if no reader
    ( sleep 5; kill -0 $send_pid 2>/dev/null && kill $send_pid 2>/dev/null ) &

    wait $send_pid 2>/dev/null
    local exit_code=$?

    if [[ $exit_code -eq 0 ]]; then
        echo "Message sent to @tube:$tube_name"
    else
        echo "Warning: Message may not have been delivered (no reader?)" >&2
        return 1
    fi
}

# Receive message from a tube
tubes_receive() {
    local tube_name="$1"
    local timeout="${2:-30}"

    [[ -z "$tube_name" ]] && {
        echo "Error: Tube name required" >&2
        return 1
    }

    local tube_path=$(tubes_get_tube_path "$tube_name")

    if [[ ! -p "$tube_path" ]]; then
        echo "Error: Tube '$tube_name' does not exist" >&2
        return 1
    fi

    # Read with timeout
    if timeout "$timeout" cat "$tube_path"; then
        return 0
    else
        echo "Error: Timeout waiting for message" >&2
        return 1
    fi
}

# Listen to a tube continuously
tubes_listen() {
    local tube_name="$1"
    local callback="${2:-tubes_default_handler}"

    [[ -z "$tube_name" ]] && {
        echo "Error: Tube name required" >&2
        return 1
    }

    local tube_path=$(tubes_get_tube_path "$tube_name")

    if [[ ! -p "$tube_path" ]]; then
        echo "Error: Tube '$tube_name' does not exist" >&2
        return 1
    fi

    echo "Listening on @tube:$tube_name (Ctrl+C to stop)"

    while true; do
        if read -r message < "$tube_path"; then
            "$callback" "$tube_name" "$message"
        fi
    done
}

# Default message handler
tubes_default_handler() {
    local tube_name="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    echo "[$timestamp] @tube:$tube_name: $message"
}

# Discover active tubes
tubes_discover() {
    local fifos_dir=$(tubes_get_fifos_dir)

    echo "Discovering tubes..."

    # Clean up stale FIFOs (those without entries in registry)
    if [[ -d "$fifos_dir" ]]; then
        local count=0
        for fifo in "$fifos_dir"/*.fifo; do
            [[ -e "$fifo" ]] || continue

            local tube_name=$(basename "$fifo" .fifo)

            # Check if has active reader/writer
            if ! fuser "$fifo" >/dev/null 2>&1; then
                echo "  Stale: $tube_name (cleaning up)"
                tubes_destroy "$tube_name"
            else
                echo "  Active: $tube_name"
                ((count++))
            fi
        done

        echo "Found $count active tube(s)"
    else
        echo "No tubes directory found"
    fi
}

# Cleanup all tubes
tubes_cleanup() {
    local fifos_dir=$(tubes_get_fifos_dir)

    echo "Cleaning up all tubes..."

    if [[ -d "$fifos_dir" ]]; then
        rm -f "$fifos_dir"/*.fifo
        rm -f "$fifos_dir"/*.control
    fi

    local registry=$(tubes_get_registry)
    if [[ -f "$registry" ]]; then
        echo '{"tubes":{}}' > "$registry"
    fi

    echo "Cleanup complete"
}
