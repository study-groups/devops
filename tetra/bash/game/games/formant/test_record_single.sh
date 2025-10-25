#!/usr/bin/env bash
#
# test_record_single.sh - Test single phoneme recording with VAD
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FORMANT_BIN="$SCRIPT_DIR/bin/formant"
RECORDINGS_DIR="$SCRIPT_DIR/test_single_recording"
SPEAKER_NAME="test"
MAX_DURATION=3000
VAD_MODE=1

mkdir -p "$RECORDINGS_DIR/$SPEAKER_NAME"

FIFO="/tmp/formant_single_test_$$"
LOG="/tmp/formant_single_log_$$"

CLEANUP_DONE=false
cleanup() {
    if [ "$CLEANUP_DONE" = true ]; then
        return
    fi
    CLEANUP_DONE=true

    echo ""
    echo "Cleaning up..."

    if [ -p "$FIFO" ]; then
        echo "STOP" >&3 2>/dev/null || true
        exec 3>&- 2>/dev/null || true
    fi

    if [ -n "${FORMANT_PID:-}" ]; then
        kill $FORMANT_PID 2>/dev/null || true
        wait $FORMANT_PID 2>/dev/null || true
    fi

    rm -f "$FIFO" "$LOG" 2>/dev/null || true
    echo "Done!"
}
trap cleanup EXIT INT TERM

# Create FIFO
mkfifo "$FIFO" || { echo "Failed to create FIFO"; exit 1; }

# Start formant engine
echo "Starting formant engine..."
"$FORMANT_BIN" -i "$FIFO" -s 16000 > "$LOG" 2>&1 &
FORMANT_PID=$!

# Open FIFO for writing
exec 3> "$FIFO"

sleep 1

# Check if running
if ! kill -0 $FORMANT_PID 2>/dev/null; then
    echo "ERROR: Formant engine failed to start"
    cat "$LOG"
    exit 1
fi

echo "Engine ready (PID: $FORMANT_PID)"
echo ""

# Test recording phoneme 'a'
phoneme="a"
file="$RECORDINGS_DIR/$SPEAKER_NAME/${phoneme}_test.wav"

echo "Testing phoneme recording: $phoneme"
echo ""

# Play example
echo "  🔊 Playing example..."
echo "PH $phoneme 2000 120 0.8 0.3" >&3
sleep 2.5

# Check if still running
if ! kill -0 $FORMANT_PID 2>/dev/null; then
    echo "ERROR: Engine died after PH command"
    cat "$LOG"
    exit 1
fi

echo "  ✓ Engine still running after example"
echo ""
echo "  🎤 Starting VAD recording..."
echo "     Speak 'ahhh' now (will auto-detect speech)"
echo ""

# Delete old file
rm -f "$file" 2>/dev/null

# Start recording
echo "RECORD_VAD $phoneme $MAX_DURATION $file $VAD_MODE" >&3

# Wait for file to appear and grow
for i in {1..30}; do
    sleep 0.2
    if [ -f "$file" ]; then
        size=$(stat -f%z "$file" 2>/dev/null || echo "0")
        if [ "$size" -gt 1000 ]; then
            echo "  ✓ Recording captured! (${size} bytes)"
            break
        fi
    fi
done

# Check result
if [ -f "$file" ]; then
    size=$(stat -f%z "$file" 2>/dev/null || echo "0")
    echo ""
    echo "SUCCESS!"
    echo "  File: $file"
    echo "  Size: $size bytes"
    echo ""
    echo "Play it with: afplay $file"
else
    echo ""
    echo "FAILED: No recording created"
    echo ""
    echo "Engine log:"
    cat "$LOG"
fi
