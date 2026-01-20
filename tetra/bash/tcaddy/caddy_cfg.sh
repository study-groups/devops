#!/usr/bin/env bash
# tcaddy/caddy_cfg.sh - Configuration commands
#
# Requires: caddy.sh (core helpers), caddy_api.sh (admin API)

# =============================================================================
# CONFIG COMMANDS
# =============================================================================

# Show config (Caddyfile or JSON from API)
# Usage: _caddy_config [--json]
_caddy_config() {
    local format="${1:-file}"
    local caddyfile=$(_caddy_caddyfile_path)
    local target=$(_caddy_ssh_target)

    # JSON format from admin API
    if [[ "$format" == "--json" || "$format" == "-j" ]]; then
        echo "=== Running Config (from admin API) ==="
        local config
        config=$(_caddy_api "config/")
        if [[ -n "$config" ]]; then
            echo "$config" | jq .
        else
            echo "(admin API not responding)"
        fi
        return
    fi

    # File format (Caddyfile)
    local site=$(_caddy_site)
    if [[ -n "$site" ]]; then
        # Show just the site block
        echo "=== $site config ==="
        if [[ "$target" == "localhost" ]]; then
            cat "$caddyfile" 2>/dev/null
        else
            _caddy_ssh "cat $caddyfile"
        fi | awk -v site="$site" '
            $0 ~ site"\\." { found=1 }
            found { print }
            found && /^}$/ { found=0 }
        '
    else
        # Show full config
        echo "=== Caddyfile ($caddyfile) ==="
        if [[ "$target" == "localhost" ]]; then
            cat "$caddyfile" 2>/dev/null || echo "(file not found)"
        else
            _caddy_ssh "cat $caddyfile"
        fi
    fi
}

# Validate config
_caddy_validate() {
    local caddyfile=$(_caddy_caddyfile_path)
    local target=$(_caddy_ssh_target)

    echo "=== Validating $caddyfile ==="
    if [[ "$target" == "localhost" ]]; then
        caddy validate --config "$caddyfile" 2>&1
    else
        _caddy_ssh "caddy validate --config $caddyfile" 2>&1
    fi
}

# Reload caddy (via admin API for local)
_caddy_reload() {
    local caddyfile=$(_caddy_caddyfile_path)
    local target=$(_caddy_ssh_target)

    echo "=== Reloading Caddy ==="

    if [[ "$target" == "localhost" ]]; then
        # Try admin API first (preferred method)
        if _caddy_api "config/" &>/dev/null; then
            echo "Using admin API to reload..."

            # Convert Caddyfile to JSON and POST to /load
            local json_config
            json_config=$(caddy adapt --config "$caddyfile" 2>/dev/null)

            if [[ -z "$json_config" ]]; then
                echo "Failed to adapt Caddyfile" >&2
                return 1
            fi

            local response
            response=$(curl -sf --max-time 10 \
                -X POST \
                -H "Content-Type: application/json" \
                -d "$json_config" \
                "http://localhost:${CADDY_ADMIN_PORT:-2019}/load" 2>&1)

            if [[ $? -eq 0 ]]; then
                echo "Config reloaded via admin API"
            else
                echo "Failed: $response" >&2
                return 1
            fi
        else
            # Fallback to signal
            if pgrep -f "caddy run" &>/dev/null; then
                caddy reload --config "$caddyfile" 2>&1 || \
                    (pkill -USR1 -f "caddy run" && echo "Reload signal sent")
            else
                echo "Caddy not running locally"
                return 1
            fi
        fi
    else
        _caddy_ssh "systemctl reload caddy && systemctl status caddy --no-pager" | head -15
    fi
}

# Format Caddyfile
_caddy_fmt() {
    local caddyfile=$(_caddy_caddyfile_path)
    local target=$(_caddy_ssh_target)

    echo "=== Formatting $caddyfile ==="
    if [[ "$target" == "localhost" ]]; then
        caddy fmt --overwrite "$caddyfile" && echo "Formatted."
    else
        _caddy_ssh "caddy fmt --overwrite $caddyfile && echo 'Formatted.'"
    fi
}

# =============================================================================
# DEPLOY COMMAND
# =============================================================================

# Deploy Caddyfile from local to remote
_caddy_deploy() {
    local caddyfile="${1:-$PWD/Caddyfile}"
    local target
    target=$(_caddy_ssh_target)

    if [[ ! -f "$caddyfile" ]]; then
        echo "Caddyfile not found: $caddyfile" >&2
        return 1
    fi

    if [[ "$target" == "localhost" ]]; then
        echo "Cannot deploy to localhost" >&2
        return 1
    fi

    echo "=== Deploying to $target ==="

    # Validate locally first
    if command -v caddy &>/dev/null; then
        echo "Validating locally..."
        caddy validate --config "$caddyfile" || return 1
    fi

    # Deploy
    echo "Copying Caddyfile..."
    scp "$caddyfile" "$target:/etc/caddy/Caddyfile"

    # Validate on remote
    echo "Validating on remote..."
    _caddy_ssh "caddy validate --config /etc/caddy/Caddyfile" || return 1

    # Reload
    echo "Reloading..."
    _caddy_ssh "systemctl reload caddy"

    echo "Deployed successfully"
}

# =============================================================================
# EXPORTS
# =============================================================================

for _fn in $(declare -F | awk '$3 ~ /^_caddy_/ {print $3}'); do
    export -f "$_fn"
done
unset _fn
