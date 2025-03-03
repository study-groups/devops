#!/bin/bash

# Resolve the directory where the script resides
HOTROD_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"

# Load additional Hotrod scripts
source "$HOTROD_DIR/hotrod_server.sh"

# Default configuration
PORT=9999
REMOTE_SERVER="${HOTROD_REMOTE:-$TETRA_REMOTE}"
REMOTE_USER="${HOTROD_USER:-root}"
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
    echo "By default, this script automatically establishes an SSH tunnel to the remote server:"
    echo "   ssh -N -L 9999:localhost:9999 $REMOTE_USER@$REMOTE_SERVER"
    echo ""
    exit 0
}

# Function to start the SSH tunnel
start_ssh_tunnel() {
    echo "🔗 Establishing SSH tunnel to $REMOTE_SERVER..."
    ssh -N -L 9999:localhost:9999 "$REMOTE_USER@$REMOTE_SERVER" &
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

# Function to send data via Hotrod
send_data() {
    if [[ -n "$MESSAGE" ]]; then
        echo "$MESSAGE" | nc -q 1 localhost $PORT
    else
        cat | nc -q 1 localhost $PORT
    fi
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

