#!/usr/bin/env bash
# nh_do_dns.sh - DigitalOcean DNS management via doctl
#
# Manages DNS records for domains hosted on DigitalOcean.
# Mirrors the nh_cf.sh interface for consistency.
#
# Usage:
#   nh dns domains           List domains
#   nh dns records <domain>  List DNS records
#   nh dns add <fqdn> <ip>   Add A record
#   nh dns remove <fqdn>     Remove A record
#   nh dns update <fqdn> <ip> Update A record

# =============================================================================
# HELPERS
# =============================================================================

# Extract domain and subdomain from FQDN
# docs.pixeljamarcade.com -> domain=pixeljamarcade.com, subdomain=docs
_dns_parse_fqdn() {
    local fqdn="$1"
    local parts
    IFS='.' read -ra parts <<< "$fqdn"
    local len=${#parts[@]}

    if [[ $len -lt 2 ]]; then
        echo "Invalid FQDN: $fqdn" >&2
        return 1
    fi

    # Domain is last two parts
    DNS_DOMAIN="${parts[$((len-2))]}.${parts[$((len-1))]}"

    # Subdomain is everything before
    if [[ $len -eq 2 ]]; then
        DNS_SUBDOMAIN="@"
    else
        DNS_SUBDOMAIN=""
        for ((i=0; i<len-2; i++)); do
            [[ -n "$DNS_SUBDOMAIN" ]] && DNS_SUBDOMAIN+="."
            DNS_SUBDOMAIN+="${parts[$i]}"
        done
    fi
}

# Get record ID by name and type
_dns_get_record_id() {
    local domain="$1"
    local name="$2"
    local type="${3:-A}"

    doctl compute domain records list "$domain" \
        --format ID,Type,Name \
        --no-header 2>/dev/null | \
        awk -v name="$name" -v type="$type" '$2==type && $3==name {print $1}'
}

# =============================================================================
# COMMANDS
# =============================================================================

# List all domains
nh_dns_domains() {
    echo "Domains:"
    doctl compute domain list --format Domain,TTL --no-header 2>/dev/null | while read -r domain ttl; do
        echo "  $domain (ttl: $ttl)"
    done
}

# List records for a domain
nh_dns_records() {
    local domain="$1"

    if [[ -z "$domain" ]]; then
        echo "Usage: nh dns records <domain>"
        echo ""
        echo "Available domains:"
        nh_dns_domains
        return 1
    fi

    echo "DNS Records for $domain:"
    printf "  %-8s %-25s %s\n" "TYPE" "NAME" "DATA"
    printf "  %-8s %-25s %s\n" "----" "----" "----"

    doctl compute domain records list "$domain" \
        --format Type,Name,Data \
        --no-header 2>/dev/null | while read -r type name data; do
        printf "  %-8s %-25s %s\n" "$type" "$name" "$data"
    done
}

# Add A record
nh_dns_add() {
    local fqdn="$1"
    local ip="$2"
    local ttl="${3:-600}"

    if [[ -z "$fqdn" || -z "$ip" ]]; then
        echo "Usage: nh dns add <fqdn> <ip> [ttl]"
        echo "Example: nh dns add docs.pixeljamarcade.com 164.90.247.44"
        return 1
    fi

    # Validate IP format
    if ! [[ "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        echo "Invalid IP address: $ip"
        return 1
    fi

    # Parse FQDN
    _dns_parse_fqdn "$fqdn" || return 1

    echo "Adding DNS record:"
    echo "  Domain:    $DNS_DOMAIN"
    echo "  Name:      $DNS_SUBDOMAIN"
    echo "  Type:      A"
    echo "  Data:      $ip"
    echo "  TTL:       $ttl"
    echo ""

    # Check if record exists
    local existing=$(_dns_get_record_id "$DNS_DOMAIN" "$DNS_SUBDOMAIN" "A")
    if [[ -n "$existing" ]]; then
        echo "Record already exists (ID: $existing)"
        echo "Use 'nh dns update $fqdn $ip' to update"
        return 1
    fi

    # Create record
    local result=$(doctl compute domain records create "$DNS_DOMAIN" \
        --record-type A \
        --record-name "$DNS_SUBDOMAIN" \
        --record-data "$ip" \
        --record-ttl "$ttl" \
        --format ID,Name,Data \
        --no-header 2>&1)

    if [[ $? -eq 0 ]]; then
        echo "Success!"
        echo "  $result"
    else
        echo "Failed: $result"
        return 1
    fi
}

# Remove A record
nh_dns_remove() {
    local fqdn="$1"

    if [[ -z "$fqdn" ]]; then
        echo "Usage: nh dns remove <fqdn>"
        return 1
    fi

    _dns_parse_fqdn "$fqdn" || return 1

    local record_id=$(_dns_get_record_id "$DNS_DOMAIN" "$DNS_SUBDOMAIN" "A")

    if [[ -z "$record_id" ]]; then
        echo "Record not found: $fqdn"
        return 1
    fi

    echo "Removing DNS record:"
    echo "  Domain:    $DNS_DOMAIN"
    echo "  Name:      $DNS_SUBDOMAIN"
    echo "  Record ID: $record_id"
    echo ""

    doctl compute domain records delete "$DNS_DOMAIN" "$record_id" --force

    if [[ $? -eq 0 ]]; then
        echo "Removed."
    else
        echo "Failed to remove record"
        return 1
    fi
}

# Update A record
nh_dns_update() {
    local fqdn="$1"
    local ip="$2"

    if [[ -z "$fqdn" || -z "$ip" ]]; then
        echo "Usage: nh dns update <fqdn> <ip>"
        return 1
    fi

    # Validate IP format
    if ! [[ "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        echo "Invalid IP address: $ip"
        return 1
    fi

    _dns_parse_fqdn "$fqdn" || return 1

    local record_id=$(_dns_get_record_id "$DNS_DOMAIN" "$DNS_SUBDOMAIN" "A")

    if [[ -z "$record_id" ]]; then
        echo "Record not found: $fqdn"
        echo "Use 'nh dns add $fqdn $ip' to create"
        return 1
    fi

    echo "Updating DNS record:"
    echo "  Domain:    $DNS_DOMAIN"
    echo "  Name:      $DNS_SUBDOMAIN"
    echo "  Record ID: $record_id"
    echo "  New IP:    $ip"
    echo ""

    doctl compute domain records update "$DNS_DOMAIN" "$record_id" \
        --record-data "$ip" \
        --format ID,Name,Data \
        --no-header

    if [[ $? -eq 0 ]]; then
        echo "Updated."
    else
        echo "Failed to update record"
        return 1
    fi
}

# Show record details
nh_dns_show() {
    local fqdn="$1"

    if [[ -z "$fqdn" ]]; then
        echo "Usage: nh dns show <fqdn>"
        return 1
    fi

    _dns_parse_fqdn "$fqdn" || return 1

    echo "Looking up: $fqdn"
    echo "  Domain:    $DNS_DOMAIN"
    echo "  Subdomain: $DNS_SUBDOMAIN"
    echo ""

    local record_id=$(_dns_get_record_id "$DNS_DOMAIN" "$DNS_SUBDOMAIN" "A")

    if [[ -n "$record_id" ]]; then
        echo "Record found:"
        doctl compute domain records list "$DNS_DOMAIN" \
            --format ID,Type,Name,Data,TTL \
            --no-header 2>/dev/null | grep "^$record_id"
    else
        echo "No A record found for $DNS_SUBDOMAIN"

        # Check if wildcard would match
        local wildcard=$(_dns_get_record_id "$DNS_DOMAIN" "*" "A")
        if [[ -n "$wildcard" ]]; then
            echo ""
            echo "Note: Wildcard record exists:"
            doctl compute domain records list "$DNS_DOMAIN" \
                --format ID,Type,Name,Data,TTL \
                --no-header 2>/dev/null | grep "^$wildcard"
        fi
    fi
}

# =============================================================================
# MAIN DISPATCHER
# =============================================================================

nh_dns() {
    local cmd="${1:-}"
    shift 2>/dev/null || true

    case "$cmd" in
        domains|dom|d)
            nh_dns_domains
            ;;
        records|rec|r)
            nh_dns_records "$@"
            ;;
        add|a)
            nh_dns_add "$@"
            ;;
        remove|rm|del)
            nh_dns_remove "$@"
            ;;
        update|up|u)
            nh_dns_update "$@"
            ;;
        show|s)
            nh_dns_show "$@"
            ;;
        help|h|"")
            nh_dns_help
            ;;
        *)
            echo "Unknown dns command: $cmd"
            nh_dns_help
            return 1
            ;;
    esac
}

nh_dns_help() {
    cat << 'EOF'
nh dns - DigitalOcean DNS management

USAGE: nh dns <command> [args]

COMMANDS
    domains             List all domains
    records <domain>    List DNS records for domain
    show <fqdn>         Show record details (checks wildcard)
    add <fqdn> <ip>     Add A record
    remove <fqdn>       Remove A record
    update <fqdn> <ip>  Update existing A record

EXAMPLES
    nh dns domains
    nh dns records pixeljamarcade.com
    nh dns show docs.pixeljamarcade.com
    nh dns add docs.pixeljamarcade.com 164.90.247.44
    nh dns update docs.pixeljamarcade.com 164.90.247.44
    nh dns remove docs.pixeljamarcade.com

NOTES
    - Requires doctl authenticated: doctl auth init
    - FQDN is parsed: docs.example.com → domain=example.com, name=docs
    - Default TTL is 600 seconds
    - Use floating IPs for failover flexibility

SEE ALSO
    nh cf    Cloudflare DNS (for domains on Cloudflare)
    nh doctor dns    Validate DNS alignment with floating IPs
EOF
}

# Export functions
export -f nh_dns nh_dns_domains nh_dns_records nh_dns_add nh_dns_remove nh_dns_update nh_dns_show nh_dns_help
export -f _dns_parse_fqdn _dns_get_record_id
