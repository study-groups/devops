#!/usr/bin/env bash
# caddy/caddy_ctx.sh - Caddy context (independent from TSM)
#
# Context: org:proj:env -> SSH target
# Examples:
#   tcaddy ctx pja arcade dev -> root@dev.pixeljamarcade.com
#   tcaddy ctx pja arcade prod -> root@pixeljamarcade.com

# =============================================================================
# CONTEXT STATE
# =============================================================================

declare -g CADDY_CTX_ORG=""
declare -g CADDY_CTX_PROJ=""
declare -g CADDY_CTX_ENV=""

# =============================================================================
# ENVIRONMENTS CONFIGURATION
# =============================================================================

# Define known environments (org:env -> ssh target)
if [[ -z "${CADDY_ENVS_LOADED:-}" ]]; then
    declare -gA CADDY_ENVS
    CADDY_ENVS["pja:dev"]="root@dev.pixeljamarcade.com"
    CADDY_ENVS["pja:staging"]="root@staging.pixeljamarcade.com"
    CADDY_ENVS["pja:prod"]="root@pixeljamarcade.com"
    CADDY_ENVS["local"]="localhost"
    CADDY_ENVS_LOADED=1
fi

# =============================================================================
# SLOT ACCESSORS
# =============================================================================

_caddy_org()  { echo "$CADDY_CTX_ORG"; }
_caddy_proj() { echo "$CADDY_CTX_PROJ"; }
_caddy_env()  { echo "${CADDY_CTX_ENV:-local}"; }

# Get SSH target for current or specified env
_caddy_ssh_target() {
    local org="${CADDY_CTX_ORG}"
    local env="${1:-$(_caddy_env)}"
    [[ -z "$env" ]] && env="local"

    # Try org:env first, then just env
    local key="${org}:${env}"
    if [[ -n "${CADDY_ENVS[$key]}" ]]; then
        echo "${CADDY_ENVS[$key]}"
    elif [[ -n "${CADDY_ENVS[$env]}" ]]; then
        echo "${CADDY_ENVS[$env]}"
    else
        echo "$env"  # Fallback: treat as direct SSH target
    fi
}

# =============================================================================
# CONTEXT COMMANDS
# =============================================================================

# Set context: caddy ctx <org> <proj> <env>
caddy_ctx_set() {
    local org="$1"
    local proj="${2:-}"
    local env="${3:-}"

    if [[ -z "$org" ]]; then
        echo "Usage: tcaddy ctx <org> <proj> <env>" >&2
        echo "  org:  pja, tetra, ..." >&2
        echo "  proj: arcade, api, docs, ..." >&2
        echo "  env:  dev, staging, prod, local" >&2
        echo "" >&2
        echo "Known targets:" >&2
        for key in "${!CADDY_ENVS[@]}"; do
            echo "  $key -> ${CADDY_ENVS[$key]}" >&2
        done
        return 1
    fi

    CADDY_CTX_ORG="$org"
    CADDY_CTX_PROJ="$proj"
    CADDY_CTX_ENV="$env"

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
    local proj=$(_caddy_proj)
    local env=$(_caddy_env)

    echo "CADDY[${org:-_}:${proj:-_}:${env:-_}]"

    if [[ -n "$org" && -n "$env" ]]; then
        local target
        target=$(_caddy_ssh_target "$env")
        echo "  SSH: $target"
    fi
}

# Add a new env
caddy_ctx_add_env() {
    local alias="$1"
    local target="$2"

    if [[ -z "$alias" || -z "$target" ]]; then
        echo "Usage: caddy ctx add-env <alias> <ssh-target>" >&2
        return 1
    fi

    CADDY_ENVS[$alias]="$target"
    echo "Added: $alias -> $target"
}

# Main dispatcher
caddy_ctx() {
    local cmd="${1:-status}"
    shift 2>/dev/null || true

    case "$cmd" in
        set)     caddy_ctx_set "$@" ;;
        proj)    caddy_ctx_proj "$@" ;;
        env)     caddy_ctx_env "$@" ;;
        clear)   caddy_ctx_clear ;;
        status)  caddy_ctx_status ;;
        add-env) caddy_ctx_add_env "$@" ;;
        *)
            # Convenience: caddy ctx pja arcade dev
            caddy_ctx_set "$cmd" "$@"
            ;;
    esac
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f _caddy_org _caddy_proj _caddy_env _caddy_ssh_target
export -f caddy_ctx caddy_ctx_set caddy_ctx_proj caddy_ctx_env
export -f caddy_ctx_clear caddy_ctx_status caddy_ctx_add_env
