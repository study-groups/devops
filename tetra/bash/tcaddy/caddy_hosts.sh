#!/usr/bin/env bash
# tcaddy/caddy_hosts.sh - Local /etc/hosts management
#
# Requires: caddy.sh (core helpers), caddy_ctx.sh (context)

# =============================================================================
# LOCAL HOSTS MANAGEMENT
# =============================================================================

# Block markers for safe removal
_CADDY_HOSTS_BEGIN="# caddy-managed-begin"
_CADDY_HOSTS_END="# caddy-managed-end"

# Get local IP - try multiple interfaces
_caddy_local_ip() {
    local ip
    # macOS - try common interfaces
    for iface in en0 en1 en2 en3 en4; do
        ip=$(ipconfig getifaddr "$iface" 2>/dev/null)
        [[ -n "$ip" ]] && { echo "$ip"; return; }
    done
    # Linux fallback
    hostname -I 2>/dev/null | awk '{print $1}'
}

# _caddy_domain() is defined in caddy_ctx.sh - reads from tetra.toml

# List configured subdomains for current org
_caddy_subdomains() {
    local domain=$(_caddy_domain)
    local caddyfile="$(_caddy_config_dir)/Caddyfile"

    if [[ -f "$caddyfile" ]]; then
        # Extract subdomains from Caddyfile (case insensitive)
        grep -oiE '[a-z0-9]+\.'"$domain" "$caddyfile" 2>/dev/null | tr '[:upper:]' '[:lower:]' | sort -u
    else
        # Default subdomains
        echo "controldeck.$domain"
        echo "divgraphics.$domain"
        echo "asciivision.$domain"
    fi
}

# Generate hosts block for domain
_caddy_hosts_block() {
    local domain=$(_caddy_domain)
    local ip=$(_caddy_local_ip)

    echo "$_CADDY_HOSTS_BEGIN $domain"
    echo "$ip  $domain"
    while IFS= read -r sub; do
        echo "$ip  $sub"
    done < <(_caddy_subdomains)
    echo "$_CADDY_HOSTS_END $domain"
}

# Show current hosts entries for this domain
_caddy_hosts_list() {
    local domain=$(_caddy_domain)
    echo "=== /etc/hosts entries for *.$domain ==="
    grep -E "$domain" /etc/hosts 2>/dev/null || echo "(none)"
}

# Check if hosts are configured
_caddy_hosts_status() {
    local domain=$(_caddy_domain)
    local ip=$(_caddy_local_ip)
    local configured_ip

    echo "Domain: $domain"
    echo "Local IP: $ip"
    echo ""

    if grep -q "$_CADDY_HOSTS_BEGIN $domain" /etc/hosts 2>/dev/null; then
        configured_ip=$(grep -A1 "$_CADDY_HOSTS_BEGIN $domain" /etc/hosts | tail -1 | awk '{print $1}')
        if [[ "$configured_ip" == "$ip" ]]; then
            echo "Status: configured (current)"
        else
            echo "Status: configured (stale IP: $configured_ip)"
            echo "Run: caddy hosts update"
        fi
        echo ""
        _caddy_hosts_list
    else
        echo "Status: not configured"
        echo ""
        echo "Run: caddy hosts add"
    fi
}

# Add hosts entries
_caddy_hosts_add() {
    local domain=$(_caddy_domain)
    local ip=$(_caddy_local_ip)
    local dry_run=false

    [[ "$1" == "-n" || "$1" == "--dry-run" ]] && dry_run=true

    if [[ -z "$ip" ]]; then
        echo "Could not determine local IP" >&2
        return 1
    fi

    # Check if already added
    if grep -q "$_CADDY_HOSTS_BEGIN $domain" /etc/hosts 2>/dev/null; then
        echo "Entries for $domain already exist."
        echo "Use 'caddy hosts update' to refresh IP, or 'caddy hosts remove' first."
        return 0
    fi

    local block
    block=$(_caddy_hosts_block)

    echo "Entries to add:"
    echo "$block"
    echo ""

    if $dry_run; then
        echo "(dry-run, no changes made)"
    else
        echo "$block" | sudo tee -a /etc/hosts > /dev/null
        echo "Added to /etc/hosts"
    fi
}

# Remove hosts entries (safe block removal)
_caddy_hosts_remove() {
    local domain=$(_caddy_domain)

    if ! grep -q "$_CADDY_HOSTS_BEGIN $domain" /etc/hosts 2>/dev/null; then
        echo "No managed entries for $domain"
        return 0
    fi

    echo "Removing hosts entries for $domain"

    # Remove block between markers (inclusive)
    sudo sed -i.bak "/$_CADDY_HOSTS_BEGIN $domain/,/$_CADDY_HOSTS_END $domain/d" /etc/hosts

    echo "Removed from /etc/hosts"
}

# Update hosts (remove + add, for IP changes)
_caddy_hosts_update() {
    local domain=$(_caddy_domain)

    if ! grep -q "$_CADDY_HOSTS_BEGIN $domain" /etc/hosts 2>/dev/null; then
        echo "No existing entries, adding fresh"
        _caddy_hosts_add
        return
    fi

    echo "Updating hosts entries for $domain"
    _caddy_hosts_remove
    _caddy_hosts_add
}

# Edit hosts file directly
_caddy_hosts_edit() {
    sudo ${EDITOR:-vim} /etc/hosts
}

# Main hosts dispatcher
_caddy_hosts() {
    local cmd="${1:-status}"
    shift 2>/dev/null || true

    case "$cmd" in
        list|ls)      _caddy_hosts_list ;;
        status|s)     _caddy_hosts_status ;;
        add|a)        _caddy_hosts_add "$@" ;;
        remove|rm)    _caddy_hosts_remove ;;
        update|u)     _caddy_hosts_update ;;
        edit|e)       _caddy_hosts_edit ;;
        ip)           _caddy_local_ip ;;
        domain)       _caddy_domain ;;
        block)        _caddy_hosts_block ;;
        *)
            echo "Usage: caddy hosts <cmd>"
            echo "  status       Check configuration"
            echo "  list         Show current entries"
            echo "  add [-n]     Add entries (-n: dry-run)"
            echo "  update       Refresh IP (remove + add)"
            echo "  remove       Remove managed entries"
            echo "  edit         Edit /etc/hosts"
            echo "  ip           Show local IP"
            echo "  domain       Show domain for org"
            ;;
    esac
}

# =============================================================================
# EXPORTS
# =============================================================================

for _fn in $(declare -F | awk '$3 ~ /^_caddy_/ {print $3}'); do
    export -f "$_fn"
done
unset _fn
