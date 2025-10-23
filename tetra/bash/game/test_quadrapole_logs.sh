#!/usr/bin/env bash

# Test that dev mode logs appear
GAME_SRC="$(pwd)"
export GAME_SRC

# Source modules
source core/dev_mode.sh
source core/quadrapole_mechanics.sh

echo "=== Testing Dev Mode Logs ==="

# Initialize
dev_mode_init

# Simulate an update
echo ""
echo "Simulating quadrapole_update with test input..."
quadrapole_init "pulsar_a" "pulsar_b"
quadrapole_update 0.5 0.0 -0.5 0.0 0.016

echo ""
echo "✓ If you see [MAPPING] and [STATE] logs above, dev mode is working!"
