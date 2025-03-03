hotrod_remote() {
    local server="${1:-$TETRA_REMOTE}"
    local user="${2:-root}"

    if [[ -z "$server" ]]; then
        echo "Server is not specified and TETRA_REMOTE is not set."
        return 1
    fi

    ssh "${user}@${server}" bash << 'EOF'
PORT=9999
PIDFILE="/tmp/hotrod.pid"

# Singleton enforcement
if [[ -f "$PIDFILE" ]] && kill -0 \$(cat "$PIDFILE") 2>/dev/null; then
    echo "🔥 Hotrod already running (PID: \$(cat "$PIDFILE"))"
    exit 0
fi

echo $$ > "$PIDFILE"
trap "rm -f $PIDFILE; exit" INT TERM EXIT

echo "🚗💨 Hotrod Remote Server listening on port $PORT"
while true; do nc -lk $PORT; done
EOF
}
