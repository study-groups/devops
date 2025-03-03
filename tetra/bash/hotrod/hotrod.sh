#!/bin/bash

# Hotrod Configuration
HOTROD_DIR="${TETRA_DIR:-$HOME/.tetra}/hotrod"
REMOTE_SERVER="${TETRA_REMOTE:-localhost}"
REMOTE_USER="${TETRA_REMOTE_USER:-root}"
DEFAULT_PORT=9999  # Default port if not overridden
PORT=$DEFAULT_PORT
TUNNEL_PORT=$((PORT + 1))  # SSH forwards this to $PORT
LISTENER_PORT=$((PORT - 1)) # Dedicated clipboard listener port

is_remote() { [[ -n "$SSH_CLIENT" || -n "$SSH_TTY" ]]; }

# Parse command-line arguments correctly
if [[ $# -gt 0 ]]; then
    if [[ "$1" =~ ^[0-9]+$ ]]; then
        shift  # Remove port argument and shift to the next
    fi
fi

usage() {
    echo ""
    echo "🚗💨 Hotrod: Remote-to-Local Clipboard Streaming"
    echo ""
    echo "Usage: hotrod.sh [port] [command]"
    echo ""
    if is_remote; then
        echo "Remote Mode (Client):"
        echo "  Pipe data into Hotrod to send it to the home base clipboard:"
        echo "    echo 'Hello' | hotrod [port]"
    else
        echo "Home Base (Server):"
        echo "  --run             Start SSH tunnel & clipboard listener"
        echo "  --status          Show Hotrod status (server-side)"
        echo "  --check           Perform a system check for SSH & dependencies"
        echo "  --stop            Stop all Hotrod processes (SSH tunnel & clipboard)"
        echo "  --kill            Kill processes holding ports $PORT, $TUNNEL_PORT, and $LISTENER_PORT"
    fi
    echo ""
    exit 0
}

hotrod_kill() {
    echo "Checking for existing processes on ports $PORT, $TUNNEL_PORT, $LISTENER_PORT..."
    local pids
    pids=$(lsof -ti tcp:$PORT -ti tcp:$TUNNEL_PORT -ti tcp:$LISTENER_PORT)

    if [[ -n "$pids" ]]; then
        echo "Killing existing processes on ports $PORT, $TUNNEL_PORT, $LISTENER_PORT: $pids"
        kill -9 $pids
        sleep 1
    else
        echo "No existing processes found."
    fi
}

hotrod_check_ports() {
    echo "Checking ports..."
    for p in $PORT $TUNNEL_PORT $LISTENER_PORT; do
        if [[ "$p" =~ ^[0-9]+$ ]]; then
            if lsof -i :"$p" >/dev/null; then
                echo "⚠️ Port $p is in use."
            else
                echo "✅ Port $p is free."
            fi
        fi
    done
}

start_ssh_tunnel() {
    is_remote && { echo "Cannot start tunnel from remote."; exit 1; }
    echo "🔗 Starting SSH Tunnel on port $TUNNEL_PORT..."

    if nc -z localhost $TUNNEL_PORT 2>/dev/null; then
        echo "✅ SSH Tunnel already active on port $TUNNEL_PORT."
        return
    fi

    ssh -N -L $TUNNEL_PORT:localhost:$PORT "$REMOTE_USER@$REMOTE_SERVER" &

    sleep 1
    if nc -z localhost $TUNNEL_PORT 2>/dev/null; then
        echo "✅ SSH Tunnel established on port $TUNNEL_PORT."
    else
        echo "❌ SSH Tunnel failed."
        exit 1
    fi
}

start_clipboard_listener() {
    is_remote && { echo "Cannot start listener from remote."; exit 1; }
    echo "📋 Starting Clipboard Listener on port $PORT..."

    while lsof -ti tcp:$PORT >/dev/null; do
        echo "⚠️ Waiting for port $PORT to be released..."
        sleep 1
    done

    echo "✅ Clipboard Listener running on port $PORT."

    # Listen and respond to special commands
    while true; do
        echo "Listening for remote messages..."
        nc -lk localhost "$PORT" | while read -r line; do
            if [[ "$line" == "hotrod_ping" ]]; then
                echo "Mothership Online - $(hostname) (Port: $PORT)" | nc -q 1 localhost "$TUNNEL_PORT"
            else
                echo "$line" | tee -a "$HOTROD_DIR/hotrod.log" | xclip -selection clipboard
            fi
        done
    done &
}

hotrod_run() {
    echo "🚗💨 Starting Hotrod..."
    echo "   User   : $(whoami)"
    echo "   Host   : $(hostname)"
    echo "   Remote : $REMOTE_USER@$REMOTE_SERVER"
    echo "   Port   : $PORT"

    hotrod_check_ports

    hotrod_kill  # Ensure clean startup

    start_clipboard_listener
    start_ssh_tunnel
}

hotrod_status() {
    echo "🔥 Hotrod Status"
    echo "Mode: $(is_remote && echo Remote Client || echo Home Base)"
    echo "Port: $PORT"
    echo -n "Tunnel: "
    nc -z localhost $TUNNEL_PORT &>/dev/null && echo "Active" || echo "Not Running"
    echo -n "Listener: "
    pgrep -f "nc -lk localhost $PORT" &>/dev/null && echo "Running" || echo "Not Running"
}

if is_remote; then
    if [[ -t 0 ]]; then
        echo "🔗 Contacting Mothership on Port $PORT..."
        echo "hotrod_ping" | nc -q 1 localhost "$PORT"
        exit 0
    else
        cat | nc -q 1 localhost "$PORT"
        exit 0
    fi
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
