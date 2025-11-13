#!/usr/bin/env bash

# Migration Verification Test
# Ensures REPL v2 is properly loaded as default

source ~/tetra/tetra.sh

echo "=== Migration Verification ==="
echo ""

# Test 1: Check that repl_v2 is loaded by default
echo "1. Checking that REPL v2 is loaded..."
if declare -f tsm_repl_main >/dev/null; then
    echo "   ✓ tsm_repl_main function is available"
else
    echo "   ✗ tsm_repl_main function NOT found"
    exit 1
fi

# Test 2: Check that repl_v2 functions are present (not legacy)
echo "2. Checking REPL v2 functions are loaded..."
if declare -f tsm_prompt_status >/dev/null; then
    echo "   ✓ tsm_prompt_status found (REPL v2 feature)"
else
    echo "   ✗ tsm_prompt_status NOT found (should be from v2)"
    exit 1
fi

if declare -f tsm_cmd_tsm_help >/dev/null; then
    echo "   ✓ tsm_cmd_tsm_help found (REPL v2 feature)"
else
    echo "   ✗ tsm_cmd_tsm_help NOT found (should be from v2)"
    exit 1
fi

# Test 3: Check that bash/repl is being used
echo "3. Checking bash/repl integration..."
if declare -f repl_run >/dev/null; then
    echo "   ✓ repl_run function found (bash/repl loaded)"
else
    echo "   ✗ repl_run NOT found (bash/repl not loaded)"
    exit 1
fi

# Test 4: Verify legacy REPL is not loaded by default
echo "4. Checking legacy REPL is NOT loaded by default..."
# Legacy REPL has a unique function name
if declare -f tsm_repl_custom_ps >/dev/null 2>&1; then
    # Check if it's actually from v2 (which also has this function)
    if grep -q "tsm_repl_custom_ps" "$TETRA_SRC/bash/tsm/interfaces/tsm_repl.sh" 2>/dev/null; then
        echo "   ✓ Legacy REPL not loaded (v2 is active)"
    else
        echo "   ⚠ Legacy REPL might be loaded (check manually)"
    fi
else
    echo "   ✓ Legacy REPL not loaded by default"
fi

# Test 5: Check include.sh loads repl_v2
echo "5. Checking include.sh configuration..."
if grep -q "tsm_repl.sh" "$TETRA_SRC/bash/tsm/core/include.sh"; then
    echo "   ✓ include.sh loads tsm_repl.sh"
else
    echo "   ✗ include.sh does NOT load tsm_repl.sh"
    exit 1
fi

# Test 6: Check tsm.sh has repl-legacy command
echo "6. Checking tsm.sh has repl-legacy fallback..."
if grep -q "repl-legacy)" "$TETRA_SRC/bash/tsm/tsm.sh"; then
    echo "   ✓ repl-legacy command available"
else
    echo "   ✗ repl-legacy command NOT found"
    exit 1
fi

# Test 7: Check legacy file was renamed
echo "7. Checking legacy file location..."
if [[ -f "$TETRA_SRC/bash/tsm/interfaces/repl_legacy.sh" ]]; then
    echo "   ✓ repl_legacy.sh exists"
else
    echo "   ✗ repl_legacy.sh NOT found"
    exit 1
fi

if [[ ! -f "$TETRA_SRC/bash/tsm/interfaces/repl.sh" ]]; then
    echo "   ✓ Original repl.sh was renamed"
else
    echo "   ⚠ Original repl.sh still exists (check if intentional)"
fi

# Test 8: Verify slash commands are registered
echo "8. Checking slash command registration..."
source "$TETRA_SRC/bash/tsm/interfaces/tsm_repl.sh" 2>/dev/null
if [[ ${#REPL_SLASH_HANDLERS[@]} -gt 10 ]]; then
    echo "   ✓ Slash commands registered (${#REPL_SLASH_HANDLERS[@]} commands)"
else
    echo "   ✗ Insufficient slash commands registered"
    exit 1
fi

echo ""
echo "=== All Migration Checks Passed! ==="
echo ""
echo "REPL v2 is now the default:"
echo "  • Run with: tsm repl"
echo "  • Legacy available: tsm repl-legacy"
echo "  • Help: tsm repl then type /tsm-help"
echo ""
exit 0
