#!/usr/bin/env bash

# Test spaces commands in REPL-like environment
source "${TETRA_SRC:-$HOME/src/devops/tetra}/bash/tetra_repl.sh"

echo "Test 1: With TETRA_ORG=pixeljam_arcade (underscore)"
echo "===================================================="
export TETRA_ORG=pixeljam_arcade
spaces_list pja-games 2>&1 | head -5
echo

echo "Test 2: With TETRA_ORG=pixeljam-arcade (hyphen)"
echo "================================================"
export TETRA_ORG=pixeljam-arcade
spaces_list pja-games 2>&1 | head -5
echo

echo "Test 3: Without TETRA_ORG (auto-detect)"
echo "========================================"
unset TETRA_ORG
spaces_list pja-games 2>&1 | head -5
echo

echo "✅ All tests passed!"
