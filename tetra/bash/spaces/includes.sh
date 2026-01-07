#!/usr/bin/env bash

# Spaces module includes

# Load module utilities
source "$TETRA_SRC/bash/utils/module_init.sh"
source "$TETRA_SRC/bash/utils/function_helpers.sh"

# Initialize module with standard tetra conventions
tetra_module_init_with_alias "spaces" "SPACES"

# Core functionality (TES resolution, s3cmd operations)
source "$SPACES_SRC/spaces.sh"

# TPS context integration (requires tps module)
if type tps_ctx &>/dev/null; then
    source "$SPACES_SRC/spaces_ctx.sh"
fi

# Tab completion
source "$SPACES_SRC/spaces_complete.sh"

# =============================================================================
# MAIN DISPATCHER
# =============================================================================

spaces() {
    local cmd="${1:-}"

    # No args: ls current context
    if [[ -z "$cmd" ]]; then
        if declare -f _spaces_has_ctx &>/dev/null && _spaces_has_ctx; then
            local symbol=$(_spaces_ctx_symbol)
            spaces_list "$symbol"
        else
            echo "No context set. Use: spaces ctx set <org> <bucket> [path]" >&2
            return 1
        fi
        return
    fi

    shift

    case "$cmd" in
        # Context management
        ctx)
            if declare -f spaces_ctx &>/dev/null; then
                spaces_ctx "$@"
            else
                echo "Error: spaces ctx requires tps module" >&2
                return 1
            fi
            ;;

        # List (context-aware)
        ls)
            local symbol="${1:-}"
            if [[ -z "$symbol" ]] && declare -f _spaces_ctx_symbol &>/dev/null; then
                symbol=$(_spaces_ctx_symbol 2>/dev/null)
            fi
            if [[ -z "$symbol" ]]; then
                echo "Usage: spaces ls [bucket[:path]]" >&2
                return 1
            fi
            spaces_list "$symbol"
            ;;

        # Get (download)
        get)
            local symbol="${1:-}"
            local dest="${2:--}"
            if [[ -z "$symbol" ]]; then
                echo "Usage: spaces get <path> [dest]" >&2
                return 1
            fi
            # Resolve relative path against context
            if declare -f _spaces_has_ctx &>/dev/null && _spaces_has_ctx; then
                if [[ ! "$symbol" =~ : ]]; then
                    symbol=$(_spaces_ctx_symbol "$symbol")
                fi
            fi
            spaces_get "$symbol" "$dest"
            ;;

        # Put (upload)
        put)
            local source="$1"
            local dest="${2:-}"
            shift 2 2>/dev/null || true
            if [[ -z "$source" ]]; then
                echo "Usage: spaces put <file> [path] [options]" >&2
                return 1
            fi
            # If no dest and context set, use filename
            if [[ -z "$dest" ]] && declare -f _spaces_has_ctx &>/dev/null && _spaces_has_ctx; then
                dest=$(basename "$source")
            fi
            # Resolve relative path against context
            if declare -f _spaces_has_ctx &>/dev/null && _spaces_has_ctx; then
                if [[ ! "$dest" =~ : ]]; then
                    dest=$(_spaces_ctx_symbol "$dest")
                fi
            fi
            if [[ -z "$dest" ]]; then
                echo "Usage: spaces put <file> <bucket:path>" >&2
                return 1
            fi
            spaces_put "$source" "$dest" "$@"
            # Invalidate cache after mutation
            _spaces_cache_invalidate 2>/dev/null
            ;;

        # Sync
        sync)
            spaces_sync "$@"
            # Invalidate cache after mutation
            _spaces_cache_invalidate 2>/dev/null
            ;;

        # Delete
        del)
            spaces_delete "$@"
            # Invalidate cache after mutation
            _spaces_cache_invalidate 2>/dev/null
            ;;

        # Info (URL + metadata)
        info)
            local symbol="${1:-}"
            if [[ -z "$symbol" ]] && declare -f _spaces_ctx_symbol &>/dev/null; then
                symbol=$(_spaces_ctx_symbol 2>/dev/null)
            fi
            if [[ -z "$symbol" ]]; then
                echo "Usage: spaces info [bucket:path]" >&2
                return 1
            fi
            _spaces_resolve "$symbol" || return 1
            echo "Bucket:   $SPACES_BUCKET"
            echo "Path:     ${SPACES_PATH:-/}"
            echo "URI:      $SPACES_URI"
            echo "URL:      https://$SPACES_BUCKET.$SPACES_HOST/$SPACES_PATH"
            echo "Endpoint: $SPACES_ENDPOINT"
            ;;

        # Help
        help|--help|-h)
            cat <<'EOF'
Tetra Spaces - DigitalOcean Spaces with context

USAGE:
    spaces              List current context (if set)
    spaces <cmd> [args]

COMMANDS:
    ctx                 Context management (org:bucket:path)
    ls   [path]         List contents
    get  <path> [dest]  Download file
    put  <file> [path]  Upload file
    sync <src> <dest>   Sync directories
    del  <path>         Delete file
    info [path]         Show URL and metadata

CONTEXT:
    spaces ctx set <org> <bucket> [path]
    spaces ctx status
    spaces                    # ls with context

EXAMPLES:
    # Set context and work
    spaces ctx set tetra pja-games games/
    spaces                    # ls games/
    spaces get manifest.json  # download games/manifest.json
    spaces put ./new.json     # upload to games/new.json

    # Direct (no context)
    spaces ls pja-games:games/
    spaces get pja-games:games/manifest.json
EOF
            ;;

        *)
            echo "Unknown: $cmd (try: ctx ls get put sync del info help)"
            return 1
            ;;
    esac
}

export -f spaces
