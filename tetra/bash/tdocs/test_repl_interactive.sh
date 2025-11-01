#!/usr/bin/env bash
# Test tdocs REPL completion interactively

export TETRA_SRC="${TETRA_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
export TETRA_DIR="${TETRA_DIR:-$HOME/tetra}"
export TDOCS_SRC="$TETRA_SRC/bash/tdocs"
export TDOCS_DIR="$TETRA_DIR/tdocs"

echo "============================================"
echo "TDOCS REPL Completion Interactive Test"
echo "============================================"
echo ""

# Source the v2 completion
source "$TDOCS_SRC/tdocs_repl_complete_v2.sh"

# Enable completion
echo "Enabling completion..."
tdocs_repl_enable_completion
echo "✓ Completion enabled"
echo ""

# Check if complete -E is set
echo "Checking completion registration:"
complete -p -E 2>&1 | head -3
echo ""

# Simulate what COMP_* variables would be during completion
echo "Simulating completion for 'ls <TAB>':"
export COMP_WORDS=(ls)
export COMP_CWORD=1
export COMP_LINE="ls "
export COMP_POINT=3

# Call the completion function
_tdocs_repl_complete
echo "Completions: ${COMPREPLY[@]}"
echo ""

echo "Simulating completion for 'filter <TAB>':"
export COMP_WORDS=(filter)
export COMP_CWORD=1
export COMP_LINE="filter "
export COMP_POINT=7

_tdocs_repl_complete
echo "Completions: ${COMPREPLY[@]}"
echo ""

echo "Simulating completion for empty line '<TAB>':"
export COMP_WORDS=("")
export COMP_CWORD=0
export COMP_LINE=""
export COMP_POINT=0

_tdocs_repl_complete
echo "Completions: ${COMPREPLY[@]::10}..." # First 10
echo ""

echo "============================================"
echo "Test complete!"
echo "============================================"
echo ""
echo "To test in actual REPL:"
echo "  source ~/tetra/tetra.sh"
echo "  tmod load tdocs"
echo "  tdocs repl"
echo "  <type 'ls' and press TAB>"
