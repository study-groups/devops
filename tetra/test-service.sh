#!/usr/bin/env bash

# Simple test service for tetra systemd testing
echo "Test service starting at $(date)"
echo "PID: $$"
echo "Working directory: $(pwd)"

# Keep service running and output periodic heartbeat
counter=0
while true; do
    echo "Heartbeat $counter at $(date)"
    sleep 10
    ((counter++))
done