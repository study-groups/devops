#!/usr/bin/env bash
# tcaddy/caddy_route.sh - Route and certificate commands
#
# Requires: caddy.sh (core helpers)

# =============================================================================
# ROUTES COMMANDS
# =============================================================================

# List all routes/sites
_caddy_routes() {
    echo "=== Configured Sites ==="
    _caddy_ssh "grep -E '^[a-zA-Z].*\{' /etc/caddy/Caddyfile | sed 's/ {//'"
}

# Show upstream backends
_caddy_upstreams() {
    echo "=== Upstream Backends ==="
    _caddy_ssh "grep -E 'reverse_proxy|proxy_pass' /etc/caddy/Caddyfile | sed 's/^[ \t]*//'"
}

# =============================================================================
# CERTS COMMANDS
# =============================================================================

# Show certificate info
_caddy_certs() {
    local site=$(_caddy_site)
    local host=$(_caddy_host)
    local domain

    # Determine domain to check
    if [[ -n "$site" && "$site" != "main" ]]; then
        domain="${site}.${host}.pixeljamarcade.com"
    else
        domain="${host}.pixeljamarcade.com"
    fi

    echo "=== Certificate: $domain ==="

    # Check via openssl
    echo | timeout 5 openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null | \
        openssl x509 -noout -dates -subject -issuer 2>/dev/null || \
        echo "Could not retrieve certificate info"
}

# List all managed certs
_caddy_certs_list() {
    echo "=== Managed Certificates ==="
    _caddy_ssh "ls -la /var/lib/caddy/.local/share/caddy/certificates/ 2>/dev/null || echo 'No certs found'"
}

# =============================================================================
# EXPORTS
# =============================================================================

for _fn in $(declare -F | awk '$3 ~ /^_caddy_/ {print $3}'); do
    export -f "$_fn"
done
unset _fn
