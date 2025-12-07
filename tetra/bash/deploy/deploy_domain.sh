#!/usr/bin/env bash
# deploy_domain.sh - Domain resolution for deploy module
#
# Resolves PROJECT x ENV -> DOMAIN using:
#   1. Project TOML [domain] section
#   2. Environment domain from tetra.toml
#   3. Pattern (subdomain or path)
#
# Examples:
#   subdomain: docs + dev.example.com -> docs.dev.example.com
#   path:      docs + dev.example.com -> dev.example.com/docs

# =============================================================================
# DOMAIN HELPERS
# =============================================================================

_deploy_get_env_domain() {
    local env="$1"

    local domain=$(org_toml_get "environments.$env.domain" 2>/dev/null)

    if [[ -z "$domain" ]]; then
        echo "No domain configured for environment: $env" >&2
        echo "Add 'domain = \"example.com\"' to [environments.$env] in tetra.toml" >&2
        return 1
    fi

    echo "$domain"
}

_deploy_get_wildcard_domain() {
    local domain="$1"

    local dot_count=$(echo "$domain" | tr -cd '.' | wc -c)

    if [[ $dot_count -ge 2 ]]; then
        echo "$domain" | sed 's/^[^.]*\.//'
    else
        echo "$domain"
    fi
}

# =============================================================================
# DOMAIN RESOLUTION
# =============================================================================

deploy_domain_resolve() {
    local env="$1"

    if [[ -z "$env" ]]; then
        echo "Usage: deploy_domain_resolve <env>" >&2
        return 1
    fi

    # Check for project override first
    local override=$(toml_get "domain" "overrides_${env}" "PROJ_TOML" 2>/dev/null)
    if [[ -n "$override" ]]; then
        echo "$override"
        return 0
    fi

    local env_domain=$(_deploy_get_env_domain "$env") || return 1
    local project="${PROJ_NAME:-unknown}"
    local pattern="${PROJ_DOMAIN_PATTERN:-subdomain}"

    case "$pattern" in
        subdomain)
            echo "${project}.${env_domain}"
            ;;
        path)
            echo "$env_domain"
            ;;
        *)
            echo "Unknown domain pattern: $pattern" >&2
            return 1
            ;;
    esac
}

deploy_domain_get_path() {
    local pattern="${PROJ_DOMAIN_PATTERN:-subdomain}"
    local project="${PROJ_NAME:-unknown}"

    if [[ "$pattern" == "path" ]]; then
        echo "/$project"
    fi
}

deploy_domain_get_ssl_cert() {
    local domain="$1"
    local wildcard=$(_deploy_get_wildcard_domain "$domain")
    echo "/etc/letsencrypt/live/$wildcard/fullchain.pem"
}

deploy_domain_get_ssl_key() {
    local domain="$1"
    local wildcard=$(_deploy_get_wildcard_domain "$domain")
    echo "/etc/letsencrypt/live/$wildcard/privkey.pem"
}

# =============================================================================
# DOMAIN INFO DISPLAY
# =============================================================================

deploy_domain_show() {
    local project="$1"
    local env="$2"

    if [[ -z "$project" || -z "$env" ]]; then
        echo "Usage: deploy domain:show <project> <env>"
        return 1
    fi

    if ! deploy_toml_load "$project"; then
        return 1
    fi

    echo "Domain Resolution"
    echo "================="
    echo ""
    echo "Project: $project"
    echo "Environment: $env"
    echo ""

    local env_domain=$(_deploy_get_env_domain "$env") || return 1
    echo "Env base domain: $env_domain"
    echo "Pattern: ${PROJ_DOMAIN_PATTERN:-subdomain}"

    local domain=$(deploy_domain_resolve "$env") || return 1
    echo ""
    echo "Resolved domain: $domain"

    local path=$(deploy_domain_get_path)
    [[ -n "$path" ]] && echo "Location path: $path"

    echo ""
    echo "SSL cert: $(deploy_domain_get_ssl_cert "$domain")"
    echo "SSL key:  $(deploy_domain_get_ssl_key "$domain")"

    echo ""
    if [[ -n "$path" ]]; then
        echo "URL: https://${domain}${path}"
    else
        echo "URL: https://${domain}"
    fi
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f _deploy_get_env_domain _deploy_get_wildcard_domain
export -f deploy_domain_resolve deploy_domain_get_path
export -f deploy_domain_get_ssl_cert deploy_domain_get_ssl_key
export -f deploy_domain_show
