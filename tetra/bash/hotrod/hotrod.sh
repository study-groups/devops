#!/bin/bash

# 🔧 Configuration
HOTROD_DIR="${TETRA_DIR:-$HOME/.tetra}/hotrod"
REMOTE_SERVER="${TETRA_REMOTE:-localhost}"
REMOTE_USER="${TETRA_REMOTE_USER:-root}"
PORT=9999  # Clipboard Listener
LISTENER_PID_FILE="$HOTROD_DIR/listener.pid"

is_remote() { [[ -n "$SSH_CLIENT" || -n "$SSH_TTY" ]]; }

usage() {
    echo ""
    echo "🚗💨 Hotrod: Remote-to-Local Clipboard Streaming"
    echo ""
    echo "Usage: hotrod.sh [command]"
    echo ""
    if is_remote; then
        echo "Remote Mode (Client):"
        echo "  Pipe data into Hotrod via SSH Tunnel:"
        echo "    echo 'Hello' | hotrod"
    else
        echo "Home Base (Server):"
        echo "  --run             Start SSH tunnel & clipboard listener"
        echo "  --status          Show Hotrod status"
        echo "  --stop            Stop all Hotrod processes"
    fi
    echo ""
    exit 0
}

hotrod_kill() {
    echo "🔍 Stopping Hotrod processes..."
    pkill -9 socat 2>/dev/null
    [[ -f "$LISTENER_PID_FILE" ]] && kill -9 "$(cat "$LISTENER_PID_FILE")" 2>/dev/null
    rm -f "$LISTENER_PID_FILE"
    echo "✅ Hotrod stopped."
}

start_ssh_tunnel() {
    is_remote && { echo "Cannot start tunnel from remote."; exit 1; }
    echo "🔗 Starting SSH Tunnel: Remote (localhost:$PORT) → HomeBase (localhost:$PORT)..."

    ssh -N -R $PORT:localhost:$PORT "$REMOTE_USER@$REMOTE_SERVER" &

    sleep 1
    if ps aux | grep "[s]sh -N -R $PORT:localhost:$PORT" &>/dev/null; then
        echo "✅ SSH Tunnel established."
    else
        echo "❌ SSH Tunnel failed."
        exit 1
    fi
}

start_clipboard_listener() {
    is_remote && { echo "Cannot start listener from remote."; exit 1; }
    echo "📋 Starting Clipboard Listener on localhost:$PORT..."

    hotrod_kill  # Ensure the port is clean

    nohup socat -u TCP-LISTEN:$PORT,reuseaddr,fork,bind=127.0.0.1 STDOUT | tee -a "$HOTROD_DIR/log.txt" &

    echo $! > "$LISTENER_PID_FILE"
    echo "✅ Clipboard listener started on localhost:$PORT"
}

hotrod_run() {
    echo "🚗💨 Starting Hotrod..."
    hotrod_kill
    start_clipboard_listener
    start_ssh_tunnel
}

hotrod_status() {
    echo "🔥 Hotrod Status"
    echo "Clipboard Port  : $PORT"

    echo -n "Listener        : "
    [[ -f "$LISTENER_PID_FILE" ]] && echo "Running" || echo "Not Running"

    echo -n "SSH Tunnel      : "
    if ps aux | grep "[s]sh -N -R $PORT:localhost:$PORT" &>/dev/null; then
        echo "Active"
    else
        echo "❌ Not Active"
    fi
}

# **Remote Mode Handling**
if is_remote; then
    echo "🚗💨 Hotrod Remote Mode"
    echo "Clipboard Port: $PORT"
    echo "Sending data to Mothership..."

    if [[ -p /dev/stdin ]]; then
        cat | socat - TCP:localhost:$PORT
        echo "✅ Clipboard data sent."
    else
        echo "❌ No data to send. Pipe data into hotrod."
    fi
    exit 0
fi

[[ $# -eq 0 ]] && usage

while [[ $# -gt 0 ]]; do
    case "$1" in
        --run) is_remote && exit 1; hotrod_run; exit 0 ;;
        --status) hotrod_status; exit 0 ;;
        --stop) is_remote && exit 1; hotrod_kill; exit 0 ;;
        --help) usage ;;
        *) 
            echo "Unknown command: $1"
            usage
            ;;
    esac
done
