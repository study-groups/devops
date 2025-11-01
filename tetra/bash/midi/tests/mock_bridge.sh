#!/usr/bin/env bash
# Mock MIDI Bridge for Testing
# Simulates tmc.js without requiring actual MIDI hardware

set -euo pipefail

# Mock bridge state
MOCK_SOCKET=""
MOCK_INPUT_DEVICE="Mock MIDI Controller"
MOCK_OUTPUT_DEVICE="Mock MIDI Output"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --input)
            MOCK_INPUT_DEVICE="$2"
            shift 2
            ;;
        --output)
            MOCK_OUTPUT_DEVICE="$2"
            shift 2
            ;;
        --socket)
            MOCK_SOCKET="$2"
            shift 2
            ;;
        --list-devices)
            echo "Available MIDI Devices:"
            echo "  0: Mock MIDI Controller"
            echo "  1: Mock MIDI Output"
            exit 0
            ;;
        *)
            echo "Unknown option: $1" >&2
            exit 1
            ;;
    esac
done

if [[ -z "$MOCK_SOCKET" ]]; then
    echo "Error: --socket required" >&2
    exit 1
fi

# Create socket listener
echo "Mock MIDI Bridge starting..."
echo "Input Device: $MOCK_INPUT_DEVICE"
echo "Output Device: $MOCK_OUTPUT_DEVICE"
echo "Socket: $MOCK_SOCKET"

# Clean up on exit
cleanup() {
    rm -f "$MOCK_SOCKET"
    echo "Mock bridge stopped"
}
trap cleanup EXIT

# Create socket
rm -f "$MOCK_SOCKET"
nc -lkU "$MOCK_SOCKET" &
NC_PID=$!

# Wait for socket to be ready
sleep 0.1

# Send initial CONNECTED message
echo "CONNECTED Mock MIDI Controller" | nc -U "$MOCK_SOCKET" 2>/dev/null || true

# Simulate receiving MIDI events from file (for testing)
if [[ -n "${MOCK_EVENTS_FILE:-}" ]] && [[ -f "$MOCK_EVENTS_FILE" ]]; then
    sleep 0.2
    while IFS= read -r event; do
        echo "$event" | nc -U "$MOCK_SOCKET" 2>/dev/null || true
        sleep 0.05
    done < "$MOCK_EVENTS_FILE"
fi

# Keep running until killed
wait $NC_PID
