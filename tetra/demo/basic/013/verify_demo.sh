#!/usr/bin/env bash

# Verify the demo actually shows action output when Enter is pressed

cd "$(dirname "${BASH_SOURCE[0]}")"

echo "Starting demo.sh with simulated Enter keypress..."
echo ""

# Start demo, wait 2 sec, send Enter, wait 2 sec, quit
(
    sleep 2
    echo ""  # Press Enter
    sleep 2
    echo "q"  # Quit
) | timeout 10 ./demo.sh 2>&1 | tee /tmp/demo_output.txt

echo ""
echo "=== Checking if action output appeared ==="
if grep -q "Tetra Organization Config" /tmp/demo_output.txt; then
    echo "✓ SUCCESS: Action output detected"
    echo ""
    echo "Content snippet:"
    grep -A5 "Tetra Organization Config" /tmp/demo_output.txt | head -10
else
    echo "✗ FAILURE: No action output found"
    echo ""
    echo "What we saw:"
    tail -20 /tmp/demo_output.txt
fi
