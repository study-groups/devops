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

# Detect if we are on the home base (server)
is_home_base() {
    command -v xclip >/dev/null && nc -z localhost $PORT 2>/dev/null
}

# Function: Show usage help
usage() {
    echo ""
    echo "🚗💨 Hotrod: Remote-to-Local Clipboard Streaming"
    echo ""
    if is_remote; then
        echo "🛰️ Remote Mode (Client):"
        echo "  Just pipe output into Hotrod:"
        echo "    more * | hotrod"
        echo ""
        echo "  Check deep connection info:"
        echo "    hotrod --info"
    else
        echo "🛜 Home Base (Server):"
        echo "  --run             Start SSH tunnel & clipboard listener"
        echo "  --status          Show Hotrod status (server-side)"
        echo "  --check           Perform a system check for SSH & dependencies"
        echo "  --stop            Stop all Hotrod processes (SSH tunnel & clipboard)"
    fi
    echo ""
    exit 0
}

# Function: Receive piped data and send to clipboard
receive_data() {
    if is_remote; then
        if ! nc -z localhost $PORT 2>/dev/null; then
            echo "❌ No connection to mothership! Ensure Hotrod is running on the home base."
            exit 1
        fi
        cat | nc -q 1 localhost $PORT
    else
        cat | xclip -selection clipboard
    fi
}

# Function: Gather deep info on remote tunnel status
hotrod_info() {
    if ! is_remote; then
        echo "❌ This command is only for remote clients."
        exit 1
    fi

    echo "🛰️ Remote Hotrod Info"
    echo "-------------------------"
    echo "🔍 Testing SSH tunnel..."
    ssh_pid=$(pgrep -f "ssh -N -L $PORT:localhost:$PORT")
    if [[ -n "$ssh_pid" ]]; then
        echo "✅ SSH Tunnel Process Running (PID: $ssh_pid)"
    else
        echo "❌ No active SSH tunnel detected."
    fi

    echo -n "🔍 Can reach localhost:$PORT? "
    if nc -z localhost $PORT 2>/dev/null; then
        echo "✅ Yes"
    else
        echo "❌ No response"
    fi

    echo -n "🔍 Can send test message? "
    echo "hotrod_test" | nc -w 1 localhost $PORT
    if [[ $? -eq 0 ]]; then
        echo "✅ Success!"
    else
        echo "❌ No response from mothership!"
    fi

    echo "-------------------------"
}

# Function: Start SSH tunnel (local → remote)
start_ssh_tunnel() {
    if is_remote; then
        echo "❌ Cannot start SSH tunnel from a remote machine."
        exit 1
    fi
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
    start_ssh_tunnel
    start_clipboard_listener
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
        echo "❌ Cannot stop Hotrod services from a remote machine."
        exit 1
    fi
    pkill -f "ssh -N -L $PORT:localhost:$PORT" 2>/dev/null && echo "✅ Stopped SSH tunnel."
    pkill -f "nc -lk $PORT" 2>/dev/null && echo "✅ Stopped clipboard listener."
}

# If receiving from a pipe, process data
if [[ $# -eq 0 && ! -t 0 ]]; then
    receive_data
    exit 0
fi

# Ensure the script properly recognizes commands
if [[ $# -eq 0 ]]; then
    usage
fi

# Parse command-line options
case "$1" in
    --run)
        if is_remote; then echo "❌ Cannot run Hotrod services from remote."; exit 1; fi
        hotrod_run
        ;;
    --status)
        hotrod_status
        ;;
    --check)
        hotrod_status
        ;;
    --info)
        hotrod_info
        ;;
    --stop)
        if is_remote; then echo "❌ Cannot stop Hotrod services from remote."; exit 1; fi
        hotrod_stop
        ;;
    --help)
        usage
        ;;
    *)
        echo "❌ Unknown command: $1"
        usage
        ;;
esac
