#!/usr/bin/env bash

export TETRA_SRC=/Users/mricos/src/devops/tetra
cd "$TETRA_SRC"

source bash/game/game.sh

echo "=== Entity System Test ==="
echo "Creating test entity..."
game_entity_create "test" eid
echo "Entity ID: $eid"
echo "Entity count: $(game_entity_count)"
echo "Entities array: ${GAME_ENTITIES[@]}"

echo ""
echo "=== Timing Test ==="
echo "Testing frame time calculation for 30 FPS:"
frame_time=$(awk "BEGIN {printf \"%.4f\", 1.0 / 30}")
echo "Frame time: $frame_time seconds"

echo ""
echo "=== Pulsar Creation Test ==="
pulsar_create 20 12 "\033[96m" 2000 p1
echo "Pulsar 1 ID: $p1"
echo "Pulsar 1 angle: $(game_entity_get "$p1" "rotation_angle")"
echo "Pulsar 1 rotation_dir: $(game_entity_get "$p1" "rotation_direction")"

echo ""
echo "=== Update Test ==="
echo "Updating pulsar for 500ms..."
pulsar_update "$p1" 500
echo "Pulsar 1 angle after update: $(game_entity_get "$p1" "rotation_angle")"

echo ""
echo "Entity count after all tests: $(game_entity_count)"
