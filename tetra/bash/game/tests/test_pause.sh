#!/usr/bin/env bash
# Test pause functionality

source ~/tetra/tetra.sh
source game.sh

echo "=== Testing Pause Functionality ==="
echo ""
echo "Instructions:"
echo "  1. Game will start in 2 seconds"
echo "  2. Press 'p' to PAUSE - you should see: ⏸  PAUSED"
echo "  3. Press 'p' again to RESUME"
echo "  4. Press 'h' to see help (should say 'P - Pause/Resume')"
echo "  5. Press 'q' to quit"
echo ""
echo "Starting in 2 seconds..."
sleep 2

game quadrapole
