#!/bin/bash

# Resolve the directory where the script resides
HOTROD_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"

# Load additional Hotrod scripts
source "$HOTROD_DIR/hotrod_server.sh"
source "$HOTROD_DIR/hotrod_remote.sh"

# Default configuration
PORT=9999
REMOTE_SERVER="${HOTROD_REMOTE:-$TETRA_REMOTE}"
REMOTE_USER="${HOTROD_USER:-root}"
MODE="local"

# Function to display usage
usage() {
    echo "Usage: hotrod.sh [options] [message]"
    echo "Options:"
    echo " -r, --remote                Use remote Hotrod server (default: $REMOTE_SERVER)"
    echo " -u, --user USER             Specify remote user (default: $REMOTE_USER)"
    echo " -h, --help                  Show this help message"
    echo ""
    echo "If a message is provided, it will be sent to Hotrod."
    echo "Otherwise, it will wait for input from stdin."
    exit 0
}

# Function to send data to Hotrod
send_data() {
    local data="$1"
    if [[ "$MODE" == "remote" ]]; then
        echo "$data" | ssh "$REMOTE_USER@$REMOTE_SERVER" "nc -q 1 localhost $PORT"
    else
        echo "$data" | nc -q 1 localhost $PORT
    fi
}

# Parse options
while [[ $# -gt 0 ]]; do
    case "$1" in
        -r|--remote)
            MODE="remote"
            shift
            ;;
        -u|--user)
            REMOTE_USER="$2"
            shift 2
            ;;
        -h|--help)
            usage
            ;;
        *)
            # Assuming positional argument is a message
            MESSAGE="$1"
            shift
            ;;
    esac
done

# Main execution logic
if [[ -n "$MESSAGE" ]]; then
    # If MESSAGE is set, send it directly
    send_data "$MESSAGE"
else
    # Read from stdin if no message is provided
    while IFS= read -r line; do
        send_data "$line"
    done
fi
#!/bin/bash

# Resolve the directory where the script resides
HOTROD_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"

# Load additional Hotrod scripts
source "$HOTROD_DIR/hotrod_server.sh"
source "$HOTROD_DIR/hotrod_remote.sh"

# Default configuration
PORT=9999
REMOTE_SERVER="${HOTROD_REMOTE:-$TETRA_REMOTE}"
REMOTE_USER="${HOTROD_USER:-root}"
MODE="local"

# Function to display usage
usage() {
    echo "Usage: hotrod.sh [options] [message]"
    echo "Options:"
    echo " -r, --remote                Use remote Hotrod server (default: $REMOTE_SERVER)"
    echo " -u, --user USER             Specify remote user (default: $REMOTE_USER)"
    echo " -h, --help                  Show this help message"
    echo ""
    echo "If a message is provided, it will be sent to Hotrod."
    echo "Otherwise, it will wait for input from stdin."
    exit 0
}

# Function to send data to Hotrod
send_data() {
    local data="$1"
    if [[ "$MODE" == "remote" ]]; then
        echo "$data" | ssh "$REMOTE_USER@$REMOTE_SERVER" "nc -q 1 localhost $PORT"
    else
        echo "$data" | nc -q 1 localhost $PORT
    fi
}

# Parse options
while [[ $# -gt 0 ]]; do
    case "$1" in
        -r|--remote)
            MODE="remote"
            shift
            ;;
        -u|--user)
            REMOTE_USER="$2"
            shift 2
            ;;
        -h|--help)
            usage
            ;;
        *)
            # Assuming positional argument is a message
            MESSAGE="$1"
            shift
            ;;
    esac
done

# Main execution logic
if [[ -n "$MESSAGE" ]]; then
    # If MESSAGE is set, send it directly
    send_data "$MESSAGE"
else
    # Read from stdin if no message is provided
    while IFS= read -r line; do
        send_data "$line"
    done
fi
