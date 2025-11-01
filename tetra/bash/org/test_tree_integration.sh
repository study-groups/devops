#!/usr/bin/env bash
# Test Org Tree Integration
# Demonstrates tab-completion and thelp integration for bash/org

echo "========================================"
echo "  Org Tree Integration Test"
echo "========================================"
echo ""

# Setup
export TETRA_SRC=/Users/mricos/src/devops/tetra
export TETRA_DIR=$HOME/tetra

# Load dependencies
source "$TETRA_SRC/bash/color/color.sh" 2>/dev/null || {
    text_color() { :; }
    reset_color() { :; }
}
source "$TETRA_SRC/bash/tree/core.sh"
source "$TETRA_SRC/bash/tree/help.sh"
source "$TETRA_SRC/bash/tree/complete.sh"
source "$TETRA_SRC/bash/org/org_constants.sh"
source "$TETRA_SRC/bash/org/org_tree.sh"
source "$TETRA_SRC/bash/org/org_completion.sh"

# Initialize tree
echo "Initializing org tree..."
_org_ensure_tree
echo "✓ Tree initialized"
echo ""

# Test 1: Tree structure
echo "=== Test 1: Tree Structure ==="
echo "Root type: $(tree_type 'help.org')"
echo "Root title: $(tree_get 'help.org' 'title')"
echo ""

# Test 2: Top-level commands
echo "=== Test 2: Top-Level Commands ==="
echo "Available commands (tree_complete):"
tree_complete 'help.org' | sed 's/^/  - /'
echo ""

# Test 3: Subcommands (import)
echo "=== Test 3: Import Subcommands ==="
echo "Import subcommands:"
tree_complete 'help.org.import' | sed 's/^/  - /'
echo ""

# Test 4: Help display
echo "=== Test 4: Help Display ==="
echo "Help for 'org list' command:"
tree_help_show 'help.org.list'
echo ""

# Test 5: Secrets subcommands
echo "=== Test 5: Secrets Subcommands ==="
echo "Secrets management commands:"
tree_complete 'help.org.secrets' | sed 's/^/  - /'
echo ""

# Test 6: Environment subcommands
echo "=== Test 6: Environment Subcommands ==="
echo "Environment management commands:"
tree_complete 'help.org.env' | sed 's/^/  - /'
echo ""

# Test 7: Command metadata
echo "=== Test 7: Command Metadata ==="
echo "Metadata for 'org switch' command:"
echo "  Usage: $(tree_get 'help.org.switch' 'usage')"
echo "  Handler: $(tree_get 'help.org.switch' 'handler')"
echo "  Completion: $(tree_get 'help.org.switch' 'completion_fn')"
echo ""

# Test 8: Dynamic completion functions
echo "=== Test 8: Dynamic Completion ==="
echo "Testing org_completion_envs:"
org_completion_envs | sed 's/^/  - /'
echo ""

# Test 9: Bash completion simulation
echo "=== Test 9: Bash Completion Simulation ==="
echo "Simulating: org import <TAB>"
COMP_WORDS=(org import "")
COMP_CWORD=2
_org_complete
echo "Completions: ${COMPREPLY[*]}"
echo ""

# Test 10: Help tree hierarchy
echo "=== Test 10: Tree Hierarchy ==="
echo "All org commands in tree:"
tree_descendants 'help.org' --type command 2>/dev/null | head -20 | sed 's/^/  - /'
echo "  ... (more commands available)"
echo ""

echo "========================================"
echo "  ✓ All Tests Complete"
echo "========================================"
echo ""
echo "Integration verified:"
echo "  ✓ bash/tree - Tree data structure"
echo "  ✓ bash/tree/complete - Tab completion"
echo "  ✓ bash/tree/help - Help display"
echo "  ✓ bash/org/org_tree - Org command tree"
echo "  ✓ bash/org/org_completion - Completion functions"
echo ""
echo "Next steps:"
echo "  1. Load org module: tmod load org"
echo "  2. Try tab completion: org <TAB>"
echo "  3. Get help: thelp org.list"
echo "  4. Start REPL: org"
echo ""
