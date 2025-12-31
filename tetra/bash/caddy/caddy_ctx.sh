#!/usr/bin/env bash
# caddy/caddy_ctx.sh - Caddy context (delegates to TSM context)
#
# UNIFIED: Caddy now uses TSM context instead of its own
#
# TSM Context: org:group:env (tetra:ascii-deck:local)
# Caddy maps:  org -> org, group -> proj, env -> env
#
# Domain computed from TSM context:
#   local  -> org.local
#   dev    -> dev.org.com
#   prod   -> org.com

# =============================================================================
# DEPENDENCIES - TSM context must be available
# =============================================================================

if ! declare -f _tsm_ctx_org &>/dev/null; then
    # TSM not loaded yet - will be available after tsm.sh loads
    :
fi

# =============================================================================
# TPS REGISTRATION (disabled - caddy uses TSM context now)
# =============================================================================

# Caddy no longer maintains its own context line.
# TSM context (org:group:env) is the source of truth.
# Domain is computed: local->org.local, dev->dev.org.com, prod->org.com

# Unregister caddy from tps_ctx if it was previously registered
if declare -f tps_ctx_unregister &>/dev/null; then
    tps_ctx_unregister caddy 2>/dev/null || true
fi

# =============================================================================
# ENVIRONMENTS CONFIGURATION
# =============================================================================

# Define known environments (env -> ssh target)
# Only declare if not already set (avoid re-declaration errors)
if [[ -z "${CADDY_ENVS[dev]+x}" ]]; then
    declare -gA CADDY_ENVS=(
        [dev]="root@dev.pixeljamarcade.com"
        [local]="localhost"
    )
fi

# =============================================================================
# SLOT ACCESSORS (delegate to TSM context)
# =============================================================================

_caddy_org()  { _tsm_ctx_org 2>/dev/null || echo ""; }
_caddy_proj() { _tsm_ctx_group 2>/dev/null || echo ""; }  # group = proj
_caddy_env()  { _tsm_ctx_env 2>/dev/null || echo "local"; }

# Get SSH target for current or specified env
_caddy_ssh_target() {
    local env="${1:-$(_caddy_env)}"
    [[ -z "$env" ]] && env="local"
    echo "${CADDY_ENVS[$env]:-$env}"
}

# =============================================================================
# CONTEXT COMMANDS
# =============================================================================

# Set context: caddy ctx set <org> [proj] [env]
# Now delegates to TSM context (org:group:env)
caddy_ctx_set() {
    local org="$1"
    local proj="${2:-}"
    local env="${3:-}"

    if [[ -z "$org" ]]; then
        echo "Usage: caddy ctx set <org> [proj] [env]" >&2
        echo "  org:  pja, tetra, ..." >&2
        echo "  proj: arcade, api, docs, ... (maps to TSM group)" >&2
        echo "  env:  ${!CADDY_ENVS[*]}" >&2
        return 1
    fi

    # Set via TSM context (org:group:env)
    if declare -f tsm_ctx_set &>/dev/null; then
        tsm_ctx_set "${org}:${proj}:${env}"
    else
        echo "TSM context not available. Use: tsm ctx ${org}:${proj}:${env}" >&2
        return 1
    fi
}

# Set just proj (group in TSM terms)
caddy_ctx_proj() {
    local proj="$1"
    [[ -z "$proj" ]] && { echo "Usage: caddy ctx proj <name>" >&2; return 1; }
    # Use TSM partial context set
    if declare -f tsm_ctx_set &>/dev/null; then
        tsm_ctx_set ":${proj}"
    else
        echo "TSM context not available" >&2
        return 1
    fi
}

# Set just env
caddy_ctx_env() {
    local env="$1"
    [[ -z "$env" ]] && { echo "Usage: caddy ctx env <name>" >&2; return 1; }
    # Use TSM partial context set
    if declare -f tsm_ctx_set &>/dev/null; then
        tsm_ctx_set "::${env}"
    else
        echo "TSM context not available" >&2
        return 1
    fi
}

# Clear context
caddy_ctx_clear() {
    if declare -f tsm_ctx_clear &>/dev/null; then
        tsm_ctx_clear
    else
        echo "TSM context not available" >&2
    fi
}

# Show context (reads from TSM)
caddy_ctx_status() {
    local org=$(_caddy_org)
    local proj=$(_caddy_proj)
    local env=$(_caddy_env)

    echo "Caddy Context (from TSM)"
    echo "========================"
    echo "  Org:    ${org:-(not set)}"
    echo "  Proj:   ${proj:-(not set)}"
    echo "  Env:    ${env:-(not set)}"

    # Show domain from TSM context
    if declare -f _tsm_ctx_domain &>/dev/null; then
        echo "  Domain: $(_tsm_ctx_domain)"
    fi

    if [[ -n "$env" ]]; then
        local target
        target=$(_caddy_ssh_target "$env")
        echo "  SSH:    $target"
    fi

    echo ""
    echo "Set with: tsm ctx org:group:env"
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
