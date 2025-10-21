#!/usr/bin/env bash
# Test script to debug symbol processing bugs in evidence_add

# Source the color system (optional)
export TETRA_SRC="${TETRA_SRC:-$HOME/tetra}"
export RAG_SRC="$TETRA_SRC/bash/rag"

# Create a test environment
TEST_DIR="/tmp/rag_symbol_test_$$"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# Source required modules
source "$RAG_SRC/core/flow_manager.sh" 2>/dev/null || echo "Warning: flow_manager not loaded"
source "$RAG_SRC/core/evidence_selector.sh" 2>/dev/null || echo "Error: evidence_selector not loaded"

# Create a test file
TEST_FILE="$TEST_DIR/test.sh"
cat > "$TEST_FILE" <<'EOF'
#!/usr/bin/env bash
# Test file line 2
# Test file line 3
# Test file line 4
echo "Line 5"
echo "Line 6"
echo "Line 7"
echo "Line 8"
echo "Line 9"
echo "Line 10"
EOF

# Create a test flow directory
FLOW_DIR="$TEST_DIR/flow_test"
mkdir -p "$FLOW_DIR/ctx/evidence"
export FLOW_DIR

# Mock get_active_flow_dir
get_active_flow_dir() {
    echo "$FLOW_DIR"
}

echo "========================================="
echo "Symbol Processing Debug Test"
echo "========================================="
echo ""

# Test 1: @ symbol (should work according to user)
echo "Test 1: @ symbol (reference/action)"
echo "Command: Not implemented in evidence_add yet"
echo "Status: SKIPPED (not part of evidence_add)"
echo ""

# Test 2: :: symbol for line ranges
echo "Test 2: :: symbol for line ranges"
echo "Command: evidence_add \"$TEST_FILE::5,7\""
echo "---"
set -x
evidence_add "$TEST_FILE::5,7" 2>&1 | tee /tmp/test2_output.txt
set +x
echo ""
echo "Evidence file created:"
ls -la "$FLOW_DIR/ctx/evidence/"
echo ""
echo "Content of evidence file:"
cat "$FLOW_DIR/ctx/evidence/"*.evidence.md 2>/dev/null || echo "NO FILE CREATED"
echo ""

# Clean evidence dir for next test
rm -f "$FLOW_DIR/ctx/evidence/"*

# Test 3: # symbol for tags
echo "========================================="
echo "Test 3: # symbol for tags"
echo "Command: evidence_add \"$TEST_FILE#tag1,tag2\""
echo "---"
set -x
evidence_add "$TEST_FILE#tag1,tag2" 2>&1 | tee /tmp/test3_output.txt
set +x
echo ""
echo "Evidence file created:"
ls -la "$FLOW_DIR/ctx/evidence/"
echo ""
echo "Content of evidence file:"
cat "$FLOW_DIR/ctx/evidence/"*.evidence.md 2>/dev/null || echo "NO FILE CREATED"
echo ""
echo "Checking for tags in metadata:"
grep -i "tags" "$FLOW_DIR/ctx/evidence/"*.evidence.md 2>/dev/null || echo "NO TAGS FOUND IN METADATA"
echo ""

# Clean evidence dir for next test
rm -f "$FLOW_DIR/ctx/evidence/"*

# Test 4: Combined :: and #
echo "========================================="
echo "Test 4: Combined :: and #"
echo "Command: evidence_add \"$TEST_FILE::5,7#important\""
echo "---"
set -x
evidence_add "$TEST_FILE::5,7#important" 2>&1 | tee /tmp/test4_output.txt
set +x
echo ""
echo "Evidence file created:"
ls -la "$FLOW_DIR/ctx/evidence/"
echo ""
echo "Content of evidence file:"
cat "$FLOW_DIR/ctx/evidence/"*.evidence.md 2>/dev/null || echo "NO FILE CREATED"
echo ""
echo "Checking for tags in metadata:"
grep -i "tags" "$FLOW_DIR/ctx/evidence/"*.evidence.md 2>/dev/null || echo "NO TAGS FOUND IN METADATA"
echo ""

# Summary
echo "========================================="
echo "Test Summary"
echo "========================================="
echo "Test directory: $TEST_DIR"
echo "Flow directory: $FLOW_DIR"
echo "Test file: $TEST_FILE"
echo ""
echo "To cleanup: rm -rf $TEST_DIR"
echo ""
echo "Expected Behavior:"
echo "  - Test 2: Should extract lines 5-7 only"
echo "  - Test 3: Should include tags='tag1,tag2' in metadata"
echo "  - Test 4: Should extract lines 5-7 AND include tags='important' in metadata"
echo ""
echo "If handlers are called multiple times, you'll see duplicate 'Added evidence:' messages above"
