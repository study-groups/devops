#!/bin/bash

# Resolve the directory where the script resides
HOTROD_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"

# Load additional Hotrod scripts (ensure these do NOT execute automatically)
source "$HOTROD_DIR/hotrod_server.sh"
source "$HOTROD_DIR/hotrod_remote.sh"

# Default configuration
PORT=9999
MODE="local"
START_SERVER=false

# Function to display usage
usage() {
    echo "Usage: hotrod.sh [options] [message]"
    echo "Options:"
    echo " -s, --start      Start the Hotrod server"
    echo " -h, --help       Show this help message"
    echo ""
    echo "If a message is provided, it will be sent to Hotrod running on localhost."
    echo ""
    echo "To use remotely, set up an SSH tunnel:"
    echo "   ssh -N -L 9999:localhost:9999 user@remote-server"
    echo ""
    echo "Then run:"
    echo "   ./hotrod.sh \"Message to send\""
    echo ""
    exit 0
}

# Function to send data to Hotrod on localhost
send_data() {
    local data="$1"
    echo "$data" | nc -q 1 localhost $PORT
}

# Ensure help is shown when no arguments are provided
if [[ $# -eq 0 ]]; then
    usage
fi

# Parse options
while [[ $# -gt 0 ]]; do
    case "$1" in
        -s|--start)
            START_SERVER=true
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
    hotrod_start_server
    exit 0
fi

# Ensure a message is provided if not starting the server
if [[ -z "$MESSAGE" ]]; then
    echo "Error: No message provided."
    usage
fi

# Send the message
send_data "$MESSAGE"

