#!/usr/bin/env bash
# Test script for tcurses_readline

set -e

export TETRA_SRC="${TETRA_SRC:-/Users/mricos/src/devops/tetra}"

# Source the readline module
source "$TETRA_SRC/bash/tcurses/tcurses_readline.sh"

# Setup test completions
echo "Setting up test completion words..."
repl_register_completion_words "list" "show" "create" "delete" "update" "help" "quit" "status"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║         TCurses Native Readline Test                      ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Features to test:"
echo "  • Basic typing and backspace"
echo "  • Arrow keys (left/right) to move cursor"
echo "  • Arrow keys (up/down) for history"
echo "  • TAB completion (type 'l' then TAB)"
echo "  • Ctrl-A (home), Ctrl-E (end)"
echo "  • Ctrl-U (clear line)"
echo "  • Ctrl-C (cancel), Ctrl-D (EOF when empty)"
echo ""
echo "Completion words: list, show, create, delete, update, help, quit, status"
echo ""
echo "Type 'quit' to exit the test."
echo ""

# History file for test
HISTORY_FILE="/tmp/tcurses_readline_test_history.txt"

while true; do
    # Read a line with native readline
    line=$(tcurses_readline "test> " "$HISTORY_FILE")
    status=$?

    # Check for EOF (Ctrl-D on empty line)
    if [[ $status -ne 0 ]]; then
        echo "EOF received - exiting."
        break
    fi

    # Check for quit command
    if [[ "$line" == "quit" ]]; then
        echo "Goodbye!"
        break
    fi

    # Echo what was entered
    if [[ -n "$line" ]]; then
        echo "You entered: '$line'"
    fi
done

echo ""
echo "Test complete!"
