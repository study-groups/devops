#!/usr/bin/env bash
# Quick test of the resolve module

export TETRA_SRC="${TETRA_SRC:-$HOME/src/devops/tetra}"
export TETRA_DIR="${TETRA_DIR:-$HOME/tetra}"

source "$TETRA_SRC/bash/resolve/resolve.sh"

echo "=== TES Resolution Module Test ==="
echo ""
echo "Testing @local resolution (Level 0 → 1):"
echo "  Symbol: @local"
address=$(resolve_symbol_to_address "@local")
echo "  Address: $address"
echo ""

echo "Level 1 → 2 (Address → Channel):"
channel=$(resolve_address_to_channel "$address" "@local")
echo "  Channel: $channel"
echo ""

echo "Level 2 → 3 (Channel → Connector):"
connector=$(resolve_channel_to_connector "$channel" "@local")
echo "  Connector: $connector"
echo ""

echo "Testing resolve_to_level (all at once):"
declare -A result
resolve_to_level "@local" 3 result 2>/dev/null
echo "  Level ${result[level]}: ${result[connector]}"
echo ""

echo "Level explanations:"
echo ""
explain_level 0
echo ""
explain_level 3
