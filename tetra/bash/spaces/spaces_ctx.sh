#!/usr/bin/env bash
# spaces/spaces_ctx.sh - TPS context integration for spaces
#
# Uses unified tps_ctx API for context management.
# Context: SPACES[org:bucket:path]
# Color: cyan (6), Priority: 25

# =============================================================================
# DEPENDENCIES
# =============================================================================

if ! type tps_ctx &>/dev/null; then
    echo "spaces_ctx: requires tps_ctx (load tps module first)" >&2
    return 1
fi

# =============================================================================
# REGISTER WITH TPS
# =============================================================================

# Register spaces context line (cyan, priority 25)
tps_ctx register spaces SPACES 25 6

# =============================================================================
# SLOT ACCESSORS (convenience wrappers)
# =============================================================================

_spaces_org()    { tps_ctx get spaces org; }
_spaces_bucket() { tps_ctx get spaces project; }
_spaces_path()   { tps_ctx get spaces subject; }

# =============================================================================
# CONTEXT COMMANDS
# =============================================================================

# Set full context
# Usage: spaces_ctx_set <org> [bucket] [path]
spaces_ctx_set() {
    local org="$1"
    local bucket="${2:-}"
    local path="${3:-}"

    if [[ -z "$org" ]]; then
        echo "Usage: spaces ctx set <org> [bucket] [path]" >&2
        return 1
    fi

    # Validate org exists
    local org_dir="$TETRA_DIR/orgs/$org"
    if [[ ! -d "$org_dir" ]]; then
        echo "Error: Org not found: $org" >&2
        echo "  Available orgs:" >&2
        ls -1 "$TETRA_DIR/orgs/" 2>/dev/null | sed 's/^/    /' >&2
        return 1
    fi

    # Set TETRA_ORG for TES resolution
    export TETRA_ORG="$org"

    # Source org secrets (DO_SPACES_KEY, etc)
    local secrets_file="$org_dir/secrets.env"
    if [[ -f "$secrets_file" ]]; then
        source "$secrets_file"
    else
        echo "Warning: No secrets.env for $org" >&2
        echo "  Run: org secrets sync $org" >&2
    fi

    # Validate bucket if provided
    if [[ -n "$bucket" ]]; then
        if ! _spaces_resolve "$bucket" &>/dev/null; then
            echo "Error: Cannot resolve bucket: $bucket" >&2
            echo "  Ensure [storage.s3] is configured in tetra.toml" >&2
            return 1
        fi
    fi

    # Set context via tps_ctx
    tps_ctx set spaces "$org" "$bucket" "$path"

    echo "Context: SPACES[$org:${bucket:-?}:${path:-/}]"
}

# Set org (clear bucket/path)
spaces_ctx_org() {
    local org="$1"
    if [[ -z "$org" ]]; then
        local current=$(_spaces_org)
        echo "Current org: ${current:-(not set)}"
        return 0
    fi
    spaces_ctx_set "$org"
}

# Set bucket (inherit org, clear path)
spaces_ctx_bucket() {
    local bucket="$1"
    local org=$(_spaces_org)

    if [[ -z "$org" ]]; then
        echo "Error: No org set. Use 'spaces ctx set <org> <bucket>' first." >&2
        return 1
    fi

    if [[ -z "$bucket" ]]; then
        echo "Current bucket: $(_spaces_bucket)"
        return 0
    fi

    spaces_ctx_set "$org" "$bucket"
}

# Set path (inherit org and bucket)
spaces_ctx_path() {
    local path="$1"
    local org=$(_spaces_org)
    local bucket=$(_spaces_bucket)

    if [[ -z "$org" || -z "$bucket" ]]; then
        echo "Error: No org/bucket set. Use 'spaces ctx set <org> <bucket> <path>' first." >&2
        return 1
    fi

    spaces_ctx_set "$org" "$bucket" "$path"
}

# Clear context
spaces_ctx_clear() {
    tps_ctx clear spaces
    echo "Context cleared"
}

# Manage path cache
spaces_ctx_cache() {
    local subcmd="${1:-status}"
    local org=$(_spaces_org)
    local bucket=$(_spaces_bucket)

    case "$subcmd" in
        refresh|r)
            if [[ -z "$org" || -z "$bucket" ]]; then
                echo "Error: Set context first" >&2
                return 1
            fi
            echo "Refreshing cache for $bucket..."
            _spaces_cache_refresh "$org" "$bucket"
            local cache_file=$(_spaces_cache_file "$org" "$bucket")
            local count=$(wc -l < "$cache_file" 2>/dev/null | tr -d ' ')
            echo "Cached $count paths"
            ;;
        clear|c)
            _spaces_cache_invalidate "$org" "$bucket"
            echo "Cache cleared"
            ;;
        status|s|"")
            if [[ -z "$org" || -z "$bucket" ]]; then
                echo "Cache: no context set"
                return
            fi
            local cache_file=$(_spaces_cache_file "$org" "$bucket")
            if [[ -f "$cache_file" ]]; then
                local count=$(wc -l < "$cache_file" | tr -d ' ')
                local age=$(( ($(date +%s) - $(stat -f %m "$cache_file" 2>/dev/null || stat -c %Y "$cache_file" 2>/dev/null)) ))
                echo "Cache: $cache_file"
                echo "  Paths: $count"
                echo "  Age:   ${age}s (TTL: ${SPACES_CACHE_TTL}s)"
            else
                echo "Cache: not populated"
                echo "  Run: spaces ctx cache refresh"
            fi
            ;;
        *)
            echo "Usage: spaces ctx cache [refresh|clear|status]"
            ;;
    esac
}

# Show current context
spaces_ctx_status() {
    local org=$(_spaces_org)
    local bucket=$(_spaces_bucket)
    local path=$(_spaces_path)

    echo "SPACES Context"
    echo "=============="
    echo ""
    echo "  Org:    ${org:-(not set)}"
    echo "  Bucket: ${bucket:-(not set)}"
    echo "  Path:   ${path:-(not set)}"
    echo ""

    if [[ -n "$org" && -n "$bucket" ]]; then
        # Show resolved URI if org+bucket set
        export TETRA_ORG="$org"
        if _spaces_resolve "${bucket}:${path}" &>/dev/null; then
            echo "  URI:    $SPACES_URI"
            echo "  Host:   $SPACES_HOST"
        fi
        echo ""
        echo "  Preview: SPACES[${org}:${bucket}:${path:-/}]"
    fi
}

# Main context command dispatcher
spaces_ctx() {
    local cmd="${1:-status}"
    shift 2>/dev/null || true

    case "$cmd" in
        set)
            spaces_ctx_set "$@"
            ;;
        org)
            spaces_ctx_org "$@"
            ;;
        bucket)
            spaces_ctx_bucket "$@"
            ;;
        path)
            spaces_ctx_path "$@"
            ;;
        cache)
            spaces_ctx_cache "$@"
            ;;
        clear)
            spaces_ctx_clear
            ;;
        status)
            spaces_ctx_status
            ;;
        *)
            # Convenience: spaces ctx tetra pja-games games/
            # Try to interpret as org [bucket] [path]
            if [[ -d "$TETRA_DIR/orgs/$cmd" ]]; then
                spaces_ctx_set "$cmd" "$@"
                return
            fi
            cat <<'EOF'
Usage: spaces ctx <command>

Commands:
  set <org> [bucket] [path]   Set full context
  org [name]                  Set/show org
  bucket [name]               Set/show bucket (inherits org)
  path <prefix>               Set path prefix (inherits org+bucket)
  cache [refresh|clear]       Manage path cache for tab completion
  clear                       Clear all context
  status                      Show current context

Examples:
  spaces ctx set tetra pja-games games/   # Full context
  spaces ctx tetra pja-games games/       # Shorthand (org exists)
  spaces ctx cache refresh                # Populate tab completion cache
  spaces ctx clear                        # Clear all

Tab completion uses cached S3 paths (auto-refreshes, 5min TTL).
EOF
            ;;
    esac
}

# =============================================================================
# CONTEXT-AWARE OPERATION HELPERS
# =============================================================================

# Get effective symbol from context + args
# Usage: _spaces_ctx_symbol [path_override]
# Sets TETRA_ORG from context if needed
_spaces_ctx_symbol() {
    local override="${1:-}"
    local org=$(_spaces_org)
    local bucket=$(_spaces_bucket)
    local path=$(_spaces_path)

    if [[ -z "$org" || -z "$bucket" ]]; then
        # No context - require full symbol
        echo ""
        return 1
    fi

    # Set org for TES resolution
    export TETRA_ORG="$org"

    if [[ -n "$override" ]]; then
        # Override provided - combine with bucket
        echo "${bucket}:${override}"
    elif [[ -n "$path" ]]; then
        # Use context path
        echo "${bucket}:${path}"
    else
        # Just bucket
        echo "${bucket}"
    fi
}

# Check if context is set
_spaces_has_ctx() {
    [[ -n "$(_spaces_org)" && -n "$(_spaces_bucket)" ]]
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f _spaces_org _spaces_bucket _spaces_path
export -f spaces_ctx_set spaces_ctx_org spaces_ctx_bucket spaces_ctx_path
export -f spaces_ctx_cache spaces_ctx_clear spaces_ctx_status spaces_ctx
export -f _spaces_ctx_symbol _spaces_has_ctx
