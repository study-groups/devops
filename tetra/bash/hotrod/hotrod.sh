#!/bin/bash

# 🔧 Configuration
HOTROD_DIR="${TETRA_DIR:-$HOME/.tetra}/hotrod"
REMOTE_SERVER="${TETRA_REMOTE:-localhost}"
REMOTE_USER="${TETRA_REMOTE_USER:-root}"
PORT=9999  # Clipboard Listener
LISTENER_PID_FILE="$HOTROD_DIR/listener.pid"
LOG_FILE="$HOTROD_DIR/log.txt"

is_mac() { [[ "$OSTYPE" == "darwin"* ]]; }
is_remote() { [[ -n "$SSH_CLIENT" || -n "$SSH_TTY" ]]; }

timestamp() {
    date +"%Y-%m-%d %H:%M:%S"
}

log_event() {
    echo "[$(timestamp)] ===== $1 =====" | tee -a "$LOG_FILE"
}

log_message() {
    echo "[$(timestamp)] $1" | tee -a "$LOG_FILE"
}

usage() {
    cat <<EOF

🚗💨 Hotrod: Remote-to-Local Clipboard Streaming

Usage: hotrod.sh [command]

  --install        Install dependencies (macOS only)
  --start          Start SSH tunnel & clipboard listener
  --status         Show Hotrod status
  --stop           Stop all Hotrod processes
  --nuke           Aggressive cleanup of all Hotrod-related processes & ports
  --help           Show this help message

EOF
    exit 0
}

install_dependencies() {
    is_mac || { log_message "❌ This installation feature is for macOS only."; exit 1; }

    log_message "🔧 Installing required dependencies..."
    local dependencies=("socat" "proctools" "lsof")

    for dep in "${dependencies[@]}"; do
        if ! command -v "$dep" &>/dev/null; then
            log_message "📦 Installing $dep..."
            brew install "$dep"
        else
            log_message "✅ $dep is already installed."
        fi
    done

    log_message "✅ Installation complete."
    exit 0
}

hotrod_nuke() {
    log_event "NUKING Hotrod Processes"

    pgrep socat | xargs kill -9 2>/dev/null
    [[ -f "$LISTENER_PID_FILE" ]] && kill -9 "$(cat "$LISTENER_PID_FILE")" 2>/dev/null && rm -f "$LISTENER_PID_FILE"
    ps aux | grep "[s]sh -N -R $PORT:localhost:$PORT" | awk '{print $2}' | xargs kill -9 2>/dev/null
    lsof -ti tcp:$PORT | xargs kill -9 2>/dev/null

    sleep 1
    if lsof -iTCP -sTCP:LISTEN | grep -q ":$PORT "; then
        log_message "❌ Port $PORT is still occupied. Manual intervention required."
        exit 1
    fi

    log_message "✅ Hotrod fully nuked."
}

hotrod_kill() {
    log_event "Stopping Hotrod Processes"
    
    pgrep socat | xargs kill -9 2>/dev/null

    if [[ -f "$LISTENER_PID_FILE" ]]; then
        kill -9 "$(cat "$LISTENER_PID_FILE")" 2>/dev/null
        rm -f "$LISTENER_PID_FILE"
    fi

    ps aux | grep "[s]sh -N -R $PORT:localhost:$PORT" | awk '{print $2}' | xargs kill -9 2>/dev/null
    lsof -ti tcp:$PORT | xargs kill -9 2>/dev/null

    sleep 1
    if lsof -iTCP -sTCP:LISTEN | grep -q ":$PORT "; then
        log_message "❌ Port $PORT is still occupied. Manual intervention required."
        exit 1
    fi

    log_message "✅ Hotrod stopped."
}

start_ssh_tunnel() {
    is_remote && { log_message "Cannot start tunnel from remote."; exit 1; }

    log_message "🔗 Starting SSH Tunnel: $REMOTE_USER@$REMOTE_SERVER, forwarding $PORT → localhost:$PORT"
    ps aux | grep "[s]sh -N -R $PORT:localhost:$PORT" | awk '{print $2}' | xargs kill -9 2>/dev/null
    sleep 1

    nohup ssh -N -R $PORT:localhost:$PORT "$REMOTE_USER@$REMOTE_SERVER" & disown

    sleep 2
    if ps aux | grep "[s]sh -N -R $PORT:localhost:$PORT" | grep "$REMOTE_SERVER" &>/dev/null; then
        log_message "✅ SSH Tunnel established."
    else
        log_message "❌ SSH Tunnel failed to start. Check your SSH connection."
        exit 1
    fi
}

handle_clipboard() {
    while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        log_event "Clipboard Event"
        log_message "📥 Received: $line"
        echo "$line" > /tmp/hotrod_clipboard
        cat /tmp/hotrod_clipboard | pbcopy
        log_message "📋 Copied to clipboard: $line"
    done
}

start_clipboard_listener() {
    is_remote && { log_message "Cannot start listener from remote."; exit 1; }
    log_message "📋 Starting Clipboard Listener on localhost:$PORT..."

    hotrod_kill
    mkdir -p "$HOTROD_DIR"

    (socat -u TCP-LISTEN:$PORT,reuseaddr,fork STDOUT | handle_clipboard) > /tmp/hotrod_socat.log 2>&1 & disown

    sleep 2
    if ! pgrep -f "socat -u TCP-LISTEN:$PORT"; then
        log_message "❌ Clipboard listener failed to start!"
        cat /tmp/hotrod_socat.log  # Show error log
        exit 1
    fi
    log_message "✅ Clipboard listener started successfully."
}

hotrod_start() {
    log_event "Hotrod Startup"
    log_message "🚗💨 Starting Hotrod..."
    log_message "🔹 User     : $(whoami)"
    log_message "🔹 Host     : $(hostname)"
    log_message "🔹 Remote   : $REMOTE_USER@$REMOTE_SERVER"
    log_message "🔹 Port     : $PORT"
    log_message "🔹 Log File : $LOG_FILE"

    hotrod_kill
    start_clipboard_listener
    start_ssh_tunnel
}

hotrod_status() {
    log_event "Hotrod Status Check"
    log_message "🔥 Hotrod Status"
    log_message "Mode            : $(is_remote && echo Remote Client || echo Home Base)"
    log_message "Clipboard Port  : $PORT"
    log_message "Log File        : $LOG_FILE"

    echo -n "Listener        : "
    [[ -f "$LISTENER_PID_FILE" ]] && echo "Running" || echo "Not Running"

    echo -n "SSH Tunnel      : "
    if ps aux | grep "[s]sh -N -R $PORT:localhost:$PORT" &>/dev/null; then
        echo "Active"
    else
        echo "❌ Not Active"
    fi

    echo -n "Port Listening  : "
    if lsof -iTCP -sTCP:LISTEN | grep -q ":$PORT "; then
        echo "✅ Port is open"
    else
        echo "❌ Port NOT open!"
    fi

    log_message "Last Clipboard Entries:"
    tail -n 3 "$LOG_FILE" | grep -vE '^\s*$'
}

# If no arguments are given, read from stdin
if [[ $# -eq 0 ]]; then
    if is_remote; then
        log_event "Remote Hotrod Stdin Mode"
        log_message "📡 Streaming stdin to local clipboard..."
        cat | socat - TCP:localhost:$PORT
        log_message "✅ Clipboard data sent."
        exit 0
    else
        log_event "Local Hotrod Stdin Mode"
        log_message "📡 Reading stdin into clipboard..."
        cat | handle_clipboard
        exit 0
    fi
fi

hotrod_last() {
    local n="${1:-0}"  # Default to 0 if no argument is given
    log_event "Fetching Last Clipboard Entry ($n ago)"

    if [[ ! -f "$LOG_FILE" ]]; then
        log_message "❌ No clipboard history available."
        exit 1
    fi

    # Extract clipboard history lines
    local lines
    lines=$(grep "📋 Copied to clipboard:" "$LOG_FILE" | awk -F "📋 Copied to clipboard: " '{print $2}')

    if [[ -z "$lines" ]]; then
        log_message "❌ No clipboard history found."
        exit 1
    fi

    # Determine the line to fetch based on $n
    if [[ "$n" -eq 0 ]]; then
        log_message "📋 Last clipboard entry: $(echo "$lines" | tail -n 1)"
    else
        log_message "📋 Clipboard entry ($n ago): $(echo "$lines" | tail -n "$((n+1))" | head -n 1)"
    fi
}


case "$1" in
    --install) install_dependencies ;;
    --start) is_remote && exit 1; hotrod_start ;;
    --status) hotrod_status ;;
    --stop) is_remote && exit 1; hotrod_kill ;;
    --nuke) hotrod_nuke ;;
    --last)
        shift
        hotrod_last "${1:-0}"
        ;;
    --help) usage ;;
    *) log_message "Unknown command: $1"; usage ;;
esac

