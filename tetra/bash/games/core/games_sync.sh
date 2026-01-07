#!/usr/bin/env bash

# Games Sync Module - S3 sync operations for games
# Uses the tetra spaces module for S3 operations
#
# Commands:
#   games_pull     - Download games from S3
#   games_push     - Upload games to S3
#   games_publish  - Publish with versioning + manifest
#   games_fetch    - Fetch specific game from S3
#   games_remote   - List/manage remote games

# Require bash 5.2+
if ((BASH_VERSINFO[0] < 5 || (BASH_VERSINFO[0] == 5 && BASH_VERSINFO[1] < 2))); then
    echo "Error: games_sync requires bash 5.2+" >&2
    return 1
fi

# =============================================================================
# SPACES MODULE INTEGRATION
# =============================================================================

# Source spaces module if not already loaded
if ! declare -f spaces_sync >/dev/null 2>&1; then
    if [[ -f "$TETRA_SRC/bash/spaces/spaces.sh" ]]; then
        source "$TETRA_SRC/bash/spaces/spaces.sh"
    else
        echo "Warning: spaces module not found at $TETRA_SRC/bash/spaces/spaces.sh" >&2
    fi
fi

# =============================================================================
# CONFIGURATION
# =============================================================================

# Get S3 bucket and prefix for a games category
# Usage: _games_s3_config "pixeljam-arcade" "pja-games"
# Sets: GAMES_S3_BUCKET, GAMES_S3_PREFIX
_games_s3_config() {
    local org="$1"
    local category="${2:-pja-games}"

    local toml_file
    toml_file=$(games_get_toml_path "$org")

    if [[ ! -f "$toml_file" ]]; then
        echo "Error: tetra.toml not found: $toml_file" >&2
        return 1
    fi

    # Try games.categories.<category> first
    local games_section
    games_section=$(awk '/^\[games\.categories\.'"$category"'\]/ {found=1; next} found && /^\[/ {exit} found {print}' "$toml_file")

    if [[ -n "$games_section" ]]; then
        GAMES_S3_BUCKET=$(echo "$games_section" | grep '^s3_bucket' | cut -d'=' -f2 | tr -d ' "')
        GAMES_S3_PREFIX=$(echo "$games_section" | grep '^s3_prefix' | cut -d'=' -f2 | tr -d ' "')
    else
        # Fall back to storage.spaces default bucket
        local storage_section
        storage_section=$(awk '/^\[storage\.spaces\]/ {found=1; next} found && /^\[/ {exit} found {print}' "$toml_file")
        GAMES_S3_BUCKET=$(echo "$storage_section" | grep '^default_bucket' | cut -d'=' -f2 | tr -d ' "')
        GAMES_S3_PREFIX="games/"
    fi

    if [[ -z "$GAMES_S3_BUCKET" ]]; then
        echo "Error: S3 bucket not configured for $org" >&2
        return 1
    fi

    return 0
}

# Build spaces symbol for a path
# Usage: _games_spaces_symbol "cheap-golf"
# Returns: pja-games:cheap-golf or just pja-games if no path
_games_spaces_symbol() {
    local path="${1:-}"
    local full_path="${GAMES_S3_PREFIX}${path}"

    # Remove leading/trailing slashes for clean symbol
    full_path="${full_path#/}"
    full_path="${full_path%/}"

    if [[ -n "$full_path" ]]; then
        echo "${GAMES_S3_BUCKET}:${full_path}"
    else
        echo "${GAMES_S3_BUCKET}"
    fi
}

# =============================================================================
# REMOTE OPERATIONS
# =============================================================================

# List games on S3
# Usage: games_remote_list [org]
games_remote_list() {
    local org="${1:-$(_games_get_org)}"

    _games_s3_config "$org" || return 1

    local symbol
    symbol=$(_games_spaces_symbol)

    echo "Remote games ($org):"
    echo "Location: @spaces:$symbol"
    echo ""

    # List directories, extract game names
    spaces_list "$symbol" 2>/dev/null | grep 'DIR' | \
        sed 's|.*s3://[^/]*/||' | sed 's|/$||' | \
        grep -v '^$' | grep -v '^videos$' | \
        while read -r game; do
            echo "  $game"
        done
}

# Get manifest from S3
# Usage: games_remote_manifest [org]
games_remote_manifest() {
    local org="${1:-$(_games_get_org)}"

    _games_s3_config "$org" || return 1

    local symbol
    symbol="${GAMES_S3_BUCKET}:manifest.json"

    spaces_get "$symbol" - 2>/dev/null
}

# =============================================================================
# FETCH - Download specific game
# =============================================================================

# Fetch a single game from S3
# Usage: games_fetch <game> [--version <version>] [--org <org>]
games_fetch() {
    local game=""
    local version="latest"
    local org=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --version|-v) version="$2"; shift ;;
            --org|-o) org="$2"; shift ;;
            --dry-run) ;; # Ignore dry-run for fetch
            -*) echo "Unknown option: $1" >&2; return 1 ;;
            *) [[ -z "$game" ]] && game="$1" ;;
        esac
        shift
    done

    if [[ -z "$game" ]]; then
        echo "Usage: games fetch <game> [--version <version>] [--org <org>]" >&2
        return 1
    fi

    org="${org:-$(_games_get_org)}"
    _games_s3_config "$org" || return 1

    local local_dir
    local_dir="$TETRA_DIR/orgs/$org/games/$game"

    local remote_path
    if [[ "$version" == "latest" ]]; then
        remote_path="$game/"
    else
        remote_path="$game/$version/"
    fi

    local symbol
    symbol=$(_games_spaces_symbol "$remote_path")

    echo "Fetching: $game (version: $version)"
    echo "From: @spaces:$symbol"
    echo "To:   $local_dir"
    echo ""

    mkdir -p "$local_dir"
    spaces_sync "$symbol" "$local_dir/"

    local result=$?
    if ((result == 0)); then
        echo ""
        echo "Fetched: $game"
    fi
    return $result
}

# =============================================================================
# PUSH/PULL - Sync operations
# =============================================================================

# Pull games from S3 to local
# Usage: games_pull [--org <org>] [--dry-run]
games_pull() {
    local org=""
    local dry_run=""
    local game=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --org|-o) org="$2"; shift ;;
            --dry-run|-n) dry_run="--dry-run" ;;
            -*) echo "Unknown option: $1" >&2; return 1 ;;
            *) game="$1" ;;
        esac
        shift
    done

    org="${org:-$(_games_get_org)}"
    _games_s3_config "$org" || return 1

    local local_dir="${TETRA_DIR}/orgs/${org}/games"
    local symbol

    if [[ -n "$game" ]]; then
        # Pull specific game
        symbol=$(_games_spaces_symbol "$game/")
        local_dir="${local_dir}/${game}"
        echo "Pull: $game"
    else
        # Pull all games
        symbol=$(_games_spaces_symbol)
        echo "Pull: all games"
    fi

    echo "From: @spaces:$symbol"
    echo "To:   $local_dir"
    echo ""

    mkdir -p "$local_dir"
    spaces_sync "$symbol" "$local_dir/" $dry_run

    local result=$?
    echo ""
    if ((result == 0)); then
        echo "Pull complete."
    else
        echo "Pull failed (exit code: $result)"
    fi
    return $result
}

# Push games from local to S3
# Usage: games_push [<game>] [--org <org>] [--dry-run] [--skip-preflight]
games_push() {
    local org=""
    local dry_run=""
    local game=""
    local skip_preflight=false

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --org|-o) org="$2"; shift ;;
            --dry-run|-n) dry_run="--dry-run" ;;
            --skip-preflight) skip_preflight=true ;;
            -*) echo "Unknown option: $1" >&2; return 1 ;;
            *) game="$1" ;;
        esac
        shift
    done

    org="${org:-$(_games_get_org)}"
    _games_s3_config "$org" || return 1

    local local_dir="${TETRA_DIR}/orgs/${org}/games"
    local symbol

    if [[ -n "$game" ]]; then
        # Push specific game
        local_dir="${local_dir}/${game}"
        symbol=$(_games_spaces_symbol "$game/")

        if [[ ! -d "$local_dir" ]]; then
            echo "Error: Game not found: $local_dir" >&2
            return 1
        fi

        echo "Push: $game"
    else
        # Push all games
        symbol=$(_games_spaces_symbol)
        echo "Push: all games"
    fi

    echo "From: $local_dir"
    echo "To:   @spaces:$symbol"
    echo ""

    # Run preflight before push
    if ! $skip_preflight && declare -f games_preflight >/dev/null 2>&1; then
        echo "Running preflight checks..."
        echo ""

        local preflight_failed=false
        if [[ -n "$game" ]]; then
            if ! games_preflight "$game" --org "$org" 2>/dev/null; then
                preflight_failed=true
            fi
        else
            if ! games_preflight --all --org "$org" 2>/dev/null; then
                preflight_failed=true
            fi
        fi

        if $preflight_failed; then
            echo ""
            echo "Preflight failed. Options:" >&2
            echo "  1. Fix the issues above" >&2
            echo "  2. Use --skip-preflight to bypass" >&2
            read -p "Push anyway? [y/N]: " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                echo "Cancelled"
                return 1
            fi
        fi
        echo ""
    fi

    spaces_sync "$local_dir/" "$symbol" --acl-public $dry_run

    local result=$?
    echo ""
    if ((result == 0)); then
        echo "Push complete."
        echo "CDN URL: https://${GAMES_S3_BUCKET}.sfo3.digitaloceanspaces.com/${GAMES_S3_PREFIX}"
    else
        echo "Push failed (exit code: $result)"
    fi
    return $result
}

# =============================================================================
# PUBLISH - Versioned release with manifest
# =============================================================================

# Publish a game with version and update manifest
# Usage: games_publish <game> [version] [--org <org>]
games_publish() {
    local game=""
    local version=""
    local org=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --org|-o) org="$2"; shift ;;
            -*) echo "Unknown option: $1" >&2; return 1 ;;
            *)
                if [[ -z "$game" ]]; then
                    game="$1"
                else
                    version="$1"
                fi
                ;;
        esac
        shift
    done

    if [[ -z "$game" ]]; then
        echo "Usage: games publish <game> [version] [--org <org>]" >&2
        return 1
    fi

    org="${org:-$(_games_get_org)}"
    _games_s3_config "$org" || return 1

    local local_dir="$TETRA_DIR/orgs/$org/games/$game"

    if [[ ! -d "$local_dir" ]]; then
        echo "Error: Game not found: $local_dir" >&2
        return 1
    fi

    # Get version from game.toml if not specified
    if [[ -z "$version" ]]; then
        if [[ -f "$local_dir/game.toml" ]]; then
            version=$(grep -E '^version\s*=' "$local_dir/game.toml" | head -1 | sed 's/.*=\s*"\([^"]*\)".*/\1/')
        fi
        version="${version:-1.0.0}"
    fi

    echo "Publishing: $game v$version"
    echo "Source: $local_dir"
    echo ""

    # 1. Upload to versioned path
    local version_symbol
    version_symbol=$(_games_spaces_symbol "$game/$version/")

    echo "1. Uploading to @spaces:$version_symbol"
    spaces_sync "$local_dir/" "$version_symbol" --acl-public

    # 2. Upload to latest path (overwrite)
    local latest_symbol
    latest_symbol=$(_games_spaces_symbol "$game/")

    echo ""
    echo "2. Updating latest at @spaces:$latest_symbol"
    spaces_sync "$local_dir/" "$latest_symbol" --acl-public --delete-removed

    # 3. Update manifest.json
    echo ""
    echo "3. Updating manifest..."
    _games_update_manifest "$org" "$game" "$version"

    echo ""
    echo "Published: $game v$version"
    echo "URL: $(spaces_url "$latest_symbol")"
}

# Update manifest.json with new game version
_games_update_manifest() {
    local org="$1"
    local game="$2"
    local version="$3"

    local manifest_symbol="${GAMES_S3_BUCKET}:manifest.json"
    local tmp_manifest="/tmp/games_manifest_$$.json"
    local timestamp
    timestamp=$(date -Iseconds)

    # Try to fetch existing manifest
    if spaces_get "$manifest_symbol" "$tmp_manifest" 2>/dev/null; then
        # Update existing entry or add new one
        # Using simple JSON manipulation (works for our flat structure)
        if grep -q "\"$game\"" "$tmp_manifest"; then
            # Update existing game entry
            sed -i.bak "s/\"$game\":[^}]*}/\"$game\": {\"version\": \"$version\", \"updated\": \"$timestamp\"}/" "$tmp_manifest"
        else
            # Add new game before closing brace
            sed -i.bak "s/}$/,\"$game\": {\"version\": \"$version\", \"updated\": \"$timestamp\"}}/" "$tmp_manifest"
        fi
    else
        # Create new manifest
        cat > "$tmp_manifest" << EOF
{
  "org": "$org",
  "updated": "$timestamp",
  "games": {
    "$game": {"version": "$version", "updated": "$timestamp"}
  }
}
EOF
    fi

    # Upload manifest
    spaces_put "$tmp_manifest" "$manifest_symbol" --acl-public
    rm -f "$tmp_manifest" "$tmp_manifest.bak"
}

# =============================================================================
# SYNC - Bidirectional with direction detection
# =============================================================================

# Bidirectional sync
# Usage: games_sync [org] [category] [--pull|--push] [--dry-run]
games_sync() {
    local org="${1:-$(_games_get_org)}"
    local category="${2:-pja-games}"
    shift 2 2>/dev/null || true

    local direction=""
    local options=()

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --pull) direction="pull" ;;
            --push) direction="push" ;;
            *) options+=("$1") ;;
        esac
        shift
    done

    if [[ -z "$direction" ]]; then
        echo "Sync direction required."
        echo ""
        echo "  1) pull - Download from S3 to local"
        echo "  2) push - Upload from local to S3"
        echo ""
        read -p "Direction [1/2]: " -n 1 -r
        echo
        case "$REPLY" in
            1) direction="pull" ;;
            2) direction="push" ;;
            *) echo "Cancelled"; return 1 ;;
        esac
    fi

    case "$direction" in
        pull) games_pull "$org" "$category" "${options[@]}" ;;
        push) games_push "$org" "$category" "${options[@]}" ;;
    esac
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f _games_s3_config
export -f _games_spaces_symbol
export -f games_remote_list
export -f games_remote_manifest
export -f games_fetch
export -f games_pull
export -f games_push
export -f games_publish
export -f _games_update_manifest
export -f games_sync
