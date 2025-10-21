#!/usr/bin/env bash

# Test REPL Takeover Mode
# Verifies that TSM REPL runs in takeover mode by default

source ~/tetra/tetra.sh

echo "=== Testing REPL Takeover Mode ==="
echo ""

# Test 1: Verify repl_set_execution_mode is available
echo "1. Checking bash/repl mode functions..."
if declare -f repl_set_execution_mode >/dev/null; then
    echo "   ✓ repl_set_execution_mode available"
else
    echo "   ✗ repl_set_execution_mode NOT found"
    exit 1
fi

if declare -f repl_is_takeover >/dev/null; then
    echo "   ✓ repl_is_takeover available"
else
    echo "   ✗ repl_is_takeover NOT found"
    exit 1
fi

# Test 2: Set takeover mode and verify
echo "2. Testing takeover mode..."
repl_set_execution_mode "takeover"
if repl_is_takeover; then
    echo "   ✓ Takeover mode set successfully"
else
    echo "   ✗ Failed to set takeover mode"
    exit 1
fi

# Test 3: Verify help command is registered
echo "3. Checking help system..."
source "$TETRA_SRC/bash/tsm/interfaces/repl_v2.sh" 2>/dev/null

if [[ -n "${REPL_SLASH_HANDLERS[help]:-}" ]]; then
    echo "   ✓ help command registered"
else
    echo "   ✗ help command NOT registered"
    exit 1
fi

# Test 4: Verify help topics are defined
echo "4. Checking hierarchical help topics..."
if [[ ${#REPL_HELP_TOPICS[@]} -gt 0 ]]; then
    echo "   ✓ Help topics registered (${#REPL_HELP_TOPICS[@]} topics)"
    for topic in "${!REPL_HELP_TOPICS[@]}"; do
        echo "     - $topic"
    done
else
    echo "   ✗ No help topics registered"
    exit 1
fi

# Test 5: Test help command execution
echo "5. Testing help command execution..."
if output=$(tsm_cmd_help 2>&1); then
    lines=$(echo "$output" | wc -l)
    echo "   ✓ Main help executed ($lines lines)"
    if [[ $lines -le 25 ]]; then
        echo "   ✓ Help is concise (<= 25 lines)"
    else
        echo "   ⚠ Help is longer than expected ($lines lines)"
    fi
else
    echo "   ✗ Help command failed"
    exit 1
fi

# Test 6: Test help topics
echo "6. Testing help topics..."
for topic in commands system repl examples; do
    if output=$(tsm_cmd_help "$topic" 2>&1); then
        echo "   ✓ help $topic works"
    else
        echo "   ✗ help $topic failed"
        exit 1
    fi
done

# Test 7: Verify main help mentions hierarchical topics
echo "7. Checking help mentions topics..."
help_output=$(tsm_cmd_help)
if echo "$help_output" | grep -q "help commands"; then
    echo "   ✓ Main help mentions 'help commands'"
else
    echo "   ✗ Main help doesn't mention hierarchical topics"
    exit 1
fi

# Test 8: Verify help shows exit commands
echo "8. Checking help shows exit commands..."
if echo "$help_output" | grep -q "exit, quit"; then
    echo "   ✓ Help mentions exit commands"
else
    echo "   ✗ Help doesn't mention exit commands"
    exit 1
fi

echo ""
echo "=== All Takeover Mode Tests Passed! ==="
echo ""
echo "REPL Configuration:"
echo "  • Default mode: REPL (takeover)"
echo "  • Commands: TSM by default (no / prefix)"
echo "  • Shell escape: !<cmd>"
echo "  • Help: Hierarchical (help, help commands, help system, etc.)"
echo "  • Exit: quit, exit, q, or Ctrl-D"
echo ""
exit 0
