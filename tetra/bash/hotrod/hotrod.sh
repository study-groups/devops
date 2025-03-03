#!/bin/bash

# 🔧 Configuration
HOTROD_DIR="${TETRA_DIR:-$HOME/.tetra}/hotrod"
REMOTE_SERVER="${TETRA_REMOTE:-localhost}"
REMOTE_USER="${TETRA_REMOTE_USER:-root}"
PORT=9999  # Clipboard Listener
LISTENER_PID_FILE="$HOTROD_DIR/listener.pid"
LOG_FILE="$HOTROD_DIR/log.txt"

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

    # Kill socat listener
    pkill -9 socat 2>/dev/null

    # Kill stored listener PID
    [[ -f "$LISTENER_PID_FILE" ]] && kill -9 "$(cat "$LISTENER_PID_FILE")" 2>/dev/null
    rm -f "$LISTENER_PID_FILE"

    # Kill SSH tunnel
    ps aux | grep "[s]sh -N -R $PORT:localhost:$PORT" | awk '{print $2}' | xargs kill -9 2>/dev/null

    # Ensure port is fully freed
    fuser -k $PORT/tcp 2>/dev/null

    echo "✅ Hotrod stopped."
}

start_ssh_tunnel() {
    is_remote && { echo "Cannot start tunnel from remote."; exit 1; }
    echo "🔗 Ensuring SSH Tunnel: Remote (localhost:$PORT) → HomeBase (localhost:$PORT)..."

    # Find existing tunnels and terminate them
    existing_tunnels=$(ps aux | grep "[s]sh -N -R $PORT:localhost:$PORT" | awk '{print $2}')
    if [[ -n "$existing_tunnels" ]]; then
        echo "🔍 Found existing tunnels. Stopping..."
        echo "$existing_tunnels" | xargs kill -9 2>/dev/null
        sleep 1
    fi

    # Start fresh SSH tunnel
    nohup ssh -N -R $PORT:localhost:$PORT "$REMOTE_USER@$REMOTE_SERVER" &

    sleep 2
    if ps aux | grep "[s]sh -N -R $PORT:localhost:$PORT" &>/dev/null; then
        echo "✅ SSH Tunnel established."
    else
        echo "❌ SSH Tunnel failed to start. Port $PORT might be blocked or already in use."
        exit 1
    fi
}

handle_clipboard() {
    while IFS= read -r line; do
        echo "$line"  # Keep stdout open for debugging/pipelining

        # Ensure clipboard can be set inside GUI session
        DISPLAY=:0; export DISPLAY

        if command -v xclip &>/dev/null; then
            echo "$line" | xclip -selection clipboard
        else
            echo "❌ xclip not found! Clipboard update failed." >> "$LOG_FILE"
        fi
    done
}

start_clipboard_listener() {
    is_remote && { echo "Cannot start listener from remote."; exit 1; }
    echo "📋 Starting Clipboard Listener on localhost:$PORT..."

    hotrod_kill  # Ensure the port is clean

    nohup socat -u TCP-LISTEN:$PORT,reuseaddr,fork,bind=127.0.0.1 STDOUT | tee -a "$LOG_FILE" | handle_clipboard &

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
    echo "Mode            : $(is_remote && echo Remote Client || echo Home Base)"
    echo "Clipboard Port  : $PORT"

    echo -n "Listener        : "
    [[ -f "$LISTENER_PID_FILE" ]] && echo "Running" || echo "Not Running"

    echo -n "SSH Tunnel      : "
    if ps aux | grep "[s]sh -N -R $PORT:localhost:$PORT" &>/dev/null; then
        echo "Active"
    else
        echo "❌ Not Active"
    fi

    echo -n "Port Listening  : "
    if ss -tln | grep -q ":$PORT "; then
        echo "✅ Port is open"
    else
        echo "❌ Port NOT open!"
    fi

    # Count only **long-lived SSH sessions**, ignore clipboard sends
    active_clients=$(ss -tan | grep ":$PORT " | grep ESTABLISHED | grep -v "127.0.0.1" | awk '{print $5}' | cut -d: -f1 | sort | uniq -c)
    if [[ -z "$active_clients" ]]; then
        echo "Active Clients  : 0"
    else
        echo "Active Clients  : $(echo "$active_clients" | wc -l)"
        echo "Connected Hosts :"
        echo "$active_clients"
    fi

    # Show last few clipboard entries
    echo "Last Clipboard Entries:"
    tail -n 3 "$LOG_FILE" | sed 's/^/  📋 Clipboard: /' | grep -vE '^\s*$'
}

# **Remote Mode Handling**
if is_remote; then
    echo "🚗💨 Hotrod Remote Mode"
    echo "Clipboard Port: $PORT"
    echo "Sending data to Mothership..."

    # Report back to home base
    echo "🔗 Remote Status Report" | socat - TCP:localhost:$PORT

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
