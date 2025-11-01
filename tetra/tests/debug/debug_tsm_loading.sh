#!/usr/bin/env bash

# Debug script to isolate TSM loading issues
echo "=== TSM Loading Debug ==="

# Set up environment
export TETRA_SRC="/Users/mricos/src/devops/tetra"
export TETRA_DIR="$TETRA_SRC"

echo "TETRA_SRC: $TETRA_SRC"
echo "TETRA_DIR: $TETRA_DIR"

# Test 1: Basic include.sh loading
echo ""
echo "Test 1: Loading include.sh with MOD_SRC..."
MOD_SRC="$TETRA_SRC/bash/tsm"
echo "MOD_SRC: $MOD_SRC"

# Check if files exist
echo "Checking file existence:"
echo "  include.sh: $(ls "$MOD_SRC/include.sh" 2>/dev/null && echo "EXISTS" || echo "MISSING")"
echo "  core/config.sh: $(ls "$MOD_SRC/core/config.sh" 2>/dev/null && echo "EXISTS" || echo "MISSING")"
echo "  core/core.sh: $(ls "$MOD_SRC/core/core.sh" 2>/dev/null && echo "EXISTS" || echo "MISSING")"

echo ""
echo "Attempting to source include.sh..."

# Source with error checking
if source "$MOD_SRC/include.sh" 2>&1; then
    echo "✅ include.sh loaded successfully"

    # Test discovery interface
    if declare -f tsm_module_actions >/dev/null; then
        echo "✅ tsm_module_actions found"
    else
        echo "❌ tsm_module_actions missing"
    fi

    if declare -f tsm_module_init >/dev/null; then
        echo "✅ tsm_module_init found"
    else
        echo "❌ tsm_module_init missing"
    fi

    if declare -f _tsm_init_global_state >/dev/null; then
        echo "✅ _tsm_init_global_state found"
    else
        echo "❌ _tsm_init_global_state missing"
    fi

else
    echo "❌ Failed to load include.sh"
    exit 1
fi

echo ""
echo "Test completed successfully!"