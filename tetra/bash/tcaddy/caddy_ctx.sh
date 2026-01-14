#!/usr/bin/env bash
# caddy/caddy_ctx.sh - Caddy context (reads from tetra.toml)
#
# Context: org:proj:env -> SSH target (from tetra.toml)
# Examples:
#   tcaddy ctx pja arcade dev -> reads from $TETRA_DIR/orgs/pixeljam-arcade/tetra.toml
#   tcaddy ctx pixeljam-arcade arcade prod -> root@64.23.151.249

# =============================================================================
# CONTEXT STATE
# =============================================================================

declare -g CADDY_CTX_ORG=""
declare -g CADDY_CTX_PROJ=""
declare -g CADDY_CTX_ENV=""

# =============================================================================
# ORG ALIASES (short name -> full org name)
# =============================================================================

if [[ -z "${CADDY_ORG_ALIASES_LOADED:-}" ]]; then
    declare -gA CADDY_ORG_ALIASES
    CADDY_ORG_ALIASES["pja"]="pixeljam-arcade"
    CADDY_ORG_ALIASES["tetra"]="tetra"
    CADDY_ORG_ALIASES_LOADED=1
fi

# Resolve org alias to full name
_caddy_resolve_org() {
    local org="$1"
    echo "${CADDY_ORG_ALIASES[$org]:-$org}"
}

# =============================================================================
# TOML READING (simple inline parser)
# =============================================================================

# Get value from TOML file
# Usage: _caddy_toml_get <file> <section> <key>
_caddy_toml_get() {
    local file="$1" section="$2" key="$3"

    [[ ! -f "$file" ]] && return 1

    awk -v sect="$section" -v k="$key" '
        /^\[/ {
            gsub(/[\[\]]/, "")
            in_sect = ($0 == sect)
        }
        in_sect && $1 == k && /=/ {
            val = $0
            sub(/^[^=]*=[ \t]*/, "", val)
            gsub(/^["'"'"']|["'"'"']$/, "", val)
            print val
            exit
        }
    ' "$file"
}

# =============================================================================
# SLOT ACCESSORS
# =============================================================================

_caddy_org()  { echo "$CADDY_CTX_ORG"; }
_caddy_proj() { echo "$CADDY_CTX_PROJ"; }
_caddy_env()  { echo "${CADDY_CTX_ENV:-local}"; }

# Get full org name (resolved from alias)
_caddy_org_full() {
    _caddy_resolve_org "$CADDY_CTX_ORG"
}

# Get tetra.toml path for current org
_caddy_toml_path() {
    local org_full=$(_caddy_org_full)
    echo "$TETRA_DIR/orgs/$org_full/tetra.toml"
}

# Get SSH target from tetra.toml [env.<env>] section
_caddy_ssh_target() {
    local env="${1:-$(_caddy_env)}"
    [[ -z "$env" ]] && env="local"

    local toml=$(_caddy_toml_path)

    if [[ ! -f "$toml" ]]; then
        echo "localhost"
        return 1
    fi

    local host=$(_caddy_toml_get "$toml" "env.$env" "host")
    local user=$(_caddy_toml_get "$toml" "env.$env" "user")

    if [[ -z "$host" ]]; then
        echo "localhost"
        return 1
    fi

    # Return just "localhost" for local execution (no SSH)
    if [[ "$host" == "localhost" || "$host" == "127.0.0.1" ]]; then
        echo "localhost"
        return 0
    fi

    echo "${user:-root}@${host}"
}

# Get domain from tetra.toml
_caddy_domain() {
    local env="${1:-$(_caddy_env)}"
    local toml=$(_caddy_toml_path)

    [[ -f "$toml" ]] && _caddy_toml_get "$toml" "env.$env" "domain"
}

# =============================================================================
# CONTEXT COMMANDS
# =============================================================================

# Set context: tcaddy ctx <org> <proj> <env>
caddy_ctx_set() {
    local org="$1"
    local proj="${2:-}"
    local env="${3:-}"

    if [[ -z "$org" ]]; then
        echo "Usage: tcaddy ctx <org> <proj> <env>" >&2
        echo "  org:  pja, tetra, or full org name" >&2
        echo "  proj: arcade, api, docs, ..." >&2
        echo "  env:  dev, staging, prod, local" >&2
        echo "" >&2
        echo "Aliases:" >&2
        for alias in "${!CADDY_ORG_ALIASES[@]}"; do
            echo "  $alias -> ${CADDY_ORG_ALIASES[$alias]}" >&2
        done
        echo "" >&2
        echo "Available orgs:" >&2
        ls "$TETRA_DIR/orgs" 2>/dev/null | sed 's/^/  /' >&2
        return 1
    fi

    CADDY_CTX_ORG="$org"
    CADDY_CTX_PROJ="$proj"
    CADDY_CTX_ENV="$env"

    # Validate org exists
    local org_full=$(_caddy_org_full)
    local toml="$TETRA_DIR/orgs/$org_full/tetra.toml"

    if [[ ! -f "$toml" ]]; then
        echo "Warning: tetra.toml not found: $toml" >&2
        echo "Run: nhb_import to create org from digocean.json" >&2
    fi

    caddy_ctx_status
}

# Set just proj
caddy_ctx_proj() {
    local proj="$1"
    [[ -z "$proj" ]] && { echo "Usage: tcaddy ctx proj <name>" >&2; return 1; }
    CADDY_CTX_PROJ="$proj"
    caddy_ctx_status
}

# Set just env
caddy_ctx_env() {
    local env="$1"
    [[ -z "$env" ]] && { echo "Usage: tcaddy ctx env <name>" >&2; return 1; }
    CADDY_CTX_ENV="$env"
    caddy_ctx_status
}

# Clear context
caddy_ctx_clear() {
    CADDY_CTX_ORG=""
    CADDY_CTX_PROJ=""
    CADDY_CTX_ENV=""
    echo "Caddy context cleared"
}

# Show context
caddy_ctx_status() {
    local org=$(_caddy_org)
    local org_full=$(_caddy_org_full)
    local proj=$(_caddy_proj)
    local env=$(_caddy_env)

    echo "CADDY[${org:-_}:${proj:-_}:${env:-_}]"

    if [[ -n "$org" ]]; then
        local toml=$(_caddy_toml_path)

        if [[ -f "$toml" ]]; then
            [[ "$org" != "$org_full" ]] && echo "  Org: $org_full"

            if [[ -n "$env" && "$env" != "local" ]]; then
                local target=$(_caddy_ssh_target "$env")
                local domain=$(_caddy_domain "$env")
                echo "  SSH: $target"
                [[ -n "$domain" ]] && echo "  Domain: $domain"
            fi
        else
            echo "  (tetra.toml not found)"
        fi
    fi
}

# List available envs for current org
caddy_ctx_envs() {
    local toml=$(_caddy_toml_path)

    if [[ ! -f "$toml" ]]; then
        echo "No tetra.toml found" >&2
        return 1
    fi

    echo "Environments for $(_caddy_org_full):"
    grep -E '^\[env\.' "$toml" | sed 's/\[env\.//;s/\]//' | while read -r env; do
        local host=$(_caddy_toml_get "$toml" "env.$env" "host")
        local domain=$(_caddy_toml_get "$toml" "env.$env" "domain")
        printf "  %-10s %s  %s\n" "$env" "${host:--}" "${domain:-}"
    done
}

# Add org alias
caddy_ctx_alias() {
    local alias="$1"
    local org="$2"

    if [[ -z "$alias" || -z "$org" ]]; then
        echo "Usage: tcaddy ctx alias <short> <org-name>" >&2
        echo "Current aliases:" >&2
        for a in "${!CADDY_ORG_ALIASES[@]}"; do
            echo "  $a -> ${CADDY_ORG_ALIASES[$a]}" >&2
        done
        return 1
    fi

    CADDY_ORG_ALIASES[$alias]="$org"
    echo "Added: $alias -> $org"
}

# Main dispatcher
caddy_ctx() {
    local cmd="${1:-status}"
    shift 2>/dev/null || true

    case "$cmd" in
        set)     caddy_ctx_set "$@" ;;
        proj)    caddy_ctx_proj "$@" ;;
        env)     caddy_ctx_env "$@" ;;
        envs)    caddy_ctx_envs ;;
        clear)   caddy_ctx_clear ;;
        status)  caddy_ctx_status ;;
        alias)   caddy_ctx_alias "$@" ;;
        *)
            # Convenience: tcaddy ctx pja arcade dev
            caddy_ctx_set "$cmd" "$@"
            ;;
    esac
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f _caddy_org _caddy_proj _caddy_env _caddy_org_full
export -f _caddy_ssh_target _caddy_domain _caddy_toml_path _caddy_toml_get
export -f _caddy_resolve_org
export -f caddy_ctx caddy_ctx_set caddy_ctx_proj caddy_ctx_env
export -f caddy_ctx_clear caddy_ctx_status caddy_ctx_envs caddy_ctx_alias
