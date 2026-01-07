#!/usr/bin/env bash

# GAMMA - Game Match-Making Allocator
# Bash CLI wrapper and module

# Module paths
: "${GAMMA_SRC:=$TETRA_SRC/bash/gamma}"
: "${GAMMA_DIR:=$TETRA_DIR/gamma}"

# Service ports
GAMMA_HTTP_PORT="${GAMMA_HTTP_PORT:-1980}"
GAMMA_UDP_PORT="${GAMMA_UDP_PORT:-1985}"
GAMMA_SOCKET="/tmp/tetra/gamma.sock"

# Global check
if [[ -z "$TETRA_SRC" ]]; then
    echo "Error: TETRA_SRC must be set" >&2
    echo "Source ~/tetra/tetra.sh first" >&2
    return 1 2>/dev/null || exit 1
fi

# Colors (TDS-compatible)
: "${GAMMA_CYAN:=\033[0;36m}"
: "${GAMMA_YELLOW:=\033[1;33m}"
: "${GAMMA_GREEN:=\033[0;32m}"
: "${GAMMA_GRAY:=\033[0;90m}"
: "${GAMMA_NC:=\033[0m}"

# Hierarchical help with TDS colors
_gamma_help() {
    local C="$GAMMA_CYAN" Y="$GAMMA_YELLOW" G="$GAMMA_GREEN" D="$GAMMA_GRAY" N="$GAMMA_NC"

    echo -e "${G}gamma${N} - Game Match-Making Allocator"
    echo ""
    echo -e "${Y}SERVICE${N}"
    echo -e "  ${C}start${N}               Start gamma service"
    echo -e "  ${C}stop${N}                Stop gamma service"
    echo -e "  ${C}restart${N}             Restart service"
    echo -e "  ${C}status${N}              Show service status"
    echo -e "  ${C}logs${N}                View logs"
    echo -e "  ${C}dashboard${N}           Open dashboard in browser"
    echo ""
    echo -e "${Y}MATCH LIFECYCLE${N}"
    echo -e "  ${C}create${N} <game>       Create a new match"
    echo -e "    ${D}--slots N${N}         Number of player slots ${D}(default: 2)${N}"
    echo -e "    ${D}--public${N}          List match in lobby"
    echo -e "  ${C}close${N} <code>        Close match ${D}(host only)${N}"
    echo ""
    echo -e "${Y}PLAYER ACTIONS${N}"
    echo -e "  ${C}join${N} <code>         Join a match"
    echo -e "  ${C}leave${N} <code>        Leave a match"
    echo ""
    echo -e "${Y}DISCOVERY${N}"
    echo -e "  ${C}list${N}                List active matches"
    echo -e "  ${C}info${N} <code>         Get match details"
    echo -e "  ${C}lobby${N} [game]        Browse public matches"
    echo ""
    echo -e "${Y}EXAMPLES${N}"
    echo -e "  ${D}gamma create trax${N}              ${D}# 2-player match${N}"
    echo -e "  ${D}gamma create magnetar --slots 4${N} ${D}# 4-player match${N}"
    echo -e "  ${D}gamma join XKCD${N}                ${D}# Join by code${N}"
    echo ""
    echo -e "${Y}DASHBOARD${N}"
    echo -e "  ${D}http://localhost:$GAMMA_HTTP_PORT/${N}"
}

# Initialize
gamma_init() {
    mkdir -p "$GAMMA_DIR"
}

# Send command to gamma via Unix socket
gamma_send() {
    local cmd="$1"
    if [[ -S "$GAMMA_SOCKET" ]]; then
        echo "$cmd" | nc -U "$GAMMA_SOCKET" 2>/dev/null
    else
        echo "Error: gamma not running" >&2
        return 1
    fi
}

# Main command interface
gamma() {
    local action="${1:-}"

    if [[ -z "$action" ]]; then
        _gamma_help
        return 0
    fi

    shift || true

    case "$action" in
        # Service management
        start)
            echo "Starting gamma..."
            if tsm start --name gamma --port "$GAMMA_HTTP_PORT" \
                node "$GAMMA_SRC/gamma-api.js" --http-port "$GAMMA_HTTP_PORT" --udp-port "$GAMMA_UDP_PORT"; then
                echo "Gamma started"
                echo "  Dashboard: http://localhost:$GAMMA_HTTP_PORT/"
                echo "  UDP: :$GAMMA_UDP_PORT"
            else
                echo "Failed to start gamma" >&2
                return 1
            fi
            ;;

        stop)
            echo "Stopping gamma..."
            tsm stop gamma
            ;;

        restart)
            gamma stop
            sleep 1
            gamma start
            ;;

        status)
            if [[ -S "$GAMMA_SOCKET" ]]; then
                local result
                result=$(gamma_send '{"type":"status"}')
                echo "Gamma: running"
                echo "$result" | jq -r '"  Matches: \(.matches)\n  Created: \(.stats.matchesCreated)\n  Joined: \(.stats.playersJoined)"' 2>/dev/null || echo "$result"
            else
                echo "Gamma: not running"
                echo "  Start with: gamma start"
                return 1
            fi
            ;;

        logs)
            tsm logs gamma
            ;;

        dashboard)
            local url="http://localhost:$GAMMA_HTTP_PORT/"
            echo "Opening: $url"
            if command -v open &>/dev/null; then
                open "$url"
            elif command -v xdg-open &>/dev/null; then
                xdg-open "$url"
            else
                echo "Open in browser: $url"
            fi
            ;;

        # Match management
        create)
            local game="$1"
            local slots=2
            local is_public=false
            shift || true

            # Parse options
            while [[ $# -gt 0 ]]; do
                case "$1" in
                    --slots) slots="$2"; shift 2 ;;
                    --public) is_public=true; shift ;;
                    *) break ;;
                esac
            done

            if [[ -z "$game" ]]; then
                echo "Usage: gamma create <game> [--slots N] [--public]" >&2
                return 1
            fi

            local result
            result=$(gamma_send "{\"type\":\"create\",\"game\":\"$game\",\"slots\":$slots,\"public\":$is_public}")

            if echo "$result" | jq -e '.code' &>/dev/null; then
                local code
                code=$(echo "$result" | jq -r '.code')
                echo "Match created: $code"
                echo ""
                echo "Share this code with players:"
                echo "  gamma join $code"
                echo "  https://tetra.dev/join/$code"
                echo ""
                echo "Close with: gamma close $code"
            else
                echo "Error: $result" >&2
                return 1
            fi
            ;;

        join)
            local code="$1"
            local name="${2:-}"

            if [[ -z "$code" ]]; then
                echo "Usage: gamma join <code> [name]" >&2
                return 1
            fi

            local cmd="{\"type\":\"join\",\"code\":\"$code\""
            [[ -n "$name" ]] && cmd="${cmd},\"name\":\"$name\""
            cmd="${cmd}}"

            local result
            result=$(gamma_send "$cmd")

            if echo "$result" | jq -e '.slot' &>/dev/null; then
                local slot host
                slot=$(echo "$result" | jq -r '.slot')
                host=$(echo "$result" | jq -r '.host')
                echo "Joined match $code as $slot"
                echo "  Host: $host"
                echo ""
                echo "Leave with: gamma leave $code"
            else
                echo "Error: $result" >&2
                return 1
            fi
            ;;

        leave)
            local code="$1"
            local token="$2"

            if [[ -z "$code" ]]; then
                echo "Usage: gamma leave <code> [token]" >&2
                return 1
            fi

            # TODO: Store token from join for auto-leave
            local result
            result=$(gamma_send "{\"type\":\"leave\",\"code\":\"$code\",\"token\":\"$token\"}")
            echo "$result"
            ;;

        close)
            local code="$1"
            local token="$2"

            if [[ -z "$code" ]]; then
                echo "Usage: gamma close <code> [host-token]" >&2
                return 1
            fi

            local result
            result=$(gamma_send "{\"type\":\"close\",\"code\":\"$code\",\"token\":\"$token\"}")

            if echo "$result" | jq -e '.ok' &>/dev/null; then
                echo "Match $code closed"
            else
                echo "Error: $result" >&2
                return 1
            fi
            ;;

        list|ls)
            local result
            result=$(gamma_send '{"type":"list"}')

            if [[ "$result" == "[]" ]]; then
                echo "No active matches"
            else
                {
                    echo "CODE GAME PLAYERS EXPIRES"
                    echo "$result" | jq -r '.[] | "\(.code) \(.game) \(.playerCount)/\(.maxPlayers) \(.expires | . / 1000 | strftime("%H:%M"))"' 2>/dev/null
                } | column -t
            fi
            ;;

        info|get)
            local code="$1"
            if [[ -z "$code" ]]; then
                echo "Usage: gamma info <code>" >&2
                return 1
            fi

            curl -s "http://localhost:$GAMMA_HTTP_PORT/api/match/$code" | jq .
            ;;

        lobby)
            local game="${1:-}"
            local url="http://localhost:$GAMMA_HTTP_PORT/api/lobby"
            [[ -n "$game" ]] && url="${url}?game=$game"
            curl -s "$url" | jq .
            ;;

        # Help
        help|--help|-h)
            gamma
            ;;

        *)
            echo "Unknown command: $action" >&2
            echo "Use 'gamma help' for usage" >&2
            return 1
            ;;
    esac
}

# Initialize on source
gamma_init

# Load tab completion
[[ -f "$GAMMA_SRC/gamma_complete.sh" ]] && source "$GAMMA_SRC/gamma_complete.sh"

# Export
export -f gamma
export -f gamma_send
export -f gamma_init
