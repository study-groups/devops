#!/usr/bin/env bash
# Test script for quadrapole mechanics (unit tests)

# Ensure TETRA_SRC is set
if [[ -z "$TETRA_SRC" ]]; then
    export TETRA_SRC="/Users/mricos/src/devops/tetra"
fi

GAME_SRC="$TETRA_SRC/bash/game"
export GAME_SRC

# Source required modules
source "$GAME_SRC/core/quadrapole_mechanics.sh"

echo "=== Quadrapole Mechanics Unit Tests ==="
echo ""

# Test 1: Mapping function
echo "Test 1: Joystick mapping with deadzone"
vx="" vy=""
quadrapole_map_stick_to_velocity 0.5 0.0 vx vy
echo "  Input: (0.5, 0.0) -> Velocity: ($vx, $vy)"
echo "  Expected: (~10.0, 0.0) since max_velocity=20.0"
echo ""

# Test 2: Deadzone
echo "Test 2: Deadzone (input below threshold)"
quadrapole_map_stick_to_velocity 0.1 0.1 vx vy
echo "  Input: (0.1, 0.1) -> Velocity: ($vx, $vy)"
echo "  Expected: (0.0, 0.0) since magnitude < 0.15"
echo ""

# Test 3: Angle calculation
echo "Test 3: Angle between vectors"
angle=$(quadrapole_angle_between 1.0 0.0 -1.0 0.0)
echo "  Vectors: (1,0) and (-1,0)"
echo "  Angle: ${angle}°"
echo "  Expected: ~180° (opposite directions)"
echo ""

# Test 4: Contrary motion detection
echo "Test 4: Contrary motion detection"
if quadrapole_is_contrary 0.8 0.0 -0.8 0.0; then
    echo "  Sticks (0.8,0) and (-0.8,0): CONTRARY ✓"
else
    echo "  Sticks (0.8,0) and (-0.8,0): NOT contrary ✗"
fi

if quadrapole_is_contrary 0.8 0.0 0.8 0.0; then
    echo "  Sticks (0.8,0) and (0.8,0): CONTRARY ✗"
else
    echo "  Sticks (0.8,0) and (0.8,0): NOT contrary ✓"
fi
echo ""

# Test 5: State tracking
echo "Test 5: State tracking globals"
echo "  QUADRAPOLE_BONDED: ${QUADRAPOLE_BONDED} (should be 1)"
echo "  QUADRAPOLE_CONTRARY_TIMER: ${QUADRAPOLE_CONTRARY_TIMER} (should be 0.0)"
echo "  QUADRAPOLE_CONTRARY_THRESHOLD: ${QUADRAPOLE_CONTRARY_THRESHOLD}s"
echo "  QUADRAPOLE_START_X: ${QUADRAPOLE_START_X}"
echo "  QUADRAPOLE_START_Y: ${QUADRAPOLE_START_Y}"
echo ""

echo "=== Tests Complete ==="
echo ""
echo "To run the full demo:"
echo "  source game.sh"
echo "  game quadrapole"
