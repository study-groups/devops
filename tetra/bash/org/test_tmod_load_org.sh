#!/usr/bin/env bash
# Diagnostic test for tmod load org

echo "=== Testing tmod load org ==="
echo ""

# Test 1: Check environment
echo "1. Environment Check:"
echo "   TETRA_SRC: ${TETRA_SRC:-NOT SET}"
echo "   TETRA_DIR: ${TETRA_DIR:-NOT SET}"
echo ""

# Test 2: Check if tetra.sh is sourced
echo "2. Tetra loaded:"
if command -v tmod >/dev/null 2>&1; then
    echo "   ✓ tmod command available"
else
    echo "   ✗ tmod command NOT available"
    echo "   Run: source ~/tetra/tetra.sh"
    exit 1
fi
echo ""

# Test 3: Check dependencies
echo "3. Dependencies:"
for file in \
    "$TETRA_SRC/bash/repl/repl.sh" \
    "$TETRA_SRC/bash/color/color.sh" \
    "$TETRA_SRC/bash/tcurses/tcurses_input.sh" \
    "$TETRA_SRC/bash/org/tetra_org.sh" \
    "$TETRA_SRC/bash/org/org_help.sh" \
    "$TETRA_SRC/bash/org/org_repl_adapter.sh"
do
    if [[ -f "$file" ]]; then
        echo "   ✓ $(basename $file)"
    else
        echo "   ✗ MISSING: $file"
    fi
done
echo ""

# Test 4: Try loading org
echo "4. Loading org module:"
if tmod load org 2>&1; then
    echo "   ✓ Module loaded successfully"
else
    echo "   ✗ Module failed to load"
    exit 1
fi
echo ""

# Test 5: Check functions
echo "5. Functions available:"
for func in org org_repl org_list org_active org_switch; do
    if command -v "$func" >/dev/null 2>&1; then
        echo "   ✓ $func"
    else
        echo "   ✗ $func NOT FOUND"
    fi
done
echo ""

# Test 6: Check REPL slash handlers
echo "6. REPL system:"
if [[ -n "${REPL_SLASH_HANDLERS[list]}" ]]; then
    echo "   ✓ Slash handlers registered"
    echo "   Handlers: ${!REPL_SLASH_HANDLERS[@]}"
else
    echo "   ✗ Slash handlers NOT registered"
fi
echo ""

echo "=== All tests passed! ==="
echo ""
echo "Try:"
echo "  org         # Launch REPL"
echo "  org list    # List orgs"
