#!/usr/bin/env bash
# gamepak/core/sync.sh - Status, pull, push operations

# =============================================================================
# HELPERS
# =============================================================================

# Find the gamepak tracking file in a directory
# Returns path to *.gamepak file, or empty if none found
_gamepak_find_tracking() {
    local dir="${1:-.}"
    local found
    found=$(find "$dir" -maxdepth 1 -name "*.gamepak" -type f 2>/dev/null | head -1)
    echo "$found"
}

# Read gamepak tracking file into global variables
# Usage: _gamepak_read_tracking <dir>
# Sets: GAMEPAK_REMOTE, GAMEPAK_ORG, GAMEPAK_VERSION, GAMEPAK_PULLED_AT, GAMEPAK_FILE, GAMEPAK_SLUG
_gamepak_read_tracking() {
    local dir="${1:-.}"
    local tracking_file
    tracking_file=$(_gamepak_find_tracking "$dir")

    if [[ -z "$tracking_file" || ! -f "$tracking_file" ]]; then
        return 1
    fi

    # Extract slug from filename (e.g., grid-ranger.gamepak -> grid-ranger)
    GAMEPAK_FILE="$tracking_file"
    GAMEPAK_SLUG=$(basename "$tracking_file" .gamepak)

    # Read key=value pairs
    while IFS='=' read -r key value; do
        [[ -z "$key" || "$key" == \#* ]] && continue
        case "$key" in
            remote) GAMEPAK_REMOTE="$value" ;;
            org) GAMEPAK_ORG="$value" ;;
            version) GAMEPAK_VERSION="$value" ;;
            pulled_at) GAMEPAK_PULLED_AT="$value" ;;
            index_rev) GAMEPAK_INDEX_REV="$value" ;;
        esac
    done < "$tracking_file"

    return 0
}

# Update gamepak tracking file
# Usage: _gamepak_write_tracking <dir> [key=value ...]
# Note: Must call _gamepak_read_tracking first to set GAMEPAK_FILE
_gamepak_write_tracking() {
    local dir="$1"
    shift

    # Read existing values (sets GAMEPAK_FILE)
    _gamepak_read_tracking "$dir" 2>/dev/null || true

    if [[ -z "$GAMEPAK_FILE" ]]; then
        echo "Error: No tracking file found in $dir" >&2
        return 1
    fi

    # Apply updates
    for kv in "$@"; do
        local key="${kv%%=*}"
        local value="${kv#*=}"
        case "$key" in
            remote) GAMEPAK_REMOTE="$value" ;;
            org) GAMEPAK_ORG="$value" ;;
            version) GAMEPAK_VERSION="$value" ;;
            pulled_at) GAMEPAK_PULLED_AT="$value" ;;
            index_rev) GAMEPAK_INDEX_REV="$value" ;;
        esac
    done

    # Write file
    cat > "$GAMEPAK_FILE" << EOF
remote=${GAMEPAK_REMOTE:-}
org=${GAMEPAK_ORG:-}
version=${GAMEPAK_VERSION:-unknown}
pulled_at=${GAMEPAK_PULLED_AT:-}
EOF
    [[ -n "$GAMEPAK_INDEX_REV" ]] && echo "index_rev=${GAMEPAK_INDEX_REV}" >> "$GAMEPAK_FILE"
}

# =============================================================================
# STATUS - Show local vs remote diff
# =============================================================================

gamepak_status() {
    local dir="${1:-.}"

    # Resolve to absolute path
    [[ "$dir" != /* ]] && dir="$(cd "$dir" 2>/dev/null && pwd)"

    if ! _gamepak_read_tracking "$dir"; then
        echo "Not a gamepak directory (no *.gamepak file found)" >&2
        echo "Run 'gamepak clone <slug>' first" >&2
        return 1
    fi

    local slug="$GAMEPAK_SLUG"
    local bucket="${GAMEPAK_REMOTE%%:*}"

    echo "Gamepak Status"
    echo "=============="
    echo ""
    echo "Game:      $slug"
    echo "Remote:    s3://$bucket/$slug/"
    echo "Local:     $dir"
    echo "Version:   $GAMEPAK_VERSION"
    echo "Pulled:    $GAMEPAK_PULLED_AT"
    echo ""

    # Check for local modifications
    echo "Local changes:"

    # Get local version from game.toml
    local local_version="unknown"
    if [[ -f "$dir/game.toml" ]]; then
        local_version=$(grep -E '^version\s*=' "$dir/game.toml" 2>/dev/null | \
            head -1 | sed 's/.*=\s*"\([^"]*\)".*/\1/')
    fi

    if [[ "$local_version" != "$GAMEPAK_VERSION" ]]; then
        echo "  [M] game.toml (version: $GAMEPAK_VERSION -> $local_version)"
    fi

    # Check index.html modification time
    if [[ -f "$dir/index.html" ]]; then
        local pulled_epoch=$(date -j -f "%Y-%m-%dT%H:%M:%S" "${GAMEPAK_PULLED_AT%[+-]*}" "+%s" 2>/dev/null || echo 0)
        local index_mtime=$(stat -f %m "$dir/index.html" 2>/dev/null || stat -c %Y "$dir/index.html" 2>/dev/null)

        if ((index_mtime > pulled_epoch)); then
            echo "  [M] index.html (modified since pull)"
        fi
    fi

    # Count other files
    local file_count=$(find "$dir" -type f ! -name "*.gamepak" ! -name "*.original" | wc -l | tr -d ' ')
    echo ""
    echo "Files: $file_count"
}

# =============================================================================
# PULL - Sync S3 → local
# =============================================================================

gamepak_pull() {
    local dir="${1:-.}"
    local dry_run=""

    # Parse options
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --dry-run|-n) dry_run="--dry-run" ;;
            -*) echo "Unknown option: $1" >&2; return 1 ;;
            *) dir="$1" ;;
        esac
        shift
    done

    # Resolve to absolute path
    [[ "$dir" != /* ]] && dir="$(cd "$dir" 2>/dev/null && pwd)"

    if ! _gamepak_read_tracking "$dir"; then
        echo "Not a gamepak directory (no *.gamepak file found)" >&2
        return 1
    fi

    local slug="$GAMEPAK_SLUG"
    local bucket="${GAMEPAK_REMOTE%%:*}"
    local org="$GAMEPAK_ORG"

    echo "Pulling: $slug"
    echo "From:    s3://$bucket/$slug/"
    echo "To:      $dir"
    echo ""

    # Set up environment
    export TETRA_ORG="$org"
    local secrets_file="$TETRA_DIR/orgs/$org/secrets.env"
    [[ -f "$secrets_file" ]] && source "$secrets_file"

    # Resolve and sync
    local symbol="${bucket}:${slug}/"
    _spaces_resolve "$symbol" || return 1

    local cfg=$(_spaces_s3cfg)
    s3cmd sync "$SPACES_URI" "$dir/" --config="$cfg" $dry_run 2>&1 | grep -v "^$"
    local rc=${PIPESTATUS[0]}
    rm -f "$cfg"

    if ((rc != 0)); then
        echo "Error: Pull failed" >&2
        return 1
    fi

    # Update tracking
    if [[ -z "$dry_run" ]]; then
        local version="unknown"
        if [[ -f "$dir/game.toml" ]]; then
            version=$(grep -E '^version\s*=' "$dir/game.toml" 2>/dev/null | \
                head -1 | sed 's/.*=\s*"\([^"]*\)".*/\1/')
        fi

        _gamepak_write_tracking "$dir" \
            "version=$version" \
            "pulled_at=$(date -Iseconds)"

        echo ""
        echo "Pull complete. Version: $version"
    fi
}

# =============================================================================
# PUSH - Sync local → S3
# =============================================================================

gamepak_push() {
    local dir="."
    local version=""
    local message=""
    local dry_run=""
    local skip_version=false

    # Parse options
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --version|-v) version="$2"; shift ;;
            --message|-m) message="$2"; shift ;;
            --dry-run|-n) dry_run="--dry-run" ;;
            --no-version) skip_version=true ;;
            -*) echo "Unknown option: $1" >&2; return 1 ;;
            *) dir="$1" ;;
        esac
        shift
    done

    # Resolve to absolute path
    [[ "$dir" != /* ]] && dir="$(cd "$dir" 2>/dev/null && pwd)"

    if ! _gamepak_read_tracking "$dir"; then
        echo "Not a gamepak directory (no *.gamepak file found)" >&2
        return 1
    fi

    local slug="$GAMEPAK_SLUG"
    local bucket="${GAMEPAK_REMOTE%%:*}"
    local org="$GAMEPAK_ORG"

    # Get current version from game.toml
    local current_version="unknown"
    if [[ -f "$dir/game.toml" ]]; then
        current_version=$(grep -E '^version\s*=' "$dir/game.toml" 2>/dev/null | \
            head -1 | sed 's/.*=\s*"\([^"]*\)".*/\1/')
    fi

    # Use provided version or current
    version="${version:-$current_version}"

    echo "Pushing: $slug"
    echo "From:    $dir"
    echo "To:      s3://$bucket/$slug/"
    echo "Version: $version"
    echo ""

    # Set up environment
    export TETRA_ORG="$org"
    local secrets_file="$TETRA_DIR/orgs/$org/secrets.env"
    [[ -f "$secrets_file" ]] && source "$secrets_file"

    local symbol="${bucket}:${slug}/"
    _spaces_resolve "$symbol" || return 1

    local cfg=$(_spaces_s3cfg)

    # If version specified and different from tracked, archive current first
    if [[ -n "$version" && "$version" != "$GAMEPAK_VERSION" ]] && ! $skip_version; then
        echo "Archiving version $version to .versions/$version/"

        if [[ -z "$dry_run" ]]; then
            # Upload to versioned path
            local version_uri="s3://$bucket/$slug/.versions/v$version/"
            s3cmd sync "$dir/" "$version_uri" --config="$cfg" \
                --exclude='*.gamepak' --exclude='*.original' \
                --acl-public 2>&1 | grep -v "^$"
        fi
    fi

    # Sync to main path
    echo ""
    echo "Syncing to main path..."
    s3cmd sync "$dir/" "$SPACES_URI" --config="$cfg" \
        --exclude='*.gamepak' --exclude='*.original' \
        --acl-public $dry_run 2>&1 | grep -v "^$"
    local rc=${PIPESTATUS[0]}
    rm -f "$cfg"

    if ((rc != 0)); then
        echo "Error: Push failed" >&2
        return 1
    fi

    # Update tracking
    if [[ -z "$dry_run" ]]; then
        _gamepak_write_tracking "$dir" "version=$version"

        echo ""
        echo "Pushed: $slug v$version"
        echo "URL:    https://$bucket.sfo3.digitaloceanspaces.com/$slug/"
    fi
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f _gamepak_find_tracking _gamepak_read_tracking _gamepak_write_tracking
export -f gamepak_status gamepak_pull gamepak_push
