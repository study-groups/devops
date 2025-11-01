#!/usr/bin/env bash
# Run this in your actual interactive shell to diagnose the org loading problem
# Usage: source debug_org_in_real_shell.sh

echo "=== Debugging org module in your actual shell ==="
echo ""

echo "1. Check if tmod function exists:"
type tmod 2>&1 | head -1

echo ""
echo "2. Check if org module is registered:"
if [[ -v TETRA_MODULE_LOADERS[org] ]]; then
    echo "✓ org is registered at: ${TETRA_MODULE_LOADERS[org]}"
else
    echo "✗ org is NOT registered"
fi

echo ""
echo "3. Check current org module status:"
if [[ -v TETRA_MODULE_LOADED[org] ]]; then
    echo "org loaded status: ${TETRA_MODULE_LOADED[org]}"
else
    echo "✗ org status unknown"
fi

echo ""
echo "4. Attempting to load org module..."
echo "   (capturing full output)"

# Create a log file for this session
DEBUG_LOG="/tmp/org_load_debug_$$.log"

echo "   Output will be in: $DEBUG_LOG"

{
    echo "=== tmod load org output ==="
    tmod load org 2>&1
    LOAD_EXIT=$?
    echo ""
    echo "Exit code: $LOAD_EXIT"
} | tee "$DEBUG_LOG"

echo ""
echo "5. Post-load status:"
echo "   org loaded: ${TETRA_MODULE_LOADED[org]}"

echo ""
echo "6. Check for org functions:"
ORG_FUNC_COUNT=$(declare -F | grep -c "^declare -f org" || echo "0")
echo "   Found $ORG_FUNC_COUNT org functions"

if [[ $ORG_FUNC_COUNT -gt 0 ]]; then
    echo "   Available org functions:"
    declare -F | grep "^declare -f org" | head -10
else
    echo "   ✗ NO ORG FUNCTIONS FOUND"
    echo ""
    echo "   This is the problem! Functions defined but not exported."
    echo "   Check: $DEBUG_LOG for details"
fi

echo ""
echo "7. Can we call org?"
if type org >/dev/null 2>&1; then
    echo "   ✓ org command exists"
    echo "   Testing: org help"
    org help 2>&1 | head -5
else
    echo "   ✗ org command NOT FOUND"
fi

echo ""
echo "=== Debug complete ==="
echo "Full log: $DEBUG_LOG"
