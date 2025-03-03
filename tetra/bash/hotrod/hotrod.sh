#!/bin/bash

# 🔧 Configuration: Set defaults using TETRA_ environment variables
TETRA_HOTROD_DIR="${TETRA_DIR:-$HOME/.tetra}/hotrod"
TETRA_REMOTE="${TETRA_REMOTE:-localhost}"
TETRA_REMOTE_USER="${TETRA_REMOTE_USER:-root}"
TETRA_PORT="${TETRA_PORT:-9999}"  # Clipboard Listener Port

# 🌐 Non-TETRA Vars (Used Inside Script)
HOTROD_DIR="$TETRA_HOTROD_DIR"
REMOTE_SERVER="$TETRA_REMOTE"
REMOTE_USER="$TETRA_REMOTE_USER"
PORT="$TETRA_PORT"
FIFO_FILE="$HOTROD_DIR/hotrod.fifo"
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
        echo "  --check           Check SSH & dependencies"
        echo "  --stop            Stop Hotrod"
        echo "  --kill            Force-stop all processes using port $PORT"
    fi
    echo ""
    exit 0
}

hotrod_kill() {
    echo "🔍 Stopping Hotrod processes..."
    local pids=$(lsof -ti tcp:$PORT)
    
    if [[ -n "$pids" ]]; then
        echo "🔪 Killing processes on port $PORT: $pids"
        kill -9 $pids
        sleep 1
    fi

    # Ensure port is free
    if ss -tln | grep -q ":$PORT "; then
        echo "⚠️ Port $PORT is still in use, forcing unbind..."
        fuser -k "$PORT"/tcp
        sleep 1
    fi

    rm -f "$LISTENER_PID_FILE" "$FIFO_FILE"
    echo "✅ Hotrod stopped."
}

hotrod_check_ports() {
    echo "Checking port $PORT..."
    if ss -tln | grep -q ":$PORT "; then
        echo "⚠️ Port $PORT is in use."
    else
        echo "✅ Port $PORT is free."
    fi
}

start_clipboard_listener() {
    is_remote && { echo "Cannot start listener from remote."; exit 1; }
    echo "📋 Starting Clipboard Listener on localhost:$PORT..."

    hotrod_kill  # Ensure the port is clean

    [[ -p "$FIFO_FILE" ]] || mkfifo "$FIFO_FILE"

    # Start the TCP listener on localhost only, discard terminal settings restoration
    socat -u TCP-LISTEN:$PORT,reuseaddr,fork SYSTEM:"cat" > /dev/null 2>&1 &

    echo "✅ Clipboard listener started on localhost:$PORT"
}


start_ssh_tunnel() {
    is_remote && { echo "Cannot start tunnel from remote."; exit 1; }
    echo "🔗 Setting up SSH Tunnel: Remote (localhost:$PORT) → HomeBase (localhost:$PORT)..."

    # Check if SSH tunnel is already active
    if ssh -q "$REMOTE_USER@$REMOTE_SERVER" "ss -tln | grep -q ':$PORT '" &>/dev/null; then
        echo "✅ SSH Tunnel already active."
        return
    fi

    # Start SSH reverse tunnel
    ssh -N -R $PORT:localhost:$PORT "$REMOTE_USER@$REMOTE_SERVER" &

    sleep 1
    if ssh -q "$REMOTE_USER@$REMOTE_SERVER" "ss -tln | grep -q ':$PORT '" &>/dev/null; then
        echo "✅ SSH Tunnel established on $REMOTE_SERVER."
    else
        echo "❌ SSH Tunnel setup failed."
        exit 1
    fi
}

hotrod_run() {
    echo "🚗💨 Starting Hotrod..."
    echo "   User   : $(whoami)"
    echo "   Host   : $(hostname)"
    echo "   Remote : $REMOTE_USER@$REMOTE_SERVER"
    echo "   Port   : $PORT"

    hotrod_check_ports
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

    # Check active connections
    active_clients=$(ssh -q "$REMOTE_USER@$REMOTE_SERVER" "ss -tn sport = :$PORT | tail -n +2 | wc -l")
    echo "Active Clients  : $active_clients"

    [[ -p "$FIFO_FILE" ]] && echo "FIFO            : Exists ($FIFO_FILE)" || echo "FIFO            : ❌ Missing"
}

# **Remote Mode Handling**
if is_remote; then
    if [[ -t 0 && $# -eq 0 ]]; then
        echo "🚗💨 Hotrod Remote Mode"
        echo "Clipboard Port: $PORT"
        echo "Pipe data to send to Mothership."
        exit 0
    fi

    echo "🔗 Sending data to Mothership via SSH tunnel (localhost:$PORT)..."

    if ! ss -tln | grep -q ":$PORT "; then
        echo "❌ Error: SSH tunnel is not active. Ensure Hotrod is running on home base."
        exit 1
    fi

    # Send data through SSH tunnel
    socat - TCP:localhost:$PORT && echo "✅ Clipboard data sent successfully."
    exit 0
fi

[[ $# -eq 0 ]] && usage

while [[ $# -gt 0 ]]; do
    case "$1" in
        --run) is_remote && exit 1; hotrod_run; exit 0 ;;
        --status) hotrod_status; exit 0 ;;
        --check) hotrod_check_ports; exit 0 ;;
        --stop) is_remote && exit 1; hotrod_kill; exit 0 ;;
        --kill) hotrod_kill; exit 0 ;;
        --help) usage ;;
        *) 
            echo "Unknown command: $1"
            usage
            ;;
    esac
done
