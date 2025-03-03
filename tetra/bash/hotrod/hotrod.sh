#!/bin/bash

# 🔧 Configuration
HOTROD_DIR="${TETRA_DIR:-$HOME/.tetra}/hotrod"
REMOTE_SERVER="${TETRA_REMOTE:-localhost}"
REMOTE_USER="${TETRA_REMOTE_USER:-root}"
PORT=9999  # Clipboard Listener
LISTENER_PID_FILE="$HOTROD_DIR/listener.pid"
LOG_FILE="$HOTROD_DIR/log.txt"
FIFO="$HOTROD_DIR/hotrod.fifo"

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
        echo "  --start           Start SSH tunnel & clipboard listener"
        echo "  --status          Show Hotrod status"
        echo "  --stop            Stop all Hotrod processes"
        echo "  --nuke            Aggressive cleanup of all Hotrod-related processes & ports"
    fi
    echo ""
    exit 0
}

hotrod_nuke() {
    echo "💣 NUKING all Hotrod-related processes and ports..."
    
    # Kill socat listener
    pkill -9 socat 2>/dev/null
    
    # Kill stored listener PID
    [[ -f "$LISTENER_PID_FILE" ]] && kill -9 "$(cat "$LISTENER_PID_FILE")" 2>/dev/null
    rm -f "$LISTENER_PID_FILE"

    # Kill SSH tunnels
    ps aux | grep "[s]sh -N -R $PORT:localhost:$PORT" | awk '{print $2}' | xargs kill -9 2>/dev/null

    # Force release port 9999
    lsof -ti tcp:$PORT | xargs kill -9 2>/dev/null
    fuser -k $PORT/tcp 2>/dev/null

    # Ensure port is fully free
    sleep 1
    if ss -tln | grep -q ":$PORT "; then
        echo "❌ Port $PORT is still occupied. Manual intervention required."
        exit 1
    fi

    echo "✅ Hotrod fully nuked."
}

hotrod_kill() {
    echo "🔍 Stopping Hotrod processes..."
    
    pkill -9 socat 2>/dev/null
    [[ -f "$LISTENER_PID_FILE" ]] && kill -9 "$(cat "$LISTENER_PID_FILE")" 2>/dev/null
    rm -f "$LISTENER_PID_FILE"

    ps aux | grep "[s]sh -N -R $PORT:localhost:$PORT" | awk '{print $2}' | xargs kill -9 2>/dev/null
    fuser -k $PORT/tcp 2>/dev/null

    echo "✅ Hotrod stopped."
}

start_ssh_tunnel() {
    is_remote && { echo "Cannot start tunnel from remote."; exit 1; }
    
    echo "🔗 Starting SSH Tunnel: $REMOTE_USER@$REMOTE_SERVER, forwarding $PORT → localhost:$PORT"

    # Kill existing tunnels
    existing_tunnels=$(ps aux | grep "[s]sh -N -R $PORT:localhost:$PORT" | awk '{print $2}')
    if [[ -n "$existing_tunnels" ]]; then
        echo "🔍 Found existing tunnels. Stopping..."
        echo "$existing_tunnels" | xargs kill -9 2>/dev/null
        sleep 1
    fi

    # Start fresh SSH tunnel
    nohup ssh -N -R $PORT:localhost:$PORT "$REMOTE_USER@$REMOTE_SERVER" &

    sleep 2
    if ps aux | grep "[s]sh -N -R $PORT:localhost:$PORT" | grep "$REMOTE_SERVER" &>/dev/null; then
        echo "✅ SSH Tunnel established."
    else
        echo "❌ SSH Tunnel failed to start. Check your SSH connection."
        exit 1
    fi
}

handle_clipboard() {
    while IFS= read -r line; do
        echo "$line"  # Keep stdout open for debugging/pipelining

        DISPLAY=:0; export DISPLAY  # Ensure clipboard works in GUI
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
    sleep 1

    if ! ss -tln | grep -q ":$PORT "; then
        echo "❌ Clipboard listener failed to start!"
        exit 1
    fi

    echo "✅ Clipboard listener started on localhost:$PORT"
}

hotrod_start() {
    echo "🚗💨 Starting Hotrod..."
    echo "  🔹 User     : $(whoami)"
    echo "  🔹 Host     : $(hostname)"
    echo "  🔹 Remote   : $REMOTE_USER@$REMOTE_SERVER"
    echo "  🔹 Port     : $PORT"
    echo "  🔹 FIFO     : $FIFO"
    echo "  🔹 Log File : $LOG_FILE"

    hotrod_kill
    start_clipboard_listener
    start_ssh_tunnel
}

hotrod_status() {
    echo "🔥 Hotrod Status"
    echo "Mode            : $(is_remote && echo Remote Client || echo Home Base)"
    echo "Clipboard Port  : $PORT"
    echo "FIFO            : $FIFO"
    echo "Log File        : $LOG_FILE"

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

    active_clients=$(ss -tan | grep ":$PORT " | grep ESTABLISHED | grep -v "127.0.0.1" | awk '{print $5}' | cut -d: -f1 | sort | uniq -c)
    if [[ -z "$active_clients" ]]; then
        echo "Active Clients  : 0"
    else
        echo "Active Clients  : $(echo "$active_clients" | wc -l)"
        echo "Connected Hosts :"
        echo "$active_clients"
    fi

    echo "Last Clipboard Entries:"
    tail -n 3 "$LOG_FILE" | sed 's/^/  📋 Clipboard: /' | grep -vE '^\s*$'
}

# **Remote Mode Handling**
if is_remote; then
    echo "🚗💨 Hotrod Remote Mode"
    echo "Clipboard Port: $PORT"
    echo "Sending data to Mothership..."

    echo "🔗 Remote Status Report" | socat - TCP:localhost:$PORT
    cat | socat - TCP:localhost:$PORT
    echo "✅ Clipboard data sent."
    exit 0
fi

[[ $# -eq 0 ]] && usage

case "$1" in
    --start) is_remote && exit 1; hotrod_start ;;
    --status) hotrod_status ;;
    --stop) is_remote && exit 1; hotrod_kill ;;
    --nuke) hotrod_nuke ;;
    --help) usage ;;
    *) echo "Unknown command: $1"; usage ;;
esac
