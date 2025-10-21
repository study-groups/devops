#!/usr/bin/env bash
# Run this script by SOURCING it in your actual terminal:
# source DEBUG_YOUR_TERMINAL.sh

echo "=== Debugging tmod load org in YOUR terminal ==="
echo ""

# Save to a log file
LOG="/tmp/org_debug_$(date +%s).log"
exec 2>&1 | tee "$LOG"

echo "Logging to: $LOG"
echo ""

echo "1. Current shell options:"
echo "   \$- = $-"
echo ""

echo "2. Check if tmod exists:"
type tmod 2>&1 | head -1
echo ""

echo "3. Check org module status BEFORE:"
echo "   TETRA_MODULE_LOADED[org] = '${TETRA_MODULE_LOADED[org]}'"
echo ""

echo "4. About to run: tmod load org"
echo "   Press Ctrl+C NOW if you don't want to risk killing terminal"
echo "   Waiting 3 seconds..."
sleep 3

echo ""
echo "5. Running tmod load org..."
echo "===START==="

# Try to protect against terminal death
(
    tmod load org 2>&1
    EXIT=$?
    echo "===END==="
    echo "Exit code: $EXIT"
    exit $EXIT
) &
PID=$!

# Wait with timeout
COUNTER=0
while kill -0 $PID 2>/dev/null && [[ $COUNTER -lt 10 ]]; do
    echo -n "."
    sleep 1
    ((COUNTER++))
done

if kill -0 $PID 2>/dev/null; then
    echo ""
    echo "HUNG! Process still running after 10 seconds"
    echo "Killing it..."
    kill -9 $PID 2>/dev/null
else
    wait $PID
    echo ""
    echo "Completed normally"
fi

echo ""
echo "6. Check org module status AFTER:"
echo "   TETRA_MODULE_LOADED[org] = '${TETRA_MODULE_LOADED[org]}'"
echo ""

echo "7. Check if org function exists:"
if type org >/dev/null 2>&1; then
    echo "   ✓ org exists"
else
    echo "   ✗ org NOT FOUND"
fi

echo ""
echo "=== Debug complete ==="
echo "Log saved to: $LOG"
echo ""
echo "If your terminal is still alive, the problem is fixed!"
echo "If it died, we need to look at the log before it crashed."
