#!/usr/bin/env bash
# ansicab.sh - ANSI terminal cabinet for hosting multiplayer game sessions
#
# Usage:
#   ansicab dev [options]           # Test pattern dev mode
#   ansicab host <game> [options]   # Host a game
#   ansicab join <url|code>         # Join a remote cabinet
#   ansicab games                   # List available games
#   ansicab start <game>            # Start game via TSM (background)
#   ansicab stop                    # Stop running cabinet
#   ansicab help [command]          # Show help
#
# Examples:
#   ansicab dev
#   ansicab host magnetar --http
#   ansicab join ws://192.168.1.5:8080

# ============================================================================
# CONFIGURATION
# ============================================================================

ANSICAB_SRC="${ANSICAB_SRC:-${TETRA_SRC}/bash/ansicab}"
ANSICAB_PID_FILE="${TETRA_DIR:?}/.ansicab.pid"
# No default port - must be specified via --port or ANSICAB_PORT env

# Game locations
GAMES_DIR="${TETRA_DIR}/orgs/tetra/games"

# ============================================================================
# HELPERS
# ============================================================================

ansicab_log() {
    echo "[ansicab] $*"
}

ansicab_error() {
    echo "[ansicab] ERROR: $*" >&2
}

ansicab_find_game() {
    local game="$1"
    local host_file="${GAMES_DIR}/${game}/${game}_host.js"

    if [[ -f "$host_file" ]]; then
        echo "$host_file"
        return 0
    fi

    ansicab_error "Game not found: $game"
    ansicab_error "Expected: $host_file"
    return 1
}

# ============================================================================
# COMMANDS
# ============================================================================

ansicab_start() {
    local game=""
    local port="${ANSICAB_PORT:-}"
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
                ansicab_error "Unknown option: $1"
                return 1
                ;;
            *)
                game="$1"
                shift
                ;;
        esac
    done

    if [[ -z "$game" ]]; then
        ansicab_error "Usage: ansicab start <game> --port PORT [--quasar URL]"
        return 1
    fi

    if [[ -z "$port" ]]; then
        ansicab_error "--port is required (or set ANSICAB_PORT env)"
        return 1
    fi

    # Check if already running
    if [[ -f "$ANSICAB_PID_FILE" ]]; then
        local pid
        pid=$(cat "$ANSICAB_PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            ansicab_error "Ansicab already running (PID $pid)"
            ansicab_error "Use 'ansicab stop' first"
            return 1
        fi
        rm -f "$ANSICAB_PID_FILE"
    fi

    # Find game host file
    local host_file
    host_file=$(ansicab_find_game "$game") || return 1

    # Build node command
    local cmd="node $host_file --port $port"
    if [[ -n "$quasar" ]]; then
        cmd+=" --quasar $quasar"
    fi

    ansicab_log "Starting $game on port $port..."

    # Run in foreground (for development)
    # TODO: Add --background flag for daemon mode
    eval "$cmd"
}

ansicab_stop() {
    if [[ ! -f "$ANSICAB_PID_FILE" ]]; then
        ansicab_log "No ansicab running"
        return 0
    fi

    local pid
    pid=$(cat "$ANSICAB_PID_FILE")

    if kill -0 "$pid" 2>/dev/null; then
        ansicab_log "Stopping ansicab (PID $pid)..."
        kill "$pid"
        rm -f "$ANSICAB_PID_FILE"
        ansicab_log "Stopped"
    else
        ansicab_log "Ansicab not running (stale PID file)"
        rm -f "$ANSICAB_PID_FILE"
    fi
}

ansicab_list() {
    ansicab_log "Available games:"
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
    ansicab_log "Use 'ansicab start <game>' to host"
}

ansicab_join() {
    local url="${1:-}"
    if [[ -z "$url" ]]; then
        ansicab_error "Usage: ansicab join <ws://host:port | match-code>"
        return 1
    fi
    local join_html="${ANSICAB_SRC}/ansicab.html"

    if [[ ! -f "$join_html" ]]; then
        ansicab_error "ansicab.html not found: $join_html"
        return 1
    fi

    ansicab_log "Opening join page..."
    ansicab_log "URL: $url"

    # Open in default browser with host parameter
    local encoded_url
    encoded_url=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$url', safe=''))" 2>/dev/null || echo "$url")

    open "file://${join_html}?host=${encoded_url}" 2>/dev/null ||
    xdg-open "file://${join_html}?host=${encoded_url}" 2>/dev/null ||
    ansicab_log "Open in browser: file://${join_html}?host=${url}"
}

ansicab_help() {
    cat << 'EOF'
ansicab - ANSI terminal game cabinet

COMMANDS
  dev                   Run test pattern in dev mode
  host <game>           Host a game for network play
  join <url|code>       Join a remote cabinet
  games                 List available games
  start <game>          Start game in background
  stop                  Stop running cabinet
  help [command]        Show help for a command

EXAMPLES
  ansicab dev --port 8090
  ansicab dev --port 8090 --headless
  ansicab host magnetar --port 8090
  ansicab host magnetar --port 8090 --http
  ansicab join ws://192.168.1.5:8090
  ansicab join Z9A7

OPTIONS
  --port, -p N          Port number (REQUIRED for dev/host/start)
  --headless            Run without local console player
  --http                Serve ansicab.html for browser access
  --max-players N       Max player slots (default: 4)
  --match-code CODE     Display match code in game

ENVIRONMENT
  ANSICAB_PORT          Default port if --port not specified
EOF
}

# ============================================================================
# MAIN
# ============================================================================

ansicab() {
    local cmd="${1:-help}"
    shift 2>/dev/null || true

    case "$cmd" in
        # Direct to ansicab.js (foreground execution)
        dev|host|join|games)
            node "$ANSICAB_SRC/ansicab.js" "$cmd" "$@"
            ;;
        # Process management (background/TSM style)
        start)
            ansicab_start "$@"
            ;;
        stop)
            ansicab_stop
            ;;
        # Legacy
        list)
            ansicab_list
            ;;
        # Help
        help|--help|-h)
            if [[ -n "$1" ]]; then
                node "$ANSICAB_SRC/ansicab.js" help "$1"
            else
                ansicab_help
            fi
            ;;
        *)
            ansicab_error "Unknown command: $cmd"
            ansicab_help
            return 1
            ;;
    esac
}

# ============================================================================
# TAB COMPLETION
# ============================================================================

[[ -f "$ANSICAB_SRC/lib/complete.sh" ]] && source "$ANSICAB_SRC/lib/complete.sh"

export -f ansicab

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    ansicab "$@"
fi
