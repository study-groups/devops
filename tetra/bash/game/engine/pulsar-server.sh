#!/usr/bin/env bash
# Pulsar Server Mode - Visual display with control socket
# Run this in one terminal, then connect REPL client from another

CONTROL_SOCKET="${1:-/tmp/pulsar_control.sock}"

# Clean up old socket
rm -f "$CONTROL_SOCKET"

# Create named pipe for commands
mkfifo "$CONTROL_SOCKET"

echo ""
echo "╔═══════════════════════════════════════╗"
echo "║   ⚡ PULSAR SERVER MODE              ║"
echo "║   Visual Display + Control Socket    ║"
echo "╚═══════════════════════════════════════╝"
echo ""
echo "  Control socket: $CONTROL_SOCKET"
echo "  In another terminal run:"
echo "    ./pulsar-client.sh"
echo ""
echo "  Press Ctrl+C to stop"
echo ""
echo "Starting in 3 seconds..."
sleep 3

# Cleanup on exit
trap "rm -f $CONTROL_SOCKET; echo ''; echo 'Server stopped.'; exit" INT TERM EXIT

# Start engine with control socket as input
# Keep FIFO open by redirecting from it
# This prevents EOF when client disconnects
(
    echo "INIT 160 96"
    # Keep reading from FIFO indefinitely
    tail -f "$CONTROL_SOCKET"
) | ./bin/pulsar 2>&1
