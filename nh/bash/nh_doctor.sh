#!/usr/bin/env bash
# nh_doctor.sh - Infrastructure health checks and diagnostics
#
# Validates local tooling, context state, and infrastructure alignment.
# Key insight: floating IPs should be first-class citizens for failover.
#
# Usage:
#   nh doctor              Run all checks
#   nh doctor local        Check local tools only
#   nh doctor context      Check context/files only
#   nh doctor infra        Check infrastructure alignment
#   nh doctor cf           Check Cloudflare integration
#   nh doctor dns          Validate DNS → floating IP mappings

# =============================================================================
# OUTPUT HELPERS
# =============================================================================

_doctor_ok() {
    printf "  %-28s \033[32mok\033[0m %s\n" "$1" "${2:+($2)}"
}

_doctor_warn() {
    printf "  %-28s \033[33mWARN\033[0m %s\n" "$1" "$2"
    ((NH_DOCTOR_WARNINGS++))
}

_doctor_fail() {
    printf "  %-28s \033[31mFAIL\033[0m %s\n" "$1" "$2"
    ((NH_DOCTOR_ERRORS++))
}

_doctor_skip() {
    printf "  %-28s \033[90m-\033[0m %s\n" "$1" "$2"
}

_doctor_info() {
    printf "  %-28s %s\n" "$1" "$2"
}

_doctor_hint() {
    printf "    \033[90m→ %s\033[0m\n" "$1"
}

_doctor_section() {
    echo ""
    echo "$1"
    echo "$(printf '=%.0s' $(seq 1 ${#1}))"
}

# =============================================================================
# LOCAL CHECKS - tools and environment
# =============================================================================

nh_doctor_local() {
    _doctor_section "LOCAL"

    # Bash version
    local bash_ver="${BASH_VERSION%%(*}"
    if [[ "${bash_ver%%.*}" -ge 5 ]]; then
        _doctor_ok "bash" "$bash_ver"
    else
        _doctor_fail "bash" "$bash_ver (need 5.2+)"
        _doctor_hint "brew install bash"
    fi

    # doctl
    if command -v doctl &>/dev/null; then
        local ver=$(doctl version 2>/dev/null | head -1 | awk '{print $3}')
        _doctor_ok "doctl" "$ver"
    else
        _doctor_fail "doctl" "not installed"
        _doctor_hint "brew install doctl"
    fi

    # doctl auth
    if doctl account get &>/dev/null; then
        _doctor_ok "doctl auth" ""
    else
        _doctor_fail "doctl auth" "not authenticated"
        _doctor_hint "doctl auth init --context <name>"
    fi

    # jq
    if command -v jq &>/dev/null; then
        _doctor_ok "jq" "$(jq --version 2>/dev/null)"
    else
        _doctor_fail "jq" "not installed"
        _doctor_hint "brew install jq"
    fi

    # ssh-agent
    if [[ -n "${SSH_AUTH_SOCK:-}" ]] && ssh-add -l &>/dev/null; then
        local key_count=$(ssh-add -l 2>/dev/null | wc -l | tr -d ' ')
        _doctor_ok "ssh-agent" "$key_count keys"
    elif [[ -n "${SSH_AUTH_SOCK:-}" ]]; then
        _doctor_warn "ssh-agent" "running, no keys"
        _doctor_hint "ssh-add ~/.ssh/id_ed25519"
    else
        _doctor_warn "ssh-agent" "not running"
        _doctor_hint "eval \$(ssh-agent)"
    fi
}

# =============================================================================
# CONTEXT CHECKS - directories and files
# =============================================================================

nh_doctor_context() {
    _doctor_section "CONTEXT"

    # NH_DIR
    if [[ -d "$NH_DIR" ]]; then
        _doctor_ok "NH_DIR" "$NH_DIR"
    else
        _doctor_fail "NH_DIR" "missing: $NH_DIR"
        _doctor_hint "mkdir -p $NH_DIR"
        return 1
    fi

    # DIGITALOCEAN_CONTEXT
    local ctx="${DIGITALOCEAN_CONTEXT:-}"
    if [[ -n "$ctx" ]]; then
        _doctor_ok "DIGITALOCEAN_CONTEXT" "$ctx"
    else
        _doctor_fail "DIGITALOCEAN_CONTEXT" "not set"
        _doctor_hint "source ~/nh/<org>/init.sh"
        return 1
    fi

    # Context directory
    local ctx_dir="$NH_DIR/$ctx"
    if [[ -d "$ctx_dir" ]]; then
        _doctor_ok "context directory" ""
    else
        _doctor_fail "context directory" "missing: $ctx_dir"
        _doctor_hint "nh create $ctx"
        return 1
    fi

    # digocean.json
    local json="$ctx_dir/digocean.json"
    if [[ -f "$json" ]]; then
        local age=$(nh_json_age "$json")
        if [[ $age -gt 7 ]]; then
            _doctor_warn "digocean.json" "stale ($age days)"
            _doctor_hint "nh fetch"
        else
            _doctor_ok "digocean.json" "$age days old"
        fi
    else
        _doctor_fail "digocean.json" "missing"
        _doctor_hint "nh fetch"
    fi

    # Variables loaded
    local loaded=$(nh_env_count 2>/dev/null || echo 0)
    if [[ "$loaded" -gt 0 ]]; then
        _doctor_ok "server variables" "$loaded loaded"
    else
        _doctor_warn "server variables" "none loaded"
        _doctor_hint "nh load"
    fi

    # aliases.env (optional)
    local alias_file="$ctx_dir/aliases.env"
    if [[ -f "$alias_file" ]]; then
        local alias_count=$(grep -c '^export' "$alias_file" 2>/dev/null || echo 0)
        _doctor_ok "aliases.env" "$alias_count aliases"
    else
        _doctor_skip "aliases.env" "optional"
    fi
}

# =============================================================================
# INFRASTRUCTURE CHECKS - droplets, floating IPs
# =============================================================================

nh_doctor_infra() {
    _doctor_section "INFRASTRUCTURE"

    local ctx="${DIGITALOCEAN_CONTEXT:-}"
    local json="$NH_DIR/$ctx/digocean.json"

    if [[ ! -f "$json" ]]; then
        _doctor_skip "infrastructure" "no digocean.json"
        return 1
    fi

    # Droplet count
    local droplet_count=$(jq '[.[] | select(.Droplets) | .Droplets[]] | length' "$json" 2>/dev/null || echo 0)
    if [[ "$droplet_count" -gt 0 ]]; then
        _doctor_ok "droplets" "$droplet_count"
    else
        _doctor_warn "droplets" "none found"
    fi

    # Floating IPs
    local floating_ips=$(jq -r '.[] | select(.FloatingIPs) | .FloatingIPs[] | "\(.ip) -> \(.droplet.name // "unassigned")"' "$json" 2>/dev/null)
    local floating_count=$(echo "$floating_ips" | grep -c . 2>/dev/null || echo 0)

    if [[ "$floating_count" -gt 0 ]]; then
        _doctor_ok "floating IPs" "$floating_count"
        # List them
        echo "$floating_ips" | while read -r line; do
            _doctor_info "" "$line"
        done
    else
        _doctor_skip "floating IPs" "none configured"
    fi

    # Check for droplets without floating IPs (potential concern)
    local droplets_with_floating=$(jq -r '.[] | select(.FloatingIPs) | .FloatingIPs[].droplet.name // empty' "$json" 2>/dev/null | sort -u)
    local all_droplets=$(jq -r '.[] | select(.Droplets) | .Droplets[].name' "$json" 2>/dev/null | sort -u)

    if [[ -n "$floating_ips" ]]; then
        local without_floating=$(comm -23 <(echo "$all_droplets") <(echo "$droplets_with_floating") 2>/dev/null)
        if [[ -n "$without_floating" ]]; then
            local count=$(echo "$without_floating" | wc -l | tr -d ' ')
            _doctor_info "without floating IP" "$count droplets"
        fi
    fi
}

# =============================================================================
# CLOUDFLARE CHECKS
# =============================================================================

nh_doctor_cf() {
    _doctor_section "CLOUDFLARE"

    local ctx="${DIGITALOCEAN_CONTEXT:-}"
    local cf_env="$NH_DIR/$ctx/cloudflare.env"

    # Credentials file
    if [[ -f "$cf_env" ]]; then
        _doctor_ok "cloudflare.env" ""
    else
        _doctor_skip "cloudflare.env" "not configured"
        _doctor_hint "nh cf init"
        return 0
    fi

    # Load credentials
    source "$cf_env"

    # Support both CF_EMAIL and CF_API_EMAIL
    local email="${CF_EMAIL:-${CF_API_EMAIL:-}}"
    local key="${CF_API_KEY:-}"

    # Validate credentials
    if [[ -z "$email" || -z "$key" ]]; then
        _doctor_fail "CF credentials" "missing email or key"
        return 1
    fi

    # Test API
    local zones_response=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones" \
        -H "X-Auth-Email: $email" \
        -H "X-Auth-Key: $key" \
        -H "Content-Type: application/json")

    local success=$(echo "$zones_response" | jq -r '.success' 2>/dev/null)
    if [[ "$success" == "true" ]]; then
        local zone_count=$(echo "$zones_response" | jq '.result | length' 2>/dev/null)
        _doctor_ok "CF API" "$zone_count zones"

        # List zones
        echo "$zones_response" | jq -r '.result[] | "  \(.name) [\(.status)]"' 2>/dev/null
    else
        local error=$(echo "$zones_response" | jq -r '.errors[0].message // "unknown error"' 2>/dev/null)
        _doctor_fail "CF API" "$error"
    fi
}

# =============================================================================
# DNS ALIGNMENT CHECKS - the key insight
# =============================================================================

nh_doctor_dns() {
    _doctor_section "DNS ALIGNMENT"

    local ctx="${DIGITALOCEAN_CONTEXT:-}"
    local json="$NH_DIR/$ctx/digocean.json"
    local cf_env="$NH_DIR/$ctx/cloudflare.env"

    if [[ ! -f "$json" ]]; then
        _doctor_skip "DNS alignment" "no digocean.json"
        return 0
    fi

    if [[ ! -f "$cf_env" ]]; then
        _doctor_skip "DNS alignment" "no cloudflare.env"
        return 0
    fi

    source "$cf_env"

    # Support both CF_EMAIL and CF_API_EMAIL
    local email="${CF_EMAIL:-${CF_API_EMAIL:-}}"
    local key="${CF_API_KEY:-}"

    if [[ -z "$email" || -z "$key" ]]; then
        _doctor_skip "DNS alignment" "CF credentials incomplete"
        return 0
    fi

    # Build floating IP lookup: ip -> droplet_name
    declare -A floating_to_droplet
    declare -A droplet_to_floating
    declare -A droplet_to_primary

    while IFS=$'\t' read -r ip droplet_name primary_ip; do
        [[ -z "$ip" ]] && continue
        floating_to_droplet["$ip"]="$droplet_name"
        droplet_to_floating["$droplet_name"]="$ip"
        droplet_to_primary["$droplet_name"]="$primary_ip"
    done < <(jq -r '.[] | select(.FloatingIPs) | .FloatingIPs[] |
        select(.droplet != null) |
        [.ip, .droplet.name, (.droplet.networks.v4[] | select(.type=="public") | .ip_address)] | @tsv' "$json" 2>/dev/null)

    # Build primary IP lookup: ip -> droplet_name
    declare -A primary_to_droplet
    while IFS=$'\t' read -r name ip; do
        [[ -z "$ip" ]] && continue
        primary_to_droplet["$ip"]="$name"
    done < <(jq -r '.[] | select(.Droplets) | .Droplets[] |
        [.name, (.networks.v4[] | select(.type=="public") | .ip_address)] | @tsv' "$json" 2>/dev/null)

    # Get DNS records from Cloudflare
    local zones_response=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones" \
        -H "X-Auth-Email: $email" \
        -H "X-Auth-Key: $key" \
        -H "Content-Type: application/json")

    local zone_ids=$(echo "$zones_response" | jq -r '.result[] | "\(.id) \(.name)"' 2>/dev/null)

    local has_issues=false

    while read -r zone_id zone_name; do
        [[ -z "$zone_id" ]] && continue

        local records_response=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$zone_id/dns_records?type=A" \
            -H "X-Auth-Email: $email" \
            -H "X-Auth-Key: $key" \
            -H "Content-Type: application/json")

        while IFS=$'\t' read -r record_name record_ip; do
            [[ -z "$record_ip" ]] && continue

            # Check if this IP is a floating IP
            if [[ -v floating_to_droplet["$record_ip"] ]]; then
                _doctor_ok "$record_name" "$record_ip (floating)"
            # Check if this IP is a primary IP that HAS a floating IP
            elif [[ -v primary_to_droplet["$record_ip"] ]]; then
                local droplet="${primary_to_droplet[$record_ip]}"
                if [[ -v droplet_to_floating["$droplet"] ]]; then
                    local floating="${droplet_to_floating[$droplet]}"
                    _doctor_warn "$record_name" "$record_ip (primary, has floating: $floating)"
                    _doctor_hint "Consider: nh cf update $record_name $floating"
                    has_issues=true
                else
                    _doctor_ok "$record_name" "$record_ip (primary, no floating)"
                fi
            else
                # External IP, not our infrastructure
                _doctor_info "$record_name" "$record_ip (external)"
            fi
        done < <(echo "$records_response" | jq -r '.result[] | [.name, .content] | @tsv' 2>/dev/null)
    done <<< "$zone_ids"

    if [[ "$has_issues" == "false" ]]; then
        echo ""
        echo "  All DNS records properly aligned with floating IPs."
    fi
}

# =============================================================================
# SUMMARY
# =============================================================================

_doctor_summary() {
    echo ""
    echo "SUMMARY"
    echo "======="

    if [[ ${NH_DOCTOR_ERRORS:-0} -eq 0 && ${NH_DOCTOR_WARNINGS:-0} -eq 0 ]]; then
        echo "  All checks passed."
    else
        [[ ${NH_DOCTOR_ERRORS:-0} -gt 0 ]] && printf "  \033[31mErrors: %d\033[0m\n" "$NH_DOCTOR_ERRORS"
        [[ ${NH_DOCTOR_WARNINGS:-0} -gt 0 ]] && printf "  \033[33mWarnings: %d\033[0m\n" "$NH_DOCTOR_WARNINGS"
    fi

    return ${NH_DOCTOR_ERRORS:-0}
}

# =============================================================================
# MAIN
# =============================================================================

nh_doctor() {
    local section="${1:-all}"

    NH_DOCTOR_ERRORS=0
    NH_DOCTOR_WARNINGS=0

    echo "nh doctor"
    echo "========="

    case "$section" in
        all)
            nh_doctor_local
            nh_doctor_context
            nh_doctor_infra
            nh_doctor_cf
            nh_doctor_dns
            ;;
        local)
            nh_doctor_local
            ;;
        context|ctx)
            nh_doctor_context
            ;;
        infra|infrastructure)
            nh_doctor_infra
            ;;
        cf|cloudflare)
            nh_doctor_cf
            ;;
        dns)
            nh_doctor_dns
            ;;
        help|h)
            nh_doctor_help
            return 0
            ;;
        *)
            echo "Unknown section: $section"
            echo "Sections: all, local, context, infra, cf, dns"
            return 1
            ;;
    esac

    _doctor_summary
}

nh_doctor_help() {
    cat << 'EOF'
nh doctor - Infrastructure health checks

USAGE: nh doctor [section]

SECTIONS
    all         Run all checks (default)
    local       Local tools: bash, doctl, jq, ssh-agent
    context     Context state: NH_DIR, files, variables
    infra       Infrastructure: droplets, floating IPs
    cf          Cloudflare: credentials, API access
    dns         DNS alignment: validates records use floating IPs

DNS ALIGNMENT
    The dns check identifies DNS records pointing to primary IPs
    when a floating IP is available. Floating IPs provide:
    - Failover: reassign to new droplet without DNS changes
    - Migration: move services between droplets seamlessly
    - Consistency: single IP for all services on a droplet

EXAMPLES
    nh doctor           Full health check
    nh doctor dns       Just DNS alignment
    nh doctor local     Check local tools only
EOF
}

# Export functions
export -f nh_doctor nh_doctor_local nh_doctor_context nh_doctor_infra nh_doctor_cf nh_doctor_dns
export -f _doctor_ok _doctor_warn _doctor_fail _doctor_skip _doctor_info _doctor_hint _doctor_section _doctor_summary
