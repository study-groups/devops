#!/usr/bin/env bash
# spaces_complete.sh - Dynamic tab completion for spaces command
#
# Provides completion for:
# - Commands: ctx, ls, get, put, sync, del, info, help
# - Context: orgs, buckets, paths
# - Files: local files for put/sync

# =============================================================================
# COMMANDS
# =============================================================================

_SPACES_COMMANDS="ctx ls get put sync del info help"
_SPACES_CTX_COMMANDS="set org bucket path cache clear status"

# =============================================================================
# CACHE INFRASTRUCTURE
# =============================================================================

SPACES_CACHE_DIR="${TETRA_DIR}/.cache/spaces"
SPACES_CACHE_TTL=300  # 5 minutes

# Ensure cache directory exists
_spaces_cache_init() {
    [[ -d "$SPACES_CACHE_DIR" ]] || mkdir -p "$SPACES_CACHE_DIR"
}

# Get cache file path for a bucket
_spaces_cache_file() {
    local org="$1"
    local bucket="$2"
    echo "$SPACES_CACHE_DIR/${org}_${bucket}.paths"
}

# Check if cache is valid (exists and not expired)
_spaces_cache_valid() {
    local cache_file="$1"
    [[ -f "$cache_file" ]] || return 1

    # Check age (find returns file if older than TTL)
    local expired
    expired=$(find "$cache_file" -mmin +$((SPACES_CACHE_TTL / 60)) 2>/dev/null)
    [[ -z "$expired" ]]
}

# Fetch and cache S3 paths for a bucket
_spaces_cache_refresh() {
    local org="$1"
    local bucket="$2"

    _spaces_cache_init
    local cache_file=$(_spaces_cache_file "$org" "$bucket")

    # Need secrets loaded
    local secrets_file="$TETRA_DIR/orgs/$org/secrets.env"
    [[ -f "$secrets_file" ]] && source "$secrets_file"

    # Set org for resolution
    export TETRA_ORG="$org"

    # Fetch listing (background-friendly, silent)
    if _spaces_resolve "$bucket" &>/dev/null; then
        local cfg=$(_spaces_s3cfg)
        s3cmd ls -r "$SPACES_URI" --config="$cfg" 2>/dev/null | \
            awk '{print $NF}' | \
            sed "s|s3://${bucket}/||" | \
            sort -u > "$cache_file"
        rm -f "$cfg"
    fi
}

# Get cached paths (refresh if needed)
_spaces_cache_get() {
    local org="$1"
    local bucket="$2"
    local cache_file=$(_spaces_cache_file "$org" "$bucket")

    if ! _spaces_cache_valid "$cache_file"; then
        # Refresh in background for responsiveness
        (_spaces_cache_refresh "$org" "$bucket" &)
        # Return empty for now, will have data next time
        return
    fi

    cat "$cache_file" 2>/dev/null
}

# Invalidate cache for a bucket
_spaces_cache_invalidate() {
    local org="${1:-$(_spaces_org 2>/dev/null)}"
    local bucket="${2:-$(_spaces_bucket 2>/dev/null)}"
    [[ -z "$org" || -z "$bucket" ]] && return

    local cache_file=$(_spaces_cache_file "$org" "$bucket")
    rm -f "$cache_file" 2>/dev/null
}

# =============================================================================
# DYNAMIC COMPLETIONS
# =============================================================================

# Get available org names
_spaces_complete_orgs() {
    local orgs_dir="$TETRA_DIR/orgs"
    [[ -d "$orgs_dir" ]] || return
    for dir in "$orgs_dir"/*/; do
        [[ -d "$dir" ]] || continue
        local name=$(basename "$dir")
        # Only show orgs with storage.spaces config
        local toml="$dir/tetra.toml"
        if [[ -f "$toml" ]] && grep -q '^\[storage\.spaces\]' "$toml" 2>/dev/null; then
            echo "$name"
        fi
    done
}

# Get bucket names from current org's tetra.toml
_spaces_complete_buckets() {
    local org="${1:-$TETRA_ORG}"
    [[ -z "$org" ]] && org=$(_spaces_org 2>/dev/null)
    [[ -z "$org" ]] && return

    local toml_file="$TETRA_DIR/orgs/$org/tetra.toml"
    [[ -f "$toml_file" ]] || return

    local buckets=()

    # Get default bucket
    local default_bucket
    default_bucket=$(awk '/^\[storage\.spaces\]/ {found=1; next} found && /^\[/ {exit} found && /^default_bucket/ {print}' "$toml_file" 2>/dev/null | cut -d'=' -f2 | tr -d ' "')
    [[ -n "$default_bucket" ]] && buckets+=("$default_bucket")

    # Get buckets from publishing sections
    local pub_buckets
    pub_buckets=$(grep -E '^\s*bucket\s*=' "$toml_file" 2>/dev/null | cut -d'=' -f2 | tr -d ' "' | sort -u)
    for b in $pub_buckets; do
        [[ -n "$b" && "$b" != "$default_bucket" ]] && buckets+=("$b")
    done

    printf '%s\n' "${buckets[@]}" | sort -u
}

# Get paths from S3 cache (dynamic)
_spaces_complete_paths() {
    local org="${1:-$(_spaces_org 2>/dev/null)}"
    local bucket="${2:-$(_spaces_bucket 2>/dev/null)}"

    # Try cached S3 paths first
    if [[ -n "$org" && -n "$bucket" ]]; then
        local cached=$(_spaces_cache_get "$org" "$bucket")
        if [[ -n "$cached" ]]; then
            echo "$cached"
            return
        fi
    fi

    # Fallback to common patterns
    echo "games/"
    echo "assets/"
    echo "docs/"
    echo "public/"
    echo "config/"
    echo "data/"
}

# Get context values for display
_spaces_ctx_org()    { tps_ctx get spaces org 2>/dev/null; }
_spaces_ctx_bucket() { tps_ctx get spaces project 2>/dev/null; }
_spaces_ctx_path()   { tps_ctx get spaces subject 2>/dev/null; }

# =============================================================================
# MAIN COMPLETION FUNCTION
# =============================================================================

_spaces_complete() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"
    local cmd="${COMP_WORDS[1]:-}"

    COMPREPLY=()

    # Level 1: Complete commands
    if [[ $COMP_CWORD -eq 1 ]]; then
        COMPREPLY=($(compgen -W "$_SPACES_COMMANDS" -- "$cur"))
        return 0
    fi

    # Level 2+: Context-sensitive completion
    case "$cmd" in
        ctx)
            _spaces_complete_ctx "$cur" "$prev"
            ;;
        ls)
            _spaces_complete_symbol "$cur"
            ;;
        get)
            _spaces_complete_symbol "$cur"
            ;;
        put)
            _spaces_complete_put "$cur" "$prev"
            ;;
        sync)
            _spaces_complete_sync "$cur" "$prev"
            ;;
        del)
            _spaces_complete_symbol "$cur"
            ;;
        info)
            _spaces_complete_symbol "$cur"
            ;;
        help)
            COMPREPLY=($(compgen -W "$_SPACES_COMMANDS" -- "$cur"))
            ;;
    esac
}

# Complete ctx subcommands
_spaces_complete_ctx() {
    local cur="$1"
    local prev="$2"
    local subcmd="${COMP_WORDS[2]:-}"

    # Level 2: ctx subcommands
    if [[ $COMP_CWORD -eq 2 ]]; then
        # Also allow direct org names as shorthand
        local orgs=$(_spaces_complete_orgs)
        COMPREPLY=($(compgen -W "$_SPACES_CTX_COMMANDS $orgs" -- "$cur"))
        return 0
    fi

    # Level 3+: depends on ctx subcommand
    case "$subcmd" in
        set)
            case $COMP_CWORD in
                3)  # org
                    COMPREPLY=($(compgen -W "$(_spaces_complete_orgs)" -- "$cur"))
                    ;;
                4)  # bucket
                    local org="${COMP_WORDS[3]}"
                    COMPREPLY=($(compgen -W "$(_spaces_complete_buckets "$org")" -- "$cur"))
                    ;;
                5)  # path
                    COMPREPLY=($(compgen -W "$(_spaces_complete_paths)" -- "$cur"))
                    ;;
            esac
            ;;
        org)
            if [[ $COMP_CWORD -eq 3 ]]; then
                COMPREPLY=($(compgen -W "$(_spaces_complete_orgs)" -- "$cur"))
            fi
            ;;
        bucket)
            if [[ $COMP_CWORD -eq 3 ]]; then
                COMPREPLY=($(compgen -W "$(_spaces_complete_buckets)" -- "$cur"))
            fi
            ;;
        path)
            if [[ $COMP_CWORD -eq 3 ]]; then
                COMPREPLY=($(compgen -W "$(_spaces_complete_paths)" -- "$cur"))
            fi
            ;;
        cache)
            if [[ $COMP_CWORD -eq 3 ]]; then
                COMPREPLY=($(compgen -W "refresh clear status" -- "$cur"))
            fi
            ;;
        *)
            # Shorthand: spaces ctx <org> [bucket] [path]
            if [[ -d "$TETRA_DIR/orgs/$subcmd" ]]; then
                case $COMP_CWORD in
                    3)  # bucket
                        COMPREPLY=($(compgen -W "$(_spaces_complete_buckets "$subcmd")" -- "$cur"))
                        ;;
                    4)  # path
                        COMPREPLY=($(compgen -W "$(_spaces_complete_paths)" -- "$cur"))
                        ;;
                esac
            fi
            ;;
    esac
}

# Complete bucket:path symbols
_spaces_complete_symbol() {
    local cur="$1"

    # If cur contains colon, complete path portion
    if [[ "$cur" == *:* ]]; then
        local bucket="${cur%%:*}"
        local path_prefix="${cur#*:}"
        local paths=$(_spaces_complete_paths)
        for p in $paths; do
            COMPREPLY+=("${bucket}:${p}")
        done
        COMPREPLY=($(compgen -W "${COMPREPLY[*]}" -- "$cur"))
    else
        # Complete bucket names
        local buckets=$(_spaces_complete_buckets)
        # Add colon suffix to suggest path completion
        local with_colon=""
        for b in $buckets; do
            with_colon+="$b $b: "
        done
        COMPREPLY=($(compgen -W "$with_colon" -- "$cur"))
    fi
}

# Complete put command (local file then symbol)
_spaces_complete_put() {
    local cur="$1"
    local prev="$2"

    if [[ $COMP_CWORD -eq 2 ]]; then
        # First arg: local file
        COMPREPLY=($(compgen -f -- "$cur"))
    elif [[ $COMP_CWORD -eq 3 ]]; then
        # Second arg: bucket:path
        _spaces_complete_symbol "$cur"
    else
        # Options
        COMPREPLY=($(compgen -W "--acl-public --add-header=" -- "$cur"))
    fi
}

# Complete sync command
_spaces_complete_sync() {
    local cur="$1"
    local prev="$2"

    if [[ $COMP_CWORD -eq 2 ]]; then
        # Source: could be local dir or bucket:path
        if [[ "$cur" == *:* || -z "$cur" ]]; then
            _spaces_complete_symbol "$cur"
        else
            # Check if starts like a bucket name
            local buckets=$(_spaces_complete_buckets)
            local is_bucket=false
            for b in $buckets; do
                [[ "$cur" == "$b"* ]] && is_bucket=true && break
            done
            if $is_bucket; then
                _spaces_complete_symbol "$cur"
            else
                # Local directory
                COMPREPLY=($(compgen -d -- "$cur"))
            fi
        fi
    elif [[ $COMP_CWORD -eq 3 ]]; then
        # Dest: opposite of source
        local src="${COMP_WORDS[2]}"
        if [[ "$src" == *:* ]]; then
            # Source is remote, dest is local
            COMPREPLY=($(compgen -d -- "$cur"))
        else
            # Source is local, dest is remote
            _spaces_complete_symbol "$cur"
        fi
    else
        COMPREPLY=($(compgen -W "--delete --dry-run --exclude=" -- "$cur"))
    fi
}

# =============================================================================
# REGISTER COMPLETION
# =============================================================================

complete -F _spaces_complete spaces

# Export for potential reuse
export -f _spaces_cache_init _spaces_cache_file _spaces_cache_valid
export -f _spaces_cache_refresh _spaces_cache_get _spaces_cache_invalidate
export -f _spaces_complete_orgs _spaces_complete_buckets _spaces_complete_paths
export -f _spaces_complete
