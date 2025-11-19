#!/usr/bin/env bash

# Hotrod Module - SSH Tunnel and Application Management
# Manages reverse SSH tunnels and PM2-based application lifecycle

# Global check
if [[ -z "$TETRA_SRC" ]]; then
    echo "Error: TETRA_SRC must be set" >&2
    return 1
fi

# Module paths
export HOTROD_SRC="${HOTROD_SRC:-$TETRA_SRC/bash/hotrod}"
export MOD_SRC="$HOTROD_SRC"

# Runtime directories
export TETRA_DIR="${TETRA_DIR:-$HOME/tetra}"
export HOTROD_DIR="$TETRA_DIR/hotrod"
export HOTROD_LOGS_DIR="$HOTROD_DIR/logs"

# Ensure runtime directories exist
mkdir -p "$HOTROD_LOGS_DIR"

# Tunnel defaults
export HOTROD_REMOTE_USER="${TETRA_REMOTE_USER:-devops}"
export HOTROD_REMOTE_HOST="${TETRA_REMOTE:-ssh.nodeholder.com}"

# Dependencies check
if ! command -v jq >/dev/null 2>&1; then
    echo "Warning: hotrod requires jq but it's not installed" >&2
fi

if ! command -v autossh >/dev/null 2>&1; then
    echo "Warning: hotrod requires autossh but it's not installed" >&2
fi

if ! command -v pm2 >/dev/null 2>&1; then
    echo "Warning: hotrod requires pm2 but it's not installed" >&2
fi

# Source core functions
source "$HOTROD_SRC/lib/tunnel_manager.sh"
source "$HOTROD_SRC/lib/app_manager.sh"

# Main hotrod command dispatcher
hotrod() {
    local action="$1"
    shift

    case "$action" in
        add)
            hotrod_add_app "$@"
            ;;
        rm|remove)
            hotrod_remove_app "$@"
            ;;
        list|ls)
            hotrod_list_apps
            ;;
        tunnel)
            hotrod_tunnel_cmd "$@"
            ;;
        status)
            hotrod_status "$@"
            ;;
        help|--help|-h)
            hotrod_usage
            ;;
        *)
            echo "Unknown command: $action"
            hotrod_usage
            return 1
            ;;
    esac
}

hotrod_usage() {
    cat << 'EOF'
Hotrod - SSH Tunnel & Application Manager

USAGE:
    hotrod add <port> <appname> <entrypoint>  Add new app with tunnel
    hotrod rm <port>                          Remove app and tunnel
    hotrod list                               List running apps
    hotrod tunnel start <port>                Start tunnel only
    hotrod tunnel stop <port>                 Stop tunnel only
    hotrod status [port]                      Show status

EXAMPLES:
    hotrod add 9000 clipboard ~/scripts/clipboard.sh
    hotrod list
    hotrod rm 9000

ENVIRONMENT:
    TETRA_REMOTE_USER    SSH user (default: devops)
    TETRA_REMOTE         SSH host (default: ssh.nodeholder.com)
    TETRA_DIR            Runtime directory (default: ~/tetra)

FILES:
    $HOTROD_DIR/logs/    Autossh logs

TUNNEL PATTERN:
    Creates reverse SSH tunnel: remote:PORT -> localhost:PORT
    Managed via PM2 with auto-restart capabilities
EOF
}
