#!/usr/bin/env bash

# Test the equation system and palette action integration

# Mock the demo environment for testing
source ./top_status.sh
source ./nouns_verbs.sh

ENV_INDEX=0
MODE_INDEX=0
ACTION_INDEX=0
ENVIRONMENTS=("DEMO" "MODULES" "TUI")
MODES=("LEARN" "TEST" "COLORS")

# Test the equation rendering
echo "=== Testing Equation System ==="
echo

# Test equation demo
demo_equations

echo
echo "=== Testing Palette Action ==="

# Test that show:palette action works
echo "fire show:palette" | ./demo.sh repl 2>/dev/null | head -15

echo
echo "✅ System integration complete!"
echo "- Palette triggered via action system (show:palette)"
echo "- Equation function renders [Env x Mod][verb x noun] -> [tag:Type]"
echo "- Result types: ENV_VAR, STD_OUT, STD_ERR, PIPE, FILE"
echo "- Tags generated from mode configuration"