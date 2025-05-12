#!/usr/bin/env bash

# Directories
TETRA_DIR="${TETRA_DIR:-$HOME/tetra}"
HOTROD_DIR="$TETRA_DIR/hotrod"
LOGS_DIR="$HOTROD_DIR/logs"
HOTROD_SRC="$TETRA_SRC/bash/hotrod"

# Defaults
DEFAULT_USER="${TETRA_REMOTE_USER:-devops}"
DEFAULT_HOST="${TETRA_REMOTE:-ssh.nodeholder.com}"

# Ensure logs directory exists
mkdir -p "$LOGS_DIR"

# Dependencies check
command -v jq >/dev/null 2>&1 || {
  echo "Error: jq is required but not installed."
  exit 1
}

# Parse PM2 for hotrod apps
function parse_pm2_apps() {
  pm2 jlist | jq -r '.[] | select(.name | startswith("hr-")) | .name'
}

# Get app name by port
function get_app_info_by_port() {
  local PORT=$1
  parse_pm2_apps | while IFS= read -r name; do
    if [[ "$name" =~ ^hr-([0-9]+)-(.*)$ ]]; then
      if [[ "${BASH_REMATCH[1]}" == "$PORT" ]]; then
        echo "${BASH_REMATCH[2]}"
        return
      fi
    fi
  done
}

# Add new hotrod app
function add_app() {
  local PORT=$1
  local APPNAME=$2
  local ENTRYPOINT=$3

  if [[ -z "$PORT" || -z "$APPNAME" || -z "$ENTRYPOINT" ]]; then
    echo "Missing arguments. Usage: hotrod add <port> <appname> <entrypoint>"
    exit 1
  fi

  if [[ ! -x "$ENTRYPOINT" ]]; then
    echo "Entrypoint '$ENTRYPOINT' does not exist or is not executable."
    exit 1
  fi

  pm2 start "$HOTROD_SRC/tunnel.sh" \
	  --name "hr-tunnel-$PORT" \
	  --interpreter bash -- "$PORT"

  pm2 start "$ENTRYPOINT" \
	  --name "hr-${PORT}-${APPNAME}" -- "$PORT"

  echo "Hotrod app '$APPNAME' started on port $PORT."
}

# Remove hotrod app
function remove_app() {
  local PORT=$1
  local APPNAME
  APPNAME=$(get_app_info_by_port "$PORT")

  if [[ -z "$APPNAME" ]]; then
    echo "No app found on port $PORT."
    exit 1
  fi

  pm2 delete "hr-tunnel-$PORT" &>/dev/null
  pm2 delete "hr-${PORT}-${APPNAME}" &>/dev/null

  echo "Removed hotrod app $APPNAME on port $PORT."
}

# List running hotrod apps
function list_apps() {
  echo "Running Hotrod Apps:"
  parse_pm2_apps | while IFS= read -r name; do
    if [[ "$name" =~ ^hr-([0-9]+)-(.*)$ ]]; then
      echo " Port ${BASH_REMATCH[1]} => ${BASH_REMATCH[2]}"
    fi
  done
}

# Usage info
function usage() {
  echo "Usage:"
  echo "  hotrod add <port> <appname> <entrypoint>"
  echo "  hotrod rm <port>"
  echo "  hotrod list"
}

# Main logic
ACTION=$1
case "$ACTION" in
  add) add_app "$2" "$3" "$4" ;;
  rm)  remove_app "$2" ;;
  list) list_apps ;;
  *) usage ;;
esac

