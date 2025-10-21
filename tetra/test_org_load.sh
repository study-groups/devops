#!/usr/bin/env bash
# Test org loading - source this in your current shell
# Usage: source test_org_load.sh

TEST_LOG="/tmp/org_load_test.log"

{
    echo "==================================================================="
    echo "ORG LOAD TEST - $(date)"
    echo "==================================================================="
    echo ""

    echo "=== Environment Check ==="
    echo "TETRA_SRC: ${TETRA_SRC}"
    echo "TETRA_DIR: ${TETRA_DIR}"
    echo "tmod available: $(command -v tmod >/dev/null && echo YES || echo NO)"
    echo ""

    echo "=== Checking color module guards ==="
    for file in color_core.sh color_palettes.sh color_themes.sh; do
        if grep -q "_LOADED" "$TETRA_SRC/bash/color/$file" 2>/dev/null; then
            echo "✓ $file has source guard"
        else
            echo "✗ $file MISSING source guard"
        fi
    done
    echo ""

    echo "=== Testing tmod load org with trace ==="
    set -x
    tmod load org
    load_result=$?
    set +x

    echo ""
    echo "=== Result ==="
    echo "Exit code: $load_result"

    if [[ $load_result -eq 0 ]]; then
        echo "✓ Module loaded"
        echo ""
        echo "Functions available:"
        command -v org && echo "  ✓ org"
        command -v org_repl && echo "  ✓ org_repl"
        command -v org_list && echo "  ✓ org_list"
    else
        echo "✗ Module failed to load"
    fi

    echo ""
    echo "==================================================================="
    echo "Log saved to: $TEST_LOG"
    echo "==================================================================="

} 2>&1 | tee "$TEST_LOG"

echo ""
echo "To view the log: cat $TEST_LOG"
