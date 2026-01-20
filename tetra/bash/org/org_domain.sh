#!/usr/bin/env bash
# org_domain.sh - Domain-first organization management
#
# Domains are first-class citizens in an org.
# Each domain has its own directory with:
#   - dns.toml     DNS provider and record config
#   - sites.toml   What's hosted at this domain
#
# Structure:
#   $TETRA_DIR/orgs/<org>/domains/<domain.com>/
#       dns.toml
#       sites.toml
#
# Usage:
#   org domain add transreal.com [--provider rc]
#   org domain list
#   org domain check transreal.com
#   org domain remove transreal.com

# =============================================================================
# DOMAIN TEMPLATES
# =============================================================================

_org_domain_create_dns_toml() {
    local domain="$1"
    local provider="$2"
    local dest="$3"

    cat > "$dest" << EOF
# DNS Configuration for $domain
# Provider: ${provider:-detect}

[dns]
domain = "$domain"
provider = "${provider:-}"

# Nameservers (populated by 'org domain check')
# nameservers = []

# Records managed by tetra
# These are tracked here, actual changes via 'dns <provider> add/delete'
[dns.records]
# www = { type = "CNAME", value = "ghs.googlehosted.com", ttl = 3600 }
# @ = { type = "A", value = "1.2.3.4", ttl = 3600 }
EOF

    # Add provider-specific section if known
    case "$provider" in
        rc)
            cat >> "$dest" << 'EOF'

# Reseller Club credentials (in secrets.env)
# RC_AUTH_USERID, RC_API_KEY
[dns.rc]
api_endpoint = "https://httpapi.com/api"
EOF
            ;;
        do)
            cat >> "$dest" << 'EOF'

# DigitalOcean credentials (in secrets.env)
# DO_API_TOKEN
[dns.do]
api_endpoint = "https://api.digitalocean.com/v2"
EOF
            ;;
        cf)
            cat >> "$dest" << 'EOF'

# CloudFlare credentials (in secrets.env)
# CF_API_TOKEN, CF_ZONE_ID
[dns.cf]
api_endpoint = "https://api.cloudflare.com/client/v4"
EOF
            ;;
    esac
}

_org_domain_create_sites_toml() {
    local domain="$1"
    local dest="$2"

    cat > "$dest" << EOF
# Sites hosted at $domain
# Maps subdomains/paths to hosting targets

[sites]
domain = "$domain"

# Google Sites example:
# [sites.www]
# type = "google-sites"
# target = "https://sites.google.com/view/mysite"
# cname = "ghs.googlehosted.com"

# Server example:
# [sites.api]
# type = "server"
# target = "@prod"  # References [env.prod] in org config
# port = 3000

# Redirect example:
# [sites.root]
# type = "redirect"
# target = "https://www.$domain"
EOF
}

# =============================================================================
# DOMAIN COMMANDS
# =============================================================================

# Add a domain to the org
org_domain_add() {
    local domain="$1"
    local provider=""

    # Parse flags
    shift
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --provider|-p) provider="$2"; shift 2 ;;
            *) shift ;;
        esac
    done

    if [[ -z "$domain" ]]; then
        echo ""
        echo "Usage: org domain add <domain.com> [--provider rc|do|cf]"
        echo ""
        echo "Adds a domain to the current org for management."
        echo ""
        echo "Examples:"
        echo "  org domain add transreal.com"
        echo "  org domain add transreal.com --provider rc"
        echo ""
        return 1
    fi

    # Validate domain format (basic check)
    if [[ ! "$domain" =~ ^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$ ]]; then
        echo "Invalid domain format: $domain"
        return 1
    fi

    # Get current org
    local org_name
    org_name=$(org_active 2>/dev/null)
    if [[ -z "$org_name" || "$org_name" == "$ORG_NO_ACTIVE" ]]; then
        echo "No active org. Run: org switch <name>"
        return 1
    fi

    local org_dir="$TETRA_DIR/orgs/$org_name"
    local domain_dir="$org_dir/domains/$domain"

    if [[ -d "$domain_dir" ]]; then
        echo "Domain already exists: $domain"
        echo "  $domain_dir"
        return 1
    fi

    # Auto-detect provider if not specified
    if [[ -z "$provider" ]]; then
        echo "Detecting DNS provider for $domain..."
        local ns_info
        ns_info=$(dig +short NS "$domain" 2>/dev/null | tr '[:upper:]' '[:lower:]' | head -1)

        if [[ -n "$ns_info" ]]; then
            if echo "$ns_info" | grep -q "resellerclub\|domaincontrol\|secureserver"; then
                provider="rc"
                echo "  Detected: Reseller Club"
            elif echo "$ns_info" | grep -q "digitalocean"; then
                provider="do"
                echo "  Detected: DigitalOcean"
            elif echo "$ns_info" | grep -q "cloudflare"; then
                provider="cf"
                echo "  Detected: CloudFlare"
            else
                echo "  Could not detect provider (NS: $ns_info)"
                echo "  You can set it later in dns.toml"
            fi
        else
            echo "  No nameservers found - domain may be new"
        fi
    fi

    echo ""
    echo "Adding domain: $domain"

    # Create domain directory
    mkdir -p "$domain_dir"

    # Create config files
    _org_domain_create_dns_toml "$domain" "$provider" "$domain_dir/dns.toml"
    echo "  Created: domains/$domain/dns.toml"

    _org_domain_create_sites_toml "$domain" "$domain_dir/sites.toml"
    echo "  Created: domains/$domain/sites.toml"

    echo ""
    echo "Next steps:"
    echo "  org domain check $domain    Verify DNS and connectivity"
    echo "  Edit domains/$domain/sites.toml to configure what's hosted"
    echo ""

    if [[ -n "$provider" ]]; then
        echo "DNS commands:"
        echo "  dns $provider list $domain"
        echo "  dns $provider google-sites $domain"
        echo ""
    fi
}

# List domains in the org
org_domain_list() {
    local org_name
    org_name=$(org_active 2>/dev/null)
    if [[ -z "$org_name" || "$org_name" == "$ORG_NO_ACTIVE" ]]; then
        echo "No active org. Run: org switch <name>"
        return 1
    fi

    local domains_dir="$TETRA_DIR/orgs/$org_name/domains"

    echo ""
    echo "Domains in $org_name"
    echo "═══════════════════════════════════════"
    echo ""

    if [[ ! -d "$domains_dir" ]]; then
        echo "No domains configured yet."
        echo ""
        echo "Add one with: org domain add example.com"
        echo ""
        return 0
    fi

    local count=0
    for domain_dir in "$domains_dir"/*/; do
        [[ -d "$domain_dir" ]] || continue
        local domain=$(basename "$domain_dir")
        ((count++))

        # Get provider from dns.toml
        local provider=""
        if [[ -f "$domain_dir/dns.toml" ]]; then
            provider=$(grep '^provider = ' "$domain_dir/dns.toml" 2>/dev/null | cut -d'"' -f2)
        fi

        # Count sites
        local sites_count=0
        if [[ -f "$domain_dir/sites.toml" ]]; then
            sites_count=$(grep -c '^\[sites\.' "$domain_dir/sites.toml" 2>/dev/null || true)
            sites_count=${sites_count:-0}
        fi

        printf "  %-30s" "$domain"
        [[ -n "$provider" ]] && printf "  DNS: %-4s" "$provider"
        [[ "$sites_count" -gt 0 ]] 2>/dev/null && printf "  Sites: %d" "$sites_count"
        echo ""
    done

    if [[ $count -eq 0 ]]; then
        echo "No domains configured yet."
        echo ""
        echo "Add one with: org domain add example.com"
    fi
    echo ""
}

# Check domain DNS health and sync status
org_domain_check() {
    local domain="$1"

    if [[ -z "$domain" ]]; then
        echo ""
        echo "Usage: org domain check <domain.com>"
        echo ""
        return 1
    fi

    local org_name
    org_name=$(org_active 2>/dev/null)
    if [[ -z "$org_name" || "$org_name" == "$ORG_NO_ACTIVE" ]]; then
        echo "No active org. Run: org switch <name>"
        return 1
    fi

    local domain_dir="$TETRA_DIR/orgs/$org_name/domains/$domain"

    echo ""
    echo "Domain Check: $domain"
    echo "═══════════════════════════════════════"
    echo ""

    # Check if domain is configured in org
    if [[ -d "$domain_dir" ]]; then
        echo "[Org Config] ✓ Configured in $org_name"

        # Show provider
        local provider=""
        if [[ -f "$domain_dir/dns.toml" ]]; then
            provider=$(grep '^provider = ' "$domain_dir/dns.toml" 2>/dev/null | cut -d'"' -f2)
            [[ -n "$provider" ]] && echo "  Provider: $provider"
        fi
    else
        echo "[Org Config] ✗ Not configured"
        echo "  Add with: org domain add $domain"
    fi
    echo ""

    # DNS health check (reuse dns check)
    if type dns_check &>/dev/null; then
        dns_check "$domain" 2>/dev/null | tail -n +4
    else
        # Fallback basic check
        echo "[Nameservers]"
        dig +short NS "$domain" 2>/dev/null | while read -r ns; do
            echo "  $ns"
        done
        echo ""

        echo "[WWW]"
        local www_target=$(dig +short CNAME "www.$domain" 2>/dev/null)
        if [[ -n "$www_target" ]]; then
            echo "  CNAME: $www_target"
        else
            local www_ip=$(dig +short A "www.$domain" 2>/dev/null)
            if [[ -n "$www_ip" ]]; then
                echo "  A: $www_ip"
            else
                echo "  (not configured)"
            fi
        fi
    fi
}

# Remove a domain from org
org_domain_remove() {
    local domain="$1"

    if [[ -z "$domain" ]]; then
        echo "Usage: org domain remove <domain.com>"
        return 1
    fi

    local org_name
    org_name=$(org_active 2>/dev/null)
    if [[ -z "$org_name" || "$org_name" == "$ORG_NO_ACTIVE" ]]; then
        echo "No active org."
        return 1
    fi

    local domain_dir="$TETRA_DIR/orgs/$org_name/domains/$domain"

    if [[ ! -d "$domain_dir" ]]; then
        echo "Domain not found: $domain"
        return 1
    fi

    echo "Remove $domain from $org_name?"
    echo "  This only removes local config, not actual DNS records."
    echo ""
    echo -n "Continue? [y/N] "
    read -r confirm
    if [[ "$confirm" =~ ^[Yy] ]]; then
        rm -rf "$domain_dir"
        echo "Removed: $domain"
    else
        echo "Cancelled"
    fi
}

# =============================================================================
# MAIN ROUTER
# =============================================================================

org_domain() {
    local cmd="${1:-list}"
    shift 2>/dev/null || true

    case "$cmd" in
        add)    org_domain_add "$@" ;;
        list|ls) org_domain_list "$@" ;;
        check)  org_domain_check "$@" ;;
        remove|rm) org_domain_remove "$@" ;;
        help|--help|-h|*)
            echo ""
            echo "org domain - Domain Management"
            echo "══════════════════════════════"
            echo ""
            echo "Commands:"
            echo "  add <domain> [--provider rc|do|cf]"
            echo "  list                    Show all domains in org"
            echo "  check <domain>          DNS health check"
            echo "  remove <domain>         Remove domain from org"
            echo ""
            echo "Examples:"
            echo "  org domain add transreal.com --provider rc"
            echo "  org domain list"
            echo "  org domain check transreal.com"
            echo ""
            ;;
    esac
}

export -f org_domain org_domain_add org_domain_list org_domain_check org_domain_remove
