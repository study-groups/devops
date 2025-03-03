#!/bin/bash

PORT=9999
FIFO="/tmp/hotrod.fifo"
PIDFILE="/tmp/hotrod.pid"

# Function to start the Hotrod server
hotrod_start_server() {
    # Singleton enforcement
    if [[ -f "$PIDFILE" ]] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
        echo "🔥 Hotrod is already running (PID: $(cat "$PIDFILE"))"
        exit 0
    fi

    # Create FIFO if not exists
    rm -f "$FIFO"
    mkfifo "$FIFO"

    echo $$ > "$PIDFILE"
    trap "rm -f $FIFO $PIDFILE; exit" INT TERM EXIT

    echo "🚗💨 Hotrod Server listening on localhost:$PORT"
    
    while true; do
        nc -lk $PORT < "$FIFO" | tee "$FIFO"
    done
}
