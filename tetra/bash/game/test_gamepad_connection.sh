#!/usr/bin/env bash
# Test gamepad connection to Pulsar engine

source ~/tetra/tetra.sh
source "$TETRA_SRC/bash/game/game.sh"

echo "=== Testing Gamepad Connection ==="
echo

# Check gamepad sender is running
./gamepad.sh status
echo
echo "Press 'd' in the engine to enable debug mode and see 'Gamepad: YES'"
echo "Press 'h' to see help"
echo "Press 'q' to quit"
echo
echo "Starting in 3 seconds..."
sleep 3

# Start engine with gamepad
cd "$GAME_SRC/engine"
(
    echo "INIT 80 24"
    echo "SPAWN_PULSAR 40 12 18 6 0.5 0.6 0"
    echo "RUN 60"
) | ./bin/pulsar
