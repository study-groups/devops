#!/bin/bash

# Hotrod Default Configuration
HOTROD_DIR="${TETRA_DIR:-$HOME/.tetra}/hotrod"
REMOTE_SERVER="${TETRA_REMOTE:-localhost}"
REMOTE_USER="${TETRA_REMOTE_USER:-root}"
PORT=9999

# Function: Show usage help
usage() {
    echo ""
    echo "🔥 Hotrod: Seamless Remote-to-Local Clipboard Streaming"
    echo ""
    echo "Usage: hotrod.sh [command]"
    echo ""
    echo "Commands:"
    echo "  --run             Start SSH tunnel & clipboard listener (single command)"
    echo "  --status          Show current Hotrod setup and status"
    echo "  --stop            Stop all Hotrod processes (SSH tunnel & clipboard)"
    echo "  --help            Show this help message"
    echo ""
    echo "Remote Usage:"
    echo "  Run on remote machine to send output to your local clipboard:"
    echo "    more * | hotrod"
    echo ""
    echo "Example Setup (Local):"
    echo "  hotrod.sh --run"
    echo ""
    echo "To manually start components:"
    echo "  hotrod.sh --status   # Show running components"
    echo "  hotrod.sh --stop     # Stop all hotrod-related jobs"
    echo ""
    exit 0
}

# Function: Check if SSH tunnel is running
is_tunnel_active() {
    pgrep -f "ssh -N -L $PORT:localhost:$PORT" >/dev/null
}

# Function: Start SSH tunnel (local → remote)
start_ssh_tunnel() {
    if is_tunnel_active; then
        echo "✅ SSH Tunnel is already running on port $PORT"
    else
        echo "🔗 Establishing SSH tunnel to $REMOTE_SERVER on port $PORT..."
        ssh -N -L $PORT:localhost:$PORT "$REMOTE_USER@$REMOTE_SERVER" &
        echo "✅ SSH Tunnel established."
    fi
}

# Function: Check if clipboard listener is running
is_clipboard_active() {
    pgrep -f "nc -lk $PORT" >/dev/null
}

# Function: Start clipboard listener (local)
start_clipboard_listener() {
    if is_clipboard_active; then
        echo "✅ Clipboard listener already running on port $PORT"
    else
        echo "📋 Hotrod Clipboard Listener Active on Port $PORT..."
        nc -lk $PORT | xclip -selection clipboard &
        echo "✅ Clipboard listener started."
    fi
}

# Function: Start both SSH tunnel and clipboard listener
hotrod_run() {
    echo "🚀 Starting Hotrod (SSH Tunnel + Clipboard Listener)..."
    start_ssh_tunnel
    start_clipboard_listener
}

# Function: Show Hotrod status
hotrod_status() {
    echo "🔥 Hotrod Status"
    echo "-----------------"
    if is_tunnel_active; then
        echo "✅ SSH Tunnel Active: $REMOTE_SERVER → localhost:$PORT"
    else
        echo "❌ SSH Tunnel Not Running"
    fi
    if is_clipboard_active; then
        echo "✅ Clipboard Listener Active on $PORT"
    else
        echo "❌ Clipboard Listener Not Running"
    fi
    echo "-----------------"
    echo "Run 'hotrod.sh --run' to start all processes"
    echo "Run 'hotrod.sh --stop' to kill all Hotrod-related jobs"
}

# Function: Stop all Hotrod processes
hotrod_stop() {
    echo "🛑 Stopping all Hotrod processes..."
    pkill -f "ssh -N -L $PORT:localhost:$PORT"
    pkill -f "nc -lk $PORT"
    echo "✅ All Hotrod processes stopped."
}

# Ensure help is shown when no arguments are provided
if [[ $# -eq 0 ]]; then
    usage
fi

# Parse command-line options
while [[ $# -gt 0 ]]; do
    case "$1" in
        --run)
            hotrod_run
            exit 0
            ;;
        --status)
            hotrod_status
            exit 0
            ;;
        --stop)
            hotrod_stop
            exit 0
            ;;
        --help)
            usage
            ;;
        *)
            echo "❌ Unknown command: $1"
            usage
            ;;
    esac
done
