#!/usr/bin/env bash
# Test Pulsar with TGP protocol

set -euo pipefail

# Source TGP library
source ~/tetra/tetra.sh
source "$TETRA_SRC/bash/tgp/tgp.sh"

SESSION="pulsar_test_$$"

echo "Starting Pulsar engine in TGP mode (session: $SESSION)..."
$TETRA_SRC/bash/game/engine/bin/pulsar --tgp "$SESSION" &
ENGINE_PID=$!

# Wait for sockets
sleep 1

# Initialize TGP client
echo "Connecting to TGP session..."
tgp_init "$SESSION"

echo "Sending INIT command..."
tgp_send_init 160 96 60

echo "Sending SPAWN command..."
tgp_send_spawn 0 0 80 48 18 6 500 600  # 0.5 and 0.6 as fixed-point

echo "Waiting for responses..."
sleep 1

echo "Sending RUN command..."
tgp_send_run 60

echo "Engine should be running now..."
sleep 2

echo "Sending QUIT command..."
tgp_send_quit

# Cleanup
wait $ENGINE_PID 2>/dev/null || true
tgp_cleanup

echo "Test complete!"
