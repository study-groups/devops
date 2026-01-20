#!/usr/bin/env bash
# dns_rc.sh - Reseller Club DNS API Provider
#
# Reseller Club HTTP API documentation:
# https://manage.resellerclub.com/kb/answer/744
#
# Required environment variables (from secrets.env):
#   RC_AUTH_USERID - Your reseller ID
#   RC_API_KEY     - Your API key
#
# Usage:
#   dns rc list <domain>           - List all DNS records
#   dns rc get <domain> <host>     - Get specific record
#   dns rc add <domain> <type> <host> <value> [ttl]
#   dns rc update <domain> <type> <host> <value> [ttl]
#   dns rc delete <domain> <type> <host>
#   dns rc search <domain> <host>  - Search for records by host

DNS_RC_ENDPOINT="https://httpapi.com/api"
DNS_RC_DEFAULT_TTL=3600

# =============================================================================
# AUTHENTICATION
# =============================================================================

_dns_rc_check_auth() {
    if [[ -z "$RC_AUTH_USERID" || -z "$RC_API_KEY" ]]; then
        echo ""
        echo "Hey, I couldn't authenticate with Reseller Club."
        echo ""
        echo "You need to add your API credentials to secrets.env:"
        echo ""
        echo "  1. Go to: https://manage.resellerclub.com"
        echo "     → Settings → API"
        echo ""
        echo "  2. Copy your Reseller ID and API Key"
        echo ""
        echo "  3. Add to: \$TETRA_DIR/orgs/\$(org active)/secrets.env"
        echo ""
        echo "     export RC_AUTH_USERID=\"your-reseller-id\""
        echo "     export RC_API_KEY=\"your-api-key\""
        echo ""
        echo "  4. Then: source secrets.env"
        echo ""
        return 1
    fi
    return 0
}

# Build auth query string
_dns_rc_auth_params() {
    echo "auth-userid=${RC_AUTH_USERID}&api-key=${RC_API_KEY}"
}

# =============================================================================
# API HELPERS
# =============================================================================

# Make API request
# Usage: _dns_rc_request <endpoint> [extra_params]
_dns_rc_request() {
    local endpoint="$1"
    local extra_params="${2:-}"
    local url="${DNS_RC_ENDPOINT}${endpoint}?$(_dns_rc_auth_params)"

    [[ -n "$extra_params" ]] && url="${url}&${extra_params}"

    curl -s "$url"
}

# Make POST API request
_dns_rc_post() {
    local endpoint="$1"
    local data="$2"
    local url="${DNS_RC_ENDPOINT}${endpoint}"

    curl -s -X POST "$url" \
        -d "$(_dns_rc_auth_params)&${data}"
}

# URL encode a value
_dns_rc_urlencode() {
    local string="$1"
    python3 -c "import urllib.parse; print(urllib.parse.quote('$string', safe=''))"
}

# =============================================================================
# DOMAIN OPERATIONS
# =============================================================================

# Get domain order ID (needed for DNS operations)
# Reseller Club requires order-id for domain operations
dns_rc_get_order_id() {
    local domain="$1"

    _dns_rc_check_auth || return 1
    [[ -z "$domain" ]] && { echo "Usage: dns rc orderid <domain>" >&2; return 1; }

    local response
    response=$(_dns_rc_request "/domains/orderid.json" "domain-name=${domain}")

    # Response is just the order ID number or error
    if [[ "$response" =~ ^[0-9]+$ ]]; then
        echo "$response"
    else
        echo ""
        echo "Hey, I couldn't find the domain '$domain' in your Reseller Club account."
        echo ""
        if [[ "$response" == *"Invalid"* || "$response" == *"authentication"* ]]; then
            echo "Looks like an authentication issue."
            echo ""
            echo "Please verify your credentials at:"
            echo "  https://manage.resellerclub.com → Settings → API"
            echo ""
        elif [[ "$response" == *"not found"* || "$response" == *"does not exist"* ]]; then
            echo "The domain doesn't exist in your account."
            echo ""
            echo "You need to:"
            echo "  1. Go to: https://manage.resellerclub.com → Domains"
            echo "  2. Make sure '$domain' is registered there"
            echo "  3. If it's registered elsewhere, transfer it or update nameservers"
            echo ""
        else
            echo "API response: $response"
            echo ""
            echo "Check your domain at:"
            echo "  https://manage.resellerclub.com → Domains → $domain"
            echo ""
        fi
        return 1
    fi
}

# =============================================================================
# DNS RECORD OPERATIONS
# =============================================================================

# List all DNS records for a domain
dns_rc_list() {
    local domain="$1"

    _dns_rc_check_auth || return 1

    if [[ -z "$domain" ]]; then
        echo ""
        echo "Usage: dns rc list <domain>"
        echo ""
        echo "Shows all DNS records for a domain managed in Reseller Club."
        echo ""
        echo "Example:"
        echo "  dns rc list transreal.com"
        echo ""
        return 1
    fi

    local order_id
    order_id=$(dns_rc_get_order_id "$domain") || return 1

    echo ""
    echo "DNS Records for $domain"
    echo "════════════════════════════════════════════════════════════════"
    echo ""

    local found_any=false

    # Get all record types
    for type in A AAAA CNAME MX TXT NS; do
        local response
        response=$(_dns_rc_request "/dns/manage/search-records.json" \
            "order-id=${order_id}&type=${type}&no-of-records=50&page-no=1")

        # Parse JSON response (basic)
        if [[ "$response" != *"error"* && "$response" != "[]" && "$response" != "{}" && "$response" != *"No records"* ]]; then
            local records
            records=$(echo "$response" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    if isinstance(data, dict):
        for key, rec in data.items():
            if isinstance(rec, dict) and 'host' in rec:
                host = rec.get('host', '@')
                value = rec.get('value', '')
                ttl = rec.get('timetolive', '3600')
                print(f'{host}|{value}|{ttl}')
except:
    pass
" 2>/dev/null)

            if [[ -n "$records" ]]; then
                found_any=true
                echo "[$type Records]"
                echo "$records" | while IFS='|' read -r host value ttl; do
                    printf "  %-20s → %-35s (TTL: %s)\n" "$host" "$value" "$ttl"
                done
                echo ""
            fi
        fi
    done

    if [[ "$found_any" == "false" ]]; then
        echo "No DNS records found."
        echo ""
        echo "This domain might be:"
        echo "  • Newly registered (DNS not set up yet)"
        echo "  • Using default nameserver records only"
        echo ""
        echo "Add records with:"
        echo "  dns rc add $domain A www 1.2.3.4"
        echo "  dns rc add $domain CNAME www ghs.googlehosted.com"
        echo ""
    fi

    echo "Manage at: https://manage.resellerclub.com → Domains → $domain"
    echo ""
}

# Search for DNS records by hostname
dns_rc_search() {
    local domain="$1"
    local host="$2"
    local type="${3:-}"

    _dns_rc_check_auth || return 1
    [[ -z "$domain" || -z "$host" ]] && {
        echo "Usage: dns rc search <domain> <host> [type]" >&2
        return 1
    }

    local order_id
    order_id=$(dns_rc_get_order_id "$domain") || return 1

    local params="order-id=${order_id}&host=${host}&no-of-records=50&page-no=1"
    [[ -n "$type" ]] && params="${params}&type=${type}"

    _dns_rc_request "/dns/manage/search-records.json" "$params"
}

# Add a DNS record
dns_rc_add() {
    local domain="$1"
    local type="$2"
    local host="$3"
    local value="$4"
    local ttl="${5:-$DNS_RC_DEFAULT_TTL}"

    _dns_rc_check_auth || return 1

    if [[ -z "$domain" || -z "$type" || -z "$host" || -z "$value" ]]; then
        echo ""
        echo "Usage: dns rc add <domain> <type> <host> <value> [ttl]"
        echo ""
        echo "Examples:"
        echo "  dns rc add example.com A www 1.2.3.4"
        echo "  dns rc add example.com CNAME www ghs.googlehosted.com"
        echo "  dns rc add example.com TXT @ \"v=spf1 include:_spf.google.com ~all\""
        echo ""
        echo "Record types: A, AAAA, CNAME, MX, TXT, NS"
        echo "Host: @ for root domain, www, blog, etc."
        echo ""
        return 1
    fi

    local order_id
    order_id=$(dns_rc_get_order_id "$domain") || return 1

    # Determine endpoint based on record type
    local endpoint
    case "$type" in
        A)     endpoint="/dns/manage/add-ipv4-record.json" ;;
        AAAA)  endpoint="/dns/manage/add-ipv6-record.json" ;;
        CNAME) endpoint="/dns/manage/add-cname-record.json" ;;
        MX)    endpoint="/dns/manage/add-mx-record.json" ;;
        TXT)   endpoint="/dns/manage/add-txt-record.json" ;;
        NS)    endpoint="/dns/manage/add-ns-record.json" ;;
        *)
            echo ""
            echo "Hey, '$type' isn't a supported record type."
            echo ""
            echo "Supported types:"
            echo "  A      - Points to an IPv4 address (e.g., 1.2.3.4)"
            echo "  AAAA   - Points to an IPv6 address"
            echo "  CNAME  - Alias to another domain (e.g., ghs.googlehosted.com)"
            echo "  MX     - Mail server"
            echo "  TXT    - Text record (SPF, verification, etc.)"
            echo "  NS     - Nameserver"
            echo ""
            return 1
            ;;
    esac

    local data="order-id=${order_id}&host=${host}&value=$(_dns_rc_urlencode "$value")&ttl=${ttl}"

    echo "Adding $type record: $host.$domain -> $value (TTL: $ttl)"

    local response
    response=$(_dns_rc_post "$endpoint" "$data")

    if [[ "$response" == *"error"* || "$response" == *"Error"* ]]; then
        echo ""
        echo "Hey, I couldn't add that DNS record."
        echo ""

        if [[ "$response" == *"already exists"* || "$response" == *"duplicate"* ]]; then
            echo "A record for '$host.$domain' already exists."
            echo ""
            echo "You need to either:"
            echo "  1. Update the existing record:"
            echo "     dns rc update $domain $type $host $value"
            echo ""
            echo "  2. Delete it first, then add:"
            echo "     dns rc delete $domain $type $host <current-value>"
            echo "     dns rc add $domain $type $host $value"
            echo ""
            echo "  3. Check existing records:"
            echo "     dns rc list $domain"
            echo ""
        elif [[ "$response" == *"invalid"* ]]; then
            echo "The value '$value' doesn't look valid for a $type record."
            echo ""
            case "$type" in
                A)
                    echo "A records need an IPv4 address like: 192.168.1.1"
                    ;;
                CNAME)
                    echo "CNAME records need a domain like: ghs.googlehosted.com"
                    echo "(no trailing dot needed)"
                    ;;
                *)
                    echo "Check the format and try again."
                    ;;
            esac
            echo ""
        else
            echo "API says: $response"
            echo ""
            echo "Try checking the domain in Reseller Club:"
            echo "  https://manage.resellerclub.com → Domains → $domain → DNS"
            echo ""
        fi
        return 1
    fi

    echo ""
    echo "Done! Created $type record:"
    echo "  $host.$domain -> $value"
    echo ""
    echo "DNS changes can take up to 24-48 hours to propagate globally,"
    echo "but usually work within a few minutes."
    echo ""
    echo "Verify with: dig $host.$domain $type"
}

# Update a DNS record
dns_rc_update() {
    local domain="$1"
    local type="$2"
    local host="$3"
    local value="$4"
    local ttl="${5:-$DNS_RC_DEFAULT_TTL}"

    _dns_rc_check_auth || return 1

    if [[ -z "$domain" || -z "$type" || -z "$host" || -z "$value" ]]; then
        echo "Usage: dns rc update <domain> <type> <host> <value> [ttl]" >&2
        return 1
    fi

    local order_id
    order_id=$(dns_rc_get_order_id "$domain") || return 1

    # Determine endpoint based on record type
    local endpoint
    case "$type" in
        A)     endpoint="/dns/manage/update-ipv4-record.json" ;;
        AAAA)  endpoint="/dns/manage/update-ipv6-record.json" ;;
        CNAME) endpoint="/dns/manage/update-cname-record.json" ;;
        MX)    endpoint="/dns/manage/update-mx-record.json" ;;
        TXT)   endpoint="/dns/manage/update-txt-record.json" ;;
        NS)    endpoint="/dns/manage/update-ns-record.json" ;;
        *)
            echo "Unsupported record type: $type" >&2
            return 1
            ;;
    esac

    # Get current record to find its ID
    local current
    current=$(dns_rc_search "$domain" "$host" "$type")

    local data="order-id=${order_id}&host=${host}&current-value=$(_dns_rc_urlencode "$value")&new-value=$(_dns_rc_urlencode "$value")&ttl=${ttl}"

    echo "Updating $type record: $host.$domain -> $value (TTL: $ttl)"

    local response
    response=$(_dns_rc_post "$endpoint" "$data")

    if [[ "$response" == *"error"* ]]; then
        echo "Error: $response" >&2
        return 1
    fi

    echo "Success: $response"
}

# Delete a DNS record
dns_rc_delete() {
    local domain="$1"
    local type="$2"
    local host="$3"
    local value="$4"

    _dns_rc_check_auth || return 1

    if [[ -z "$domain" || -z "$type" || -z "$host" || -z "$value" ]]; then
        echo ""
        echo "Usage: dns rc delete <domain> <type> <host> <value>"
        echo ""
        echo "The value is required because there can be multiple records"
        echo "for the same host (e.g., multiple A records for load balancing)."
        echo ""
        echo "Example:"
        echo "  dns rc delete example.com CNAME www ghs.googlehosted.com"
        echo ""
        echo "To see current records and their values:"
        echo "  dns rc list $domain"
        echo ""
        return 1
    fi

    local order_id
    order_id=$(dns_rc_get_order_id "$domain") || return 1

    # Determine endpoint based on record type
    local endpoint
    case "$type" in
        A)     endpoint="/dns/manage/delete-ipv4-record.json" ;;
        AAAA)  endpoint="/dns/manage/delete-ipv6-record.json" ;;
        CNAME) endpoint="/dns/manage/delete-cname-record.json" ;;
        MX)    endpoint="/dns/manage/delete-mx-record.json" ;;
        TXT)   endpoint="/dns/manage/delete-txt-record.json" ;;
        NS)    endpoint="/dns/manage/delete-ns-record.json" ;;
        *)
            echo ""
            echo "Hey, '$type' isn't a supported record type."
            echo "Use: A, AAAA, CNAME, MX, TXT, or NS"
            echo ""
            return 1
            ;;
    esac

    local data="order-id=${order_id}&host=${host}&value=$(_dns_rc_urlencode "$value")"

    echo "Deleting $type record: $host.$domain -> $value"

    local response
    response=$(_dns_rc_post "$endpoint" "$data")

    if [[ "$response" == *"error"* || "$response" == *"Error"* ]]; then
        echo ""
        echo "Hey, I couldn't delete that record."
        echo ""

        if [[ "$response" == *"not found"* || "$response" == *"does not exist"* ]]; then
            echo "That record doesn't exist (maybe already deleted?)."
            echo ""
            echo "Check current records with:"
            echo "  dns rc list $domain"
            echo ""
        else
            echo "API says: $response"
            echo ""
            echo "You can delete it manually at:"
            echo "  https://manage.resellerclub.com → Domains → $domain → DNS"
            echo ""
        fi
        return 1
    fi

    echo ""
    echo "Done! Deleted $type record for $host.$domain"
    echo ""
}

# =============================================================================
# DOCTOR / DIAGNOSTICS
# =============================================================================

# Check RC API connectivity and credentials
dns_rc_doctor() {
    echo ""
    echo "Reseller Club API Doctor"
    echo "════════════════════════"
    echo ""

    local all_good=true

    # Step 1: Check environment variables
    echo "[1/4] Checking credentials..."
    if [[ -z "$RC_AUTH_USERID" ]]; then
        echo "  ✗ RC_AUTH_USERID not set"
        all_good=false
    else
        echo "  ✓ RC_AUTH_USERID: ${RC_AUTH_USERID:0:4}****"
    fi

    if [[ -z "$RC_API_KEY" ]]; then
        echo "  ✗ RC_API_KEY not set"
        all_good=false
    else
        echo "  ✓ RC_API_KEY: ${RC_API_KEY:0:4}****"
    fi

    if [[ "$all_good" == "false" ]]; then
        echo ""
        echo "Missing credentials. To fix:"
        echo ""
        echo "  1. Get your API credentials:"
        echo "     https://manage.resellerclub.com"
        echo "     → Settings → API → Generate API Key"
        echo ""
        echo "  2. Add to your org's secrets.env:"
        local current_org="your-org"
        if type org_active &>/dev/null; then
            current_org=$(org_active 2>/dev/null) || current_org="your-org"
        fi
        echo "     \$TETRA_DIR/orgs/$current_org/secrets.env"
        echo ""
        echo "     export RC_AUTH_USERID=\"your-reseller-id\""
        echo "     export RC_API_KEY=\"your-api-key\""
        echo ""
        echo "  3. Load the credentials:"
        echo "     source \$TETRA_DIR/orgs/$current_org/secrets.env"
        echo ""
        return 1
    fi
    echo ""

    # Step 2: Check network connectivity
    echo "[2/4] Checking network connectivity..."
    if curl -s --connect-timeout 5 "https://httpapi.com" >/dev/null 2>&1; then
        echo "  ✓ Can reach httpapi.com"
    else
        echo "  ✗ Cannot reach httpapi.com"
        echo ""
        echo "Network issue. Check:"
        echo "  • Internet connection"
        echo "  • Firewall settings"
        echo "  • VPN (try disabling)"
        echo ""
        return 1
    fi
    echo ""

    # Step 3: Test API authentication
    echo "[3/4] Testing API authentication..."
    local auth_test
    auth_test=$(curl -s --connect-timeout 10 \
        "${DNS_RC_ENDPOINT}/domains/available.json?auth-userid=${RC_AUTH_USERID}&api-key=${RC_API_KEY}&domain-name=test&tlds=com" \
        2>/dev/null)

    if [[ "$auth_test" == *"error"* && "$auth_test" == *"authentication"* ]]; then
        echo "  ✗ Authentication failed"
        echo ""
        echo "Your credentials were rejected. To fix:"
        echo ""
        echo "  1. Verify at: https://manage.resellerclub.com → Settings → API"
        echo ""
        echo "  2. Make sure you're using:"
        echo "     • Reseller ID (not email)"
        echo "     • API Key (not password)"
        echo ""
        echo "  3. Check for typos or extra spaces"
        echo ""
        return 1
    elif [[ "$auth_test" == *"true"* || "$auth_test" == *"false"* || "$auth_test" == *"available"* ]]; then
        echo "  ✓ API authentication successful"
    else
        echo "  ? Unexpected response: ${auth_test:0:100}"
        echo ""
        echo "This might still work. Try: dns rc list <your-domain>"
        echo ""
    fi
    echo ""

    # Step 4: List domains in account
    echo "[4/4] Checking domains in your account..."
    local domains_test
    domains_test=$(curl -s --connect-timeout 10 \
        "${DNS_RC_ENDPOINT}/domains/search.json?auth-userid=${RC_AUTH_USERID}&api-key=${RC_API_KEY}&no-of-records=5&page-no=1" \
        2>/dev/null)

    if [[ "$domains_test" == *"recsindb"* ]]; then
        local domain_count
        domain_count=$(echo "$domains_test" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    print(data.get('recsindb', 0))
except:
    print('?')
" 2>/dev/null)
        echo "  ✓ Found $domain_count domain(s) in account"

        # Show first few domains
        echo ""
        echo "  Sample domains:"
        echo "$domains_test" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    for key, val in data.items():
        if isinstance(val, dict) and 'entity.description' in val:
            print(f\"    • {val['entity.description']}\")
except:
    pass
" 2>/dev/null | head -5
    elif [[ "$domains_test" == *"error"* ]]; then
        echo "  ✗ Could not list domains"
        echo "    Response: ${domains_test:0:100}"
    else
        echo "  ? No domains found or unexpected response"
    fi

    echo ""
    echo "────────────────────────────────────────"

    if [[ "$all_good" == "true" ]]; then
        echo ""
        echo "✓ All checks passed!"
        echo ""
        echo "Ready to use:"
        echo "  dns rc list <domain>              List DNS records"
        echo "  dns rc google-sites <domain>      Setup for Google Sites"
        echo "  dns rc add <domain> A www 1.2.3.4"
        echo ""
    fi
}

# Test a specific domain
dns_rc_test() {
    local domain="$1"

    if [[ -z "$domain" ]]; then
        echo ""
        echo "Usage: dns rc test <domain>"
        echo ""
        echo "Tests if a domain is accessible via your RC account."
        echo ""
        return 1
    fi

    echo ""
    echo "Testing: $domain"
    echo ""

    # Check with public DNS first
    echo "[Public DNS]"
    local ns=$(dig +short NS "$domain" 2>/dev/null | head -1)
    if [[ -n "$ns" ]]; then
        echo "  Nameserver: $ns"

        if echo "$ns" | grep -qi "resellerclub\|domaincontrol\|secureserver"; then
            echo "  ✓ Appears to be managed by Reseller Club"
        else
            echo "  ⚠ Nameserver doesn't look like Reseller Club"
            echo "    DNS might be hosted elsewhere"
        fi
    else
        echo "  ✗ Could not find nameservers"
        echo "    Domain may not exist or DNS not configured"
    fi
    echo ""

    # Check with RC API
    echo "[Reseller Club API]"
    _dns_rc_check_auth || return 1

    local order_id
    order_id=$(dns_rc_get_order_id "$domain" 2>&1)

    if [[ "$order_id" =~ ^[0-9]+$ ]]; then
        echo "  ✓ Domain found in your account"
        echo "  Order ID: $order_id"
        echo ""
        echo "Ready to manage:"
        echo "  dns rc list $domain"
        echo "  dns rc add $domain CNAME www ghs.googlehosted.com"
    else
        echo "  ✗ Domain not found in your RC account"
        echo ""
        echo "This could mean:"
        echo "  • Domain is registered elsewhere"
        echo "  • Domain is under a different reseller account"
        echo "  • Domain name is misspelled"
        echo ""
        echo "Check at: https://manage.resellerclub.com → Domains"
    fi
    echo ""
}

# =============================================================================
# GOOGLE SITES SPECIFIC
# =============================================================================

# Configure DNS for Google Sites custom domain
# Google Sites requires a CNAME to ghs.googlehosted.com
dns_rc_setup_google_sites() {
    local domain="$1"
    local subdomain="${2:-www}"  # Default to www

    _dns_rc_check_auth || return 1

    if [[ -z "$domain" ]]; then
        echo ""
        echo "Usage: dns rc google-sites <domain> [subdomain]"
        echo ""
        echo "This sets up DNS so your custom domain points to Google Sites."
        echo ""
        echo "Examples:"
        echo "  dns rc google-sites transreal.com          # www.transreal.com"
        echo "  dns rc google-sites transreal.com blog     # blog.transreal.com"
        echo ""
        return 1
    fi

    echo ""
    echo "Setting up Google Sites DNS"
    echo "═══════════════════════════"
    echo ""
    echo "This will make $subdomain.$domain point to your Google Site."
    echo ""

    # Add CNAME for subdomain -> ghs.googlehosted.com
    if dns_rc_add "$domain" "CNAME" "$subdomain" "ghs.googlehosted.com" 3600; then
        echo ""
        echo "DNS is configured! Now connect it in Google Sites:"
        echo ""
        echo "  1. Open your Google Site in edit mode"
        echo ""
        echo "  2. Click the gear icon (Settings) → Custom domains"
        echo "     Or go to: https://sites.google.com"
        echo "     → Your site → ⚙ Settings → Custom domains"
        echo ""
        echo "  3. Click 'Start setup' and enter:"
        echo "     $subdomain.$domain"
        echo ""
        echo "  4. Google will verify the CNAME record (may take a few minutes)"
        echo ""
        echo "  5. Once verified, your site will be live at:"
        echo "     https://$subdomain.$domain"
        echo ""
    else
        echo ""
        echo "DNS setup didn't complete. See the error above."
        echo ""
        echo "You can also set this up manually:"
        echo ""
        echo "  1. Go to: https://manage.resellerclub.com"
        echo "     → Domains → $domain → DNS Management"
        echo ""
        echo "  2. Add a CNAME record:"
        echo "     Host: $subdomain"
        echo "     Points to: ghs.googlehosted.com"
        echo "     TTL: 3600"
        echo ""
        return 1
    fi
}

# =============================================================================
# MAIN COMMAND ROUTER
# =============================================================================

dns_rc() {
    local cmd="${1:-help}"
    shift 2>/dev/null || true

    case "$cmd" in
        # Diagnostics
        doctor)       dns_rc_doctor "$@" ;;
        test)         dns_rc_test "$@" ;;

        # Record management
        list|ls)      dns_rc_list "$@" ;;
        search)       dns_rc_search "$@" ;;
        add)          dns_rc_add "$@" ;;
        update)       dns_rc_update "$@" ;;
        delete|rm)    dns_rc_delete "$@" ;;

        # Helpers
        orderid)      dns_rc_get_order_id "$@" ;;
        google-sites|gsites) dns_rc_setup_google_sites "$@" ;;

        help|--help|-h|*)
            echo ""
            echo "dns rc - Reseller Club DNS Management"
            echo "══════════════════════════════════════"
            echo ""
            echo "First time? Run:"
            echo "  dns rc doctor           Check setup and connectivity"
            echo ""
            echo "Common tasks:"
            echo "  dns rc google-sites transreal.com    Point www to Google Sites"
            echo "  dns rc add transreal.com A www 1.2.3.4"
            echo "  dns rc list transreal.com            See all records"
            echo ""
            echo "Commands:"
            echo "  doctor                  Check API setup and connectivity"
            echo "  test <domain>           Test if domain is in your account"
            echo "  list <domain>           Show all DNS records"
            echo "  add <domain> <type> <host> <value>"
            echo "  delete <domain> <type> <host> <value>"
            echo "  google-sites <domain>   Setup CNAME for Google Sites"
            echo ""
            echo "Record types:"
            echo "  A      IPv4 address (server IP)"
            echo "  CNAME  Alias (point to another domain)"
            echo "  TXT    Text (verification, SPF)"
            echo "  MX     Mail server"
            echo ""
            ;;
    esac
}

export -f dns_rc_doctor dns_rc_test

export -f dns_rc dns_rc_list dns_rc_search dns_rc_add dns_rc_update dns_rc_delete
export -f dns_rc_get_order_id dns_rc_setup_google_sites
