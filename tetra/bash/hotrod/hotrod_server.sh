#!/bin/bash

PORT=9999
FIFO="/tmp/hotrod.fifo"
PIDFILE="/tmp/hotrod.pid"

# Ensure TETRA is started
if [[ -z "$TETRA_DIR" ]]; then
    echo "TETRA is not started. Aborting."
    exit 1
fi

# Singleton enforcement
if [[ -f "$PIDFILE" ]] && kill -0 $(cat "$PIDFILE") 2>/dev/null; then
    echo "🔥 Hotrod is already running (PID: $(cat "$PIDFILE"))"
    exit 0
fi

# Create FIFO if not exists
rm -f "$FIFO"
mkfifo "$FIFO"

echo $$ > "$PIDFILE"
trap "rm -f $FIFO $PIDFILE; exit" INT TERM EXIT

echo "🚗💨 Hotrod Server listening on port $PORT"

while true; do
    nc -lk $PORT < "$FIFO" | tee "$FIFO"
done

