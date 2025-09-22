#!/usr/bin/env bash

# Simple nc-based server for testing TSM process management
# This script opens a port using netcat and keeps it open

export PORT=8888

echo "Starting nc server on port $PORT (PID: $$)"
echo "Server started at $(date)"

# Create a simple HTTP-like response
response="HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: 13\r\n\r\nHello World!\n"

# Use netcat to listen on the port
# -l: listen mode
# -k: keep listening after client disconnects (if supported)
# -p: specify port (some versions)

if command -v nc >/dev/null 2>&1; then
    # macOS/BSD netcat syntax
    echo "Using BSD netcat (macOS)"
    while true; do
        echo -e "$response" | nc -l "$PORT" || {
            echo "nc failed, retrying in 1 second..."
            sleep 1
        }
    done
else
    echo "ERROR: netcat (nc) not found"
    exit 1
fi
