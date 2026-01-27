#!/usr/bin/env bash
# org/guide/helpers.sh - Helper functions for setup guide generation
#
# Pure bash functions for reading org config and checking status

# Simple TOML value extraction (handles quoted strings)
_org_guide_get_toml() {
    local file="$1"
    local key="$2"
    [[ ! -f "$file" ]] && return 1
    grep "^${key}[[:space:]]*=" "$file" 2>/dev/null | head -1 | sed 's/.*=[[:space:]]*"\{0,1\}\([^"]*\)"\{0,1\}/\1/' | tr -d '"'
}

# Get current date formatted
_org_guide_date() {
    date "+%b %d, %Y"
}

# Get short month year
_org_guide_month_year() {
    date "+%b %Y"
}

# Check if DNS credentials are configured
_org_guide_check_dns_creds() {
    local org_dir="$1"
    local secrets_file="$org_dir/secrets.env"

    if [[ -f "$secrets_file" ]]; then
        if grep -q "RC_AUTH_USERID=" "$secrets_file" && grep -q "RC_API_KEY=" "$secrets_file"; then
            echo "configured"
            return 0
        fi
    fi
    echo "missing"
    return 1
}

# Check if Stripe credentials are configured
_org_guide_check_stripe_creds() {
    local org_dir="$1"
    local secrets_file="$org_dir/secrets.env"

    if [[ -f "$secrets_file" ]]; then
        if grep -q "STRIPE_SECRET_KEY=" "$secrets_file"; then
            # Check if it's a real key (not placeholder)
            local key
            key=$(grep "STRIPE_SECRET_KEY=" "$secrets_file" | cut -d= -f2 | tr -d '"' | tr -d "'")
            if [[ "$key" == sk_live_* || "$key" == sk_test_* ]]; then
                echo "configured"
                return 0
            fi
        fi
    fi
    echo "missing"
    return 1
}

# Get WWW CNAME record via dig
_org_guide_get_www_cname() {
    local domain="$1"
    dig +short CNAME "www.$domain" 2>/dev/null | head -1 | tr -d '.'
}

# Read all org config into variables
# Sets: ORG_* variables for use by templates
_org_guide_read_config() {
    local org_name="$1"
    local org_dir="$TETRA_DIR/orgs/$org_name"

    # Org identity
    ORG_NAME="$org_name"
    ORG_DISPLAY="${org_name^}"
    ORG_TYPE=$(_org_guide_get_toml "$org_dir/sections/00-org.toml" "type")
    ORG_PLATFORM=$(_org_guide_get_toml "$org_dir/sections/00-org.toml" "platform")

    # Google config
    GOOGLE_EMAIL=$(_org_guide_get_toml "$org_dir/sections/20-google.toml" "owner_email")
    GOOGLE_SITE_URL=$(_org_guide_get_toml "$org_dir/sections/20-google.toml" "site_url")
    GOOGLE_CUSTOM_DOMAIN=$(_org_guide_get_toml "$org_dir/sections/20-google.toml" "custom_domain")
    GOOGLE_GA4_ID=$(_org_guide_get_toml "$org_dir/sections/20-google.toml" "measurement_id")

    # Stripe/Payments config
    STRIPE_MODE=$(_org_guide_get_toml "$org_dir/sections/30-payments.toml" "mode")
    STRIPE_WEBHOOK=$(_org_guide_get_toml "$org_dir/sections/30-payments.toml" "endpoint")

    # DNS config
    DNS_PROVIDER=$(_org_guide_get_toml "$org_dir/sections/40-dns.toml" "provider")
    DNS_DOMAIN=$(_org_guide_get_toml "$org_dir/sections/40-dns.toml" "domain")

    # Find primary domain from domains/ directory
    PRIMARY_DOMAIN=""
    DOMAIN_DIR=""
    for d in "$org_dir/domains"/*/; do
        [[ -d "$d" ]] || continue
        PRIMARY_DOMAIN=$(basename "$d")
        DOMAIN_DIR="$d"
        break
    done
    [[ -z "$PRIMARY_DOMAIN" ]] && PRIMARY_DOMAIN="$DNS_DOMAIN"

    # Domain-specific DNS
    DOMAIN_PROVIDER=""
    if [[ -f "$DOMAIN_DIR/dns.toml" ]]; then
        DOMAIN_PROVIDER=$(_org_guide_get_toml "$DOMAIN_DIR/dns.toml" "provider")
    fi
    [[ -z "$DOMAIN_PROVIDER" ]] && DOMAIN_PROVIDER="$DNS_PROVIDER"

    # Provider display name
    case "$DOMAIN_PROVIDER" in
        rc) PROVIDER_NAME="Reseller Club" ;;
        do) PROVIDER_NAME="DigitalOcean" ;;
        cf) PROVIDER_NAME="CloudFlare" ;;
        *)  PROVIDER_NAME="Unknown" ;;
    esac

    # Status checks
    DNS_CREDS_STATUS=$(_org_guide_check_dns_creds "$org_dir")
    STRIPE_CREDS_STATUS=$(_org_guide_check_stripe_creds "$org_dir")

    WWW_CNAME=$(_org_guide_get_www_cname "$PRIMARY_DOMAIN")
    WWW_STATUS="todo"
    [[ "$WWW_CNAME" == *"ghs.googlehosted"* ]] && WWW_STATUS="done"

    GA4_STATUS="todo"
    [[ -n "$GOOGLE_GA4_ID" && "$GOOGLE_GA4_ID" != "G-XXXXXXXXXX" ]] && GA4_STATUS="done"

    STRIPE_STATUS="todo"
    [[ "$STRIPE_CREDS_STATUS" == "configured" ]] && STRIPE_STATUS="done"

    # Progress calculation
    DONE_COUNT=0
    TOTAL_COUNT=6
    [[ "$DNS_CREDS_STATUS" == "configured" ]] && ((DONE_COUNT++))
    [[ "$WWW_STATUS" == "done" ]] && ((DONE_COUNT++))
    [[ "$GA4_STATUS" == "done" ]] && ((DONE_COUNT++))
    [[ "$STRIPE_STATUS" == "done" ]] && ((DONE_COUNT++))
    [[ -n "$PRIMARY_DOMAIN" ]] && ((DONE_COUNT++))  # Domain registered
    ((DONE_COUNT++))  # Org created
    PROGRESS_PCT=$((DONE_COUNT * 100 / TOTAL_COUNT))

    # Dates
    CURRENT_DATE=$(_org_guide_date)
    MONTH_YEAR=$(_org_guide_month_year)
}

export -f _org_guide_get_toml _org_guide_date _org_guide_month_year
export -f _org_guide_check_dns_creds _org_guide_check_stripe_creds _org_guide_get_www_cname
export -f _org_guide_read_config
