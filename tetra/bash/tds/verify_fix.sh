#!/usr/bin/env bash

# Verify that theme colors update correctly

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/tds.sh" 2>/dev/null

echo "=== Verifying Theme Color Updates ==="
echo

# Test 1: Tokyo Night
echo "Loading Tokyo Night theme..."
tds_switch_theme "tokyo-night" >/dev/null 2>&1
echo "  ENV_PRIMARY[0] (should be green): ${ENV_PRIMARY[0]}"
echo "  TDS_SEMANTIC_COLORS[success]:     ${TDS_SEMANTIC_COLORS[success]}"
if [[ "${ENV_PRIMARY[0]}" == "${TDS_SEMANTIC_COLORS[success]}" ]]; then
    echo "  ✓ Correctly mapped!"
else
    echo "  ✗ Mismatch!"
fi
echo "  Visual test:"
echo "    $(tds_status "success" "Success") $(tds_status "error" "Error") $(tds_status "warning" "Warning")"
echo

# Test 2: Neon
echo "Loading Neon theme..."
tds_switch_theme "neon" >/dev/null 2>&1
echo "  ENV_PRIMARY[0] (should be neon green): ${ENV_PRIMARY[0]}"
echo "  TDS_SEMANTIC_COLORS[success]:          ${TDS_SEMANTIC_COLORS[success]}"
if [[ "${ENV_PRIMARY[0]}" == "${TDS_SEMANTIC_COLORS[success]}" ]]; then
    echo "  ✓ Correctly mapped!"
else
    echo "  ✗ Mismatch!"
fi
echo "  Visual test:"
echo "    $(tds_status "success" "Success") $(tds_status "error" "Error") $(tds_status "warning" "Warning")"
echo

# Test 3: Default
echo "Loading Default theme..."
tds_switch_theme "default" >/dev/null 2>&1
echo "  ENV_PRIMARY[0]:                    ${ENV_PRIMARY[0]}"
echo "  TDS_SEMANTIC_COLORS[success]:     ${TDS_SEMANTIC_COLORS[success]}"
if [[ "${ENV_PRIMARY[0]}" == "${TDS_SEMANTIC_COLORS[success]}" ]]; then
    echo "  ✓ Correctly mapped!"
else
    echo "  ✗ Mismatch (might be OK if ENV_PRIMARY is empty)"
fi
echo "  Visual test:"
echo "    $(tds_status "success" "Success") $(tds_status "error" "Error") $(tds_status "warning" "Warning")"
echo

echo "=== Conclusion ==="
echo "Colors should visibly change between themes above."
echo "If success is always green but different shades, it's working!"
