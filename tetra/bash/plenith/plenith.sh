#!/usr/bin/env bash

# plenith.sh - Plenith TV Module
#
# Retro TV channel system with quasar audio integration.
# Serves static files and embeds quasar apps as channels.
#
# Usage:
#   plenith start           # Start plenith server
#   plenith stop            # Stop plenith server
#   plenith status          # Show server status
#   plenith open            # Open in browser

PLENITH_SRC="${PLENITH_SRC:-$HOME/src/pixeljam/pja/plenith}"
PLENITH_DIR="${PLENITH_DIR:-${TETRA_DIR:-$HOME/tetra}/plenith}"
PLENITH_PORT="${PLENITH_PORT:-1979}"
PLENITH_PID_FILE="$PLENITH_DIR/plenith.pid"

# Ensure runtime directory exists
[[ -d "$PLENITH_DIR" ]] || mkdir -p "$PLENITH_DIR"

# ============================================================================
# Server Management
# ============================================================================

plenith_start() {
    if plenith_is_running; then
        echo "Plenith already running (PID: $(cat "$PLENITH_PID_FILE"))"
        return 1
    fi

    echo "Starting Plenith TV on port $PLENITH_PORT..."

    # Check for python3
    if ! command -v python3 &>/dev/null; then
        echo "Error: python3 not found."
        return 1
    fi

    # Start server
    nohup python3 -m http.server "$PLENITH_PORT" \
        --directory "$PLENITH_SRC" \
        > "$PLENITH_DIR/plenith.log" 2>&1 &

    local pid=$!
    echo "$pid" > "$PLENITH_PID_FILE"

    sleep 1
    if plenith_is_running; then
        echo "Plenith started (PID: $pid)"
        echo "  URL: http://localhost:$PLENITH_PORT"
        return 0
    else
        echo "Failed to start Plenith"
        rm -f "$PLENITH_PID_FILE"
        return 1
    fi
}

plenith_stop() {
    if ! plenith_is_running; then
        echo "Plenith not running"
        return 0
    fi

    local pid
    pid=$(cat "$PLENITH_PID_FILE")
    echo "Stopping Plenith (PID: $pid)..."

    kill "$pid" 2>/dev/null
    sleep 1

    if kill -0 "$pid" 2>/dev/null; then
        kill -9 "$pid" 2>/dev/null
    fi

    rm -f "$PLENITH_PID_FILE"
    echo "Plenith stopped"
}

plenith_restart() {
    plenith_stop
    sleep 1
    plenith_start "$@"
}

plenith_is_running() {
    [[ -f "$PLENITH_PID_FILE" ]] || return 1
    local pid
    pid=$(cat "$PLENITH_PID_FILE")
    kill -0 "$pid" 2>/dev/null
}

plenith_status() {
    if plenith_is_running; then
        local pid
        pid=$(cat "$PLENITH_PID_FILE")
        echo "Plenith: running (PID: $pid)"
        echo "  URL:  http://localhost:$PLENITH_PORT"
        echo "  Log:  $PLENITH_DIR/plenith.log"
    else
        echo "Plenith: stopped"
    fi
}

# ============================================================================
# Logs
# ============================================================================

plenith_logs() {
    local lines="${1:-50}"
    if [[ -f "$PLENITH_DIR/plenith.log" ]]; then
        tail -n "$lines" "$PLENITH_DIR/plenith.log"
    else
        echo "No log file found"
    fi
}

plenith_tail() {
    if [[ -f "$PLENITH_DIR/plenith.log" ]]; then
        tail -f "$PLENITH_DIR/plenith.log"
    else
        echo "No log file found"
    fi
}

# ============================================================================
# Full Stack (Plenith + Quasar)
# ============================================================================

plenith_full() {
    # Start both plenith and quasar
    echo "Starting full stack (Plenith + Quasar)..."

    # Start quasar if available
    if type quasar &>/dev/null; then
        quasar start
    else
        echo "Warning: quasar module not loaded"
    fi

    # Start plenith
    plenith_start

    echo ""
    echo "Full stack running:"
    echo "  Plenith: http://localhost:$PLENITH_PORT"
    echo "  Quasar:  http://localhost:${QUASAR_PORT:-1985}"
    echo ""
    echo "Channels:"
    echo "  9  - Quasar Dashboard"
    echo "  10 - Lobby"
}

plenith_full_stop() {
    plenith_stop
    if type quasar &>/dev/null; then
        quasar stop
    fi
}

# ============================================================================
# Browser
# ============================================================================

plenith_open() {
    local url="http://localhost:$PLENITH_PORT"

    if ! plenith_is_running; then
        echo "Plenith not running. Starting..."
        plenith_start
        sleep 1
    fi

    if command -v open &>/dev/null; then
        open "$url"
    elif command -v xdg-open &>/dev/null; then
        xdg-open "$url"
    else
        echo "Please open $url in your browser"
    fi
}

# ============================================================================
# Main Dispatcher
# ============================================================================

plenith() {
    local cmd="${1:-help}"
    shift 2>/dev/null || true

    case "$cmd" in
        start)   plenith_start "$@" ;;
        stop)    plenith_stop ;;
        restart) plenith_restart "$@" ;;
        status)  plenith_status ;;
        logs)    plenith_logs "$@" ;;
        tail)    plenith_tail ;;
        full)    plenith_full ;;
        full-stop) plenith_full_stop ;;
        open)    plenith_open ;;
        help|--help|-h)
            cat <<'EOF'
Plenith TV - Retro channel system with quasar audio

Usage: plenith <command> [options]

Commands:
  start           Start plenith server
  stop            Stop plenith server
  restart         Restart plenith server
  status          Show server status
  logs [n]        Show last n lines of log (default: 50)
  tail            Follow log output
  full            Start plenith + quasar together
  full-stop       Stop plenith + quasar
  open            Open browser

Environment:
  PLENITH_PORT    HTTP port (default: 1979)
  PLENITH_SRC     Source directory
  PLENITH_DIR     Runtime directory

Channels:
  2   Plenith logo
  3   Welcome
  4   Pong (built-in)
  5   Clock
  6   Test Pattern
  7   ControlDeck Pong
  8   DivGraphics
  9   Quasar Dashboard
  10  Lobby
  13  CRT Controls

Examples:
  plenith start        # Start server on port 1979
  plenith full         # Start with quasar audio
  plenith open         # Open in browser
EOF
            ;;
        *)
            echo "Unknown command: $cmd"
            echo "Run 'plenith help' for usage"
            return 1
            ;;
    esac
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    plenith "$@"
fi
