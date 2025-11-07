#!/usr/bin/env bash
# Debug script to see what Enter key sends

: "${TETRA_SRC:=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
export TETRA_SRC
export TCURSES_READLINE_DEBUG=1

source "$TETRA_SRC/bash/tcurses/tcurses_readline.sh"

# Setup simple completions
repl_register_completion_words "help" "test"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║      DEBUG: Testing Enter Key Detection                   ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Debug mode is ON - you'll see key codes as you type."
echo ""
echo "Instructions:"
echo "  1. Type a few characters"
echo "  2. Press Enter"
echo "  3. Look at the debug output to see what Enter sends"
echo ""
echo "Starting test..."
echo ""

result=$(tcurses_readline "test> " "/tmp/debug_history.txt")
echo ""
echo "Result: '$result'"
echo ""
echo "If you see [DEBUG] output above, check the hex code for Enter."
echo "Common codes:"
echo "  0a = newline (\\n)"
echo "  0d = carriage return (\\r)"
echo "  (empty) = empty string"
