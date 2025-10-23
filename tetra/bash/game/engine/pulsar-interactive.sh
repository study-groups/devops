#!/usr/bin/env bash
# Pulsar Interactive Mode - Commands work on-the-fly
# This version doesn't use RUN - it manually updates and renders

CONTROL_SOCKET="/tmp/pulsar_control.sock"
LOG_FILE="/tmp/pulsar_commands.log"

# Clean up
rm -f "$CONTROL_SOCKET" "$LOG_FILE"
mkfifo "$CONTROL_SOCKET"

echo ""
echo "╔═══════════════════════════════════════╗"
echo "║   ⚡ PULSAR INTERACTIVE MODE         ║"
echo "║   Commands Update Live               ║"
echo "╚═══════════════════════════════════════╝"
echo ""
echo "  Commands: $CONTROL_SOCKET"
echo "  Log: $LOG_FILE"
echo ""
echo "  Client: ./pulsar-client.sh"
echo "  Commands work immediately!"
echo ""
echo "Starting..."
echo ""

# Trap cleanup
trap "rm -f $CONTROL_SOCKET $LOG_FILE; exit" INT TERM EXIT

# Initialize engine and spawn animation loop
{
    echo "INIT 160 96"

    # Read commands from FIFO with logging
    while IFS= read -r cmd; do
        echo "[$(date '+%H:%M:%S')] → $cmd" | tee -a "$LOG_FILE" >&2
        echo "$cmd"

        # Every 10 commands, send RENDER to update display
        if (( ++count % 5 == 0 )); then
            echo "RENDER"
        fi
    done < "$CONTROL_SOCKET"

} | ./bin/pulsar 2>&1
