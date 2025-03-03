#!/bin/bash

# 🔧 Configuration: Set defaults using TETRA_ environment variables
TETRA_HOTROD_DIR="${TETRA_DIR:-$HOME/.tetra}/hotrod"
TETRA_REMOTE="${TETRA_REMOTE:-localhost}"
TETRA_REMOTE_USER="${TETRA_REMOTE_USER:-root}"
TETRA_PORT="${TETRA_PORT:-9999}"

# 🌐 Non-TETRA Vars (Used Inside Script)
HOTROD_DIR="$TETRA_HOTROD_DIR"
REMOTE_SERVER="$TETRA_REMOTE"
REMOTE_USER="$TETRA_REMOTE_USER"
PORT="$TETRA_PORT"
FIFO_FILE="$HOTROD_DIR/hotrod.fifo"
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
        echo "  --check           Check SSH & dependencies"
        echo "  --stop            Stop Hotrod"
        echo "  --kill            Force-stop all processes using port $PORT"
    fi
    echo ""
    exit 0
}

hotrod_kill() {
    echo "🔍 Stopping Hotrod processes..."

    # Find processes using port 9999
    local pids=$(lsof -ti tcp:$PORT)

    if [[ -n "$pids" ]]; then
        echo "🔪 Killing processes on port $PORT: $pids"
        kill -9 $pids
        sleep 1
    fi

    # Stop socat only if it's running
    if ps aux | grep "[s]ocat" &>/dev/null; then
        echo "⚠️ Stopping socat..."
        pkill -9 socat
    fi

    # Restart SSH tunnel if needed
    if ! ps aux | grep "[s]sh -N -R $PORT:localhost:$PORT" &>/dev/null; then
        echo "⚠️ SSH tunnel not found. Restarting..."
        ssh -N -R $PORT:localhost:$PORT "$REMOTE_USER@$REMOTE_SERVER" &
        sleep 1
    fi

    # Ensure port is free
    if ss -tln | grep -q ":$PORT "; then
        echo "⚠️ Port $PORT is still in use, forcing unbind..."
        fuser -k "$PORT"/tcp
        sleep 1
    fi

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

    # Ensure only actual clipboard content is logged
    nohup socat -u TCP-LISTEN:$PORT,reuseaddr,fork,bind=127.0.0.1 STDOUT | tee -a "$LOG_FILE" | grep -vE '^\s*$|^  📋 ' | {
        if command -v xclip &>/dev/null; then
            xclip -selection clipboard
        elif command -v pbcopy &>/dev/null; then
            pbcopy
        fi
    } &

    echo $! > "$LISTENER_PID_FILE"
    echo "✅ Clipboard listener started on localhost:$PORT (logging to $LOG_FILE)"
}

start_ssh_tunnel() {
    is_remote && { echo "Cannot start tunnel from remote."; exit 1; }
    echo "🔗 Starting SSH Tunnel: Remote (localhost:$PORT) → HomeBase (localhost:$PORT)..."

    # Check if SSH tunnel is already active
    if ps aux | grep "[s]sh -N -R $PORT:localhost:$PORT" &>/dev/null; then
        echo "✅ SSH Tunnel already active."
        return
    fi

    # Start SSH reverse tunnel
    ssh -N -R $PORT:localhost:$PORT "$REMOTE_USER@$REMOTE_SERVER" &

    sleep 1
    if ps aux | grep "[s]sh -N -R $PORT:localhost:$PORT" &>/dev/null; then
        echo "✅ SSH Tunnel established."
    else
        echo "❌ SSH Tunnel failed to start."
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

    # Show active SSH connections
    echo -n "Active Clients  : "
    active_clients=$(ss -tan | grep -c ":$PORT ")
    echo "$active_clients"

    # Show last few clipboard entries
    echo "Last Clipboard Entries:"
    tail -n 3 "$LOG_FILE" | sed 's/^/  📋 /'
}

# **Remote Mode Handling**
if is_remote; then
    echo "🚗💨 Hotrod Remote Mode"
    echo "Clipboard Port: $PORT"
    echo "Fetching technical status..."

    echo -n "🔍 Checking if Hotrod is running locally... "
    if ss -tan | grep -q ":$PORT "; then
        echo "✅ Listener is active."
    else
        echo "❌ No listener detected on localhost:$PORT."
    fi

    echo "🔎 Active TCP Connections on Port $PORT:"
    ss -tan | grep ":$PORT " || echo "No active connections."

    echo -n "🔗 Checking SSH Tunnel to Mothership... "
    if ps aux | grep "[s]sh -N -R $PORT:localhost:$PORT" &>/dev/null; then
        echo "✅ Tunnel is active."
    else
        echo "❌ Tunnel is down!"
    fi

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
