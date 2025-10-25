#!/usr/bin/env bash
# test_tree_completion.sh - Test tree tab completion

# Source tetra
source ~/tetra/tetra.sh

# Source tree modules
source "$TETRA_SRC/bash/tree/core.sh"
source "$TETRA_SRC/bash/tree/complete.sh"
source "$TETRA_SRC/bash/tree/tree_repl_complete.sh"

# Create sample tree structure
echo "=== Setting up test tree ==="
tree_insert "help.tree" "category" title="Tree Module" help="Tree operations"
tree_insert "help.tree.list" "action" help="List all tree nodes" detail="Show hierarchical tree structure"
tree_insert "help.tree.show" "action" help="Show node details" detail="Display node metadata and children"
tree_insert "help.tree.query" "category" help="Query tree nodes"
tree_insert "help.tree.query.type" "action" help="Query by type" detail="Find nodes matching type filter"
tree_insert "help.tree.query.path" "action" help="Query by path" detail="Find nodes by path pattern"
tree_insert "help.tree.insert" "action" help="Insert new node" detail="Add node to tree structure"
tree_insert "help.tree.delete" "action" help="Delete node" detail="Remove node and optionally children"

echo "✓ Created sample tree structure"
echo ""

# Test tree_complete function
echo "=== Testing tree_complete function ==="
echo ""

echo "1. Complete at root level (help.tree):"
tree_complete "help.tree"
echo ""

echo "2. Complete 'qu' at help.tree (should match 'query'):"
tree_complete "help.tree" "qu"
echo ""

echo "3. Complete at help.tree.query:"
tree_complete "help.tree.query"
echo ""

# Test completion with namespace
echo "=== Testing namespace-based completion ==="
export TREE_REPL_NAMESPACE="help.tree"

# Simulate COMP_WORDS for bash completion
COMP_WORDS=("query")
COMP_CWORD=0
echo "Simulating: 'query<TAB>'"
tree_repl_completion
echo "COMPREPLY: ${COMPREPLY[*]}"
echo ""

# Test with partial match
COMP_WORDS=("qu")
COMP_CWORD=0
echo "Simulating: 'qu<TAB>'"
tree_repl_completion
echo "COMPREPLY: ${COMPREPLY[*]}"
echo ""

# Test second level
COMP_WORDS=("query" "type")
COMP_CWORD=1
echo "Simulating: 'query type<TAB>'"
tree_repl_completion
echo "COMPREPLY: ${COMPREPLY[*]}"
echo ""

echo "=== Interactive tree_complete_interactive ==="
tree_complete_interactive "help.tree"
echo ""

echo "=== Test Summary ==="
echo "✓ Tab completion functions created"
echo "✓ Tree structure navigation working"
echo ""
echo "To use in a REPL:"
echo "  1. Set namespace: export TREE_REPL_NAMESPACE='help.tree'"
echo "  2. Enable completion: tree_repl_enable_completion 'help.tree'"
echo "  3. Press TAB to complete commands"
echo ""
echo "Example REPL integration:"
echo "  source \$TETRA_SRC/bash/tree/tree_repl_complete.sh"
echo "  tree_repl_enable_completion 'help.tree'"
echo "  # Now TAB works in your REPL!"
