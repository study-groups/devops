#!/usr/bin/env bash

# Games Sync Module - S3 sync operations for games
# Wraps the tetra spaces module for games-specific operations

# Require bash 5.2+
if ((BASH_VERSINFO[0] < 5 || (BASH_VERSINFO[0] == 5 && BASH_VERSINFO[1] < 2))); then
    echo "Error: games_sync requires bash 5.2+" >&2
    return 1
fi

# =============================================================================
# S3 CONFIGURATION
# Reads games-specific S3 config from tetra.toml [games] section
# Falls back to [storage.spaces] if no [games] section
# =============================================================================

# Load S3 config for a games category
# Usage: _games_s3_config "pixeljam-arcade" "pja-games"
# Sets: GAMES_S3_BUCKET, GAMES_S3_PREFIX, GAMES_S3_ENDPOINT, etc.
_games_s3_config() {
    local org="$1"
    local category="$2"

    local toml_file
    toml_file=$(games_get_toml_path "$org")

    if [[ ! -f "$toml_file" ]]; then
        echo "Error: tetra.toml not found: $toml_file" >&2
        return 1
    fi

    # Try to read games-specific config first
    local games_section
    games_section=$(awk '/^\[games\.categories\.'"$category"'\]/ {found=1; next} found && /^\[/ {exit} found {print}' "$toml_file")

    if [[ -n "$games_section" ]]; then
        # Category-specific config found
        GAMES_S3_BUCKET=$(echo "$games_section" | grep '^s3_bucket' | cut -d'=' -f2 | tr -d ' "')
        GAMES_S3_PREFIX=$(echo "$games_section" | grep '^s3_prefix' | cut -d'=' -f2 | tr -d ' "')
    else
        # Fall back to publishing.games or storage.spaces
        local pub_section
        pub_section=$(awk '/^\[publishing\.games\]/ {found=1; next} found && /^\[/ {exit} found {print}' "$toml_file")

        if [[ -n "$pub_section" ]]; then
            GAMES_S3_BUCKET=$(echo "$pub_section" | grep '^bucket' | cut -d'=' -f2 | tr -d ' "')
            GAMES_S3_PREFIX=$(echo "$pub_section" | grep '^prefix' | cut -d'=' -f2 | tr -d ' "')
        else
            # Fall back to storage.spaces default bucket
            local storage_section
            storage_section=$(awk '/^\[storage\.spaces\]/ {found=1; next} found && /^\[/ {exit} found {print}' "$toml_file")

            GAMES_S3_BUCKET=$(echo "$storage_section" | grep '^default_bucket' | cut -d'=' -f2 | tr -d ' "')
            GAMES_S3_PREFIX="${category}/"
        fi
    fi

    # Read S3 connection details from [games.s3] or [storage.spaces]
    local s3_section
    s3_section=$(awk '/^\[games\.s3\]/ {found=1; next} found && /^\[/ {exit} found {print}' "$toml_file")

    if [[ -z "$s3_section" ]]; then
        # Fall back to storage.spaces
        s3_section=$(awk '/^\[storage\.spaces\]/ {found=1; next} found && /^\[/ {exit} found {print}' "$toml_file")
    fi

    GAMES_S3_ENDPOINT=$(echo "$s3_section" | grep '^endpoint' | cut -d'=' -f2 | tr -d ' "')
    GAMES_S3_REGION=$(echo "$s3_section" | grep '^region' | cut -d'=' -f2 | tr -d ' "')
    GAMES_S3_ACCESS_KEY=$(echo "$s3_section" | grep '^access_key' | cut -d'=' -f2 | tr -d ' "')
    GAMES_S3_SECRET_KEY=$(echo "$s3_section" | grep '^secret_key' | cut -d'=' -f2 | tr -d ' "')

    # Expand environment variables in credentials
    GAMES_S3_ACCESS_KEY=$(eval echo "$GAMES_S3_ACCESS_KEY")
    GAMES_S3_SECRET_KEY=$(eval echo "$GAMES_S3_SECRET_KEY")

    # Extract host from endpoint
    GAMES_S3_HOST=$(echo "$GAMES_S3_ENDPOINT" | sed 's|^https\{0,1\}://||')

    # Validate required fields
    if [[ -z "$GAMES_S3_BUCKET" ]]; then
        echo "Error: S3 bucket not configured for $org/$category" >&2
        return 1
    fi

    if [[ -z "$GAMES_S3_ENDPOINT" ]]; then
        echo "Error: S3 endpoint not configured" >&2
        return 1
    fi

    return 0
}

# =============================================================================
# S3 OPERATIONS
# =============================================================================

# List games on S3
# Usage: games_s3_list "pixeljam-arcade" "pja-games"
games_s3_list() {
    local org="$1"
    local category="$2"

    _games_s3_config "$org" "$category" || return 1

    local s3_uri="s3://${GAMES_S3_BUCKET}/${GAMES_S3_PREFIX}"

    echo "S3: $s3_uri"
    echo ""

    s3cmd ls "$s3_uri" \
        --access_key="$GAMES_S3_ACCESS_KEY" \
        --secret_key="$GAMES_S3_SECRET_KEY" \
        --host="$GAMES_S3_HOST" \
        --host-bucket="%(bucket)s.$GAMES_S3_HOST" \
        --region="$GAMES_S3_REGION" 2>/dev/null || {
            echo "  (no games or S3 error)"
            return 1
        }
}

# Pull games from S3 to local
# Usage: games_pull "pixeljam-arcade" "pja-games" "prod" [--dry-run]
games_pull() {
    local org="$1"
    local category="$2"
    local env="$3"
    shift 3
    local options="$*"

    _games_s3_config "$org" "$category" || return 1

    local local_dir
    local_dir=$(games_get_category_dir "$org" "$category")
    local s3_uri="s3://${GAMES_S3_BUCKET}/${GAMES_S3_PREFIX}"

    echo "Pull: $s3_uri -> $local_dir"
    echo ""

    # Create local directory if needed
    mkdir -p "$local_dir"

    s3cmd sync "$s3_uri" "$local_dir/" \
        --access_key="$GAMES_S3_ACCESS_KEY" \
        --secret_key="$GAMES_S3_SECRET_KEY" \
        --host="$GAMES_S3_HOST" \
        --host-bucket="%(bucket)s.$GAMES_S3_HOST" \
        --region="$GAMES_S3_REGION" \
        $options

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
# Usage: games_push "pixeljam-arcade" "pja-games" "prod" [--dry-run]
games_push() {
    local org="$1"
    local category="$2"
    local env="$3"
    shift 3
    local options="$*"

    _games_s3_config "$org" "$category" || return 1

    local local_dir
    local_dir=$(games_get_category_dir "$org" "$category")
    local s3_uri="s3://${GAMES_S3_BUCKET}/${GAMES_S3_PREFIX}"

    if [[ ! -d "$local_dir" ]]; then
        echo "Error: local directory not found: $local_dir" >&2
        return 1
    fi

    echo "Push: $local_dir -> $s3_uri"
    echo ""

    # Validate before push
    echo "Validating games before push..."
    if ! games_validate "$org" "$category"; then
        echo ""
        echo "Warning: some games failed validation" >&2
        read -p "Continue anyway? [y/N]: " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Cancelled"
            return 1
        fi
    fi
    echo ""

    s3cmd sync "$local_dir/" "$s3_uri" \
        --access_key="$GAMES_S3_ACCESS_KEY" \
        --secret_key="$GAMES_S3_SECRET_KEY" \
        --host="$GAMES_S3_HOST" \
        --host-bucket="%(bucket)s.$GAMES_S3_HOST" \
        --region="$GAMES_S3_REGION" \
        --acl-public \
        $options

    local result=$?
    echo ""
    if ((result == 0)); then
        echo "Push complete."
    else
        echo "Push failed (exit code: $result)"
    fi
    return $result
}

# Bidirectional sync (auto-detect direction)
# Usage: games_sync "pixeljam-arcade" "pja-games" "prod" [--pull|--push] [--dry-run]
games_sync() {
    local org="$1"
    local category="$2"
    local env="$3"
    shift 3

    local direction=""
    local options=()

    # Parse options
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --pull)
                direction="pull"
                ;;
            --push)
                direction="push"
                ;;
            *)
                options+=("$1")
                ;;
        esac
        shift
    done

    # If no direction specified, prompt
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
            *)
                echo "Cancelled"
                return 1
                ;;
        esac
    fi

    case "$direction" in
        pull)
            games_pull "$org" "$category" "$env" "${options[@]}"
            ;;
        push)
            games_push "$org" "$category" "$env" "${options[@]}"
            ;;
    esac
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f _games_s3_config
export -f games_s3_list
export -f games_pull
export -f games_push
export -f games_sync
