#!/usr/bin/env bash

# quasar.sh - Quasar Audio Engine Module
#
# Multi-mode audio synthesizer for tetra games.
# Modes: TIA (Atari 2600), PWM (lo-fi), SIDPlus (C64+)
#
# Usage:
#   quasar start           # Start quasar server
#   quasar stop            # Stop quasar server
#   quasar status          # Show server status
#   quasar demo            # Start demo mode
#   quasar bridge traks    # Start traks bridge

QUASAR_SRC="${QUASAR_SRC:-$TETRA_SRC/bash/quasar}"
QUASAR_DIR="${QUASAR_DIR:-$TETRA_DIR/quasar}"
QUASAR_PORT="${QUASAR_PORT:-1985}"
QUASAR_OSC_PORT="${QUASAR_OSC_PORT:-1986}"
QUASAR_PID_FILE="$QUASAR_DIR/quasar.pid"

# Ensure runtime directory exists
[[ -d "$QUASAR_DIR" ]] || mkdir -p "$QUASAR_DIR"

# ============================================================================
# Server Management
# ============================================================================

quasar_start() {
    local verbose=""
    [[ "$1" == "-v" || "$1" == "--verbose" ]] && verbose="-v"

    if quasar_is_running; then
        echo "Quasar already running (PID: $(cat "$QUASAR_PID_FILE"))"
        return 1
    fi

    echo "Starting Quasar server on port $QUASAR_PORT..."

    # Check for node
    if ! command -v node &>/dev/null; then
        echo "Error: node not found. Install Node.js first."
        return 1
    fi

    # Check for dependencies
    if [[ ! -d "$QUASAR_SRC/node_modules/ws" ]]; then
        echo "Installing dependencies..."
        (cd "$QUASAR_SRC" && npm install ws osc 2>/dev/null)
    fi

    # Start server
    PORT="$QUASAR_PORT" OSC_IN="$QUASAR_OSC_PORT" \
        nohup node "$QUASAR_SRC/quasar_server.js" $verbose \
        > "$QUASAR_DIR/quasar.log" 2>&1 &

    local pid=$!
    echo "$pid" > "$QUASAR_PID_FILE"

    sleep 1
    if quasar_is_running; then
        echo "Quasar started (PID: $pid)"
        echo "  HTTP: http://localhost:$QUASAR_PORT"
        echo "  WS:   ws://localhost:$QUASAR_PORT/ws"
        echo "  OSC:  localhost:$QUASAR_OSC_PORT"
        return 0
    else
        echo "Failed to start Quasar"
        rm -f "$QUASAR_PID_FILE"
        return 1
    fi
}

quasar_stop() {
    if ! quasar_is_running; then
        echo "Quasar not running"
        return 0
    fi

    local pid
    pid=$(cat "$QUASAR_PID_FILE")
    echo "Stopping Quasar (PID: $pid)..."

    kill "$pid" 2>/dev/null
    sleep 1

    if kill -0 "$pid" 2>/dev/null; then
        kill -9 "$pid" 2>/dev/null
    fi

    rm -f "$QUASAR_PID_FILE"
    echo "Quasar stopped"
}

quasar_restart() {
    quasar_stop
    sleep 1
    quasar_start "$@"
}

quasar_status() {
    if quasar_is_running; then
        local pid
        pid=$(cat "$QUASAR_PID_FILE")
        echo "Quasar running (PID: $pid)"
        echo "  HTTP: http://localhost:$QUASAR_PORT"
        echo "  WS:   ws://localhost:$QUASAR_PORT/ws"
        echo "  OSC:  localhost:$QUASAR_OSC_PORT"

        # Try to get status from API
        if command -v curl &>/dev/null; then
            echo ""
            echo "Server status:"
            curl -s "http://localhost:$QUASAR_PORT/api/status" 2>/dev/null | \
                python3 -m json.tool 2>/dev/null || echo "  (unable to query)"
        fi
    else
        echo "Quasar not running"
    fi
}

quasar_is_running() {
    [[ -f "$QUASAR_PID_FILE" ]] || return 1
    local pid
    pid=$(cat "$QUASAR_PID_FILE")
    kill -0 "$pid" 2>/dev/null
}

quasar_logs() {
    local lines="${1:-50}"
    if [[ -f "$QUASAR_DIR/quasar.log" ]]; then
        tail -n "$lines" "$QUASAR_DIR/quasar.log"
    else
        echo "No log file found"
    fi
}

quasar_tail() {
    if [[ -f "$QUASAR_DIR/quasar.log" ]]; then
        tail -f "$QUASAR_DIR/quasar.log"
    else
        echo "No log file found"
    fi
}

# ============================================================================
# Bridge Management
# ============================================================================

quasar_bridge() {
    local game="${1:-traks}"
    local bridge_path="$QUASAR_SRC/bridges/${game}_bridge.js"

    if [[ ! -f "$bridge_path" ]]; then
        echo "Unknown game bridge: $game"
        echo "Available bridges:"
        ls "$QUASAR_SRC/bridges/"*_bridge.js 2>/dev/null | \
            xargs -I{} basename {} _bridge.js | sed 's/^/  /'
        return 1
    fi

    echo "Starting $game bridge..."
    node "$bridge_path" --server "ws://localhost:$QUASAR_PORT/ws?role=game"
}

# ============================================================================
# Demo Mode
# ============================================================================

quasar_demo() {
    echo "Starting Quasar in demo mode..."

    # Start server if not running
    if ! quasar_is_running; then
        quasar_start
        sleep 2
    fi

    # Start traks bridge (has built-in demo mode if traks not found)
    quasar_bridge traks
}

# ============================================================================
# OSC Send Helper
# ============================================================================

quasar_osc() {
    # Send OSC message to quasar
    # Usage: quasar_osc /quasar/0/set 1 18 7 12

    local address="$1"
    shift
    local args=("$@")

    if command -v oscsend &>/dev/null; then
        oscsend localhost "$QUASAR_OSC_PORT" "$address" "${args[@]}"
    else
        echo "oscsend not found. Install liblo-tools."
        echo "Would send: $address ${args[*]}"
    fi
}

# ============================================================================
# Sound Test
# ============================================================================

quasar_test() {
    echo "Testing Quasar sound..."

    if ! quasar_is_running; then
        echo "Quasar not running. Starting..."
        quasar_start
        sleep 2
    fi

    echo "Sending test sounds via OSC..."

    # Test voice 0
    quasar_osc /quasar/0/set i i i i 1 18 7 12
    sleep 0.5

    # Trigger pew
    quasar_osc /quasar/trigger/pew

    sleep 1

    # Stop voice
    quasar_osc /quasar/0/gate i 0

    echo "Test complete. Check browser at http://localhost:$QUASAR_PORT"
}

# ============================================================================
# Open Browser
# ============================================================================

quasar_open() {
    local url="http://localhost:$QUASAR_PORT"

    if ! quasar_is_running; then
        echo "Quasar not running. Start with: quasar start"
        return 1
    fi

    echo "Opening $url"

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

quasar() {
    local cmd="${1:-help}"
    shift 2>/dev/null || true

    case "$cmd" in
        start)   quasar_start "$@" ;;
        stop)    quasar_stop ;;
        restart) quasar_restart "$@" ;;
        status)  quasar_status ;;
        logs)    quasar_logs "$@" ;;
        tail)    quasar_tail ;;
        bridge)  quasar_bridge "$@" ;;
        demo)    quasar_demo ;;
        osc)     quasar_osc "$@" ;;
        test)    quasar_test ;;
        open)    quasar_open ;;
        help|--help|-h)
            cat <<'EOF'
Quasar Audio Engine - Multi-mode synthesizer for tetra games

Usage: quasar <command> [options]

Commands:
  start [-v]      Start quasar server (verbose with -v)
  stop            Stop quasar server
  restart [-v]    Restart quasar server
  status          Show server status
  logs [n]        Show last n lines of log (default: 50)
  tail            Follow log output
  bridge <game>   Start game bridge (traks, pulsar, etc.)
  demo            Start demo mode
  osc <addr> ...  Send OSC message
  test            Test sound output
  open            Open browser client

Environment:
  QUASAR_PORT      HTTP/WS port (default: 1985)
  QUASAR_OSC_PORT  OSC input port (default: 1986)

OSC Protocol:
  /quasar/{voice}/set {gate} {freq} {wave} {vol}
  /quasar/{voice}/gate {0|1}
  /quasar/mode {tia|pwm|sidplus}
  /quasar/trigger/{name}

Examples:
  quasar start           # Start server
  quasar demo            # Start with demo
  quasar bridge traks    # Connect traks game
  quasar open            # Open browser
EOF
            ;;
        *)
            echo "Unknown command: $cmd"
            echo "Run 'quasar help' for usage"
            return 1
            ;;
    esac
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    quasar "$@"
fi


