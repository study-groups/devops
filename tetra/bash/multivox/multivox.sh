#!/usr/bin/env bash
# multivox.sh - Voice coordination module for tetra
# Manages the multivox server (UDP + WebSocket bridge)

MULTIVOX_VERSION="0.1.0"
MULTIVOX_MOD_DIR="${BASH_SOURCE[0]%/*}"
MULTIVOX_MOD_SRC="${MULTIVOX_MOD_DIR}"
MULTIVOX_PORT="${MULTIVOX_PORT:-1982}"

# === MODULE INTERFACE ===

multivox_module_info() {
    cat <<EOF
Module: Multivox
Version: $MULTIVOX_VERSION
Description: Voice coordination server for estovox

Features:
  - UDP receiver for bash estovox (formant parameters)
  - WebSocket broadcaster for browser synths
  - Rate-limited at ~30fps to prevent flooding
  - Serves browser client files

Usage:
  multivox start     - Start the server
  multivox stop      - Stop the server
  multivox status    - Check if running
  multivox test      - Send test UDP packet
  multivox help      - Show this help

Port: $MULTIVOX_PORT (configurable via MULTIVOX_PORT env var)

Test command:
  echo '{"t":"fm","f1":800,"f2":1200,"f3":2500}' | nc -u -w0 localhost $MULTIVOX_PORT
EOF
}

multivox_start() {
    if multivox_is_running; then
        echo "Multivox already running (PID $(multivox_pid))"
        return 0
    fi

    # Check if ws module is installed
    if [[ ! -d "$MULTIVOX_MOD_DIR/node_modules/ws" ]]; then
        echo "Installing dependencies..."
        (cd "$MULTIVOX_MOD_DIR" && npm install --silent)
    fi

    echo "Starting multivox on port $MULTIVOX_PORT..."
    MULTIVOX_PORT="$MULTIVOX_PORT" node "$MULTIVOX_MOD_DIR/multivox.js" &
    local pid=$!
    echo "$pid" > "$MULTIVOX_MOD_DIR/.pid"

    sleep 0.5
    if kill -0 "$pid" 2>/dev/null; then
        echo "Multivox started (PID $pid)"
        echo "  HTTP/WS: http://localhost:$MULTIVOX_PORT"
        echo "  UDP:     localhost:$MULTIVOX_PORT"
    else
        echo "Failed to start multivox" >&2
        rm -f "$MULTIVOX_MOD_DIR/.pid"
        return 1
    fi
}

multivox_stop() {
    if ! multivox_is_running; then
        echo "Multivox not running"
        return 0
    fi

    local pid
    pid=$(multivox_pid)
    echo "Stopping multivox (PID $pid)..."
    kill "$pid" 2>/dev/null
    rm -f "$MULTIVOX_MOD_DIR/.pid"
    echo "Multivox stopped"
}

multivox_status() {
    if multivox_is_running; then
        echo "Multivox running (PID $(multivox_pid)) on port $MULTIVOX_PORT"
        return 0
    else
        echo "Multivox not running"
        return 1
    fi
}

multivox_is_running() {
    local pid
    pid=$(multivox_pid 2>/dev/null)
    [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

multivox_pid() {
    local pidfile="$MULTIVOX_MOD_DIR/.pid"
    [[ -f "$pidfile" ]] && cat "$pidfile"
}

multivox_test() {
    local msg='{"t":"fm","f1":800,"f2":1200,"f3":2500,"bits":8}'
    echo "Sending test packet to localhost:$MULTIVOX_PORT"
    echo "$msg"
    echo "$msg" | nc -u -w0 localhost "$MULTIVOX_PORT"
    echo "Sent!"
}

multivox_restart() {
    multivox_stop
    sleep 0.5
    multivox_start
}

# === MAIN ENTRY POINT ===

multivox() {
    local cmd="${1:-help}"
    shift || true

    case "$cmd" in
        start)      multivox_start "$@" ;;
        stop)       multivox_stop "$@" ;;
        restart)    multivox_restart "$@" ;;
        status)     multivox_status "$@" ;;
        test)       multivox_test "$@" ;;
        info|help|--help|-h)
                    multivox_module_info ;;
        version|--version|-v)
                    echo "Multivox v$MULTIVOX_VERSION" ;;
        *)
            echo "Unknown command: $cmd" >&2
            echo "Try: multivox help" >&2
            return 1
            ;;
    esac
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    multivox "$@"
fi
