#!/usr/bin/env bash
# cabinet.sh - CLI for hosting multiplayer game sessions
#
# Usage:
#   cabinet start <game> [--port PORT] [--quasar URL]
#   cabinet stop
#   cabinet list
#   cabinet join [URL]
#
# Examples:
#   cabinet start trax
#   cabinet start trax --port 9000
#   cabinet start trax --quasar ws://relay.example.com

# ============================================================================
# CONFIGURATION
# ============================================================================

CABINET_SRC="${TETRA_SRC}/bash/cabinet"
CABINET_PID_FILE="${TETRA_DIR:?}/.cabinet.pid"
CABINET_DEFAULT_PORT=8080

# Game locations
GAMES_DIR="${TETRA_DIR}/orgs/tetra/games"

# ============================================================================
# HELPERS
# ============================================================================

cabinet_log() {
    echo "[cabinet] $*"
}

cabinet_error() {
    echo "[cabinet] ERROR: $*" >&2
}

cabinet_find_game() {
    local game="$1"
    local host_file="${GAMES_DIR}/${game}/${game}_host.js"

    if [[ -f "$host_file" ]]; then
        echo "$host_file"
        return 0
    fi

    cabinet_error "Game not found: $game"
    cabinet_error "Expected: $host_file"
    return 1
}

# ============================================================================
# COMMANDS
# ============================================================================

cabinet_start() {
    local game=""
    local port="$CABINET_DEFAULT_PORT"
    local quasar=""

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --port)
                port="$2"
                shift 2
                ;;
            --quasar)
                quasar="$2"
                shift 2
                ;;
            -*)
                cabinet_error "Unknown option: $1"
                return 1
                ;;
            *)
                game="$1"
                shift
                ;;
        esac
    done

    if [[ -z "$game" ]]; then
        cabinet_error "Usage: cabinet start <game> [--port PORT] [--quasar URL]"
        return 1
    fi

    # Check if already running
    if [[ -f "$CABINET_PID_FILE" ]]; then
        local pid
        pid=$(cat "$CABINET_PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            cabinet_error "Cabinet already running (PID $pid)"
            cabinet_error "Use 'cabinet stop' first"
            return 1
        fi
        rm -f "$CABINET_PID_FILE"
    fi

    # Find game host file
    local host_file
    host_file=$(cabinet_find_game "$game") || return 1

    # Build node command
    local cmd="node $host_file --port $port"
    if [[ -n "$quasar" ]]; then
        cmd+=" --quasar $quasar"
    fi

    cabinet_log "Starting $game on port $port..."

    # Run in foreground (for development)
    # TODO: Add --background flag for daemon mode
    eval "$cmd"
}

cabinet_stop() {
    if [[ ! -f "$CABINET_PID_FILE" ]]; then
        cabinet_log "No cabinet running"
        return 0
    fi

    local pid
    pid=$(cat "$CABINET_PID_FILE")

    if kill -0 "$pid" 2>/dev/null; then
        cabinet_log "Stopping cabinet (PID $pid)..."
        kill "$pid"
        rm -f "$CABINET_PID_FILE"
        cabinet_log "Stopped"
    else
        cabinet_log "Cabinet not running (stale PID file)"
        rm -f "$CABINET_PID_FILE"
    fi
}

cabinet_list() {
    cabinet_log "Available games:"
    echo ""

    for game_dir in "$GAMES_DIR"/*/; do
        local game_name
        game_name=$(basename "$game_dir")
        local host_file="${game_dir}${game_name}_host.js"

        if [[ -f "$host_file" ]]; then
            echo "  $game_name"
        fi
    done

    echo ""
    cabinet_log "Use 'cabinet start <game>' to host"
}

cabinet_join() {
    local url="${1:-ws://localhost:$CABINET_DEFAULT_PORT}"
    local join_html="${CABINET_SRC}/join.html"

    if [[ ! -f "$join_html" ]]; then
        cabinet_error "join.html not found: $join_html"
        return 1
    fi

    cabinet_log "Opening join page..."
    cabinet_log "URL: $url"

    # Open in default browser with host parameter
    local encoded_url
    encoded_url=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$url', safe=''))" 2>/dev/null || echo "$url")

    open "file://${join_html}?host=${encoded_url}" 2>/dev/null ||
    xdg-open "file://${join_html}?host=${encoded_url}" 2>/dev/null ||
    cabinet_log "Open in browser: file://${join_html}?host=${url}"
}

cabinet_help() {
    cat << 'EOF'
cabinet - Host multiplayer game sessions

USAGE:
    cabinet <command> [options]

COMMANDS:
    start <game>    Start hosting a game
    stop            Stop the running cabinet
    list            List available games
    join [url]      Open join page in browser
    help            Show this help

OPTIONS:
    --port PORT     WebSocket port (default: 8080)
    --quasar URL    Register with Quasar relay for internet play

EXAMPLES:
    cabinet start trax
    cabinet start trax --port 9000
    cabinet start trax --quasar ws://relay.pixeljamarcade.com
    cabinet join ws://192.168.1.100:8080
EOF
}

# ============================================================================
# MAIN
# ============================================================================

cabinet_main() {
    local cmd="${1:-help}"
    shift 2>/dev/null || true

    case "$cmd" in
        start)
            cabinet_start "$@"
            ;;
        stop)
            cabinet_stop
            ;;
        list)
            cabinet_list
            ;;
        join)
            cabinet_join "$@"
            ;;
        help|--help|-h)
            cabinet_help
            ;;
        *)
            cabinet_error "Unknown command: $cmd"
            cabinet_help
            return 1
            ;;
    esac
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    cabinet_main "$@"
fi
