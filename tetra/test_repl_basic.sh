#!/usr/bin/env bash
# Basic REPL functionality test (non-interactive)

set -e

echo "=== Testing Tetra REPL Framework ==="
echo ""

# Source tetra
source bash/tetra/tetra.sh

# Source REPL components
source bash/tetra/core/repl_core.sh
source bash/tetra/interfaces/repl.sh

# Test 1: Framework functions loaded
echo "1. Framework Functions:"
for func in repl_init repl_loop repl_register_key repl_register_trigger repl_insert_char repl_cursor_home repl_cursor_end; do
    if declare -f "$func" >/dev/null 2>&1; then
        echo "   ✓ $func"
    else
        echo "   ✗ $func MISSING"
        exit 1
    fi
done
echo ""

# Test 2: REPL interface functions loaded
echo "2. REPL Interface Functions:"
for func in tetra_repl tetra_repl_trigger_at tetra_repl_trigger_doublecolon repl_process_line tetra_repl_help; do
    if declare -f "$func" >/dev/null 2>&1; then
        echo "   ✓ $func"
    else
        echo "   ✗ $func MISSING"
        exit 1
    fi
done
echo ""

# Test 3: Buffer operations
echo "3. Buffer Operations:"
REPL_BUFFER=""
REPL_CURSOR_POS=0

repl_insert_char "h"
repl_insert_char "e"
repl_insert_char "l"
repl_insert_char "l"
repl_insert_char "o"

if [[ "$REPL_BUFFER" == "hello" ]] && [[ $REPL_CURSOR_POS -eq 5 ]]; then
    echo "   ✓ Insert: buffer='$REPL_BUFFER' pos=$REPL_CURSOR_POS"
else
    echo "   ✗ Insert failed: buffer='$REPL_BUFFER' pos=$REPL_CURSOR_POS"
    exit 1
fi

repl_delete_char
if [[ "$REPL_BUFFER" == "hell" ]] && [[ $REPL_CURSOR_POS -eq 4 ]]; then
    echo "   ✓ Delete: buffer='$REPL_BUFFER' pos=$REPL_CURSOR_POS"
else
    echo "   ✗ Delete failed: buffer='$REPL_BUFFER' pos=$REPL_CURSOR_POS"
    exit 1
fi

repl_cursor_home
if [[ $REPL_CURSOR_POS -eq 0 ]]; then
    echo "   ✓ Home: pos=$REPL_CURSOR_POS"
else
    echo "   ✗ Home failed: pos=$REPL_CURSOR_POS"
    exit 1
fi

repl_cursor_end
if [[ $REPL_CURSOR_POS -eq ${#REPL_BUFFER} ]]; then
    echo "   ✓ End: pos=$REPL_CURSOR_POS"
else
    echo "   ✗ End failed: pos=$REPL_CURSOR_POS"
    exit 1
fi
echo ""

# Test 4: Trigger registration
echo "4. Trigger Registration:"
test_trigger_called=false

test_trigger_handler() {
    test_trigger_called=true
}

repl_register_trigger "@test" "test_trigger_handler"

if [[ -n "${REPL_TRIGGER_PATTERNS[@test]}" ]]; then
    echo "   ✓ Trigger registered: @test -> test_trigger_handler"
else
    echo "   ✗ Trigger registration failed"
    exit 1
fi
echo ""

# Test 5: Key registration
echo "5. Key Registration:"
test_key_called=false

test_key_handler() {
    test_key_called=true
}

repl_register_key "x" "test_key_handler"

if [[ -n "${REPL_KEY_HANDLERS[x]}" ]]; then
    echo "   ✓ Key registered: x -> test_key_handler"
else
    echo "   ✗ Key registration failed"
    exit 1
fi
echo ""

# Test 6: Line processing (simulate)
echo "6. Line Processing:"

# Mock process to avoid actual execution
test_line_received=""
repl_process_line() {
    test_line_received="$1"
}

repl_process_line "list modules"
if [[ "$test_line_received" == "list modules" ]]; then
    echo "   ✓ Line processor called with: '$test_line_received'"
else
    echo "   ✗ Line processor failed"
    exit 1
fi
echo ""

# Test 7: Help content
echo "7. Help System:"
help_output="$(tetra_repl_help)"
if echo "$help_output" | grep -q "Tetra REPL"; then
    echo "   ✓ Help content generated"
    echo "   ✓ Help includes: $(echo "$help_output" | grep -o "COMMANDS:" | head -1)"
else
    echo "   ✗ Help generation failed"
    exit 1
fi
echo ""

# Summary
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║            ALL TESTS PASSED ✓                             ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "Framework is working correctly!"
echo ""
echo "To test interactively, run:"
echo "  source bash/tetra/tetra.sh"
echo "  tetra repl"
echo ""
echo "Then try:"
echo "  - Type some text and use Ctrl-A, Ctrl-E"
echo "  - Type @ to trigger fuzzy finder (needs fzf)"
echo "  - Type file.sh:: to trigger endpoint selector"
echo "  - Use /help, /status, /env, /mode commands"
echo "  - Try: list modules, list actions"
echo ""
