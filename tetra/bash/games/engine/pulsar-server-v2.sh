#!/usr/bin/env bash
# Pulsar Server Mode v2 - With command logging and proper FIFO handling

CONTROL_SOCKET="${1:-/tmp/pulsar_control.sock}"
LOG_FILE="/tmp/pulsar_server.log"

# Clean up old socket and log
rm -f "$CONTROL_SOCKET" "$LOG_FILE"

# Create named pipe for commands
mkfifo "$CONTROL_SOCKET"

echo ""
echo "╔═══════════════════════════════════════╗"
echo "║   ⚡ PULSAR SERVER v2                ║"
echo "║   Visual Display + Command Log       ║"
echo "╚═══════════════════════════════════════╝"
echo ""
echo "  Control socket: $CONTROL_SOCKET"
echo "  Command log:    $LOG_FILE"
echo ""
echo "  In another terminal run:"
echo "    ./pulsar-client.sh"
echo ""
echo "  Watch commands:"
echo "    tail -f $LOG_FILE"
echo ""
echo "  Press Ctrl+C to stop"
echo ""
echo "Starting in 3 seconds..."
sleep 3

# Cleanup on exit
trap "rm -f $CONTROL_SOCKET $LOG_FILE; echo ''; echo 'Server stopped.'; exit" INT TERM EXIT

# Start command logger in background
(
    while true; do
        if read -r cmd < "$CONTROL_SOCKET"; then
            echo "[$(date '+%H:%M:%S')] $cmd" | tee -a "$LOG_FILE" >&2
            echo "$cmd"
        fi
    done
) | (
    echo "INIT 160 96" | tee -a "$LOG_FILE" >&2
    cat
) | ./bin/pulsar 2>&1 &

# Wait for engine
wait
