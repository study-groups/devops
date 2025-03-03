#!/bin/bash

# Hotrod Default Configuration
HOTROD_DIR="${TETRA_DIR:-$HOME/.tetra}/hotrod"
REMOTE_SERVER="${TETRA_REMOTE:-localhost}"
REMOTE_USER="${TETRA_REMOTE_USER:-root}"
PORT=9999

# Function: Show usage help
usage() {
    echo ""
    echo "🚗💨 Hotrod: Remote-to-Local Clipboard Streaming"
    echo ""
    echo "Usage: hotrod.sh [command]"
    echo ""
    echo "Commands:"
    echo "  --run             Start SSH tunnel & clipboard listener (single command)"
    echo "  --status          Show current Hotrod setup and status"
    echo "  --check           Perform a system check for SSH & dependencies"
    echo "  --stop            Stop all Hotrod processes (SSH tunnel & clipboard)"
    echo "  --help            Show this help message"
    echo ""
    echo "To send remote output to your local clipboard:"
    echo "  more * | hotrod"
    echo ""
    exit 0
}

# Function: Kill existing processes
cleanup_processes() {
    echo "🛑 Stopping any existing Hotrod processes..."
    pkill -f "ssh -N -L $PORT:localhost:$PORT" 2>/dev/null && echo "✅ SSH Tunnel stopped."
    pkill -f "nc -lk $PORT" 2>/dev/null && echo "✅ Clipboard listener stopped."
}

# Function: Check if SSH tunnel is running
is_tunnel_active() {
    pgrep -f "ssh -N -L $PORT:localhost:$PORT" >/dev/null
}

# Function: Start SSH tunnel (local → remote)
start_ssh_tunnel() {
    if is_tunnel_active; then
        echo "✅ SSH Tunnel is already running on port $PORT"
    else
        echo "🔍 Checking SSH host key for $REMOTE_SERVER..."
        
        # Check if the host is already in known_hosts
        if ! ssh-keygen -F "$REMOTE_SERVER" >/dev/null; then
            echo "⚠️ Host key for $REMOTE_SERVER not found. Adding to known_hosts..."
            ssh-keyscan -H "$REMOTE_SERVER" >> ~/.ssh/known_hosts 2>/dev/null
            echo "✅ Host key added."
        fi

        echo "🔗 Establishing SSH tunnel to $REMOTE_SERVER on port $PORT..."
        ssh -N -L $PORT:localhost:$PORT "$REMOTE_USER@$REMOTE_SERVER" &
        echo "✅ SSH Tunnel established."
    fi
}

# Function: Check if clipboard listener is running
is_clipboard_active() {
    pgrep -f "nc -lk $PORT" >/dev/null
}

# Function: Start clipboard listener (local)
start_clipboard_listener() {
    if is_clipboard_active; then
        echo "✅ Clipboard listener already running on port $PORT"
    else
        echo "📋 Hotrod Clipboard Listener Active on Port $PORT..."
        nc -lk $PORT | xclip -selection clipboard &
        echo "✅ Clipboard listener started."
    fi
}

# Function: Start both SSH tunnel and clipboard listener
hotrod_run() {
    echo "🚗💨 Starting Hotrod (SSH Tunnel + Clipboard Listener)..."
    cleanup_processes
    start_ssh_tunnel
    start_clipboard_listener
}

# Function: Perform a systems check
hotrod_check() {
    echo "🛠️ Running Hotrod System Check..."
    
    echo -n "🔍 Checking SSH connection to $REMOTE_SERVER... "
    if ssh -o BatchMode=yes -o ConnectTimeout=3 "$REMOTE_USER@$REMOTE_SERVER" "exit" 2>/dev/null; then
        echo "✅ Success"
    else
        echo "❌ Failed! Run 'ssh $REMOTE_USER@$REMOTE_SERVER' manually to troubleshoot."
    fi

    echo -n "🔍 Checking SSH host key for $REMOTE_SERVER... "
    if ssh-keygen -F "$REMOTE_SERVER" >/dev/null; then
        echo "✅ Found in known_hosts"
    else
        echo "⚠️ Not found! Use 'hotrod.sh --run' to auto-add."
    fi

    echo -n "🔍 Checking SSH tunnel... "
    if is_tunnel_active; then
        echo "✅ Active"
    else
        echo "❌ Not running"
    fi

    echo -n "🔍 Checking clipboard listener... "
    if is_clipboard_active; then
        echo "✅ Running"
    else
        echo "❌ Not running"
    fi

    echo -n "🔍 Checking dependencies... "
    if command -v ssh && command -v nc && command -v xclip >/dev/null; then
        echo "✅ All dependencies installed"
    else
        echo "❌ Missing required tools (ssh, nc, xclip). Install them and retry."
    fi

    echo "✅ System check complete!"
}

# Function: Show Hotrod status
hotrod_status() {
    echo "🔥 Hotrod Status"
    echo "-----------------"
    if is_tunnel_active; then
        echo "✅ SSH Tunnel Active: $REMOTE_SERVER → localhost:$PORT"
    else
        echo "❌ SSH Tunnel Not Running"
    fi
    if is_clipboard_active; then
        echo "✅ Clipboard Listener Active on $PORT"
    else
        echo "❌ Clipboard Listener Not Running"
    fi

    # Test remote → local connection
    echo -n "🔍 Testing remote → local pipe... "
    echo "hotrod_test" | nc -w 1 localhost $PORT
    if [[ $? -eq 0 ]]; then
        echo "✅ Connection working!"
    else
        echo "❌ No response from tunnel! Run 'hotrod.sh --run' again."
    fi

    echo "-----------------"
    echo "Run 'hotrod.sh --run' to start all processes"
    echo "Run 'hotrod.sh --stop' to kill all Hotrod-related jobs"
}

# Function: Stop all Hotrod processes
hotrod_stop() {
    echo "🛑 Stopping all Hotrod processes..."
    cleanup_processes
    echo "✅ All Hotrod processes stopped."
}

# Ensure help is shown when no arguments are provided
if [[ $# -eq 0 ]]; then
    usage
fi

# Parse command-line options
while [[ $# -gt 0 ]]; do
    case "$1" in
        --run)
            hotrod_run
            exit 0
            ;;
        --status)
            hotrod_status
            exit 0
            ;;
        --check)
            hotrod_check
            exit 0
            ;;
        --stop)
            hotrod_stop
            exit 0
            ;;
        --help)
            usage
            ;;
        *)
            echo "❌ Unknown command: $1"
            usage
            ;;
    esac
done
