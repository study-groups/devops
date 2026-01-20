#!/usr/bin/env bash
# dns_remote.sh - Execute DNS commands via SSH to whitelisted server
#
# Reseller Club requires IP whitelisting. Rather than constantly updating
# the whitelist, route API calls through a server that's already whitelisted.
#
# Usage:
#   dns remote rc list transrealstudio.com
#   dns remote rc google-sites transrealstudio.com www
#
# Config:
#   DNS_REMOTE_HOST - SSH host (default: nodeholder prod)
#   DNS_REMOTE_USER - SSH user (default: root)

# Default to nodeholder prod (already whitelisted at RC)
DNS_REMOTE_HOST="${DNS_REMOTE_HOST:-165.227.6.221}"
DNS_REMOTE_USER="${DNS_REMOTE_USER:-root}"

dns_remote() {
    local provider="${1:-}"
    shift 2>/dev/null || true

    if [[ -z "$provider" ]]; then
        echo ""
        echo "dns remote - Execute DNS commands via whitelisted server"
        echo ""
        echo "Usage: dns remote <provider> <command> [args...]"
        echo ""
        echo "Examples:"
        echo "  dns remote rc list transrealstudio.com"
        echo "  dns remote rc google-sites transrealstudio.com www"
        echo "  dns remote rc add transrealstudio.com CNAME www ghs.googlehosted.com"
        echo ""
        echo "Config:"
        echo "  DNS_REMOTE_HOST=$DNS_REMOTE_HOST"
        echo "  DNS_REMOTE_USER=$DNS_REMOTE_USER"
        echo ""
        return 1
    fi

    # Check we have credentials to pass
    if [[ -z "$RC_AUTH_USERID" || -z "$RC_API_KEY" ]]; then
        echo "Load credentials first: source \$TETRA_DIR/orgs/<org>/secrets.env"
        return 1
    fi

    echo "Executing via ${DNS_REMOTE_USER}@${DNS_REMOTE_HOST}..."
    echo ""

    # Build the remote command
    # Pass credentials as env vars, execute curl directly
    local cmd="$*"
    local domain=""
    local rc_cmd=""

    # Parse the command to build appropriate curl
    case "$1" in
        list)
            domain="$2"
            _dns_remote_rc_list "$domain"
            ;;
        google-sites|gsites)
            domain="$2"
            local subdomain="${3:-www}"
            _dns_remote_rc_add "$domain" "CNAME" "$subdomain" "ghs.googlehosted.com"
            ;;
        add)
            domain="$2"
            local type="$3"
            local host="$4"
            local value="$5"
            _dns_remote_rc_add "$domain" "$type" "$host" "$value"
            ;;
        *)
            echo "Supported remote commands: list, google-sites, add"
            return 1
            ;;
    esac
}

_dns_remote_rc_list() {
    local domain="$1"

    # Get order ID first
    local order_id
    order_id=$(ssh -o ConnectTimeout=10 "${DNS_REMOTE_USER}@${DNS_REMOTE_HOST}" \
        "curl -s 'https://httpapi.com/api/domains/orderid.json?auth-userid=${RC_AUTH_USERID}&api-key=${RC_API_KEY}&domain-name=${domain}'" 2>/dev/null)

    if [[ ! "$order_id" =~ ^[0-9]+$ ]]; then
        echo "Could not get order ID for $domain"
        echo "Response: $order_id"
        return 1
    fi

    echo "Domain: $domain (order: $order_id)"
    echo ""

    # Get records for each type
    for type in A CNAME MX TXT; do
        local records
        records=$(ssh -o ConnectTimeout=10 "${DNS_REMOTE_USER}@${DNS_REMOTE_HOST}" \
            "curl -s 'https://httpapi.com/api/dns/manage/search-records.json?auth-userid=${RC_AUTH_USERID}&api-key=${RC_API_KEY}&order-id=${order_id}&type=${type}&no-of-records=50&page-no=1'" 2>/dev/null)

        if [[ "$records" != *"error"* && "$records" != "{}" && -n "$records" ]]; then
            echo "[$type Records]"
            echo "$records" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    for key, rec in data.items():
        if isinstance(rec, dict) and 'host' in rec:
            print(f\"  {rec.get('host', '@'):20} → {rec.get('value', '')}\")
except:
    pass
" 2>/dev/null
            echo ""
        fi
    done
}

_dns_remote_rc_add() {
    local domain="$1"
    local type="$2"
    local host="$3"
    local value="$4"
    local ttl="${5:-7200}"  # RC minimum is 7200

    # Get order ID
    local order_id
    order_id=$(ssh -o ConnectTimeout=10 "${DNS_REMOTE_USER}@${DNS_REMOTE_HOST}" \
        "curl -s 'https://httpapi.com/api/domains/orderid.json?auth-userid=${RC_AUTH_USERID}&api-key=${RC_API_KEY}&domain-name=${domain}'" 2>/dev/null)

    if [[ ! "$order_id" =~ ^[0-9]+$ ]]; then
        echo "Could not get order ID for $domain"
        return 1
    fi

    # Determine endpoint
    local endpoint
    case "$type" in
        A)     endpoint="add-ipv4-record" ;;
        CNAME) endpoint="add-cname-record" ;;
        MX)    endpoint="add-mx-record" ;;
        TXT)   endpoint="add-txt-record" ;;
        *)     echo "Unsupported type: $type"; return 1 ;;
    esac

    echo "Adding $type record: $host.$domain → $value"

    local response
    response=$(ssh -o ConnectTimeout=10 "${DNS_REMOTE_USER}@${DNS_REMOTE_HOST}" \
        "curl -s -X POST 'https://httpapi.com/api/dns/manage/${endpoint}.json' --data-urlencode 'auth-userid=${RC_AUTH_USERID}' --data-urlencode 'api-key=${RC_API_KEY}' --data-urlencode 'domain-name=${domain}' --data-urlencode 'host=${host}' --data-urlencode 'value=${value}' --data-urlencode 'ttl=${ttl}'" 2>/dev/null)

    if [[ "$response" == *"error"* ]]; then
        echo ""
        echo "Error: $response"
        return 1
    fi

    echo ""
    echo "Done! $response"
    echo ""
    echo "Verify: dig $host.$domain $type"
}

export -f dns_remote
