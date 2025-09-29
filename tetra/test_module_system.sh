#!/usr/bin/env bash

# Test script for the new module system
echo "Testing Tetra Module System"
echo "==========================="

# Set up environment if not already set
if [[ -z "$TETRA_SRC" ]]; then
    export TETRA_SRC="/Users/mricos/src/devops/tetra"
    echo "Setting TETRA_SRC to: $TETRA_SRC"
fi

if [[ -z "$TETRA_DIR" ]]; then
    export TETRA_DIR="$TETRA_SRC"
    echo "Setting TETRA_DIR to: $TETRA_DIR"
fi

echo ""
echo "Environment:"
echo "  TETRA_SRC: $TETRA_SRC"
echo "  TETRA_DIR: $TETRA_DIR"
echo ""

# Test 1: Load module registry
echo "Test 1: Loading module registry..."
if source "$TETRA_SRC/bash/utils/module_registry.sh"; then
    echo "✅ Module registry loaded successfully"
else
    echo "❌ Failed to load module registry"
    exit 1
fi

# Test 2: Check discovery interface for TSM
echo ""
echo "Test 2: Testing TSM discovery interface..."
MOD_SRC="$TETRA_SRC/bash/tsm"

# Load TSM components
if source "$MOD_SRC/include.sh"; then
    echo "✅ TSM include.sh loaded successfully"
else
    echo "❌ Failed to load TSM include.sh"
    exit 1
fi

# Test discovery interface
if declare -f tsm_module_actions >/dev/null; then
    echo "✅ tsm_module_actions found"
    echo "   Actions: $(tsm_module_actions)"
else
    echo "❌ tsm_module_actions not found"
fi

if declare -f tsm_module_properties >/dev/null; then
    echo "✅ tsm_module_properties found"
    echo "   Properties: $(tsm_module_properties)"
else
    echo "❌ tsm_module_properties not found"
fi

# Test 3: Register TSM with module system
echo ""
echo "Test 3: Registering TSM with module system..."
if tetra_module_register "tsm" "$MOD_SRC" "$MODULE_STATUS_ACTIVE"; then
    echo "✅ TSM registered successfully"
else
    echo "❌ Failed to register TSM"
fi

# Test 4: Module discovery
echo ""
echo "Test 4: Module discovery..."
tetra_module_discover "tsm"

echo ""
echo "Test completed!"