ping-placeholder(){
IP="placeholdermedia.com"
OLD_IP=""
DELAY=30
NOTIFICATION_DELAY=5
KEEP_ALIVE_DELAY=300

while true; do
    CURRENT_IP=$(ping -c 1 $IP | head -n 1 | grep -E -o "([0-9]{1,3}[\.]){3}[0-9]{1,3}")

    if [ "$CURRENT_IP" != "$OLD_IP" ]; then
        echo "IP address has changed to $CURRENT_IP"
        OLD_IP=$CURRENT_IP
    fi

    sleep $DELAY

    if (( $(date +%s) % $KEEP_ALIVE_DELAY == 0 )); then
        echo "Keep alive: $(date)"
    fi

    if (( $(date +%s) % $NOTIFICATION_DELAY == 0 )); then
        echo "Still pinging $IP"
    fi
done
}
