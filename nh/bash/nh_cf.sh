#!/usr/bin/env bash
# nh_cf.sh - Cloudflare DNS management for NodeHolder
#
# Manages DNS records via Cloudflare API
# Credentials stored in: $NH_DIR/<context>/cloudflare.env
#
# Usage:
#   nh cf zones                    List zones
#   nh cf records <zone>           List DNS records
#   nh cf add <fqdn> <ip>          Add A record
#   nh cf remove <fqdn>            Remove record
#   nh cf snapshot                 Save current state to cloudflare.json

CF_API_BASE="https://api.cloudflare.com/client/v4"

# =============================================================================
# CREDENTIALS
# =============================================================================

_cf_load_creds() {
    local context=$(nh_context)
    local creds_file="$NH_DIR/$context/cloudflare.env"

    if [[ ! -f "$creds_file" ]]; then
        echo "Cloudflare credentials not found: $creds_file" >&2
        echo "Create with: nh cf init" >&2
        return 1
    fi

    source "$creds_file"

    # Need either API Token OR (API Key + Email)
    if [[ -z "$CF_API_TOKEN" && ( -z "$CF_API_KEY" || -z "$CF_EMAIL" ) ]]; then
        echo "Cloudflare credentials not set in $creds_file" >&2
        echo "Set either CF_API_TOKEN or (CF_API_KEY + CF_EMAIL)" >&2
        return 1
    fi

    return 0
}

_cf_curl() {
    local method="$1"
    local endpoint="$2"
    shift 2

    if [[ -n "$CF_API_TOKEN" ]]; then
        # Scoped API Token
        curl -s -X "$method" "${CF_API_BASE}${endpoint}" \
            -H "Authorization: Bearer $CF_API_TOKEN" \
            -H "Content-Type: application/json" \
            "$@"
    else
        # Global API Key
        curl -s -X "$method" "${CF_API_BASE}${endpoint}" \
            -H "X-Auth-Email: $CF_EMAIL" \
            -H "X-Auth-Key: $CF_API_KEY" \
            -H "Content-Type: application/json" \
            "$@"
    fi
}

# =============================================================================
# ZONES
# =============================================================================

# List all zones
nh_cf_zones() {
    _cf_load_creds || return 1

    local response=$(_cf_curl GET "/zones")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        echo "API Error:" >&2
        echo "$response" | jq -r '.errors[]?.message // .' >&2
        return 1
    fi

    echo "Zones:"
    echo "$response" | jq -r '.result[] | "  \(.name) [\(.id)] - \(.status)"'
}

# Get zone ID by name
_cf_zone_id() {
    local zone_name="$1"

    # Check cache in env first
    local var_name="CF_ZONE_${zone_name//./_}"
    var_name="${var_name^^}"  # uppercase

    if [[ -n "${!var_name}" ]]; then
        echo "${!var_name}"
        return 0
    fi

    # Fetch from API
    local response=$(_cf_curl GET "/zones?name=$zone_name")
    local zone_id=$(echo "$response" | jq -r '.result[0].id // empty')

    if [[ -z "$zone_id" ]]; then
        echo "Zone not found: $zone_name" >&2
        return 1
    fi

    echo "$zone_id"
}

# =============================================================================
# RECORDS
# =============================================================================

# List DNS records for a zone
nh_cf_records() {
    local zone="$1"

    if [[ -z "$zone" ]]; then
        echo "Usage: nh cf records <zone>"
        echo "Example: nh cf records nodeholder.com"
        return 1
    fi

    _cf_load_creds || return 1

    local zone_id=$(_cf_zone_id "$zone") || return 1
    local response=$(_cf_curl GET "/zones/$zone_id/dns_records")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        echo "API Error:" >&2
        echo "$response" | jq -r '.errors[]?.message // .' >&2
        return 1
    fi

    echo "DNS Records for $zone:"
    printf "  %-8s %-30s %-20s %s\n" "TYPE" "NAME" "CONTENT" "PROXIED"
    printf "  %-8s %-30s %-20s %s\n" "----" "----" "-------" "-------"
    echo "$response" | jq -r '.result[] | "  \(.type | .[0:8])  \(.name | .[0:30])  \(.content | .[0:20])  \(.proxied)"' | head -30
}

# Add DNS record
nh_cf_add() {
    local fqdn="$1"
    local content="$2"
    local type="${3:-A}"
    local proxied="${4:-false}"

    if [[ -z "$fqdn" || -z "$content" ]]; then
        echo "Usage: nh cf add <fqdn> <ip> [type] [proxied]"
        echo "Example: nh cf add docs.nodeholder.com 165.227.6.221"
        echo "         nh cf add docs.nodeholder.com 165.227.6.221 A true"
        return 1
    fi

    _cf_load_creds || return 1

    # Extract zone from fqdn (last two parts)
    local zone=$(echo "$fqdn" | awk -F. '{print $(NF-1)"."$NF}')
    local name="${fqdn%.$zone}"
    [[ "$name" == "$fqdn" ]] && name="@"

    local zone_id=$(_cf_zone_id "$zone") || return 1

    echo "Adding DNS record:"
    echo "  Zone:    $zone ($zone_id)"
    echo "  Name:    $name"
    echo "  Type:    $type"
    echo "  Content: $content"
    echo "  Proxied: $proxied"
    echo ""

    local data=$(jq -n \
        --arg type "$type" \
        --arg name "$name" \
        --arg content "$content" \
        --argjson proxied "$proxied" \
        '{type: $type, name: $name, content: $content, proxied: $proxied, ttl: 1}')

    local response=$(_cf_curl POST "/zones/$zone_id/dns_records" -d "$data")

    if echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        echo "Success!"
        echo "$response" | jq -r '.result | "  ID: \(.id)\n  Name: \(.name)\n  Content: \(.content)"'
    else
        echo "Failed:" >&2
        echo "$response" | jq -r '.errors[]?.message // .' >&2
        return 1
    fi
}

# Remove DNS record
nh_cf_remove() {
    local fqdn="$1"

    if [[ -z "$fqdn" ]]; then
        echo "Usage: nh cf remove <fqdn>"
        echo "Example: nh cf remove docs.nodeholder.com"
        return 1
    fi

    _cf_load_creds || return 1

    # Extract zone from fqdn
    local zone=$(echo "$fqdn" | awk -F. '{print $(NF-1)"."$NF}')
    local zone_id=$(_cf_zone_id "$zone") || return 1

    # Find record ID
    local response=$(_cf_curl GET "/zones/$zone_id/dns_records?name=$fqdn")
    local record_id=$(echo "$response" | jq -r '.result[0].id // empty')

    if [[ -z "$record_id" ]]; then
        echo "Record not found: $fqdn" >&2
        return 1
    fi

    echo "Removing DNS record:"
    echo "  FQDN:      $fqdn"
    echo "  Record ID: $record_id"
    echo ""

    read -rp "Confirm? [y/N] " confirm
    [[ "$confirm" != "y" && "$confirm" != "Y" ]] && { echo "Cancelled"; return 1; }

    response=$(_cf_curl DELETE "/zones/$zone_id/dns_records/$record_id")

    if echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        echo "Removed."
    else
        echo "Failed:" >&2
        echo "$response" | jq -r '.errors[]?.message // .' >&2
        return 1
    fi
}

# =============================================================================
# PROXY TOGGLE
# =============================================================================

# Toggle or set proxy status (orange/gray cloud)
nh_cf_proxy() {
    local fqdn="$1"
    local action="$2"  # on, off, or empty for toggle

    if [[ -z "$fqdn" ]]; then
        echo "Usage: nh cf proxy <fqdn> [on|off]"
        echo ""
        echo "Examples:"
        echo "  nh cf proxy docs.nodeholder.com        # show current status"
        echo "  nh cf proxy docs.nodeholder.com on     # enable proxy (orange cloud)"
        echo "  nh cf proxy docs.nodeholder.com off    # disable proxy (gray cloud)"
        echo ""
        echo "Cloudflare Proxy (orange cloud):"
        echo "  - Cloudflare handles SSL (no cert needed on origin)"
        echo "  - DDoS protection, CDN caching, analytics"
        echo "  - Hides origin IP (shows Cloudflare IPs)"
        echo ""
        echo "DNS Only (gray cloud):"
        echo "  - Direct connection to origin server"
        echo "  - You must have SSL cert on origin for HTTPS"
        echo "  - Exposes origin IP address"
        return 1
    fi

    _cf_load_creds || return 1

    # Extract zone from fqdn
    local zone=$(echo "$fqdn" | awk -F. '{print $(NF-1)"."$NF}')
    local zone_id=$(_cf_zone_id "$zone") || return 1

    # Get current record
    local response=$(_cf_curl GET "/zones/$zone_id/dns_records?name=$fqdn")
    local record=$(echo "$response" | jq -r '.result[0] // empty')

    if [[ -z "$record" || "$record" == "null" ]]; then
        echo "Record not found: $fqdn" >&2
        return 1
    fi

    local record_id=$(echo "$record" | jq -r '.id')
    local current_proxied=$(echo "$record" | jq -r '.proxied')
    local content=$(echo "$record" | jq -r '.content')
    local rec_type=$(echo "$record" | jq -r '.type')

    # Show current status if no action
    if [[ -z "$action" ]]; then
        echo "$fqdn"
        echo "  Type:    $rec_type"
        echo "  Content: $content"
        if [[ "$current_proxied" == "true" ]]; then
            echo "  Proxy:   ON (orange cloud - Cloudflare SSL)"
        else
            echo "  Proxy:   OFF (gray cloud - direct to origin)"
        fi
        return 0
    fi

    # Determine new state
    local new_proxied
    case "$action" in
        on|true|1)   new_proxied=true ;;
        off|false|0) new_proxied=false ;;
        toggle)
            [[ "$current_proxied" == "true" ]] && new_proxied=false || new_proxied=true
            ;;
        *)
            echo "Invalid action: $action (use on, off, or toggle)" >&2
            return 1
            ;;
    esac

    if [[ "$current_proxied" == "$new_proxied" ]]; then
        echo "Already set to proxied=$new_proxied"
        return 0
    fi

    echo "Updating $fqdn:"
    echo "  Proxy: $current_proxied -> $new_proxied"

    response=$(_cf_curl PATCH "/zones/$zone_id/dns_records/$record_id" \
        -d "{\"proxied\": $new_proxied}")

    if echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        echo ""
        if [[ "$new_proxied" == "true" ]]; then
            echo "Proxy ENABLED (orange cloud)"
            echo "  - Cloudflare now handles SSL"
            echo "  - DNS will show Cloudflare IPs (104.x.x.x, 172.67.x.x)"
            echo "  - Run: nh cf dig $fqdn  to verify propagation"
        else
            echo "Proxy DISABLED (gray cloud)"
            echo "  - Traffic goes direct to origin: $content"
            echo "  - You need SSL cert on origin for HTTPS"
        fi
    else
        echo "Failed:" >&2
        echo "$response" | jq -r '.errors[]?.message // .' >&2
        return 1
    fi
}

# =============================================================================
# SSL SETTINGS
# =============================================================================

# Check/set SSL mode for a zone
nh_cf_ssl() {
    local zone="$1"
    local mode="$2"  # off, flexible, full, strict

    if [[ -z "$zone" ]]; then
        echo "Usage: nh cf ssl <zone> [mode]"
        echo ""
        echo "Modes:"
        echo "  off       No SSL (http only)"
        echo "  flexible  HTTPS browser->CF, HTTP CF->origin (no origin cert needed)"
        echo "  full      HTTPS end-to-end (origin cert can be self-signed)"
        echo "  strict    HTTPS end-to-end (origin cert must be valid CA)"
        echo ""
        echo "Recommendation:"
        echo "  Use 'flexible' if you don't have certs on origin servers"
        echo "  Use 'full' or 'strict' for production with proper certs"
        return 1
    fi

    _cf_load_creds || return 1
    local zone_id=$(_cf_zone_id "$zone") || return 1

    # Get current SSL setting
    local response=$(_cf_curl GET "/zones/$zone_id/settings/ssl")
    local current=$(echo "$response" | jq -r '.result.value // empty')

    if [[ -z "$mode" ]]; then
        echo "SSL mode for $zone: $current"
        echo ""
        case "$current" in
            off)      echo "  No encryption" ;;
            flexible) echo "  Browser->Cloudflare: HTTPS"
                      echo "  Cloudflare->Origin:  HTTP (no cert needed)" ;;
            full)     echo "  End-to-end HTTPS (self-signed OK)" ;;
            strict)   echo "  End-to-end HTTPS (valid CA cert required)" ;;
        esac
        return 0
    fi

    # Validate mode
    case "$mode" in
        off|flexible|full|strict) ;;
        *)
            echo "Invalid mode: $mode" >&2
            echo "Use: off, flexible, full, strict" >&2
            return 1
            ;;
    esac

    echo "Setting SSL mode: $current -> $mode"

    response=$(_cf_curl PATCH "/zones/$zone_id/settings/ssl" \
        -d "{\"value\": \"$mode\"}")

    if echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        echo "SSL mode updated to: $mode"
    else
        echo "Failed:" >&2
        echo "$response" | jq -r '.errors[]?.message // .' >&2
        return 1
    fi
}

# =============================================================================
# DIG DIAGNOSTICS
# =============================================================================

# DNS diagnostic helper
nh_cf_dig() {
    local fqdn="$1"

    if [[ -z "$fqdn" ]]; then
        echo "Usage: nh cf dig <fqdn>"
        echo ""
        echo "Compares DNS resolution across:"
        echo "  - Your local resolver (may be cached)"
        echo "  - Cloudflare's nameservers (authoritative)"
        echo "  - Google DNS (8.8.8.8)"
        echo ""
        echo "Helps diagnose:"
        echo "  - DNS propagation delays"
        echo "  - Proxy status (Cloudflare IPs vs origin IP)"
        echo "  - Cache issues"
        return 1
    fi

    # Extract zone for nameserver lookup
    local zone=$(echo "$fqdn" | awk -F. '{print $(NF-1)"."$NF}')

    echo "DNS Diagnostics for: $fqdn"
    echo "========================================"
    echo ""

    # Get Cloudflare nameservers for this zone
    _cf_load_creds 2>/dev/null
    local cf_ns=""
    if [[ -n "$CF_API_KEY" || -n "$CF_API_TOKEN" ]]; then
        local zone_id=$(_cf_zone_id "$zone" 2>/dev/null)
        if [[ -n "$zone_id" ]]; then
            cf_ns=$(_cf_curl GET "/zones/$zone_id" | jq -r '.result.name_servers[0] // empty')
        fi
    fi
    [[ -z "$cf_ns" ]] && cf_ns=$(dig +short NS "$zone" | head -1)

    echo "1. LOCAL RESOLVER (your DNS cache)"
    echo "   dig +short $fqdn"
    local local_ips=$(dig +short "$fqdn" 2>/dev/null | tr '\n' ' ')
    echo "   Result: ${local_ips:-<no response>}"
    echo ""

    echo "2. CLOUDFLARE NAMESERVER (authoritative)"
    echo "   dig +short $fqdn @$cf_ns"
    local cf_ips=$(dig +short "$fqdn" @"$cf_ns" 2>/dev/null | tr '\n' ' ')
    echo "   Result: ${cf_ips:-<no response>}"
    echo ""

    echo "3. GOOGLE DNS (8.8.8.8)"
    echo "   dig +short $fqdn @8.8.8.8"
    local google_ips=$(dig +short "$fqdn" @8.8.8.8 2>/dev/null | tr '\n' ' ')
    echo "   Result: ${google_ips:-<no response>}"
    echo ""

    # Analyze results
    echo "========================================"
    echo "ANALYSIS"
    echo ""

    # Check if proxied (Cloudflare IPs are 104.x.x.x or 172.67.x.x)
    if [[ "$cf_ips" =~ 104\. ]] || [[ "$cf_ips" =~ 172\.67\. ]]; then
        echo "Proxy Status: ENABLED (orange cloud)"
        echo "  Traffic routes through Cloudflare"
        echo "  Cloudflare handles SSL"
    else
        echo "Proxy Status: DISABLED (gray cloud) or not on Cloudflare"
        echo "  Traffic goes direct to origin"
        echo "  Origin IP exposed: $cf_ips"
    fi
    echo ""

    # Check propagation
    if [[ "$local_ips" != "$cf_ips" ]]; then
        echo "Propagation: PENDING"
        echo "  Local:       $local_ips"
        echo "  Cloudflare:  $cf_ips"
        echo ""
        echo "  Fix: Flush local DNS cache"
        echo "    macOS:  sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder"
        echo "    Linux:  sudo systemd-resolve --flush-caches"
    else
        echo "Propagation: COMPLETE"
        echo "  All resolvers return: $cf_ips"
    fi
}

# =============================================================================
# WILDCARD RECORDS
# =============================================================================

# Add or manage wildcard DNS record
nh_cf_wildcard() {
    local action="$1"
    local pattern="$2"
    local ip="$3"

    if [[ -z "$action" ]]; then
        cat << 'EOF'
Usage: nh cf wildcard <action> <pattern> [ip]

ACTIONS
    add <pattern> <ip>     Add wildcard record
    remove <pattern>       Remove wildcard record
    show <zone>            Show wildcard records for zone
    test <fqdn>            Test if FQDN matches a wildcard

PATTERNS
    *.example.com          Match all subdomains (app.example.com)
    *.dev.example.com      Match dev subdomains (app.dev.example.com)

EXAMPLES
    nh cf wildcard add *.nodeholder.com 68.183.248.67
    nh cf wildcard add *.dev.nodeholder.com 68.183.248.67
    nh cf wildcard show nodeholder.com
    nh cf wildcard test app.dev.nodeholder.com
    nh cf wildcard remove *.dev.nodeholder.com

CLOUDFLARE WILDCARD RULES

  Free Plan Limitations:
    - Wildcard records CANNOT be proxied (always gray cloud)
    - This means NO Cloudflare SSL for wildcard subdomains
    - You need SSL certs on origin (Let's Encrypt, etc.)

  Pro/Business/Enterprise:
    - Wildcard records CAN be proxied (orange cloud)
    - Cloudflare provides SSL for *.example.com

  How Wildcards Work:
    - *.example.com matches: app.example.com, api.example.com
    - *.example.com does NOT match: app.dev.example.com (need *.dev.example.com)
    - Specific records override wildcards (docs.example.com beats *.example.com)

  Recommended Setup (Free Plan):
    1. Use wildcards for dev/staging (gray cloud, origin cert)
    2. Add specific proxied records for production domains

    Example:
      *.dev.nodeholder.com   -> 68.183.248.67 (gray, origin cert)
      app.nodeholder.com     -> 68.183.248.67 (orange, CF SSL)
EOF
        return 1
    fi

    case "$action" in
        add)
            if [[ -z "$pattern" || -z "$ip" ]]; then
                echo "Usage: nh cf wildcard add <pattern> <ip>"
                echo "Example: nh cf wildcard add *.dev.nodeholder.com 68.183.248.67"
                return 1
            fi

            if [[ ! "$pattern" =~ ^\*\. ]]; then
                echo "Pattern must start with *. (e.g., *.example.com)" >&2
                return 1
            fi

            _cf_load_creds || return 1

            # Extract zone (everything after *.)
            local zone="${pattern#\*.}"
            # Get root zone (last two parts)
            local root_zone=$(echo "$zone" | awk -F. '{print $(NF-1)"."$NF}')
            local zone_id=$(_cf_zone_id "$root_zone") || return 1

            # The "name" for API is the wildcard prefix
            # *.dev.example.com -> name is "*.dev"
            local name="${pattern%.$root_zone}"

            echo "Adding wildcard record:"
            echo "  Pattern: $pattern"
            echo "  Zone:    $root_zone ($zone_id)"
            echo "  Name:    $name"
            echo "  IP:      $ip"
            echo "  Proxied: false (wildcards cannot be proxied on free plan)"
            echo ""

            local data=$(jq -n \
                --arg name "$name" \
                --arg content "$ip" \
                '{type: "A", name: $name, content: $content, proxied: false, ttl: 1}')

            local response=$(_cf_curl POST "/zones/$zone_id/dns_records" -d "$data")

            if echo "$response" | jq -e '.success' >/dev/null 2>&1; then
                echo "Wildcard record created!"
                echo ""
                echo "Note: Wildcard records are DNS-only (gray cloud)."
                echo "For HTTPS, you need SSL certs on your origin server."
                echo ""
                echo "Get Let's Encrypt wildcard cert:"
                echo "  certbot certonly --manual --preferred-challenges=dns \\"
                echo "    -d '$pattern' -d '${pattern#\*.}'"
            else
                echo "Failed:" >&2
                echo "$response" | jq -r '.errors[]?.message // .' >&2
                return 1
            fi
            ;;

        remove|rm)
            if [[ -z "$pattern" ]]; then
                echo "Usage: nh cf wildcard remove <pattern>"
                return 1
            fi

            _cf_load_creds || return 1

            local zone="${pattern#\*.}"
            local root_zone=$(echo "$zone" | awk -F. '{print $(NF-1)"."$NF}')
            local zone_id=$(_cf_zone_id "$root_zone") || return 1

            # Find the record
            local response=$(_cf_curl GET "/zones/$zone_id/dns_records?name=$pattern&type=A")
            local record_id=$(echo "$response" | jq -r '.result[0].id // empty')

            if [[ -z "$record_id" ]]; then
                echo "Wildcard record not found: $pattern" >&2
                return 1
            fi

            echo "Removing wildcard: $pattern (ID: $record_id)"
            read -rp "Confirm? [y/N] " confirm
            [[ "$confirm" != "y" && "$confirm" != "Y" ]] && { echo "Cancelled"; return 1; }

            response=$(_cf_curl DELETE "/zones/$zone_id/dns_records/$record_id")

            if echo "$response" | jq -e '.success' >/dev/null 2>&1; then
                echo "Removed."
            else
                echo "Failed:" >&2
                echo "$response" | jq -r '.errors[]?.message // .' >&2
                return 1
            fi
            ;;

        show)
            local zone="$pattern"
            if [[ -z "$zone" ]]; then
                echo "Usage: nh cf wildcard show <zone>"
                return 1
            fi

            _cf_load_creds || return 1
            local zone_id=$(_cf_zone_id "$zone") || return 1

            echo "Wildcard records for $zone:"
            echo ""

            local response=$(_cf_curl GET "/zones/$zone_id/dns_records")
            local wildcards=$(echo "$response" | jq -r '.result[] | select(.name | startswith("*")) | "\(.name)\t\(.content)\t\(.proxied)"')

            if [[ -z "$wildcards" ]]; then
                echo "  No wildcard records found"
                echo ""
                echo "  Add one with: nh cf wildcard add *.$zone <ip>"
            else
                printf "  %-30s %-18s %s\n" "PATTERN" "IP" "PROXIED"
                printf "  %-30s %-18s %s\n" "-------" "--" "-------"
                echo "$wildcards" | while IFS=$'\t' read -r name content proxied; do
                    printf "  %-30s %-18s %s\n" "$name" "$content" "$proxied"
                done
            fi
            ;;

        test)
            local fqdn="$pattern"
            if [[ -z "$fqdn" ]]; then
                echo "Usage: nh cf wildcard test <fqdn>"
                return 1
            fi

            _cf_load_creds || return 1

            local zone=$(echo "$fqdn" | awk -F. '{print $(NF-1)"."$NF}')
            local zone_id=$(_cf_zone_id "$zone") || return 1

            echo "Testing: $fqdn"
            echo ""

            # Check for exact match first
            local response=$(_cf_curl GET "/zones/$zone_id/dns_records?name=$fqdn&type=A")
            local exact=$(echo "$response" | jq -r '.result[0] // empty')

            if [[ -n "$exact" && "$exact" != "null" ]]; then
                echo "1. EXACT MATCH FOUND"
                echo "   Record: $fqdn -> $(echo "$exact" | jq -r '.content')"
                echo "   Proxied: $(echo "$exact" | jq -r '.proxied')"
                echo ""
                echo "   This record takes precedence over any wildcard."
                return 0
            fi

            echo "1. No exact match for $fqdn"
            echo ""

            # Check for wildcard matches
            echo "2. WILDCARD SEARCH"

            # Build possible wildcard patterns
            # app.dev.example.com could match: *.dev.example.com or *.example.com
            local parts
            IFS='.' read -ra parts <<< "$fqdn"
            local len=${#parts[@]}

            local found_wildcard=""
            for ((i=1; i<len-1; i++)); do
                local wildcard_pattern="*"
                for ((j=i; j<len; j++)); do
                    wildcard_pattern+=".${parts[$j]}"
                done

                response=$(_cf_curl GET "/zones/$zone_id/dns_records?name=$wildcard_pattern&type=A")
                local wc=$(echo "$response" | jq -r '.result[0] // empty')

                if [[ -n "$wc" && "$wc" != "null" ]]; then
                    echo "   MATCH: $wildcard_pattern -> $(echo "$wc" | jq -r '.content')"
                    echo "   Proxied: $(echo "$wc" | jq -r '.proxied')"
                    found_wildcard="$wildcard_pattern"
                    break
                else
                    echo "   No: $wildcard_pattern"
                fi
            done

            echo ""
            if [[ -n "$found_wildcard" ]]; then
                echo "RESULT: $fqdn will resolve via $found_wildcard"

                # Check if proxied
                if echo "$wc" | jq -e '.proxied == false' >/dev/null; then
                    echo ""
                    echo "WARNING: Wildcard is not proxied (gray cloud)"
                    echo "  - No Cloudflare SSL"
                    echo "  - Origin IP exposed"
                    echo "  - Need cert on origin for HTTPS"
                fi
            else
                echo "RESULT: No wildcard covers $fqdn"
                echo ""
                echo "Options:"
                echo "  1. Add specific record: nh cf add $fqdn <ip> A true"
                echo "  2. Add wildcard: nh cf wildcard add *.${fqdn#*.} <ip>"
            fi
            ;;

        *)
            echo "Unknown action: $action"
            echo "Use: add, remove, show, test"
            return 1
            ;;
    esac
}

# =============================================================================
# STATUS CHECK
# =============================================================================

# Full diagnostic for a domain
nh_cf_check() {
    local fqdn="$1"

    if [[ -z "$fqdn" ]]; then
        echo "Usage: nh cf check <fqdn>"
        echo ""
        echo "Full diagnostic: DNS, SSL, proxy status, and connectivity"
        return 1
    fi

    local zone=$(echo "$fqdn" | awk -F. '{print $(NF-1)"."$NF}')

    echo "Checking: $fqdn"
    echo "========================================"
    echo ""

    # 1. Cloudflare record status
    echo "1. CLOUDFLARE RECORD"
    _cf_load_creds || return 1
    local zone_id=$(_cf_zone_id "$zone") || return 1

    local response=$(_cf_curl GET "/zones/$zone_id/dns_records?name=$fqdn")
    local record=$(echo "$response" | jq -r '.result[0] // empty')

    if [[ -z "$record" || "$record" == "null" ]]; then
        echo "   NOT FOUND in Cloudflare"
        echo "   Add with: nh cf add $fqdn <ip>"
        return 1
    fi

    local rec_type=$(echo "$record" | jq -r '.type')
    local content=$(echo "$record" | jq -r '.content')
    local proxied=$(echo "$record" | jq -r '.proxied')

    echo "   Type:    $rec_type"
    echo "   Content: $content"
    if [[ "$proxied" == "true" ]]; then
        echo "   Proxy:   ON (orange cloud)"
    else
        echo "   Proxy:   OFF (gray cloud)"
    fi
    echo ""

    # 2. SSL Mode
    echo "2. SSL MODE"
    response=$(_cf_curl GET "/zones/$zone_id/settings/ssl")
    local ssl_mode=$(echo "$response" | jq -r '.result.value // "unknown"')
    echo "   Mode: $ssl_mode"
    case "$ssl_mode" in
        flexible)
            if [[ "$proxied" == "true" ]]; then
                echo "   OK: Cloudflare provides SSL to browsers"
            else
                echo "   WARN: flexible mode but proxy OFF - no SSL!"
            fi
            ;;
        full|strict)
            echo "   Requires SSL cert on origin server"
            ;;
    esac
    echo ""

    # 3. DNS Resolution
    echo "3. DNS RESOLUTION"
    local resolved=$(dig +short "$fqdn" | head -1)
    echo "   Resolves to: ${resolved:-<failed>}"

    if [[ "$proxied" == "true" ]]; then
        if [[ "$resolved" =~ 104\. ]] || [[ "$resolved" =~ 172\.67\. ]]; then
            echo "   OK: Showing Cloudflare IP (proxy working)"
        else
            echo "   WAIT: Still showing origin IP, DNS propagating..."
        fi
    else
        if [[ "$resolved" == "$content" ]]; then
            echo "   OK: Showing origin IP (proxy off)"
        fi
    fi
    echo ""

    # 4. HTTP/HTTPS Check
    echo "4. CONNECTIVITY"

    # HTTP
    local http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://$fqdn" 2>/dev/null)
    echo "   HTTP:  ${http_code:-timeout}"

    # HTTPS (use Cloudflare IP if proxied and local DNS stale)
    local https_code
    if [[ "$proxied" == "true" ]] && ! [[ "$resolved" =~ 104\. ]] && ! [[ "$resolved" =~ 172\.67\. ]]; then
        # Local DNS stale, test via Cloudflare IP
        local cf_ip=$(dig +short "$fqdn" @8.8.8.8 | head -1)
        https_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 \
            --resolve "$fqdn:443:$cf_ip" "https://$fqdn" 2>/dev/null)
        echo "   HTTPS: ${https_code:-timeout} (via Cloudflare IP, local DNS stale)"
    else
        https_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "https://$fqdn" 2>/dev/null)
        echo "   HTTPS: ${https_code:-timeout}"
    fi
    echo ""

    # 5. Summary
    echo "========================================"
    echo "SUMMARY"
    if [[ "$proxied" == "true" && "$ssl_mode" == "flexible" && "$https_code" == "200" ]]; then
        echo "  All good! Site is live with Cloudflare SSL"
    elif [[ "$proxied" == "false" && "$https_code" != "200" ]]; then
        echo "  HTTPS failing - proxy is OFF"
        echo "  Fix: nh cf proxy $fqdn on"
    elif [[ "$https_code" != "200" ]]; then
        echo "  HTTPS not working (code: $https_code)"
        echo "  Check: proxy status, SSL mode, origin server"
    else
        echo "  HTTP: $http_code, HTTPS: $https_code"
    fi
}

# =============================================================================
# SNAPSHOT
# =============================================================================

# Save current state to cloudflare.json
nh_cf_snapshot() {
    _cf_load_creds || return 1

    local context=$(nh_context)
    local output_file="$NH_DIR/$context/cloudflare.json"

    echo "Fetching Cloudflare data..."

    # Get zones
    local zones_response=$(_cf_curl GET "/zones")

    if ! echo "$zones_response" | jq -e '.success' >/dev/null 2>&1; then
        echo "Failed to fetch zones" >&2
        return 1
    fi

    local zones=$(echo "$zones_response" | jq '.result')
    local zone_count=$(echo "$zones" | jq 'length')
    echo "  Found $zone_count zones"

    # Build records object
    local records="{}"

    for zone_id in $(echo "$zones" | jq -r '.[].id'); do
        local zone_name=$(echo "$zones" | jq -r ".[] | select(.id==\"$zone_id\") | .name")
        echo "  Fetching records for $zone_name..."

        local records_response=$(_cf_curl GET "/zones/$zone_id/dns_records")
        local zone_records=$(echo "$records_response" | jq '[.result[] | {type, name, content, proxied, ttl}]')

        records=$(echo "$records" | jq --arg zone "$zone_name" --argjson recs "$zone_records" '. + {($zone): $recs}')
    done

    # Combine and save
    local snapshot=$(jq -n \
        --argjson zones "$zones" \
        --argjson records "$records" \
        --arg timestamp "$(date -Iseconds)" \
        '{
            timestamp: $timestamp,
            zones: [$zones[] | {id, name, status, name_servers}],
            records: $records
        }')

    echo "$snapshot" > "$output_file"
    echo ""
    echo "Saved to: $output_file"
    echo "  Zones: $zone_count"
    echo "  Records: $(echo "$records" | jq '[.[]] | add | length')"
}

# =============================================================================
# INIT
# =============================================================================

nh_cf_init() {
    local context=$(nh_context)
    local creds_file="$NH_DIR/$context/cloudflare.env"

    if [[ -f "$creds_file" ]]; then
        echo "Cloudflare credentials already exist: $creds_file"
        read -rp "Overwrite? [y/N] " confirm
        [[ "$confirm" != "y" && "$confirm" != "Y" ]] && return 1
    fi

    cat > "$creds_file" << 'EOF'
# Cloudflare API credentials
# Created: $(date -Iseconds)
#
# Create token at: https://dash.cloudflare.com/profile/api-tokens
# Required permissions:
#   - Zone > DNS > Edit
#   - Zone > Zone > Read

export CF_API_TOKEN=

# Zone IDs (populated by: nh cf snapshot)
# export CF_ZONE_NODEHOLDER_COM=
EOF

    echo "Created: $creds_file"
    echo ""
    echo "Next steps:"
    echo "  1. Edit $creds_file and add your CF_API_TOKEN"
    echo "  2. Run: nh cf zones (to test)"
    echo "  3. Run: nh cf snapshot (to save zone IDs)"
}

# =============================================================================
# DISPATCHER
# =============================================================================

nh_cf() {
    local cmd="${1:-help}"
    shift 2>/dev/null || true

    case "$cmd" in
        zones)      nh_cf_zones "$@" ;;
        records)    nh_cf_records "$@" ;;
        add)        nh_cf_add "$@" ;;
        remove|rm)  nh_cf_remove "$@" ;;
        proxy)      nh_cf_proxy "$@" ;;
        ssl)        nh_cf_ssl "$@" ;;
        dig)        nh_cf_dig "$@" ;;
        check)      nh_cf_check "$@" ;;
        wildcard|wc) nh_cf_wildcard "$@" ;;
        snapshot)   nh_cf_snapshot "$@" ;;
        init)       nh_cf_init "$@" ;;
        help|--help|-h)
            cat << 'EOF'
nh cf - Cloudflare DNS management

SETUP
    nh cf init                    Create cloudflare.env template
    nh cf zones                   List all zones

RECORDS
    nh cf records <zone>          List DNS records for zone
    nh cf add <fqdn> <ip>         Add A record (gray cloud)
    nh cf add <fqdn> <ip> A true  Add A record (orange cloud)
    nh cf remove <fqdn>           Remove DNS record

PROXY (orange/gray cloud)
    nh cf proxy <fqdn>            Show proxy status
    nh cf proxy <fqdn> on         Enable proxy (Cloudflare SSL)
    nh cf proxy <fqdn> off        Disable proxy (direct to origin)

SSL MODE (zone-wide)
    nh cf ssl <zone>              Show SSL mode
    nh cf ssl <zone> flexible     CF handles SSL, HTTP to origin
    nh cf ssl <zone> full         End-to-end HTTPS (self-signed OK)
    nh cf ssl <zone> strict       End-to-end HTTPS (valid cert)

WILDCARDS
    nh cf wildcard                Show wildcard help & rules
    nh cf wildcard add <pattern> <ip>   Add wildcard (e.g., *.dev.example.com)
    nh cf wildcard show <zone>    List wildcard records
    nh cf wildcard test <fqdn>    Test if FQDN matches a wildcard
    nh cf wildcard remove <pattern>     Remove wildcard record

DIAGNOSTICS
    nh cf dig <fqdn>              DNS propagation check
    nh cf check <fqdn>            Full diagnostic (DNS, SSL, HTTP)
    nh cf snapshot                Save zones/records to cloudflare.json

COMMON WORKFLOWS

  New subdomain with Cloudflare SSL (no origin cert):
    nh cf add app.example.com 1.2.3.4 A true
    nh cf ssl example.com flexible
    nh cf check app.example.com

  Debug HTTPS not working:
    nh cf check broken.example.com
    nh cf proxy broken.example.com on
    nh cf dig broken.example.com

  DNS not propagating:
    nh cf dig slow.example.com
    # Then flush local cache (see output for commands)

CLOUDFLARE CONCEPTS

  Proxy ON (orange cloud):
    - Cloudflare terminates SSL (handles certs automatically)
    - Hides origin IP (shows 104.x.x.x or 172.67.x.x)
    - Enables CDN, DDoS protection, analytics
    - Use with SSL mode "flexible" if no origin cert

  Proxy OFF (gray cloud):
    - Direct connection to origin server
    - You must have SSL cert on origin for HTTPS
    - Exposes origin IP address
    - Use for: mail servers, SSH, non-HTTP services

  SSL Modes:
    flexible  - Browser->CF: HTTPS, CF->Origin: HTTP
    full      - End-to-end HTTPS (self-signed OK)
    strict    - End-to-end HTTPS (valid CA cert required)
EOF
            ;;
        *)
            echo "Unknown: cf $cmd"
            echo "Try: nh cf help"
            return 1
            ;;
    esac
}

export -f nh_cf nh_cf_zones nh_cf_records nh_cf_add nh_cf_remove \
       nh_cf_proxy nh_cf_ssl nh_cf_dig nh_cf_check nh_cf_wildcard \
       nh_cf_snapshot nh_cf_init
