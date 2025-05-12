#!/usr/bin/env bash

PORT=$1
TETRA_DIR="${TETRA_DIR:-$HOME/tetra}"
HOTROD_DIR="$TETRA_DIR/hotrod"

mkdir -p "$HOTROD_DIR"

timestamp() {
  date +"%Y-%m-%d %H:%M:%S"
}

log() {
  echo "[$(timestamp)] $1"
}

log "📋 Clipboard Hotrod Listener started on port $PORT"

handle_clipboard() {
  local line
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    echo "$line" > /tmp/hotrod_clipboard

    if [[ "$OSTYPE" == "darwin"* ]]; then
      pbcopy < /tmp/hotrod_clipboard
    elif command -v xclip &>/dev/null; then
      xclip -selection clipboard < /tmp/hotrod_clipboard
    fi

    log "✅ Copied to clipboard: $line"
  done
}

socat -u TCP-LISTEN:$PORT,reuseaddr,fork STDOUT | handle_clipboard
