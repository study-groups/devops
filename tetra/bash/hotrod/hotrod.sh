#!/bin/bash
HOTROD_SRC="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
source "$HOTROD_SRC/hotrod_remote.sh"
source "$HOTROD_SRC/hotrod_server.sh"

# Use sensible defaults from environment variables
HOTROD_DIR="${TETRA_DIR:-$HOME/.tetra}/hotrod"
REMOTE_SERVER="${TETRA_REMOTE:-localhost}"
REMOTE_USER="${TETRA_REMOTE_USER:-root}"
REMOTE_DIR="${TETRA_REMOTE_DIR:-/opt/hotrod}"
PORT=9999
MODE="remote"
START_SERVER=false
SSH_TUNNEL_PID=""
MESSAGE=""

# Function to display usage
usage() {
    echo "Usage: hotrod.sh [options] [message]"
    echo "Options:"
    echo " -s, --start         Start the Hotrod server"
    echo " -l, --local         Run Hotrod locally (skip SSH tunnel)"
    echo " -h, --help          Show this help message"
    echo ""
    echo "Message can be passed either as an argument:"
    echo "   ./hotrod.sh \"Message to send\""
    echo ""
    echo "Or via stdin:"
    echo "   echo \"Message to send\" | ./hotrod.sh"
    echo ""
    echo "Clipboard Mode: If running on a remote machine, output will be sent to the local clipboard."
    echo ""
    echo "By default, this script automatically establishes an SSH tunnel to the remote server:"
    echo "   ssh -N -L $PORT:localhost:$PORT $REMOTE_USER@$REMOTE_SERVER"
    echo ""
    echo "Remote Hotrod directory: $REMOTE_DIR"
    echo "Local Hotrod directory: $HOTROD_DIR"
    echo ""
    exit 0
}

# Function to start the SSH tunnel
start_ssh_tunnel() {
    echo "🔗 Establishing SSH tunnel to $REMOTE_SERVER..."
    ssh -N -L $PORT:localhost:$PORT "$REMOTE_USER@$REMOTE_SERVER" &
    SSH_TUNNEL_PID=$!
    sleep 1  # Give some time for the tunnel to establish
}

# Function to stop the SSH tunnel
stop_ssh_tunnel() {
    if [[ -n "$SSH_TUNNEL_PID" ]]; then
        echo "🛑 Closing SSH tunnel..."
        kill "$SSH_TUNNEL_PID" 2>/dev/null
    fi
}

# Function to send data via Hotrod (including clipboard support)
send_data() {
    if [[ -n "$MESSAGE" ]]; then
        echo "$MESSAGE" | nc -q 1 localhost $PORT
    else
        cat | nc -q 1 localhost $PORT
    fi
}

# Function to listen for incoming Hotrod data and copy to clipboard
hotrod_clipboard_listener() {
    echo "📋 Hotrod Clipboard Listener Active on Port $PORT..."
    nc -lk $PORT | xclip -selection clipboard
}

# Ensure help is shown when no arguments are provided and stdin is not a pipe
if [[ $# -eq 0 && -t 0 ]]; then
    usage
fi

# Parse options
while [[ $# -gt 0 ]]; do
    case "$1" in
        -s|--start)
            START_SERVER=true
            shift
            ;;
        -l|--local)
            MODE="local"
            shift
            ;;
        -h|--help)
            usage
            ;;
        --clipboard-listener)
            hotrod_clipboard_listener
            exit 0
            ;;
        *)
            MESSAGE="$1"
            shift
            ;;
    esac
done

# Start the server if requested
if [[ "$START_SERVER" == "true" ]]; then
    if [[ "$MODE" == "remote" ]]; then
        echo "❌ Cannot start server in remote mode. Use --local to run locally."
        exit 1
    fi
    hotrod_start_server
    exit 0
fi

# Start SSH tunnel if in remote mode
if [[ "$MODE" == "remote" ]]; then
    start_ssh_tunnel
    trap stop_ssh_tunnel EXIT  # Ensure cleanup on exit
fi

# Send the message (or read from stdin if no message provided)
send_data
