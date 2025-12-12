#!/usr/bin/env bash

# bug_start.sh - Launch bug game with input sources
#
# Usage:
#   ./bug_start.sh           # keyboard only
#   ./bug_start.sh --midi    # keyboard + MIDI/OSC
#   ./bug_start.sh --midi-only  # MIDI/OSC only (no keyboard)
#
# Signals (send to PID in /tmp/bug.pid):
#   SIGUSR1  - Quit game
#   SIGUSR2  - Pause game
#   SIGCONT  - Resume game
#
# Example: kill -USR1 $(cat /tmp/bug.pid)

BUG_SRC="${BUG_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
BUG_FIFO="${BUG_FIFO:-/tmp/bug_input}"
BUG_PID_FILE="${BUG_PID_FILE:-/tmp/bug.pid}"

# Cleanup function
cleanup() {
    rm -f "$BUG_PID_FILE"
    # Kill background jobs
    jobs -p | xargs -r kill 2>/dev/null
    wait 2>/dev/null
}
trap cleanup EXIT

# Create FIFO
[[ -p "$BUG_FIFO" ]] || mkfifo "$BUG_FIFO"

# Parse args
USE_KEYBOARD=true
USE_MIDI=false

for arg in "$@"; do
    case "$arg" in
        --midi) USE_MIDI=true ;;
        --midi-only) USE_MIDI=true; USE_KEYBOARD=false ;;
        --help|-h)
            echo "Usage: $0 [--midi] [--midi-only]"
            echo "  --midi       Enable MIDI/OSC input alongside keyboard"
            echo "  --midi-only  MIDI/OSC input only, no keyboard"
            exit 0
            ;;
    esac
done

# Start input sources
if [[ "$USE_KEYBOARD" == true ]]; then
    "$BUG_SRC/bug_keyboard.sh" > "$BUG_FIFO" &
fi

if [[ "$USE_MIDI" == true ]]; then
    node "$BUG_SRC/bug_osc_listener.js" > "$BUG_FIFO" 2>/dev/null &
fi

# Run game in background, save PID
"$BUG_SRC/bug.sh" &
BUG_GAME_PID=$!
echo "$BUG_GAME_PID" > "$BUG_PID_FILE"

# Wait for game to finish
wait "$BUG_GAME_PID"
