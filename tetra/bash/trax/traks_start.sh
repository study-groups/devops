#!/usr/bin/env bash

# traks_start.sh - Launch traks game with MIDI/OSC input
#
# Usage:
#   ./traks_start.sh           # keyboard only (runs traks.sh directly)
#   ./traks_start.sh --midi    # MIDI/OSC only via FIFO
#
# Signals (send to PID in /tmp/traks.pid):
#   SIGUSR1  - Quit game
#   SIGUSR2  - Pause game
#   SIGCONT  - Resume game

TRAKS_SRC="${TRAKS_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
TRAKS_FIFO="${TRAKS_FIFO:-/tmp/traks_input}"
TRAKS_PID_FILE="${TRAKS_PID_FILE:-/tmp/traks.pid}"

# Cleanup function
cleanup() {
    rm -f "$TRAKS_PID_FILE"
    rm -f "$TRAKS_FIFO"
    jobs -p | xargs -r kill 2>/dev/null
    wait 2>/dev/null
}
trap cleanup EXIT

# Parse args
USE_MIDI=false

for arg in "$@"; do
    case "$arg" in
        --midi) USE_MIDI=true ;;
        --help|-h)
            echo "Usage: $0 [--midi]"
            echo "  (no args)   Keyboard input (run ./traks.sh directly)"
            echo "  --midi      MIDI/OSC input via multicast"
            echo ""
            echo "For keyboard, just run: ./traks.sh"
            exit 0
            ;;
    esac
done

if [[ "$USE_MIDI" == false ]]; then
    echo "For keyboard input, run ./traks.sh directly."
    echo "Use --midi flag for MIDI/OSC input."
    exit 0
fi

# MIDI mode: use FIFO
echo "Starting MIDI/OSC mode..."
echo "Listening on multicast ${TRAKS_OSC_MULTICAST:-239.1.1.1}:${TRAKS_OSC_PORT:-1983}"
echo "P1: CC ${P1_LEFT:-40}/${P1_RIGHT:-41}  P2: CC ${P2_LEFT:-46}/${P2_RIGHT:-47}"
echo ""

# Create FIFO
rm -f "$TRAKS_FIFO"
mkfifo "$TRAKS_FIFO"

# Start OSC listener -> FIFO
TRAKS_VERBOSE="${TRAKS_VERBOSE:-0}" node "$TRAKS_SRC/traks_osc_listener.js" > "$TRAKS_FIFO" 2>/dev/null &
OSC_PID=$!

# Give OSC listener time to start
sleep 0.5

# Run game with FIFO input
export TRAKS_USE_FIFO=true
export TRAKS_FIFO
"$TRAKS_SRC/traks.sh" &
TRAKS_GAME_PID=$!
echo "$TRAKS_GAME_PID" > "$TRAKS_PID_FILE"

# Wait for game
wait "$TRAKS_GAME_PID"
