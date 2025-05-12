#!/usr/bin/env bash

# 🔧 Configuration
HOTROD_DIR="${TETRA_DIR:-$HOME/.tetra}/hotrod"
REMOTE_SERVER="${TETRA_REMOTE:-localhost}"
REMOTE_USER="${TETRA_REMOTE_USER:-root}"
PORT=9999
LOG_FILE="$HOTROD_DIR/log.txt"

is_mac() { [[ "$OSTYPE" == "darwin"* ]]; }
is_remote() { [[ -n "$SSH_CLIENT" || -n "$SSH_TTY" ]]; }
timestamp() { date +"%Y-%m-%d %H:%M:%S"; }
log_event()  { echo "[$(timestamp)] ===== $1 =====" | tee -a "$LOG_FILE"; }
log_message(){ echo "[$(timestamp)] $1" | tee -a "$LOG_FILE"; }

usage() {
  cat <<EOF
🚗💨 Hotrod: Remote-to-Local Clipboard Streaming

Usage: hotrod.sh [command]
  --install     Install dependencies (macOS only)
  --start       Start SSH tunnel & clipboard listener via PM2
  --status      Show Hotrod status
  --stop        Stop Hotrod services via PM2
  --nuke        Aggressive cleanup of Hotrod-related processes & ports
  --last [n]    Show last clipboard entries
  --help        Show this help message
EOF
  exit 0
}

install_dependencies() {
  is_mac || { log_message "This installation feature is for macOS only."; exit 1; }
  log_message "🔧 Installing required dependencies..."
  local dependencies=("socat" "proctools" "lsof")
  for dep in "${dependencies[@]}"; do
    if ! command -v "$dep" &>/dev/null; then
      log_message "📦 Installing $dep..."
      brew install "$dep"
    else
      log_message "$dep is already installed."
    fi
  done
  log_message "Installation complete."
  exit 0
}

hotrod_nuke() {
  log_event "NUKING Hotrod Processes"
  pgrep socat | xargs kill -9 2>/dev/null
  ps aux | grep "[s]sh -N -R $PORT:localhost:$PORT" | awk '{print $2}' | xargs kill -9 2>/dev/null
  lsof -ti tcp:$PORT | xargs kill -9 2>/dev/null
  pm2 delete hotrod-listener hotrod-ssh-tunnel 2>/dev/null
  sleep 1
  if lsof -iTCP -sTCP:LISTEN | grep -q ":$PORT "; then
    log_message "Port $PORT is still occupied. Manual intervention required."
    exit 1
  fi
  log_message "Hotrod fully nuked."
}

hotrod_kill() {
  log_event "Stopping Hotrod"
  pm2 stop hotrod-listener hotrod-ssh-tunnel 2>/dev/null
  pm2 delete hotrod-listener hotrod-ssh-tunnel 2>/dev/null
  pm2 save
  log_message "🔥 Hotrod services stopped."
}

start_ssh_tunnel() {
  is_remote && { log_message "Cannot start tunnel from remote."; exit 1; }
  log_message "🔗 Starting SSH Tunnel: $REMOTE_USER@$REMOTE_SERVER, forwarding $PORT → localhost:$PORT"
  sleep 1
  tail -f /dev/null
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
  mkdir -p "$HOTROD_DIR"
  socat -u TCP-LISTEN:$PORT,reuseaddr,fork STDOUT | handle_clipboard
}

hotrod_start() {
  log_event "Hotrod Startup"
  log_message "🚗💨 Starting Hotrod via PM2..."
  pm2 start "$(dirname "$0")/ecosystem.config.js"
  #echo start "$(dirname "$0")/ecosystem.config.js"
  pm2 save
}

hotrod_status() {
  log_event "Hotrod Status Check"
  pm2 list
  pm2 logs --lines 10 hotrod-listener
}

hotrod_last() {
  local n="${1:-0}"
  log_event "Fetching Last Clipboard Entry ($n ago)"
  if [[ ! -f "$LOG_FILE" ]]; then
    log_message "No clipboard history available."
    exit 1
  fi
  local lines
  lines=$(grep "📋 Copied to clipboard:" "$LOG_FILE" | awk -F "📋 Copied to clipboard: " '{print $2}')
  if [[ -z "$lines" ]]; then
    log_message "No clipboard history found."
    exit 1
  fi
  if [[ "$n" -eq 0 ]]; then
    log_message "📋 Last clipboard entry: $(echo "$lines" | tail -n 1)"
  else
    log_message "📋 Clipboard entry ($n ago): $(echo "$lines" | tail -n $((n+1)) | head -n 1)"
  fi
}

# PM2 Entrypoint Handling
if [[ "$1" == "--pm2-listener" ]]; then
  start_clipboard_listener
  exit 0
fi

if [[ "$1" == "--pm2-tunnel" ]]; then
  start_ssh_tunnel
  exit 0
fi

# Default stdin modes
if [[ $# -eq 0 ]]; then
  if is_remote; then
    log_event "Remote Hotrod Stdin Mode"
    log_message "📡 Streaming stdin to local clipboard..."
    cat | socat - TCP:localhost:$PORT
    log_message "Clipboard data sent."
    exit 0
  else
    log_event "Local Hotrod Stdin Mode"
    log_message "📡 Reading stdin into clipboard..."
    cat | handle_clipboard
    exit 0
  fi
fi

# Command-line Interface
case "$1" in
  --install) install_dependencies ;;
  --start)   is_remote && exit 1; hotrod_start ;;
  --stop)    is_remote && exit 1; hotrod_kill ;;
  --status)  hotrod_status ;;
  --nuke)    hotrod_nuke ;;
  --last)    shift; hotrod_last "${1:-0}" ;;
  --help)    usage ;;
  *)         log_message "Unknown command: $1"; usage ;;
esac

