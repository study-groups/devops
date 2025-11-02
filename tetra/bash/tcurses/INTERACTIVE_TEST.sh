#!/usr/bin/env bash
# Interactive test for native readline
# Run this in a terminal to test if the readline works

set -e

export TETRA_SRC="${TETRA_SRC:-/Users/mricos/src/devops/tetra}"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║      Testing Native Readline - INTERACTIVE TEST           ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "This test will check if the native readline works properly."
echo "You should be able to:"
echo "  - Type characters and see them appear"
echo "  - Press TAB to complete 'h' to 'help'"
echo "  - Use arrow keys to move cursor"
echo "  - Press Enter to submit"
echo ""
echo "If you see the prompt but can't type, or characters don't appear,"
echo "then there's a terminal mode issue."
echo ""
echo "Press Enter to start the test..."
read

# Source the readline
source "$TETRA_SRC/bash/tcurses/tcurses_readline.sh"

# Setup simple completions
repl_register_completion_words "help" "exit" "quit" "test"

echo ""
echo "Starting readline test..."
echo "Type something and press Enter (or 'exit' to quit):"
echo ""

# Test readline
result=$(tcurses_readline "test> " "/tmp/readline_test_history.txt")
echo ""
echo "You entered: '$result'"
echo ""
echo "✓ Test complete!"
