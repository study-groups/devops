#!/usr/bin/env bash

# Nginx REPL - Interactive nginx configuration and management

: "${TETRA_SRC:?TETRA_SRC must be set}"
: "${NGINX_SRC:=$TETRA_SRC/bash/nginx}"

# Source nginx functionality
source "$NGINX_SRC/nginx.sh"
source "$NGINX_SRC/nginx_helpers.sh"

# REPL state
REPL_RUNNING=true

# REPL commands
nginx_repl_help() {
    cat <<'EOF'
Nginx REPL Commands:
  config proxy <port> [name]   Configure reverse proxy
  config spaces <name> [region] Configure Spaces proxy
  test                         Test nginx configuration
  reload                       Reload nginx
  status                       Show nginx status
  logs [lines]                 Show nginx logs
  help                         Show this help
  quit                         Exit REPL
EOF
}

nginx_repl_config() {
    local type="$1"
    shift

    case "$type" in
        proxy)
            local port="$1"
            local name="${2:-localhost}"
            if [[ -z "$port" ]]; then
                echo "Error: port required"
                return 1
            fi
            nginx_config_proxy "$port" "$name"
            ;;
        spaces)
            local space_name="$1"
            local region="${2:-nyc3}"
            if [[ -z "$space_name" ]]; then
                echo "Error: space_name required"
                return 1
            fi
            nginx_config_spaces "$space_name" "$region"
            ;;
        *)
            echo "Unknown config type: $type"
            echo "Available: proxy, spaces"
            ;;
    esac
}

nginx_repl_test() {
    nginx -t
}

nginx_repl_reload() {
    if command -v brew >/dev/null 2>&1; then
        brew services reload nginx
    else
        sudo nginx -s reload
    fi
}

nginx_repl_status() {
    if command -v brew >/dev/null 2>&1; then
        brew services list | grep nginx
    else
        sudo systemctl status nginx
    fi
}

nginx_repl_logs() {
    local lines="${1:-50}"
    if [[ -f /opt/homebrew/var/log/nginx/error.log ]]; then
        tail -n "$lines" /opt/homebrew/var/log/nginx/error.log
    elif [[ -f /var/log/nginx/error.log ]]; then
        sudo tail -n "$lines" /var/log/nginx/error.log
    else
        echo "Nginx logs not found"
    fi
}

# Main REPL loop
nginx_repl() {
    echo "Nginx REPL - Type 'help' for commands, 'quit' to exit"

    while $REPL_RUNNING; do
        printf "nginx> "
        read -r -a input

        [[ ${#input[@]} -eq 0 ]] && continue

        local cmd="${input[0]}"
        local args=("${input[@]:1}")

        case "$cmd" in
            config)
                nginx_repl_config "${args[@]}"
                ;;
            test)
                nginx_repl_test
                ;;
            reload)
                nginx_repl_reload
                ;;
            status)
                nginx_repl_status
                ;;
            logs)
                nginx_repl_logs "${args[@]}"
                ;;
            help)
                nginx_repl_help
                ;;
            quit|exit)
                REPL_RUNNING=false
                ;;
            *)
                echo "Unknown command: $cmd (type 'help' for commands)"
                ;;
        esac
    done
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    nginx_repl
fi
