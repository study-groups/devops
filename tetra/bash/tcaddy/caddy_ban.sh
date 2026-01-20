#!/usr/bin/env bash
# tcaddy/caddy_ban.sh - fail2ban monitoring commands
#
# Requires: caddy.sh (core helpers)

# =============================================================================
# FAIL2BAN MONITORING
# =============================================================================

# fail2ban service status
_caddy_ban_status() {
    echo "=== fail2ban Status ==="
    _caddy_ssh "systemctl status fail2ban --no-pager -l 2>/dev/null | head -15 || fail2ban-client status 2>/dev/null || echo 'fail2ban not found'"
}

# List all jails
_caddy_ban_jails() {
    echo "=== fail2ban Jails ==="
    _caddy_ssh "fail2ban-client status 2>/dev/null | grep -A100 'Jail list' | head -20"
}

# Show banned IPs
_caddy_ban_banned() {
    local jail="${1:-}"

    if [[ -n "$jail" ]]; then
        echo "=== Banned IPs in $jail ==="
        _caddy_ssh "fail2ban-client status $jail 2>/dev/null | grep -E 'Banned|Currently banned'"
    else
        echo "=== All Banned IPs ==="
        _caddy_ssh 'jails=$(fail2ban-client status 2>/dev/null | grep "Jail list" | sed "s/.*:\s*//" | tr -d " " | tr "," " ")
            for j in $jails; do
                count=$(fail2ban-client status "$j" 2>/dev/null | grep "Currently banned" | awk "{print \$NF}")
                [[ "$count" != "0" ]] && {
                    echo "=== $j ($count banned) ==="
                    fail2ban-client status "$j" 2>/dev/null | grep -A100 "Banned IP list"
                }
            done'
    fi
}

# Cross-reference caddy errors with fail2ban bans
_caddy_ban_match() {
    local jail="${1:-}"

    echo "=== Matching Caddy Errors to Bans ==="

    # Get banned IPs
    local banned_ips
    if [[ -n "$jail" ]]; then
        banned_ips=$(_caddy_ssh "fail2ban-client status $jail 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+'")
    else
        banned_ips=$(_caddy_ssh "fail2ban-client status 2>/dev/null | grep 'Jail list' | sed 's/.*:\s*//' | tr ',' ' ' | xargs -n1 fail2ban-client status 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+'" 2>/dev/null)
    fi

    if [[ -z "$banned_ips" ]]; then
        echo "(no banned IPs found)"
        return
    fi

    echo "Banned IPs with caddy activity:"
    for ip in $banned_ips; do
        local count
        count=$(_caddy_ssh "grep -c '$ip' /var/log/caddy/*.log 2>/dev/null | awk -F: '{s+=\$2} END {print s}'")
        [[ -n "$count" && "$count" != "0" ]] && echo "  $ip: $count requests in caddy logs"
    done
}

# Recent ban/unban activity
_caddy_ban_recent() {
    local n="${1:-20}"

    echo "=== Recent fail2ban Activity (last $n) ==="
    _caddy_ssh "grep -E 'Ban|Unban' /var/log/fail2ban.log 2>/dev/null | tail -n $n" || \
    _caddy_ssh "journalctl -u fail2ban --no-pager -n $n 2>/dev/null | grep -E 'Ban|Unban'" || \
    echo "(no fail2ban logs found)"
}

# =============================================================================
# EXPORTS
# =============================================================================

for _fn in $(declare -F | awk '$3 ~ /^_caddy_ban/ {print $3}'); do
    export -f "$_fn"
done
unset _fn
