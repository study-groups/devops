#!/usr/bin/env bash

# Minimal test to isolate fork loop issue
echo "=== Minimal TSM Fork Debug ==="

# Set up environment
export TETRA_SRC="/Users/mricos/src/devops/tetra"
export TETRA_DIR="$TETRA_SRC"

echo "Step 1: Environment set"
echo "TETRA_SRC: $TETRA_SRC"

# Test each file individually to find the problematic one
echo ""
echo "Step 2: Testing individual files..."

MOD_SRC="$TETRA_SRC/bash/tsm"
echo "MOD_SRC: $MOD_SRC"

# Test 1: config.sh alone
echo ""
echo "Test 2a: Loading config.sh..."
if timeout 5 bash -c "source '$MOD_SRC/core/config.sh'; echo 'config.sh loaded'" 2>/dev/null; then
    echo "✅ config.sh loads successfully"
else
    echo "❌ config.sh has issues or timeout"
    exit 1
fi

# Test 2: core.sh alone
echo ""
echo "Test 2b: Loading core.sh..."
if timeout 5 bash -c "source '$MOD_SRC/core/config.sh'; source '$MOD_SRC/core/core.sh'; echo 'core.sh loaded'" 2>/dev/null; then
    echo "✅ core.sh loads successfully"
else
    echo "❌ core.sh has issues or timeout"
    exit 1
fi

# Test 3: utils.sh
echo ""
echo "Test 2c: Loading utils.sh..."
if timeout 5 bash -c "source '$MOD_SRC/core/config.sh'; source '$MOD_SRC/core/core.sh'; source '$MOD_SRC/core/utils.sh'; echo 'utils.sh loaded'" 2>/dev/null; then
    echo "✅ utils.sh loads successfully"
else
    echo "❌ utils.sh has issues or timeout"
    exit 1
fi

# Test 4: Try include.sh with timeout
echo ""
echo "Test 3: Testing include.sh with timeout..."
if timeout 10 bash -c "export MOD_SRC='$MOD_SRC'; source '$MOD_SRC/include.sh'; echo 'include.sh loaded successfully'" 2>/dev/null; then
    echo "✅ include.sh loads successfully"
else
    echo "❌ include.sh has fork loop or timeout"
    echo "The fork loop is in include.sh or one of its dependencies"
    exit 1
fi

echo ""
echo "All tests passed! The issue might be elsewhere."