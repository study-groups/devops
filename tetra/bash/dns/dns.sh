#!/usr/bin/env bash
# dns.sh - DNS Management Command Router
#
# Two modes:
#   1. Check/lookup (no auth needed): dns check, dns ns, dns where
#   2. Provider operations (auth required): dns rc, dns do, dns cf
#
# Usage:
#   dns check example.com      - Full DNS health check
#   dns ns example.com         - Show nameservers
#   dns where example.com      - Identify DNS provider
#   dns rc list example.com    - Provider-specific operations

DNS_SRC="${TETRA_SRC}/bash/dns"

# Load providers
[[ -f "$DNS_SRC/dns_rc.sh" ]] && source "$DNS_SRC/dns_rc.sh"
[[ -f "$DNS_SRC/dns_remote.sh" ]] && source "$DNS_SRC/dns_remote.sh"

# =============================================================================
# DNS LOOKUP / CHECK UTILITIES (no auth needed)
# =============================================================================

dns_whatsmyip() {
    local ip
    ip=$(curl -s https://api.ipify.org)

    if [[ $? -eq 0 && -n "$ip" ]]; then
        echo "$ip"
    else
        echo "Failed to retrieve public IP" >&2
        return 1
    fi
}

# Get nameservers for a domain
dns_ns() {
    local domain="$1"

    if [[ -z "$domain" ]]; then
        echo ""
        echo "Usage: dns ns <domain>"
        echo ""
        echo "Shows the nameservers for a domain."
        echo "This tells you where DNS is hosted/managed."
        echo ""
        return 1
    fi

    # Strip any subdomains to get root domain
    local root_domain
    root_domain=$(echo "$domain" | awk -F. '{print $(NF-1)"."$NF}')

    echo ""
    echo "Nameservers for $root_domain"
    echo "════════════════════════════"
    echo ""

    local ns_records
    ns_records=$(dig +short NS "$root_domain" 2>/dev/null)

    if [[ -z "$ns_records" ]]; then
        echo "No nameservers found."
        echo ""
        echo "This could mean:"
        echo "  • Domain doesn't exist"
        echo "  • Domain is expired"
        echo "  • DNS not configured yet"
        echo ""
        echo "Check registration at: https://whois.domaintools.com/$root_domain"
        echo ""
        return 1
    fi

    echo "$ns_records" | while read -r ns; do
        echo "  $ns"
    done
    echo ""
}

# Identify which provider manages DNS for a domain
dns_where() {
    local domain="$1"

    if [[ -z "$domain" ]]; then
        echo ""
        echo "Usage: dns where <domain>"
        echo ""
        echo "Identifies which DNS provider manages a domain."
        echo ""
        return 1
    fi

    # Strip subdomains
    local root_domain
    root_domain=$(echo "$domain" | awk -F. '{print $(NF-1)"."$NF}')

    echo ""
    echo "DNS Provider Detection: $root_domain"
    echo "═══════════════════════════════════════"
    echo ""

    local ns_records
    ns_records=$(dig +short NS "$root_domain" 2>/dev/null | tr '[:upper:]' '[:lower:]')

    if [[ -z "$ns_records" ]]; then
        echo "Could not find nameservers for $root_domain"
        echo ""
        return 1
    fi

    local provider="unknown"
    local provider_url=""
    local tetra_cmd=""

    # Detect provider from nameserver patterns
    if echo "$ns_records" | grep -q "resellerclub\|domaincontrol\|secureserver\|orderbox-dns"; then
        provider="Reseller Club"
        provider_url="https://manage.resellerclub.com"
        tetra_cmd="dns rc"
    elif echo "$ns_records" | grep -q "digitalocean"; then
        provider="DigitalOcean"
        provider_url="https://cloud.digitalocean.com/networking/domains"
        tetra_cmd="dns do"
    elif echo "$ns_records" | grep -q "cloudflare"; then
        provider="CloudFlare"
        provider_url="https://dash.cloudflare.com"
        tetra_cmd="dns cf"
    elif echo "$ns_records" | grep -q "awsdns\|amazonaws"; then
        provider="AWS Route 53"
        provider_url="https://console.aws.amazon.com/route53"
        tetra_cmd="(not implemented)"
    elif echo "$ns_records" | grep -q "google\|googledomains"; then
        provider="Google Domains / Cloud DNS"
        provider_url="https://domains.google.com"
        tetra_cmd="(not implemented)"
    elif echo "$ns_records" | grep -q "namecheap\|registrar-servers"; then
        provider="Namecheap"
        provider_url="https://ap.www.namecheap.com"
        tetra_cmd="(not implemented)"
    elif echo "$ns_records" | grep -q "hover"; then
        provider="Hover"
        provider_url="https://www.hover.com/control_panel"
        tetra_cmd="(not implemented)"
    fi

    echo "Provider: $provider"
    echo ""
    echo "Nameservers:"
    echo "$ns_records" | while read -r ns; do
        echo "  $ns"
    done
    echo ""

    if [[ -n "$provider_url" ]]; then
        echo "Manage at: $provider_url"
    fi

    if [[ "$tetra_cmd" != "(not implemented)" && -n "$tetra_cmd" ]]; then
        echo ""
        echo "Tetra commands:"
        echo "  $tetra_cmd list $root_domain"
        echo "  $tetra_cmd add $root_domain CNAME www ghs.googlehosted.com"
    fi
    echo ""
}

# Full DNS health check for a domain
dns_check() {
    local domain="$1"

    if [[ -z "$domain" ]]; then
        echo ""
        echo "Usage: dns check <domain>"
        echo ""
        echo "Performs a full DNS health check:"
        echo "  • Nameserver lookup"
        echo "  • Provider detection"
        echo "  • A/CNAME records for root and www"
        echo "  • MX records (email)"
        echo ""
        return 1
    fi

    # Strip subdomains for root checks
    local root_domain
    root_domain=$(echo "$domain" | awk -F. '{print $(NF-1)"."$NF}')

    echo ""
    echo "DNS Health Check: $root_domain"
    echo "══════════════════════════════════════════════════════════════"
    echo ""

    # Nameservers
    echo "[Nameservers]"
    local ns_records
    ns_records=$(dig +short NS "$root_domain" 2>/dev/null)
    if [[ -n "$ns_records" ]]; then
        echo "$ns_records" | while read -r ns; do
            echo "  ✓ $ns"
        done
    else
        echo "  ✗ No nameservers found"
    fi
    echo ""

    # Provider detection (inline)
    local provider="Unknown"
    local ns_lower=$(echo "$ns_records" | tr '[:upper:]' '[:lower:]')
    if echo "$ns_lower" | grep -q "resellerclub\|domaincontrol\|orderbox-dns"; then
        provider="Reseller Club"
    elif echo "$ns_lower" | grep -q "digitalocean"; then
        provider="DigitalOcean"
    elif echo "$ns_lower" | grep -q "cloudflare"; then
        provider="CloudFlare"
    elif echo "$ns_lower" | grep -q "awsdns"; then
        provider="AWS Route 53"
    elif echo "$ns_lower" | grep -q "google"; then
        provider="Google"
    fi
    echo "[Provider] $provider"
    echo ""

    # Root domain A record
    echo "[Root Domain: $root_domain]"
    local root_a=$(dig +short A "$root_domain" 2>/dev/null)
    local root_cname=$(dig +short CNAME "$root_domain" 2>/dev/null)
    if [[ -n "$root_a" ]]; then
        echo "  A:     $root_a"
    elif [[ -n "$root_cname" ]]; then
        echo "  CNAME: $root_cname"
    else
        echo "  (no A or CNAME record)"
    fi
    echo ""

    # WWW subdomain
    echo "[WWW: www.$root_domain]"
    local www_a=$(dig +short A "www.$root_domain" 2>/dev/null)
    local www_cname=$(dig +short CNAME "www.$root_domain" 2>/dev/null)
    if [[ -n "$www_cname" ]]; then
        echo "  CNAME: $www_cname"
        # Check if it's Google Sites
        if [[ "$www_cname" == *"ghs.googlehosted.com"* ]]; then
            echo "  → Points to Google Sites ✓"
        fi
    elif [[ -n "$www_a" ]]; then
        echo "  A:     $www_a"
    else
        echo "  (no record - www won't work)"
    fi
    echo ""

    # MX records (email)
    echo "[Email: MX records]"
    local mx_records=$(dig +short MX "$root_domain" 2>/dev/null)
    if [[ -n "$mx_records" ]]; then
        echo "$mx_records" | while read -r mx; do
            echo "  $mx"
        done
        if echo "$mx_records" | grep -qi "google\|aspmx"; then
            echo "  → Google Workspace email"
        fi
    else
        echo "  (no MX records - email won't work)"
    fi
    echo ""

    # TXT records (SPF, verification)
    echo "[TXT Records]"
    local txt_records=$(dig +short TXT "$root_domain" 2>/dev/null | head -3)
    if [[ -n "$txt_records" ]]; then
        echo "$txt_records" | while read -r txt; do
            local short_txt="${txt:0:60}"
            [[ ${#txt} -gt 60 ]] && short_txt="${short_txt}..."
            echo "  $short_txt"
        done
    else
        echo "  (none)"
    fi
    echo ""
}

# Resolve a domain to its final IP
dns_resolve() {
    local domain="$1"

    if [[ -z "$domain" ]]; then
        echo "Usage: dns resolve <domain>"
        return 1
    fi

    echo ""
    echo "Resolving: $domain"
    echo ""

    # Follow CNAME chain
    local current="$domain"
    local depth=0
    local max_depth=10

    while [[ $depth -lt $max_depth ]]; do
        local cname=$(dig +short CNAME "$current" 2>/dev/null)
        if [[ -n "$cname" ]]; then
            echo "  CNAME → $cname"
            current="${cname%.}"  # Remove trailing dot
            ((depth++))
        else
            break
        fi
    done

    local ip=$(dig +short A "$current" 2>/dev/null | head -1)
    if [[ -n "$ip" ]]; then
        echo "  A     → $ip"
        echo ""
        echo "Final: $ip"
    else
        echo "  (no A record found)"
    fi
    echo ""
}

# =============================================================================
# DOCTOR / DIAGNOSTICS
# =============================================================================

dns_doctor() {
    local domain="${1:-}"

    echo ""
    echo "DNS Tools Doctor"
    echo "════════════════"
    echo ""

    # Check basic tools
    echo "[Prerequisites]"

    if command -v dig &>/dev/null; then
        echo "  ✓ dig installed"
    else
        echo "  ✗ dig not found (install: brew install bind or apt install dnsutils)"
    fi

    if command -v curl &>/dev/null; then
        echo "  ✓ curl installed"
    else
        echo "  ✗ curl not found"
    fi

    if command -v python3 &>/dev/null; then
        echo "  ✓ python3 installed"
    else
        echo "  ⚠ python3 not found (some features may not work)"
    fi
    echo ""

    # Check provider credentials
    echo "[Provider Credentials]"

    if [[ -n "$RC_AUTH_USERID" && -n "$RC_API_KEY" ]]; then
        echo "  ✓ Reseller Club: configured"
        echo "    Run 'dns rc doctor' for full check"
    else
        echo "  ○ Reseller Club: not configured"
        echo "    Run 'dns rc doctor' for setup help"
    fi

    if [[ -n "$DO_API_TOKEN" ]]; then
        echo "  ✓ DigitalOcean: configured"
    else
        echo "  ○ DigitalOcean: not configured"
    fi

    if [[ -n "$CF_API_TOKEN" ]]; then
        echo "  ✓ CloudFlare: configured"
    else
        echo "  ○ CloudFlare: not configured"
    fi
    echo ""

    # If domain provided, check it
    if [[ -n "$domain" ]]; then
        echo "[Domain Check: $domain]"
        dns_where "$domain" 2>/dev/null | grep -E "Provider:|Tetra commands:" | sed 's/^/  /'
    fi

    echo ""
    echo "Quick checks:"
    echo "  dns check <domain>     Full DNS health check"
    echo "  dns where <domain>     Find DNS provider"
    echo "  dns rc doctor          Reseller Club setup"
    echo ""
}

# =============================================================================
# MAIN ROUTER
# =============================================================================

dns() {
    local cmd="${1:-help}"
    shift 2>/dev/null || true

    case "$cmd" in
        # Diagnostics
        doctor)       dns_doctor "$@" ;;

        # Lookup/check commands (no auth needed)
        check)        dns_check "$@" ;;
        ns)           dns_ns "$@" ;;
        where|provider) dns_where "$@" ;;
        resolve)      dns_resolve "$@" ;;
        whatsmyip|ip) dns_whatsmyip ;;

        # Provider commands (auth required)
        rc)           dns_rc "$@" ;;
        remote)       dns_remote "$@" ;;  # Via whitelisted server
        # do)         dns_do "$@" ;;  # Future
        # cf)         dns_cf "$@" ;;  # Future

        help|--help|-h|*)
            echo ""
            echo "dns - Domain Name System Tools"
            echo "══════════════════════════════"
            echo ""
            echo "First time? Run:"
            echo "  dns doctor              Check setup"
            echo "  dns rc doctor           Reseller Club setup"
            echo ""
            echo "Check & Lookup (no auth needed):"
            echo "  dns check <domain>      Full DNS health check"
            echo "  dns where <domain>      Identify DNS provider"
            echo "  dns ns <domain>         Show nameservers"
            echo "  dns resolve <domain>    Follow CNAME chain to IP"
            echo "  dns ip                  Show your public IP"
            echo ""
            echo "Provider Operations (auth required):"
            echo "  dns rc <cmd>            Reseller Club (direct)"
            echo "  dns remote <cmd>        Via nodeholder (whitelisted)"
            echo "  dns do <cmd>            DigitalOcean (planned)"
            echo "  dns cf <cmd>            CloudFlare (planned)"
            echo ""
            echo "Examples:"
            echo "  dns check transreal.com"
            echo "  dns where transreal.com"
            echo "  dns rc google-sites transreal.com"
            echo ""
            ;;
    esac
}

export -f dns_doctor

export -f dns dns_check dns_ns dns_where dns_resolve dns_whatsmyip
