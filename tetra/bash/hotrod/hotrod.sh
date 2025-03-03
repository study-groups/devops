#!/bin/bash

# Hotrod Default Configuration
HOTROD_DIR="${TETRA_DIR:-$HOME/.tetra}/hotrod"
REMOTE_SERVER="${TETRA_REMOTE:-localhost}"
REMOTE_USER="${TETRA_REMOTE_USER:-root}"
PORT=9999

# Detect if we are running on a remote machine
is_remote() {
    [[ -n "$SSH_CLIENT" || -n "$SSH_TTY" ]]
}

# Detect if we are on the home base
is_home_base() {
    command -v xclip >/dev/null && nc -z localhost $PORT 2>/dev/null
}

# Function: Show usage help
usage() {
    echo ""
    echo "🚗💨 Hotrod: Remote-to-Local Clipboard Streaming"
    echo ""
    echo "Usage: hotrod.sh [command]"
    echo ""
    if is_remote; then
        echo "Remote Mode (Client):"
        echo "  Just pipe output into Hotrod:"
        echo "    more * | hotrod"
    else
        echo "Home Base (Server):"
        echo "  --run             Start SSH tunnel & clipboard listener"
        echo "  --status          Show Hotrod status (server-side)"
        echo "  --check           Perform a system check for SSH & dependencies"
        echo "  --stop            Stop all Hotrod processes (SSH tunnel & clipboard)"
    fi
    echo ""
    exit 0
}

# Function: Kill existing processes
cleanup_processes() {
    pkill -f "ssh -N -L $PORT:localhost:$PORT" 2>/dev/null && echo "✅ Stopped SSH tunnel."
    pkill -f "nc -lk $PORT" 2>/dev/null && echo "✅ Stopped clipboard listener."
}

# Function: Start SSH tunnel (local → remote)
start_ssh_tunnel() {
    if is_remote; then
        echo "❌ Cannot start SSH tunnel from a remote machine."
        exit 1
    fi
    cleanup_processes
    echo "🔗 Establishing SSH tunnel to $REMOTE_SERVER on port $PORT..."
    ssh -N -L $PORT:localhost:$PORT "$REMOTE_USER@$REMOTE_SERVER" &
    echo "✅ SSH Tunnel established."
}

# Function: Start clipboard listener (local)
start_clipboard_listener() {
    if is_remote; then
        echo "❌ Cannot start clipboard listener from a remote machine."
        exit 1
    fi
    echo "📋 Hotrod Clipboard Listener Active on Port $PORT..."
    nc -lk $PORT | xclip -selection clipboard &
    echo "✅ Clipboard listener started."
}

# Function: Run Hotrod (tunnel + listener)
hotrod_run() {
    echo "🚗💨 Starting Hotrod (SSH Tunnel + Clipboard Listener)..."
    start_ssh_tunnel
    start_clipboard_listener
}

# Function: Perform a system check
hotrod_check() {
    echo "🛠️ Running Hotrod System Check..."
    if is_home_base; then
        echo "✅ Home Base Detected (Mothership)"
    elif is_remote; then
        echo "✅ Remote Client Detected"
    fi

    echo -n "🔍 Checking SSH connection to $REMOTE_SERVER... "
    if ssh -o BatchMode=yes -o ConnectTimeout=3 "$REMOTE_USER@$REMOTE_SERVER" "exit" 2>/dev/null; then
        echo "✅ Success"
    else
        echo "❌ Failed! Run 'ssh $REMOTE_USER@$REMOTE_SERVER' manually to troubleshoot."
    fi

    echo -n "🔍 Checking SSH tunnel... "
    if is_home_base; then
        echo "✅ Active"
    else
        echo "❌ Not running"
    fi

    echo "✅ System check complete!"
}

# Function: Show status
hotrod_status() {
    echo "🔥 Hotrod Status"
    if is_home_base; then
        echo "🛜 Mode: Home Base (Mothership)"
        echo -n "🔍 Tunnel: "
        if nc -z localhost $PORT 2>/dev/null; then
            echo "✅ Active"
        else
            echo "❌ Not Running"
        fi
        echo -n "📋 Clipboard Listener: "
        if pgrep -f "nc -lk $PORT" >/dev/null; then
            echo "✅ Running"
        else
            echo "❌ Not Running"
        fi
    elif is_remote; then
        echo "🛰️ Mode: Remote Client"
        echo "🔍 Testing connection to Mothership..."
        echo "hotrod_test" | nc -w 1 localhost $PORT
        if [[ $? -eq 0 ]]; then
            echo "✅ Connected! Clipboard sync is working."
        else
            echo "❌ No response! Ensure 'hotrod.sh --run' is running on the home base."
        fi
    fi
}

# Function: Stop all Hotrod processes
hotrod_stop() {
    if is_remote; then
        echo "❌ Cannot stop Hotrod processes from a remote machine."
        exit 1
    fi
    cleanup_processes
    echo "✅ All Hotrod processes stopped."
}

# If no arguments are provided, show usage
if [[ $# -eq 0 ]]; then
    usage
fi

# Remote mode: If piped into, send data through the tunnel
if is_remote && [[ ! -t 0 ]]; then
    cat | nc -q 1 localhost $PORT
    exit 0
fi

# Parse command-line options
while [[ $# -gt 0 ]]; do
    case "$1" in
        --run)
            if is_remote; then echo "❌ Cannot run Hotrod services from remote."; exit 1; fi
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
            if is_remote; then echo "❌ Cannot stop Hotrod services from remote."; exit 1; fi
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
