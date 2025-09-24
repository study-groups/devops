#!/usr/bin/env bash

# Test script for Named Port Registry Persistence
# Validates TOML configuration loading, saving, and port allocation

source "${TETRA_SRC}/bash/tsm/tsm.sh"

echo "=== Testing Named Port Registry Persistence ==="
echo

# Test 1: Configuration file creation
echo "1. Testing configuration file creation..."
if [[ -f "$TETRA_DIR/config/ports.toml" ]]; then
    echo "✅ Configuration file exists"
else
    echo "❌ Configuration file not found"
    exit 1
fi

# Test 2: Port listing
echo
echo "2. Testing port listing..."
tsm ports list

# Test 3: Adding a new port
echo
echo "3. Testing port addition..."
tsm ports set testservice 9001

# Test 4: Verify persistence
echo
echo "4. Verifying persistence..."
if grep -q "testservice.*9001" "$TETRA_DIR/config/ports.toml"; then
    echo "✅ Port persisted to configuration file"
else
    echo "❌ Port not found in configuration file"
fi

# Test 5: Port allocation
echo
echo "5. Testing automatic port allocation..."
tsm ports allocate autoservice development

# Test 6: Conflict detection
echo
echo "6. Testing conflict detection..."
tsm ports conflicts

# Test 7: Export functionality
echo
echo "7. Testing export functionality..."
temp_file="/tmp/ports_export_test.toml"
tsm ports export "$temp_file" toml
if [[ -f "$temp_file" ]]; then
    echo "✅ Export successful"
    rm -f "$temp_file"
else
    echo "❌ Export failed"
fi

# Cleanup
echo
echo "8. Cleanup..."
tsm ports remove testservice
tsm ports remove autoservice

echo
echo "=== Port Registry Persistence Tests Complete ==="