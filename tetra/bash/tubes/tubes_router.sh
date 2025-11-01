#!/usr/bin/env bash

# tubes_router.sh - Simple message router for tube networks

source "${TUBES_SRC}/tubes_paths.sh"
source "${TUBES_SRC}/tubes_core.sh"

# Start the router daemon
tubes_router_start() {
    local router_pid_file=$(tubes_get_router_pid)
    local router_log=$(tubes_get_router_log)

    # Check if already running
    if [[ -f "$router_pid_file" ]]; then
        local pid=$(cat "$router_pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            echo "Router already running (PID: $pid)"
            return 0
        else
            echo "Removing stale PID file"
            rm -f "$router_pid_file"
        fi
    fi

    # Start router in background
    tubes_router_daemon >> "$router_log" 2>&1 &
    local router_pid=$!

    echo "$router_pid" > "$router_pid_file"
    echo "Router started (PID: $router_pid)"
    echo "Log: $router_log"
}

# Stop the router daemon
tubes_router_stop() {
    local router_pid_file=$(tubes_get_router_pid)

    if [[ ! -f "$router_pid_file" ]]; then
        echo "Router not running"
        return 0
    fi

    local pid=$(cat "$router_pid_file")

    if kill -0 "$pid" 2>/dev/null; then
        kill "$pid"
        rm -f "$router_pid_file"
        echo "Router stopped (PID: $pid)"
    else
        echo "Router not running (stale PID file)"
        rm -f "$router_pid_file"
    fi
}

# Router status
tubes_router_status() {
    local router_pid_file=$(tubes_get_router_pid)

    if [[ ! -f "$router_pid_file" ]]; then
        echo "Router: stopped"
        return 1
    fi

    local pid=$(cat "$router_pid_file")

    if kill -0 "$pid" 2>/dev/null; then
        echo "Router: running (PID: $pid)"
        echo "Log: $(tubes_get_router_log)"
        return 0
    else
        echo "Router: stopped (stale PID file)"
        rm -f "$router_pid_file"
        return 1
    fi
}

# Router daemon (runs in background)
tubes_router_daemon() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] Router daemon starting (PID: $$)"

    # Create router control tube
    tubes_create "router-control" "Router control channel" >/dev/null

    local control_path=$(tubes_get_tube_path "router-control")

    # Main router loop
    while true; do
        if read -r command < "$control_path"; then
            tubes_router_handle_command "$command"
        fi

        # Small sleep to prevent busy-wait
        sleep 0.1
    done
}

# Handle router commands
tubes_router_handle_command() {
    local command="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    echo "[$timestamp] Router command: $command"

    # Parse command: route:source:target:message
    if [[ "$command" =~ ^route:([^:]+):([^:]+):(.+)$ ]]; then
        local source="${BASH_REMATCH[1]}"
        local target="${BASH_REMATCH[2]}"
        local message="${BASH_REMATCH[3]}"

        tubes_router_route "$source" "$target" "$message"
    elif [[ "$command" == "shutdown" ]]; then
        echo "[$timestamp] Router shutting down"
        exit 0
    else
        echo "[$timestamp] Unknown command: $command"
    fi
}

# Route message from source to target
tubes_router_route() {
    local source="$1"
    local target="$2"
    local message="$3"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    echo "[$timestamp] Routing: $source -> $target: $message"

    # Check if target tube exists
    local target_path=$(tubes_get_tube_path "$target")

    if [[ ! -p "$target_path" ]]; then
        echo "[$timestamp] Error: Target tube '$target' does not exist"
        return 1
    fi

    # Format message with source
    local routed_message="[from:$source] $message"

    # Send to target (non-blocking)
    echo "$routed_message" > "$target_path" &
}

# Send message via router
tubes_route() {
    local target="$1"
    local message="$2"
    local source="${3:-$(tty | sed 's/\/dev\///')}"

    [[ -z "$target" ]] && {
        echo "Error: Target tube required" >&2
        return 1
    }

    [[ -z "$message" ]] && {
        echo "Error: Message required" >&2
        return 1
    }

    # Check if router is running
    if ! tubes_router_status >/dev/null 2>&1; then
        echo "Error: Router not running. Start with 'tubes router start'" >&2
        return 1
    fi

    # Send route command to router
    local control_path=$(tubes_get_tube_path "router-control")
    local route_command="route:$source:$target:$message"

    echo "$route_command" > "$control_path" &

    echo "Routed message: $source -> @tube:$target"
}
