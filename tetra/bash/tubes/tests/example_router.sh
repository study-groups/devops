#!/usr/bin/env bash

# example_router.sh - Router-based communication example

# This example demonstrates using the tubes router for message routing.
# Run in multiple terminals with different tube names.

set -euo pipefail

# Setup
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TETRA_SRC="${TETRA_SRC:-$(cd "$SCRIPT_DIR/../../.." && pwd)}"
TETRA_DIR="${TETRA_DIR:-$HOME/tetra}"

# Load tetra
source "$TETRA_SRC/bash/bootloader.sh"

# Load tubes
tmod load tubes

echo "Router-Based Tubes Example"
echo "=========================="
echo ""

# Ensure router is running
if ! tubes router status >/dev/null 2>&1; then
    echo "Starting router..."
    tubes router start
    sleep 0.5
fi

# Get tube name from argument or prompt
TUBE_NAME="${1:-}"

if [[ -z "$TUBE_NAME" ]]; then
    read -p "Enter your terminal name: " TUBE_NAME
fi

# Create tube
echo "Creating tube: @tube:$TUBE_NAME"
tubes create "$TUBE_NAME" "Terminal $TUBE_NAME"

echo ""
echo "Commands:"
echo "  list             - List all tubes"
echo "  send <to> <msg>  - Send message to another tube"
echo "  help             - Show this help"
echo "  quit             - Exit"
echo ""

# Start listener in background
tubes listen "$TUBE_NAME" &
LISTENER_PID=$!

# Cleanup on exit
cleanup() {
    echo ""
    echo "Cleaning up..."
    kill $LISTENER_PID 2>/dev/null || true
    tubes destroy "$TUBE_NAME" 2>/dev/null || true
    exit 0
}

trap cleanup EXIT INT TERM

# Command loop
while true; do
    read -p "$TUBE_NAME> " cmd args

    case "$cmd" in
        list)
            tubes list
            ;;
        send)
            # Parse: send <target> <message>
            TARGET=$(echo "$args" | awk '{print $1}')
            MESSAGE=$(echo "$args" | cut -d' ' -f2-)

            if [[ -n "$TARGET" ]] && [[ -n "$MESSAGE" ]]; then
                tubes route "$TARGET" "$MESSAGE" "$TUBE_NAME"
            else
                echo "Usage: send <target> <message>"
            fi
            ;;
        help)
            echo "Commands:"
            echo "  list             - List all tubes"
            echo "  send <to> <msg>  - Send message to another tube"
            echo "  help             - Show this help"
            echo "  quit             - Exit"
            ;;
        quit|exit)
            break
            ;;
        "")
            # Empty input, continue
            ;;
        *)
            echo "Unknown command: $cmd (type 'help' for commands)"
            ;;
    esac
done
