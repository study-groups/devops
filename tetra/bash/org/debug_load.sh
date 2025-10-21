#!/usr/bin/env bash
# Debug script to capture exact error

echo "=== Environment ==="
echo "TETRA_SRC: ${TETRA_SRC}"
echo "TETRA_DIR: ${TETRA_DIR}"
echo ""

echo "=== Attempting to load org module with full tracing ==="
echo ""

# Try loading with maximum debug info
set -x
tmod load org
exitcode=$?
set +x

echo ""
echo "=== Exit code: $exitcode ==="
echo ""

if [[ $exitcode -eq 0 ]]; then
    echo "✓ Module loaded successfully"
    command -v org_repl && echo "✓ org_repl available" || echo "✗ org_repl NOT available"
else
    echo "✗ Module failed to load"
fi
