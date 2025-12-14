#!/usr/bin/env bash
# Simple TGP Frame Viewer - Displays frames using xxd to parse binary protocol
# Usage: tgp_simple_viewer.sh <session_name>

SESSION="${1:-pulsar}"
FRAME_SOCK="/tmp/tgp_${SESSION}_frame.sock"

# Wait for socket
echo "Waiting for TGP session: $SESSION"
timeout=10
elapsed=0
while [[ ! -S "$FRAME_SOCK" ]] && [[ $elapsed -lt $timeout ]]; do
    sleep 0.5
    ((elapsed++))
done

if [[ ! -S "$FRAME_SOCK" ]]; then
    echo "ERROR: TGP frame socket not found: $FRAME_SOCK"
    exit 1
fi

echo "Connected to TGP session: $SESSION"
echo "Receiving frames..."
sleep 1

# Clear screen and hide cursor
clear
tput civis
trap 'tput cnorm; clear; echo "Viewer stopped"' EXIT INT TERM

# Continuously read from socket using socat
while true; do
    # Read one message from socket (blocking)
    data=$(timeout 0.1 socat -u UNIX-RECV:"$FRAME_SOCK" - 2>/dev/null)

    if [[ -n "$data" ]]; then
        # Skip TGP header (8 bytes) and Frame_Full struct (~32 bytes)
        # The actual text frame starts after byte 40
        frame_text=$(echo -n "$data" | tail -c +41)

        if [[ -n "$frame_text" ]]; then
            # Display frame
            tput cup 0 0
            echo -n "$frame_text"
        fi
    fi
done
