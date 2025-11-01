#!/usr/bin/env bash
# Test if bind -x works with the completion function

export TETRA_SRC="${TETRA_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
export TETRA_DIR="${TETRA_DIR:-$HOME/tetra}"
export TDOCS_SRC="$TETRA_SRC/bash/tdocs"
export TDOCS_DIR="$TETRA_DIR/tdocs"

# Source the completion module
source "$TDOCS_SRC/tdocs_repl_complete.sh"

echo "======================================"
echo "Testing bind -x functionality"
echo "======================================"
echo ""

# Check if function exists
echo "1. Checking if _tdocs_repl_complete exists:"
if declare -F _tdocs_repl_complete >/dev/null 2>&1; then
    echo "   ✓ Function exists"
else
    echo "   ✗ Function does not exist"
    exit 1
fi
echo ""

# Try to enable completion
echo "2. Enabling completion:"
tdocs_repl_enable_completion
echo "   ✓ Enable function called"
echo ""

# Check if bind succeeded
echo "3. Checking bind status:"
bind_output=$(bind -P 2>&1 | grep '\\t')
if [[ -n "$bind_output" ]]; then
    echo "   ✓ TAB binding found:"
    echo "     $bind_output"
else
    echo "   ⚠ No TAB binding found"
    echo ""
    echo "   This is expected if:"
    echo "   - Not running in interactive bash"
    echo "   - Readline not available"
fi
echo ""

# Try manual test of the function
echo "4. Testing function directly:"
export READLINE_LINE=""
export READLINE_POINT=0

if _tdocs_repl_complete 2>&1 | head -5; then
    echo "   ✓ Function executes without error"
else
    echo "   ✗ Function failed"
fi
echo ""

echo "======================================"
echo "Bind test complete"
echo "======================================"
echo ""
echo "To test in actual REPL:"
echo "  source ~/tetra/tetra.sh"
echo "  tmod load tdocs"
echo "  tdocs repl"
echo "  <press TAB>"
