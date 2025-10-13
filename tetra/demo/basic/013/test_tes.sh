#!/usr/bin/env bash

# Test TES resolution system

DEMO_DIR="$(dirname "${BASH_SOURCE[0]}")"
source ~/tetra/tetra.sh
source "$DEMO_DIR/tes_resolver.sh"

echo "═══════════════════════════════════════════════════════════"
echo "TES Resolution Test"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Test 1: Get TOML path
echo "Test 1: TOML Path Resolution"
toml_path=$(get_toml_path)
if [[ -n "$toml_path" ]]; then
    echo "  ✓ TOML found: ${toml_path/$HOME/~}"
else
    echo "  ✗ TOML not found"
fi
echo ""

# Test 2: Resolve @dev connector
echo "Test 2: Connector Resolution (@dev)"
connector_data=$(resolve_connector "@dev")
if [[ -n "$connector_data" ]]; then
    IFS='|' read -r auth_user work_user host auth_key <<< "$connector_data"
    echo "  ✓ Connector resolved:"
    echo "    auth_user: $auth_user"
    echo "    work_user: $work_user"
    echo "    host: $host"
    echo "    auth_key: ${auth_key/$HOME/~}"
else
    echo "  ✗ Failed to resolve @dev"
fi
echo ""

# Test 3: Build SSH command
echo "Test 3: SSH Command Construction"
ssh_cmd=$(build_ssh_command "@dev" "echo 'test'")
if [[ -n "$ssh_cmd" ]]; then
    echo "  ✓ SSH command built:"
    echo ""
    echo "  $ssh_cmd"
else
    echo "  ✗ Failed to build SSH command"
fi
echo ""

# Test 4: Show full TES resolution
echo "Test 4: Full 8-Phase TES Resolution"
echo ""
show_tes_resolution "status:tsm" "@dev" "source ~/tetra/tetra.sh && tsm ls"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "TES Test Complete"
echo "═══════════════════════════════════════════════════════════"
