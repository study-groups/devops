#!/usr/bin/env bash

# example_simple.sh - Simple example of tubes usage

# This example shows basic tube communication between two terminals.
# Run this script in two different terminals to see them communicate.

set -euo pipefail

# Setup
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TETRA_SRC="${TETRA_SRC:-$(cd "$SCRIPT_DIR/../../.." && pwd)}"
TETRA_DIR="${TETRA_DIR:-$HOME/tetra}"

# Load tetra
source "$TETRA_SRC/bash/bootloader.sh"

# Load tubes
tmod load tubes

echo "Simple Tubes Example"
echo "===================="
echo ""
echo "This example demonstrates basic tube communication."
echo ""
echo "Choose mode:"
echo "  1) Sender   - Send messages"
echo "  2) Receiver - Receive messages"
echo ""
read -p "Enter choice (1 or 2): " choice

case "$choice" in
    1)
        # Sender mode
        echo ""
        echo "Sender Mode"
        echo "-----------"
        echo ""

        # Create tube if doesn't exist
        tubes create example-tube "Example communication tube" 2>/dev/null || true

        echo "Enter messages to send (Ctrl+C to quit):"
        echo ""

        while true; do
            read -p "> " message
            if [[ -n "$message" ]]; then
                tubes send example-tube "$message"
            fi
        done
        ;;

    2)
        # Receiver mode
        echo ""
        echo "Receiver Mode"
        echo "-------------"
        echo ""

        # Create tube if doesn't exist
        tubes create example-tube "Example communication tube" 2>/dev/null || true

        echo "Listening for messages (Ctrl+C to quit):"
        echo ""

        tubes listen example-tube
        ;;

    *)
        echo "Invalid choice"
        exit 1
        ;;
esac
