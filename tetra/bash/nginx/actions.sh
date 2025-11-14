#!/usr/bin/env bash
# Nginx Module TCS-Compliant Actions
# Follows Tetra Module Convention 2.0 and TCS 3.0

# Import nginx functionality
: "${NGINX_SRC:=$TETRA_SRC/bash/nginx}"
source "$NGINX_SRC/nginx.sh" 2>/dev/null || true

# Register nginx actions with TUI
nginx_register_actions() {
    # Ensure declare_action exists
    if ! declare -f declare_action >/dev/null 2>&1; then
        echo "Warning: declare_action not available" >&2
        return 1
    fi

    # Configure reverse proxy
    declare_action "config_proxy" \
        "verb=config" \
        "noun=proxy" \
        "exec_at=@local" \
        "contexts=Local" \
        "modes=Configure" \
        "tes_operation=local" \
        "inputs=upstream_port,server_name" \
        "output=@tui[status]" \
        "effects=@nginx[config/updated]" \
        "immediate=false" \
        "can=Configure nginx reverse proxy for local services" \
        "cannot=Modify upstream services"

    # Configure Spaces proxy
    declare_action "config_spaces" \
        "verb=config" \
        "noun=spaces" \
        "exec_at=@local" \
        "contexts=Local" \
        "modes=Configure" \
        "tes_operation=local" \
        "inputs=space_name,region" \
        "output=@tui[status]" \
        "effects=@nginx[config/updated]" \
        "immediate=false" \
        "can=Configure DigitalOcean Spaces proxy" \
        "cannot=Create or delete spaces"

    # Test configuration
    declare_action "test_config" \
        "verb=test" \
        "noun=config" \
        "exec_at=@local" \
        "contexts=Local" \
        "modes=Inspect" \
        "tes_operation=local" \
        "output=@tui[content]" \
        "immediate=true" \
        "can=Test nginx configuration syntax" \
        "cannot=Apply configuration changes"

    # Reload service
    declare_action "reload_service" \
        "verb=reload" \
        "noun=service" \
        "exec_at=@local" \
        "contexts=Local" \
        "modes=Execute" \
        "tes_operation=local" \
        "output=@tui[status]" \
        "effects=@nginx[service/reloaded]" \
        "immediate=true" \
        "can=Reload nginx configuration without downtime" \
        "cannot=Start or stop nginx"
}

# Execute nginx actions
nginx_execute_action() {
    local action="$1"
    shift
    local args=("$@")

    case "$action" in
        config:proxy)
            local upstream_port="${args[0]}"
            local server_name="${args[1]:-localhost}"

            if [[ -z "$upstream_port" ]]; then
                echo "Error: upstream_port required"
                return 1
            fi

            nginx_config_proxy "$upstream_port" "$server_name"
            ;;

        config:spaces)
            local space_name="${args[0]}"
            local region="${args[1]:-nyc3}"

            if [[ -z "$space_name" ]]; then
                echo "Error: space_name required"
                return 1
            fi

            nginx_config_spaces "$space_name" "$region"
            ;;

        test:config)
            nginx -t
            ;;

        reload:service)
            if command -v brew >/dev/null 2>&1; then
                brew services reload nginx
            else
                sudo nginx -s reload
            fi
            ;;

        *)
            echo "Unknown action: $action"
            return 1
            ;;
    esac
}

export -f nginx_register_actions
export -f nginx_execute_action
