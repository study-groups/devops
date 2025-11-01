#!/usr/bin/env bash

# Test script for REPL readline functionality
# This script verifies that readline is properly configured

echo "Testing REPL Readline Configuration"
echo "===================================="
echo

# Source the tetra environment
source "${TETRA_SRC:-$HOME/src/devops/tetra}/bash/tetra_repl.sh"

# Check if history is enabled
if set -o | grep -q "^history.*on"; then
    echo "✓ Bash history is enabled"
else
    echo "✗ Bash history is NOT enabled"
fi

# Check if histappend is enabled
if shopt -p histappend | grep -q "on"; then
    echo "✓ histappend is enabled"
else
    echo "✗ histappend is NOT enabled"
fi

# Check HISTFILE
if [[ -n "$HISTFILE" ]]; then
    echo "✓ HISTFILE is set to: $HISTFILE"
else
    echo "✗ HISTFILE is not set"
fi

# Check HISTSIZE
if [[ -n "$HISTSIZE" ]]; then
    echo "✓ HISTSIZE is set to: $HISTSIZE"
else
    echo "✗ HISTSIZE is not set"
fi

echo
echo "Readline keybindings test:"
echo "-------------------------"
echo "To manually test in the REPL:"
echo "  1. Run: bash bash/tetra_repl.sh"
echo "  2. Type some text and test:"
echo "     - Ctrl-A: Jump to beginning of line"
echo "     - Ctrl-E: Jump to end of line"
echo "     - Up Arrow: Previous command in history"
echo "     - Down Arrow: Next command in history"
echo "     - Left/Right Arrows: Move cursor"
echo "  3. Type 'exit' to quit"
echo
echo "Example commands to try:"
echo "  help"
echo "  status"
echo "  functions"
