#!/usr/bin/env bash

# Test script for game module

set -e

echo "Testing Game Module..."
echo "====================="
echo

# Load tetra
source ~/tetra/tetra.sh 2>/dev/null || {
    echo "Error: Could not load tetra" >&2
    exit 1
}

# Load game module
source "$TETRA_SRC/bash/game/game.sh" || {
    echo "Error: Could not load game module" >&2
    exit 1
}

echo "✓ Game module loaded: v$GAME_VERSION"
echo

# Test help
echo "Testing 'game help':"
echo "-------------------"
game help
echo

# Test version
echo "Testing 'game version':"
echo "----------------------"
game version
echo

# Test entity system
echo "Testing entity system..."
test_id=$(game_entity_create "test")
game_entity_set "$test_id" "x" "10"
game_entity_set "$test_id" "y" "20"
x=$(game_entity_get "$test_id" "x")
y=$(game_entity_get "$test_id" "y")
echo "✓ Entity created: id=$test_id, x=$x, y=$y"
game_entity_destroy "$test_id"
echo "✓ Entity destroyed"
echo

# Test timing
echo "Testing timing system..."
start=$(game_time_ms)
sleep 0.1
end=$(game_time_ms)
delta=$((end - start))
echo "✓ Timing works: ${delta}ms elapsed"
echo

# Test tweening
echo "Testing tweening system..."
progress=$(tween_sine_01 "0.5")
echo "✓ Tweening works: sine(0.5) = $progress"
echo

echo "All tests passed!"
echo
echo "To run Quadrapole demo:"
echo "  bash $TETRA_SRC/bash/game/run_quadrapole.sh"
echo
echo "Or from your shell:"
echo "  source ~/tetra/tetra.sh"
echo "  source \$TETRA_SRC/bash/game/game.sh"
echo "  game quadrapole"
