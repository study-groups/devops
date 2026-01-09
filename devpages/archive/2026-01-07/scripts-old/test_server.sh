#!/usr/bin/env bash
export PORT=3001

echo "Test server starting on port $PORT"
while true; do
    echo "$(date): Server running on port $PORT"
    sleep 5
done