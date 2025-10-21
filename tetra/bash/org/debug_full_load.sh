#!/usr/bin/env bash
# Comprehensive debug for org loading issue

LOG_FILE="/tmp/tetra_org_debug.log"
exec > >(tee "$LOG_FILE") 2>&1

echo "==================================================================="
echo "TETRA ORG MODULE DEBUG LOG - $(date)"
echo "==================================================================="
echo ""

echo "=== 1. Initial Environment ==="
echo "TETRA_SRC: ${TETRA_SRC:-NOT SET}"
echo "TETRA_DIR: ${TETRA_DIR:-NOT SET}"
echo "SHELL: $SHELL"
echo "BASH_VERSION: $BASH_VERSION"
echo ""

echo "=== 2. Sourcing tetra.sh ==="
echo "File: ~/tetra/tetra.sh"
if [[ ! -f ~/tetra/tetra.sh ]]; then
    echo "ERROR: ~/tetra/tetra.sh does not exist!"
    exit 1
fi

echo "Content of ~/tetra/tetra.sh:"
cat ~/tetra/tetra.sh
echo ""

echo "--- Sourcing with debug trace ---"
set -x
source ~/tetra/tetra.sh
source_exit=$?
set +x
echo "Source exit code: $source_exit"
echo ""

echo "=== 3. Post-source Environment ==="
echo "TETRA_SRC: ${TETRA_SRC:-NOT SET}"
echo "TETRA_DIR: ${TETRA_DIR:-NOT SET}"
echo ""

echo "=== 4. Check if tmod exists ==="
if command -v tmod >/dev/null 2>&1; then
    echo "✓ tmod command is available"
    echo "tmod location: $(command -v tmod)"
    echo "tmod function definition (first 10 lines):"
    declare -f tmod | head -10
else
    echo "✗ tmod command NOT available"
    echo ""
    echo "Checking if function is defined:"
    declare -F tmod || echo "  Function not defined"
    echo ""
    echo "Checking PATH:"
    echo "  $PATH"
fi
echo ""

echo "=== 5. Check bootloader functions ==="
for func in tetra_load_module tetra_smart_load_module tmod_load_module; do
    if declare -F "$func" >/dev/null 2>&1; then
        echo "✓ $func exists"
    else
        echo "✗ $func NOT found"
    fi
done
echo ""

echo "=== 6. Attempt to load org (if tmod exists) ==="
if command -v tmod >/dev/null 2>&1; then
    echo "Running: tmod load org"
    set -x
    tmod load org
    load_exit=$?
    set +x
    echo "Load exit code: $load_exit"

    if [[ $load_exit -eq 0 ]]; then
        echo "✓ org module loaded"
        echo ""
        echo "=== 7. Check org functions ==="
        for func in org org_repl org_list; do
            if command -v "$func" >/dev/null 2>&1; then
                echo "✓ $func available"
            else
                echo "✗ $func NOT available"
            fi
        done
    else
        echo "✗ org module failed to load"
    fi
else
    echo "SKIPPED - tmod not available"
fi
echo ""

echo "==================================================================="
echo "Debug log saved to: $LOG_FILE"
echo "==================================================================="
