#!/usr/bin/env bash
echo "Starting Pong server..."

# Start of Pong server
while true; do
    if read line; then
        if [[ $line == *"ping"* ]]; then
            local pong_id=$(date +%s%N)  # Unix timestamp in nanoseconds
            local pong_pico_object="$pong_id PONG $line"
            echo "$pong_pico_object"
        fi
    fi
done
# End of Pong server

