#!/usr/bin/env bash
# TGP Frame Viewer - Displays TGP engine output in real-time
# Usage: tgp_viewer.sh <session_name>

SESSION="${1:-pulsar}"
FRAME_SOCK="/tmp/tgp_${SESSION}_frame.sock"

# Wait for socket to exist
echo "Waiting for TGP session: $SESSION"
timeout=10
elapsed=0
while [[ ! -S "$FRAME_SOCK" ]] && [[ $elapsed -lt $timeout ]]; do
    sleep 0.5
    ((elapsed++))
done

if [[ ! -S "$FRAME_SOCK" ]]; then
    echo "ERROR: TGP frame socket not found: $FRAME_SOCK"
    echo "Make sure the engine is running with --tgp $SESSION"
    exit 1
fi

echo "Connected to TGP session: $SESSION"
echo "Press Ctrl+C to exit viewer"
echo ""
sleep 1

# Clear screen and hide cursor
clear
tput civis

# Cleanup on exit
trap 'tput cnorm; clear; echo "Viewer stopped"' EXIT INT TERM

# Use socat or nc to continuously read from socket
if command -v socat &>/dev/null; then
    # socat is better for continuous streaming
    socat UNIX-RECV:"$FRAME_SOCK" - | while IFS= read -r line; do
        # Extract frame data (skip TGP header)
        # For now, just print raw output
        echo "$line"
    done
else
    # Fallback to nc with continuous reading
    while true; do
        # Read from socket with longer timeout
        nc -U "$FRAME_SOCK" 2>/dev/null | {
            # Read TGP message header (8 bytes)
            read -N 8 -r header 2>/dev/null

            if [[ -n "$header" ]]; then
                # Parse header to get payload length
                # For simplicity, just read a large chunk
                read -N 16384 -r payload 2>/dev/null

                if [[ -n "$payload" ]]; then
                    # Skip TGP Frame_Full struct (skip first bytes after header)
                    # The actual frame text starts after the struct
                    # Extract text part (after the 32-byte Frame_Full struct)
                    frame_text="${payload:32}"

                    # Display frame
                    tput cup 0 0
                    echo -n "$frame_text"
                fi
            fi
        }

        # Small delay
        sleep 0.016  # ~60 FPS
    done
fi
