#!/usr/bin/env bash
# gamepak/core/clone.sh - Clone game from S3

# =============================================================================
# CLONE - Download game from S3 and create .gamepak tracking
# =============================================================================

# Clone a game from S3
# Usage: gamepak_clone <slug> [--org <org>] [--bucket <bucket>] [--dest <dir>]
gamepak_clone() {
    local slug=""
    local org=""
    local bucket=""
    local dest=""

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --org|-o) org="$2"; shift ;;
            --bucket|-b) bucket="$2"; shift ;;
            --dest|-d) dest="$2"; shift ;;
            -*) echo "Unknown option: $1" >&2; return 1 ;;
            *) [[ -z "$slug" ]] && slug="$1" ;;
        esac
        shift
    done

    if [[ -z "$slug" ]]; then
        echo "Usage: gamepak clone <slug> [--org <org>] [--bucket <bucket>]" >&2
        return 1
    fi

    # Resolve org and bucket
    org="${org:-$(_gamepak_get_org)}"
    bucket="${bucket:-$(_gamepak_get_bucket)}"

    # Default destination
    if [[ -z "$dest" ]]; then
        dest="$TETRA_DIR/orgs/$org/games/$slug"
    fi

    # Check if already exists (look for any *.gamepak file)
    if [[ -d "$dest" ]] && ls "$dest"/*.gamepak &>/dev/null; then
        echo "Already cloned: $dest" >&2
        echo "Use 'gamepak pull' to update" >&2
        return 1
    fi

    echo "Cloning: $slug"
    echo "From:    s3://$bucket/$slug/"
    echo "To:      $dest"
    echo ""

    # Set TETRA_ORG for spaces resolution
    export TETRA_ORG="$org"

    # Source org secrets if available
    local secrets_file="$TETRA_DIR/orgs/$org/secrets.env"
    if [[ -f "$secrets_file" ]]; then
        source "$secrets_file"
    fi

    # Create destination directory
    mkdir -p "$dest"

    # Build spaces symbol
    local symbol="${bucket}:${slug}/"

    # Sync from S3
    echo "Downloading..."
    if ! _spaces_resolve "$symbol" &>/dev/null; then
        echo "Error: Cannot resolve $symbol" >&2
        echo "Check org config: $TETRA_DIR/orgs/$org/tetra.toml" >&2
        return 1
    fi

    local cfg=$(_spaces_s3cfg)
    s3cmd sync "$SPACES_URI" "$dest/" --config="$cfg" 2>&1 | grep -v "^$"
    local rc=${PIPESTATUS[0]}
    rm -f "$cfg"

    if ((rc != 0)); then
        echo "Error: s3cmd sync failed (exit code: $rc)" >&2
        return 1
    fi

    # Get version from game.toml if exists
    local version="unknown"
    if [[ -f "$dest/game.toml" ]]; then
        version=$(grep -E '^version\s*=' "$dest/game.toml" 2>/dev/null | \
            head -1 | sed 's/.*=\s*"\([^"]*\)".*/\1/')
        [[ -z "$version" ]] && version="unknown"
    fi

    # Create tracking file (slug.gamepak, not dotfile)
    local timestamp=$(date -Iseconds)
    cat > "$dest/${slug}.gamepak" << EOF
remote=${bucket}:${slug}
org=${org}
version=${version}
pulled_at=${timestamp}
EOF

    echo ""
    echo "Cloned: $slug"
    echo "  Directory: $dest"
    echo "  Version:   $version"
    echo ""
    echo "Next steps:"
    echo "  cd $dest"
    echo "  gamepak inspect"
    echo "  gamepak doctor --fix"
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f gamepak_clone
