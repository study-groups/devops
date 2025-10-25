#!/usr/bin/env bash
# Test tdoc help tree integration

set -e

export TETRA_SRC=/Users/mricos/src/devops/tetra
export TETRA_DIR=$HOME/tetra

# Load only what we need
source "$TETRA_SRC/bash/tree/core.sh"
source "$TETRA_SRC/bash/tree/complete.sh"
source "$TETRA_SRC/bash/tree/help.sh"

# Build a simplified tdoc help tree
tree_insert "help.tdoc" category \
    title="Document Manager" \
    help="Manage LLM-generated markdown documents"

tree_insert "help.tdoc.init" command \
    title="Initialize document" \
    help="Add metadata to document" \
    synopsis="tdoc init <file> [OPTIONS]"

tree_insert "help.tdoc.init.--core" flag \
    title="Core document" \
    help="Mark as core document"

tree_insert "help.tdoc.list" command \
    title="List documents" \
    help="List all tracked documents" \
    synopsis="tdoc list [OPTIONS]"

echo "=== Testing tdoc help tree ==="
echo ""

# Test 1: Show main help
echo "Test 1: Main help"
tree_help_show "help.tdoc" --no-pagination
echo ""

# Test 2: Show command help
echo "Test 2: Command help (init)"
tree_help_show "help.tdoc.init" --no-pagination
echo ""

# Test 3: Completions
echo "Test 3: Tab-completions for tdoc"
completions=$(tree_complete "help.tdoc")
echo "Available commands:"
echo "$completions"
echo ""

# Test 4: Flag completions
echo "Test 4: Tab-completions for tdoc init"
flag_completions=$(tree_complete "help.tdoc.init")
echo "Available flags/options:"
echo "$flag_completions"
echo ""

echo "✓ All tdoc help tests passed!"
