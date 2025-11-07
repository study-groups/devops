#!/usr/bin/env bash
# Quick Action Registry System Test
# Run this to verify the system works

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           Action Registry - Quick System Test               ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Setup environment
: "${TETRA_SRC:=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
: "${TETRA_DIR:=$HOME/tetra}"
export TETRA_SRC TETRA_DIR

echo "⚙️  Loading system..."
source ~/tetra/tetra.sh 2>/dev/null || echo "  Note: tetra.sh not loaded (optional)"
source $TETRA_SRC/bash/tds/tds.sh 2>/dev/null || echo "  Note: TDS not loaded (optional)"
source $TETRA_SRC/bash/actions/registry.sh
source $TETRA_SRC/bash/actions/executor.sh
source $TETRA_SRC/bash/repl/action_completion.sh

# Load all modules
source $TETRA_SRC/bash/org/includes.sh 2>/dev/null
source $TETRA_SRC/bash/rag/includes.sh 2>/dev/null
source $TETRA_SRC/bash/tsm/includes.sh 2>/dev/null

echo "✓ System loaded"
echo ""

# Test 1: Registry Statistics
echo "📊 Test 1: Registry Statistics"
echo "────────────────────────────────────────────────────────────"
total=$(grep -c '^[^#]' $TETRA_DIR/actions.registry)
org_count=$(grep -c '^org\.' $TETRA_DIR/actions.registry)
rag_count=$(grep -c '^rag\.' $TETRA_DIR/actions.registry)
tsm_count=$(grep -c '^tsm\.' $TETRA_DIR/actions.registry)

echo "Total actions: $total"
echo "  • org: $org_count"
echo "  • rag: $rag_count"
echo "  • tsm: $tsm_count"

if [[ $total -ge 42 ]]; then
    echo "✅ PASS: Expected 42+ actions"
else
    echo "❌ FAIL: Expected 42+ actions, got $total"
    exit 1
fi
echo ""

# Test 2: Color System
echo "🎨 Test 2: TDS Color System"
echo "────────────────────────────────────────────────────────────"
if type tds_text_color &>/dev/null; then
    echo -n "Module color: "
    tds_color_swatch action.module
    echo ""
    echo -n "Action color: "
    tds_color_swatch action.name
    echo ""
    echo "✅ PASS: TDS colors available"
else
    echo "⚠️  WARNING: TDS colors not available (non-critical)"
fi
echo ""

# Test 3: Action Existence
echo "🔍 Test 3: Action Existence Checks"
echo "────────────────────────────────────────────────────────────"
test_actions=(
    "org.validate.toml"
    "org.compile.toml"
    "rag.query.ulm"
    "tsm.start.service"
)

passed=0
for action in "${test_actions[@]}"; do
    if action_exists "$action"; then
        echo "✓ Found: $action"
        ((passed++))
    else
        echo "✗ Missing: $action"
    fi
done

if [[ $passed -eq ${#test_actions[@]} ]]; then
    echo "✅ PASS: All test actions found ($passed/${#test_actions[@]})"
else
    echo "❌ FAIL: Some actions missing ($passed/${#test_actions[@]})"
    exit 1
fi
echo ""

# Test 4: TES Capability
echo "🚀 Test 4: TES Capability Detection"
echo "────────────────────────────────────────────────────────────"
if action_is_tes_capable "org.compile.toml"; then
    echo "✓ org.compile.toml is TES-capable (expected)"
    tes_pass=1
else
    echo "✗ org.compile.toml should be TES-capable"
    tes_pass=0
fi

if ! action_is_tes_capable "rag.query.ulm"; then
    echo "✓ rag.query.ulm is NOT TES-capable (expected)"
    ((tes_pass++))
else
    echo "✗ rag.query.ulm should NOT be TES-capable"
fi

if [[ $tes_pass -eq 2 ]]; then
    echo "✅ PASS: TES capability detection works"
else
    echo "❌ FAIL: TES capability detection broken"
    exit 1
fi
echo ""

# Test 5: Tab Completion
echo "⌨️  Test 5: Tab Completion"
echo "────────────────────────────────────────────────────────────"
completions=$(repl_complete_actions org | wc -l)
if [[ $completions -gt 0 ]]; then
    echo "✓ Found $completions org action completions"
    echo "  Sample: $(repl_complete_actions org | head -3 | tr '\n' ' ')"
    echo "✅ PASS: Tab completion works"
else
    echo "❌ FAIL: No completions found"
    exit 1
fi
echo ""

# Test 6: Action Execution
echo "▶️  Test 6: Action Execution"
echo "────────────────────────────────────────────────────────────"

# Create a test action
action_register "test" "verify" "Verification test action" "" "no"
test_verify() {
    echo "Test action executed successfully!"
}

# Execute it
output=$(action_exec test.verify 2>&1)
if echo "$output" | grep -q "successfully"; then
    echo "✓ Action executed correctly"
    echo "✅ PASS: Action execution works"
else
    echo "❌ FAIL: Action execution failed"
    exit 1
fi
echo ""

# Test 7: Action Info Display
echo "ℹ️  Test 7: Action Info Display"
echo "────────────────────────────────────────────────────────────"
info_output=$(action_info org.compile.toml 2>&1)
if echo "$info_output" | grep -q "compile.toml"; then
    echo "✓ Action info displayed correctly"
    echo "✅ PASS: Action info works"
else
    echo "❌ FAIL: Action info broken"
    exit 1
fi
echo ""

# Summary
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    🎉 ALL TESTS PASSED! 🎉                   ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "The action registry system is working correctly!"
echo ""
echo "Next steps:"
echo "  • Run interactive tutorial: bash $TETRA_SRC/bash/actions/TUTORIAL.sh"
echo "  • Read quick start guide: less $TETRA_SRC/bash/actions/QUICKSTART.md"
echo "  • Explore actions: action_list org"
echo ""
