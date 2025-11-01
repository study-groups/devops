#!/usr/bin/env bash
# Quick Verification for Org Tab Completion
# Note: This tests the functions, but 'complete' only works in interactive shells

export TETRA_SRC=/Users/mricos/src/devops/tetra
export TETRA_DIR=$HOME/tetra

echo "=================================="
echo "  Org Tab Completion Quick Check"
echo "=================================="
echo ""

# Load module
echo "1. Loading org module..."
source "$TETRA_SRC/bash/org/includes.sh" 2>&1 | grep -E "error|Error|ERROR" && {
    echo "✗ Errors during load"
    exit 1
}
echo "   ✓ No errors"

# Check functions
echo ""
echo "2. Checking functions..."
for func in org _org_complete org_tree_init; do
    if declare -F "$func" >/dev/null 2>&1; then
        echo "   ✓ $func exists"
    else
        echo "   ✗ $func NOT found"
        exit 1
    fi
done

# Test completion function directly
echo ""
echo "3. Testing completion function..."
COMP_WORDS=(org '')
COMP_CWORD=1
_org_complete
if [[ ${#COMPREPLY[@]} -gt 15 ]]; then
    echo "   ✓ Top-level: ${#COMPREPLY[@]} completions"
    echo "     ${COMPREPLY[@]:0:6}..."
else
    echo "   ✗ Expected 15+ completions, got ${#COMPREPLY[@]}"
    exit 1
fi

COMP_WORDS=(org import '')
COMP_CWORD=2
_org_complete
if [[ "${COMPREPLY[*]}" =~ "nh" ]]; then
    echo "   ✓ Subcommands: ${COMPREPLY[*]}"
else
    echo "   ✗ Subcommand completion failed"
    exit 1
fi

# Check tree
echo ""
echo "4. Checking tree structure..."
if [[ "$(tree_type 'help.org')" == "category" ]]; then
    echo "   ✓ Tree initialized"
else
    echo "   ✗ Tree not initialized"
    exit 1
fi

echo ""
echo "=================================="
echo "  ✅ ALL CHECKS PASSED"
echo "=================================="
echo ""
echo "NOTE: The 'complete' command only works in"
echo "      interactive shells. To test tab completion:"
echo ""
echo "  1. Start a new interactive bash shell"
echo "  2. source ~/tetra/tetra.sh"
echo "  3. tmod load org"
echo "  4. Type: org <TAB>"
echo ""
echo "Or test with:"
echo "  bash -i -c 'source ~/tetra/tetra.sh && tmod load org && complete -p org'"
echo ""
