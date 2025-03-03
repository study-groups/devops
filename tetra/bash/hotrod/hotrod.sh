#!/bin/bash

# Hotrod Configuration
HOTROD_DIR="${TETRA_DIR:-$HOME/.tetra}/hotrod"
REMOTE_SERVER="${TETRA_REMOTE:-localhost}"
REMOTE_USER="${TETRA_REMOTE_USER:-root}"
PORT=9999  # Clipboard Listener
FIFO_FILE="$HOTROD_DIR/hotrod.fifo"  # Named pipe for remote input
LISTENER_PID_FILE="$HOTROD_DIR/listener.pid"

is_remote() { [[ -n "$SSH_CLIENT" || -n "$SSH_TTY" ]]; }

usage() {
    echo ""
    echo "🚗💨 Hotrod: Remote-to-Local Clipboard Streaming"
    echo ""
    echo "Usage: hotrod.sh [command]"
    echo ""
    if is_remote; then
        echo "Remote Mode (Client):"
        echo "  Pipe data into Hotrod via SSH Tunnel:"
        echo "    echo 'Hello' | hotrod"
    else
        echo "Home Base (Server):"
        echo "  --run             Start clipboard listener"
        echo "  --status          Show Hotrod status"
        echo "  --check           Perform a system check for SSH & dependencies"
        echo "  --stop            Stop all Hotrod processes"
        echo "  --kill            Kill all processes using port $PORT"
    fi
    echo ""
    exit 0
}

hotrod_kill() {
    echo "🔍 Stopping Hotrod processes..."

    local pids
    pids=$(lsof -ti tcp:$PORT)

    if [[ -n "$pids" ]]; then
        echo "🔪 Killing processes on port $PORT: $pids"
        kill -9 $pids
        sleep 1
    fi

    # Release lingering ports
    if ss -tln | grep -q ":$PORT "; then
        echo "⚠️ Port $PORT still in use, forcing unbind..."
        fuser -k "$PORT"/tcp
        sleep 1
    fi

    rm -f "$LISTENER_PID_FILE" "$FIFO_FILE"
    echo "✅ Hotrod stopped."
}

hotrod_check_ports() {
    echo "Checking port $PORT..."
    if ss -tln | grep -q ":$PORT "; then
        echo "⚠️ Port $PORT is in use."
    else
        echo "✅ Port $PORT is free."
    fi
}

start_clipboard_listener() {
    is_remote && { echo "Cannot start listener from remote."; exit 1; }
    echo "📋 Starting Clipboard Listener on port $PORT..."

    hotrod_kill  # Ensure the port is clean

    # Ensure FIFO exists
    [[ -p "$FIFO_FILE" ]] || mkfifo "$FIFO_FILE"

    # Start TCP listener -> FIFO
    socat -u TCP-LISTEN:$PORT,reuseaddr,fork OPEN:$FIFO_FILE &
    echo $! > "$LISTENER_PID_FILE"

    # Read from FIFO and print to stdout for debugging
    ( while true; do cat "$FIFO_FILE"; done ) &

    echo "✅ Clipboard listener started. FIFO available at $FIFO_FILE"
}

hotrod_run() {
    echo "🚗💨 Starting Hotrod..."
    echo "   User   : $(whoami)"
    echo "   Host   : $(hostname)"
    echo "   Remote : $REMOTE_USER@$REMOTE_SERVER"
    echo "   Clipboard Port   : $PORT"

    hotrod_check_ports
    hotrod_kill
    start_clipboard_listener
}

hotrod_status() {
    echo "🔥 Hotrod Status"
    echo "Mode            : $(is_remote && echo Remote Client || echo Home Base)"
    echo "Clipboard Port  : $PORT"
    echo -n "Listener        : "
    [[ -f "$LISTENER_PID_FILE" ]] && echo "Running" || echo "Not Running"

    # Check if FIFO exists
    [[ -p "$FIFO_FILE" ]] && echo "FIFO            : Exists ($FIFO_FILE)" || echo "FIFO            : ❌ Missing"

    # Check active connections
    active_clients=$(ss -tn sport = :$PORT | tail -n +2 | wc -l)
    echo "Active Clients  : $active_clients"

    # Display last received data
    [[ -s "$FIFO_FILE" ]] && echo "Last Received   : $(tail -n 1 "$FIFO_FILE")" || echo "Last Received   : (No recent data)"
}

# **Remote Mode Handling**
if is_remote; then
    echo "🔗 Sending data to Mothership via FIFO..."

    if ! ss -tln | grep -q ":$PORT "; then
        echo "❌ Error: Connection to Mothership failed. Check SSH."
        exit 1
    fi

    if [[ -t 0 ]]; then
        echo "hotrod_ping" | socat - TCP:localhost:"$PORT"
        response=$(socat - TCP:localhost:"$PORT")
        if [[ -n "$response" ]]; then
            echo "✅ Mothership Response: $response"
        else
            echo "⚠️ No response from Mothership."
        fi
        exit 0
    else
        cat | socat - TCP:localhost:"$PORT" && echo "✅ Clipboard data sent successfully."
        exit 0
    fi
fi

[[ $# -eq 0 ]] && usage

while [[ $# -gt 0 ]]; do
    case "$1" in
        --run) is_remote && exit 1; hotrod_run; exit 0 ;;
        --status) hotrod_status; exit 0 ;;
        --check) hotrod_check_ports; exit 0 ;;
        --stop) is_remote && exit 1; hotrod_kill; exit 0 ;;
        --kill) hotrod_kill; exit 0 ;;
        --help) usage ;;
        *) 
            echo "Unknown command: $1"
            usage
            ;;
    esac
done
