#!/usr/bin/env bash

# Test the input state machine in isolation

SCRIPT_DIR="$(dirname "${BASH_SOURCE[0]}")"
source "$SCRIPT_DIR/tcurses_input_sm.sh"

# Enable debug
export INPUT_SM_DEBUG=true

# Save terminal state
OLD_STATE=$(stty -g </dev/tty 2>/dev/null)

# Setup terminal
echo "Setting up terminal..."
stty -echo -icanon -isig min 1 time 0 </dev/tty 2>/dev/null || {
    echo "Failed to setup terminal"
    exit 1
}

# Validate
echo "Validating terminal settings..."
stty -a </dev/tty 2>&1 | grep -q "min = 1" || {
    echo "ERROR: min != 1"
    stty "$OLD_STATE" </dev/tty 2>/dev/null
    exit 1
}
echo "Terminal settings OK (min=1)"
echo ""

# Initialize state machine
input_sm_init

echo "========================================"
echo "TCurses Input State Machine Test"
echo "========================================"
echo ""
echo "Press keys to test input handling:"
echo "  - Regular keys (a, b, 1, 2)"
echo "  - Arrow keys"
echo "  - ESC key"
echo "  - 'q' to quit"
echo ""
echo "Each keypress will show:"
echo "  1. State transitions (debug output)"
echo "  2. Final input received"
echo ""

# Hide cursor
printf '\033[?25l'

counter=0
while true; do
    echo "----------------------------------------"
    echo "Waiting for input #$((++counter))..."
    echo ""

    # Read one complete input
    key=$(input_sm_read_input)

    # Show what we got
    hex=$(echo -n "$key" | od -An -tx1 | tr -d ' ')
    name=$(tcurses_input_key_name "$key" 2>/dev/null || echo "?")

    echo ""
    echo ">>> RECEIVED:"
    echo "    Key: '$key'"
    echo "    Hex: $hex"
    echo "    Name: $name"
    echo ""

    # Check for quit
    if [[ "$key" == "q" || "$key" == "Q" ]]; then
        echo "Quit requested"
        break
    fi

    # Small pause to see output
    sleep 0.1
done

# Cleanup
printf '\033[?25h'
stty "$OLD_STATE" </dev/tty 2>/dev/null

echo ""
echo "========================================"
echo "Test complete"
echo "========================================"
echo ""
echo "Summary:"
echo "  - Processed $counter inputs"
echo "  - Check above for any errors or duplicates"
echo ""
