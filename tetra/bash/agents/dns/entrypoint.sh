#!/usr/bin/env bash
IP=${1:-"XYZplaceholdermedia.com"}
DELAY=${2:-30}
OLD_IP=""
NOTIFICATION_DELAY=5
KEEP_ALIVE_DELAY=300
CHECK_COUNT=0

# Function to handle SIGUSR1 signal
sigusr1_handler() {
    echo "Current IP: $OLD_IP"
    echo "Total checks: $CHECK_COUNT"
}

# Function to handle SIGINT signal (Ctrl+C)
sigint_handler() {
    echo "Shutting down..."
    exit 0
}

# Initialize signal handlers
trap sigusr1_handler SIGUSR1
trap sigint_handler SIGINT

# State machine loop
while true; do
    CURRENT_IP=$(ping -c 1 $IP \
                  | head -n 1 \
                  | grep -E -o "([0-9]{1,3}[\.]){3}[0-9]{1,3}")

    if [ "$CURRENT_IP" != "$OLD_IP" ]; then
        echo "IP address change from $OLD_IP to $CURRENT_IP at $(date)"
        OLD_IP=$CURRENT_IP
    fi

    sleep $DELAY

    # Increment check count
    ((CHECK_COUNT++))

    if (( $(date +%s) % $KEEP_ALIVE_DELAY == 0 )); then
        echo "Keep alive: $(date)"
    fi

    if (( $(date +%s) % $NOTIFICATION_DELAY == 0 )); then
        echo "Still pinging $IP"
    fi
done
