#!/usr/bin/env bash

# Quick test of dev mode
GAME_SRC="$(pwd)"
export GAME_SRC

source core/dev_mode.sh
source core/quadrapole_mechanics.sh

echo "=== Dev Mode Test ==="
dev_mode_init

echo ""
echo "Test 1: Log mapping"
dev_mode_log_mapping 0.5 0.0 10.0 0.0 -0.5 0.0 -10.0 0.0

echo ""
echo "Test 2: Log state"
dev_mode_log_state 1 0.85

echo ""
echo "Test 3: Log forces"
dev_mode_log_forces 35.2 "tension" 1.56

echo ""
echo "Test 4: List parameters"
echo "Available parameters:"
for param in "${DEV_MODE_PARAM_LIST[@]}"; do
    echo "  $param = ${!param}"
done

echo ""
echo "✓ Dev mode working!"
