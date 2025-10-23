#!/usr/bin/env bash

echo "=== Testing Sticky Bottom Panel ==="
echo ""
echo "Instructions:"
echo "1. The game will start in 3 seconds"
echo "2. Press '2' to enable the event log"
echo "3. Resize your terminal window (make it taller/shorter)"
echo "4. The event log should STAY AT THE BOTTOM"
echo "5. You should see 'Terminal resized to WxH' in the event log"
echo "6. Press 'q' to quit"
echo ""
echo "Starting in 3 seconds..."
sleep 3

source ~/tetra/tetra.sh 2>/dev/null
source game.sh
game quadrapole
