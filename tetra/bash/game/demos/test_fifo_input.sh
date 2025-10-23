#!/usr/bin/env bash
# Test FIFO gamepad input protocol
# Sends mock gamepad events to the engine

FIFO_PATH="/tmp/pulsar_input"

echo "=== FIFO Input Protocol Test ==="
echo

# Clean up old FIFO
rm -f "$FIFO_PATH"

# Create FIFO
mkfifo "$FIFO_PATH"
echo "✓ Created FIFO: $FIFO_PATH"

# Start engine in background
cd "$(dirname "$0")/../engine"
(
    echo "INIT 80 24"
    echo "SPAWN_PULSAR 80 48 18 6 0.5 0.6 0"
    echo "OPEN_FIFO $FIFO_PATH"
    echo "RUN 60"
) | ./bin/pulsar &

ENGINE_PID=$!
echo "✓ Started engine (PID: $ENGINE_PID)"
sleep 2

echo
echo "Sending mock gamepad input..."
echo "  - Left stick movement"
echo "  - Button presses"
echo "  - Press Ctrl+C to stop"
echo

# Send mock input
(
    t=0
    while true; do
        # Circular motion for left stick
        x=$(echo "s($t)" | bc -l | xargs printf "%.3f")
        y=$(echo "c($t)" | bc -l | xargs printf "%.3f")

        echo "AXIS 0 0 $x"
        echo "AXIS 0 1 $y"

        # Random button presses
        if (( $(echo "$t" | awk '{print int($1 * 10) % 20}') == 0 )); then
            echo "BUTTON 0 0 1"
            sleep 0.1
            echo "BUTTON 0 0 0"
        fi

        t=$(echo "$t + 0.1" | bc -l)
        sleep 0.016  # ~60 FPS
    done
) > "$FIFO_PATH" &

FEEDER_PID=$!

# Cleanup on exit
trap "kill $ENGINE_PID $FEEDER_PID 2>/dev/null; rm -f $FIFO_PATH; exit" INT TERM

# Wait
wait $ENGINE_PID

# Cleanup
kill $FEEDER_PID 2>/dev/null
rm -f "$FIFO_PATH"

echo
echo "Test complete!"
