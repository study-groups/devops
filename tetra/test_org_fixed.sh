#!/usr/bin/env bash
# Test that org module now loads cleanly without terminal spam
# Run this with: source test_org_fixed.sh

echo "=== Org Module Fix Verification ==="
echo ""

# Clean test in a subshell
(
    source ~/tetra/tetra.sh 2>&1 >/dev/null

    echo "1. Before loading org:"
    echo "   Module status: ${TETRA_MODULE_LOADED[org]}"

    echo ""
    echo "2. Loading org (should be clean, no spam):"
    echo "   -------"
    OUTPUT=$(tmod load org 2>&1)
    OUTPUT_LINES=$(echo "$OUTPUT" | wc -l | tr -d ' ')
    echo "   -------"
    echo "   Output lines: $OUTPUT_LINES (should be ~1)"

    if [[ $OUTPUT_LINES -lt 10 ]]; then
        echo "   ✓ CLEAN OUTPUT (no verbose spam)"
    else
        echo "   ✗ Still spammy ($OUTPUT_LINES lines)"
    fi

    echo ""
    echo "3. After loading:"
    echo "   Module status: ${TETRA_MODULE_LOADED[org]}"

    echo ""
    echo "4. Function availability:"
    if type org >/dev/null 2>&1; then
        echo "   ✓ org command exists"
    else
        echo "   ✗ org command missing"
    fi

    if type org_list >/dev/null 2>&1; then
        echo "   ✓ org_list function exists"
    else
        echo "   ✗ org_list function missing"
    fi

    ORG_FUNC_COUNT=$(declare -F | grep -c "^declare -f org" || echo "0")
    echo "   Total org functions: $ORG_FUNC_COUNT"

    echo ""
    echo "5. Testing org command:"
    echo "   Running: org help | head -5"
    echo "   -------"
    org help 2>&1 | head -5
    echo "   -------"
)

echo ""
echo "=== Fix Summary ==="
echo "The fix added verbose mode suppression to bash/org/includes.sh:"
echo "  - Saves shell options before loading"
echo "  - Disables 'set -x' and 'set -v' during source operations"
echo "  - Restores original shell options after loading"
echo ""
echo "This prevents the 1000+ lines of function definitions from"
echo "flooding your terminal when loading the org module."
