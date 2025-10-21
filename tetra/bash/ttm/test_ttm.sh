#!/usr/bin/env bash
# test_ttm.sh - Test TTM core functionality

set -e

# Setup test environment
export TETRA_SRC="${TETRA_SRC:-$HOME/tetra}"
export TETRA_DIR="/tmp/tetra-test-$$"

echo "=== TTM Test Suite ==="
echo "TETRA_DIR=$TETRA_DIR"
echo ""

# Source TTM
source "$TETRA_SRC/bash/ttm/ttm.sh"

# Initialize TTM
echo "1. Testing ttm_init..."
ttm_init
if [[ -d "$TETRA_DIR/ttm/txns" ]]; then
    echo "✓ TTM initialized successfully"
else
    echo "✗ Failed to initialize TTM"
    exit 1
fi
echo ""

# Test transaction creation
echo "2. Testing txn_create..."
txn_id=$(txn_create "test deployment" "@staging" "human")
if [[ -n "$txn_id" ]]; then
    echo "✓ Transaction created: $txn_id"
else
    echo "✗ Failed to create transaction"
    exit 1
fi
echo ""

# Test active transaction
echo "3. Testing txn_active..."
active=$(txn_active)
if [[ "$active" == "$txn_id" ]]; then
    echo "✓ Active transaction: $active"
else
    echo "✗ Active transaction mismatch: expected=$txn_id, got=$active"
    exit 1
fi
echo ""

# Test transaction state
echo "4. Testing txn_state..."
state=$(txn_state)
if echo "$state" | jq -e '.txn_id' >/dev/null 2>&1; then
    echo "✓ Transaction state retrieved"
    echo "$state" | jq '{txn_id, stage, description}'
else
    echo "✗ Failed to get transaction state"
    exit 1
fi
echo ""

# Test adding context
echo "5. Testing txn_add_ctx..."
# Create test file
echo "Test artifact content" > /tmp/test-artifact.txt
txn_add_ctx /tmp/test-artifact.txt "artifact"
if [[ -f "$(txn_dir)/ctx/100_artifact.txt" ]]; then
    echo "✓ Context added successfully"
else
    echo "✗ Failed to add context"
    exit 1
fi
echo ""

# Test listing context
echo "6. Testing txn_list_ctx..."
ctx_list=$(txn_list_ctx)
if echo "$ctx_list" | grep -q "100_artifact.txt"; then
    echo "✓ Context files listed"
else
    echo "✗ Failed to list context"
    exit 1
fi
echo ""

# Test evidence variables
echo "7. Testing init_evidence_vars..."
init_evidence_vars
if [[ -n "$e1" ]] && [[ -f "$e1" ]]; then
    echo "✓ Evidence variables initialized"
    echo "  e1=$e1"
    echo "  e_count=$e_count"
else
    echo "✗ Failed to initialize evidence variables"
    exit 1
fi
echo ""

# Test stage transition
echo "8. Testing txn_transition..."
txn_transition "SELECT"
new_stage=$(txn_state | jq -r '.stage')
if [[ "$new_stage" == "SELECT" ]]; then
    echo "✓ Stage transitioned to SELECT"
else
    echo "✗ Stage transition failed: expected=SELECT, got=$new_stage"
    exit 1
fi
echo ""

# Test TES resolution
echo "9. Testing txn_resolve_tes..."
txn_transition "ASSEMBLE"
txn_resolve_tes
tes_plan=$(txn_state | jq -r '.tes_plan // empty')
if [[ -n "$tes_plan" ]]; then
    echo "✓ TES resolved: $tes_plan"
else
    echo "✗ TES resolution failed"
    exit 1
fi
echo ""

# Test transaction status
echo "10. Testing txn_status..."
txn_status
echo "✓ Status displayed"
echo ""

# Test transaction list
echo "11. Testing txn_list..."
txn_list
echo "✓ Transactions listed"
echo ""

# Test transaction commit
echo "12. Testing txn_commit..."
txn_transition "EXECUTE"
txn_transition "VALIDATE"
txn_commit
final_stage=$(txn_state | jq -r '.stage')
if [[ "$final_stage" == "DONE" ]]; then
    echo "✓ Transaction committed successfully"
else
    echo "✗ Commit failed: expected=DONE, got=$final_stage"
    exit 1
fi
echo ""

# Test transaction failure
echo "13. Testing txn_fail..."
txn_id2=$(txn_create "test failure" "@local" "human")
txn_fail "$txn_id2" "Intentional test failure"
fail_stage=$(txn_state "$txn_id2" | jq -r '.stage')
fail_error=$(txn_state "$txn_id2" | jq -r '.last_error')
if [[ "$fail_stage" == "FAIL" ]] && [[ "$fail_error" == "Intentional test failure" ]]; then
    echo "✓ Transaction failed correctly"
else
    echo "✗ Fail test failed: stage=$fail_stage, error=$fail_error"
    exit 1
fi
echo ""

# Test transaction events
echo "14. Testing txn_events..."
events=$(txn_events "$txn_id")
if echo "$events" | grep -q "txn_start"; then
    echo "✓ Events retrieved"
    echo "Event count: $(echo "$events" | wc -l)"
else
    echo "✗ Failed to retrieve events"
    exit 1
fi
echo ""

# Cleanup
echo "=== Cleanup ==="
rm -rf "$TETRA_DIR"
rm -f /tmp/test-artifact.txt
echo "✓ Test environment cleaned up"
echo ""

echo "=== All Tests Passed! ==="
echo ""
echo "Summary:"
echo "  - Transaction lifecycle: ✓"
echo "  - Context management: ✓"
echo "  - Evidence variables: ✓"
echo "  - TES resolution: ✓"
echo "  - Query functions: ✓"
echo "  - Event logging: ✓"
