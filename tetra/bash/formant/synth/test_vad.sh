#!/usr/bin/env bash
#
# test_vad.sh - Test Voice Activity Detection recording
#

set -euo pipefail

cd "$(dirname "$0")"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║           Testing VAD (Voice Activity Detection)              ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Create test directory
mkdir -p test_recordings

echo "This test will use VAD to automatically detect when you speak."
echo ""
echo "Mode 0 = Quality (conservative, won't clip speech)"
echo "Mode 1 = Balanced (good for most cases) [DEFAULT]"
echo "Mode 2 = Aggressive (clips silence quickly)"
echo ""
echo "Select VAD mode (0-2) or press ENTER for default (1): "
read -r VAD_MODE

if [ -z "$VAD_MODE" ]; then
    VAD_MODE=1
fi

if [ "$VAD_MODE" -lt 0 ] || [ "$VAD_MODE" -gt 2 ]; then
    echo "Invalid mode, using default (1)"
    VAD_MODE=1
fi

# Create FIFO for communication
FIFO="/tmp/formant_test_vad_$$"
mkfifo "$FIFO"

# Start formant engine
echo "Starting formant engine..."
./bin/formant -i "$FIFO" -s 16000 2>&1 | grep -E "Recording|Waiting|VAD|ERROR" &
FORMANT_PID=$!

# Cleanup on exit
cleanup() {
    echo "STOP" > "$FIFO" 2>/dev/null || true
    rm -f "$FIFO"
    wait $FORMANT_PID 2>/dev/null || true
}
trap cleanup EXIT

# Give formant time to start
sleep 1

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                     VAD Recording Test                        ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "The recorder will:"
echo "  1. Wait for you to speak (up to 10 seconds)"
echo "  2. Start recording when speech is detected"
echo "  3. Stop recording when you stop speaking"
echo ""
echo "Press ENTER to start, then say 'ahhh' for 1-2 seconds..."
read -r

echo ""
echo "🎤 VAD active - waiting for speech..."
echo ""

# Send RECORD_VAD command
# Format: RECORD_VAD <phoneme> <max_duration_ms> <filename> [vad_mode]
echo "RECORD_VAD a 10000 test_recordings/test_vad.wav $VAD_MODE" > "$FIFO"

# Wait for recording to complete (max 12 seconds)
sleep 12

echo ""
echo "Test complete!"
echo ""

# Check if file was created
if [ -f "test_recordings/test_vad.wav" ]; then
    SIZE=$(wc -c < test_recordings/test_vad.wav)
    echo "✓ Success! Created test_recordings/test_vad.wav ($SIZE bytes)"
    echo ""

    # Show duration
    if command -v ffprobe >/dev/null 2>&1; then
        DURATION=$(ffprobe -i test_recordings/test_vad.wav -show_entries format=duration -v quiet -of csv="p=0")
        echo "  Duration: ${DURATION}s"
    fi

    echo ""
    echo "You can play it with:"
    echo "  afplay test_recordings/test_vad.wav"
    echo ""
    echo "Compare with fixed-duration recording:"
    echo "  ./test_record.sh"
else
    echo "✗ ERROR: Recording file not created"
    echo ""
    echo "Possible reasons:"
    echo "  - No speech detected within timeout"
    echo "  - Microphone not working"
    echo "  - VAD threshold too high"
    echo ""
    echo "Try again with a different VAD mode."
    exit 1
fi
