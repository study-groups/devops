#!/usr/bin/env bash
# tcaddy/caddy_api.sh - Native Caddy Admin API helpers
#
# Caddy Admin API runs on localhost:2019 by default
# https://caddyserver.com/docs/api
#
# Requires: curl, jq

# =============================================================================
# CONFIGURATION
# =============================================================================

CADDY_ADMIN_PORT="${CADDY_ADMIN_PORT:-2019}"
CADDY_ADMIN_TIMEOUT="${CADDY_ADMIN_TIMEOUT:-5}"

# =============================================================================
# CORE API HELPERS
# =============================================================================

# Get admin API base URL for current context
_caddy_api_url() {
    local target=$(_caddy_ssh_target)

    if [[ "$target" == "localhost" ]]; then
        echo "http://localhost:${CADDY_ADMIN_PORT}"
    else
        # For remote, we'll SSH tunnel or use SSH + curl
        echo "http://localhost:${CADDY_ADMIN_PORT}"
    fi
}

# Query Caddy admin API (local)
# Usage: _caddy_api_get "config/apps/http"
_caddy_api_get() {
    local endpoint="${1:-}"
    local url="$(_caddy_api_url)/${endpoint}"

    curl -sf --max-time "$CADDY_ADMIN_TIMEOUT" "$url" 2>/dev/null
}

# Query Caddy admin API (remote via SSH)
# Usage: _caddy_api_remote "config/"
_caddy_api_remote() {
    local endpoint="${1:-}"
    local target=$(_caddy_ssh_target)

    if [[ "$target" == "localhost" ]]; then
        _caddy_api_get "$endpoint"
    else
        ssh -o ConnectTimeout=5 "$target" \
            "curl -sf --max-time $CADDY_ADMIN_TIMEOUT http://localhost:${CADDY_ADMIN_PORT}/${endpoint}" 2>/dev/null
    fi
}

# Universal API query - routes to local or remote
_caddy_api() {
    local endpoint="${1:-}"

    if _caddy_is_local; then
        _caddy_api_get "$endpoint"
    else
        _caddy_api_remote "$endpoint"
    fi
}

# POST to Caddy admin API
_caddy_api_post() {
    local endpoint="${1:-}"
    local data="${2:-}"
    local url="$(_caddy_api_url)/${endpoint}"

    if _caddy_is_local; then
        curl -sf --max-time "$CADDY_ADMIN_TIMEOUT" \
            -X POST \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$url" 2>/dev/null
    else
        local target=$(_caddy_ssh_target)
        ssh -o ConnectTimeout=5 "$target" \
            "curl -sf --max-time $CADDY_ADMIN_TIMEOUT -X POST -H 'Content-Type: application/json' -d '$data' http://localhost:${CADDY_ADMIN_PORT}/${endpoint}" 2>/dev/null
    fi
}

# =============================================================================
# STATUS & HEALTH
# =============================================================================

# Check if Caddy admin API is responding
_caddy_api_ping() {
    local response
    response=$(_caddy_api "config/")

    if [[ -n "$response" ]]; then
        echo "Caddy admin API responding on port $CADDY_ADMIN_PORT"
        return 0
    else
        echo "Caddy admin API not responding"
        return 1
    fi
}

# Test connectivity to current context (local or remote)
_caddy_api_test() {
    local target=$(_caddy_ssh_target)
    local env=$(_caddy_env)

    echo "=== Caddy API Connectivity Test ==="
    echo "Context: $(_caddy_org):$(_caddy_proj):$env"
    echo "Target: $target"
    echo ""

    if [[ "$target" == "localhost" ]]; then
        echo "Testing local Caddy API..."
        if curl -sf --max-time 3 "http://localhost:${CADDY_ADMIN_PORT}/config/" &>/dev/null; then
            echo "✓ Admin API responding on localhost:${CADDY_ADMIN_PORT}"
            echo ""
            echo "Config apps:"
            curl -sf "http://localhost:${CADDY_ADMIN_PORT}/config/" | jq -r '.apps | keys | .[]' 2>/dev/null | sed 's/^/  /'
        else
            echo "✗ Admin API not responding"
            echo ""
            echo "Is Caddy running? Try:"
            echo "  caddy run --config \$TETRA_DIR/orgs/\$ORG/caddy/Caddyfile"
        fi
    else
        echo "Testing SSH connection..."
        if ssh -o ConnectTimeout=5 -o BatchMode=yes "$target" "echo ok" &>/dev/null; then
            echo "✓ SSH connection OK"
            echo ""

            echo "Testing remote Caddy API..."
            local api_response
            api_response=$(ssh -o ConnectTimeout=5 "$target" \
                "curl -sf --max-time 3 http://localhost:${CADDY_ADMIN_PORT}/config/" 2>/dev/null)

            if [[ -n "$api_response" ]]; then
                echo "✓ Remote admin API responding"
                echo ""
                echo "Config apps:"
                echo "$api_response" | jq -r '.apps | keys | .[]' 2>/dev/null | sed 's/^/  /'
            else
                echo "✗ Remote admin API not responding"
                echo ""
                echo "Checking systemd..."
                ssh "$target" "systemctl is-active caddy 2>/dev/null || echo 'not running'"
            fi
        else
            echo "✗ SSH connection failed"
            echo ""
            echo "Check:"
            echo "  - SSH key authentication"
            echo "  - Host reachable: ping ${target#*@}"
            echo "  - tetra.toml [env.$env] config"
        fi
    fi
}

# Get Caddy status via admin API
_caddy_api_status() {
    local config
    config=$(_caddy_api "config/")

    if [[ -z "$config" ]]; then
        echo "status: offline"
        echo "admin_api: not responding"
        return 1
    fi

    echo "status: online"
    echo "admin_api: localhost:$CADDY_ADMIN_PORT"

    # Extract some useful info
    local apps
    apps=$(echo "$config" | jq -r '.apps | keys | join(", ")' 2>/dev/null)
    [[ -n "$apps" ]] && echo "apps: $apps"

    # Count HTTP servers
    local servers
    servers=$(echo "$config" | jq -r '.apps.http.servers | keys | length' 2>/dev/null)
    [[ -n "$servers" ]] && echo "http_servers: $servers"
}

# =============================================================================
# CONFIGURATION
# =============================================================================

# Get full config as JSON
_caddy_api_config() {
    _caddy_api "config/" | jq .
}

# Get specific config path
# Usage: _caddy_api_config_get "apps/http/servers"
_caddy_api_config_get() {
    local path="${1:-}"
    _caddy_api "config/${path}" | jq .
}

# Get HTTP server configuration
_caddy_api_servers() {
    _caddy_api "config/apps/http/servers" | jq .
}

# Get routes from all HTTP servers
_caddy_api_routes() {
    local servers
    servers=$(_caddy_api "config/apps/http/servers")

    if [[ -z "$servers" ]]; then
        echo "(no servers configured)"
        return
    fi

    echo "$servers" | jq -r '
        to_entries[] |
        .key as $server |
        .value.routes[]? |
        {
            server: $server,
            match: (.match // [{}])[0],
            handle: (.handle // [])[0].handler
        }
    ' 2>/dev/null
}

# Get reverse proxy upstreams
_caddy_api_upstreams() {
    _caddy_api "reverse_proxy/upstreams" | jq . 2>/dev/null || echo "(no upstreams or endpoint not available)"
}

# =============================================================================
# DYNAMIC CONFIG UPDATES
# =============================================================================

# Load new config from JSON
_caddy_api_load() {
    local config_file="${1:-}"

    if [[ -z "$config_file" ]]; then
        echo "Usage: _caddy_api_load <config.json>" >&2
        return 1
    fi

    if [[ ! -f "$config_file" ]]; then
        echo "Config file not found: $config_file" >&2
        return 1
    fi

    local response
    response=$(_caddy_api_post "load" "$(cat "$config_file")")

    if [[ $? -eq 0 ]]; then
        echo "Config loaded successfully"
    else
        echo "Failed to load config"
        return 1
    fi
}

# Reload config from Caddyfile (converts and loads)
_caddy_api_reload() {
    local caddyfile=$(_caddy_caddyfile_path)

    echo "Reloading from: $caddyfile"

    if _caddy_is_local; then
        # Use caddy adapt to convert Caddyfile to JSON, then load via API
        local json_config
        json_config=$(caddy adapt --config "$caddyfile" 2>/dev/null)

        if [[ -z "$json_config" ]]; then
            echo "Failed to adapt Caddyfile" >&2
            return 1
        fi

        local url="$(_caddy_api_url)/load"
        local response
        response=$(curl -sf --max-time 10 \
            -X POST \
            -H "Content-Type: application/json" \
            -d "$json_config" \
            "$url" 2>&1)

        if [[ $? -eq 0 ]]; then
            echo "Config reloaded successfully"
        else
            echo "Failed to reload: $response" >&2
            return 1
        fi
    else
        # Remote: use caddy reload command
        _caddy_ssh "caddy reload --config /etc/caddy/Caddyfile"
    fi
}

# =============================================================================
# LOGGING (via API where available)
# =============================================================================

# Note: Caddy's admin API doesn't serve logs directly
# Logs are configured in Caddyfile and written to files/stdout
# These helpers check log configuration

_caddy_api_log_config() {
    local config
    config=$(_caddy_api "config/logging")

    if [[ -z "$config" || "$config" == "null" ]]; then
        echo "(logging not configured via API - check Caddyfile)"
        return
    fi

    echo "$config" | jq .
}

# =============================================================================
# EXPORTS
# =============================================================================

for _fn in $(declare -F | awk '$3 ~ /^_caddy_api/ {print $3}'); do
    export -f "$_fn"
done
unset _fn
