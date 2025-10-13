#!/usr/bin/env bash

# Tetra Spaces Module
# DigitalOcean Spaces with TES progressive resolution
#
# TES Symbol: @spaces:bucket[:path]
# Example: @spaces:pja-games:games/manifest.json
#
# Resolution Chain:
#   Symbol (@spaces:pja-games:games/)
#   → Connector (tetra.toml [storage.spaces])
#   → s3cmd execution with DO Spaces endpoint

# Only set strict mode when running as script, not when sourced
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    set -euo pipefail
fi

# Module metadata
MOD_NAME="spaces"
MOD_DESC="DigitalOcean Spaces with TES resolution"
MOD_VERSION="1.0.0"

# Resolve @spaces symbol to connector config
# Returns connector details via global SPACES_* variables
_spaces_resolve() {
    local symbol="$1"

    # Parse symbol: @spaces:bucket[:path]
    local bucket path

    if [[ "$symbol" =~ ^@spaces:([^:]+)(:(.+))?$ ]]; then
        bucket="${BASH_REMATCH[1]}"
        path="${BASH_REMATCH[3]:-}"
    elif [[ "$symbol" =~ ^@spaces$ ]]; then
        # Use default bucket
        bucket=""
        path=""
    else
        # Assume it's just bucket:path without @spaces prefix
        if [[ "$symbol" =~ ^([^:]+)(:(.+))?$ ]]; then
            bucket="${BASH_REMATCH[1]}"
            path="${BASH_REMATCH[3]:-}"
        else
            echo "Error: Invalid symbol format: $symbol" >&2
            echo "Expected: @spaces:bucket[:path] or bucket[:path]" >&2
            return 1
        fi
    fi

    # Load org configuration
    local org_name="${TETRA_ORG:-}"

    # Auto-detect org if not set and only one exists
    if [[ -z "$org_name" ]]; then
        local org_dir="$TETRA_DIR/org"
        if [[ -d "$org_dir" ]]; then
            local orgs=($(ls -1 "$org_dir" 2>/dev/null))
            if [[ ${#orgs[@]} -eq 1 ]]; then
                org_name="${orgs[0]}"
                echo "Note: Auto-detected TETRA_ORG=$org_name" >&2
            else
                echo "Error: TETRA_ORG not set" >&2
                echo "Set with: export TETRA_ORG=your-org-name" >&2
                if [[ ${#orgs[@]} -gt 1 ]]; then
                    echo "" >&2
                    echo "Available orgs:" >&2
                    printf "  %s\n" "${orgs[@]}" >&2
                fi
                return 1
            fi
        else
            echo "Error: TETRA_ORG not set and no org directory found" >&2
            echo "Set with: export TETRA_ORG=your-org-name" >&2
            return 1
        fi
    fi

    # Try to find org directory with name normalization
    local toml_file="$TETRA_DIR/org/$org_name/tetra.toml"

    if [[ ! -f "$toml_file" ]]; then
        # Try alternate name formats (underscore <-> hyphen)
        local alt_name
        if [[ "$org_name" == *"_"* ]]; then
            # Try with hyphens instead of underscores
            alt_name="${org_name//_/-}"
        else
            # Try with underscores instead of hyphens
            alt_name="${org_name//-/_}"
        fi

        local alt_toml="$TETRA_DIR/org/$alt_name/tetra.toml"
        if [[ -f "$alt_toml" ]]; then
            echo "Note: Using org directory '$alt_name' (normalized from '$org_name')" >&2
            org_name="$alt_name"
            toml_file="$alt_toml"
        else
            echo "Error: Organization config not found: $toml_file" >&2
            if [[ -f "$alt_toml" ]]; then
                echo "  Also tried: $alt_toml" >&2
            fi
            echo "" >&2
            echo "Available orgs:" >&2
            ls -1 "$TETRA_DIR/org/" 2>/dev/null | sed 's/^/  /' >&2 || echo "  (none found)" >&2
            echo "" >&2
            echo "Compile with: bash/org/compiler.sh compile <org-name>" >&2
            return 1
        fi
    fi

    # Extract [storage.spaces] section
    if ! grep -q '^\[storage\.spaces\]' "$toml_file"; then
        echo "Error: No [storage.spaces] section in $toml_file" >&2
        echo "Add storage config to resources.toml and recompile" >&2
        return 1
    fi

    # Parse storage config
    local endpoint region access_key secret_key default_bucket
    endpoint=$(grep -A20 '^\[storage\.spaces\]' "$toml_file" | grep '^endpoint' | cut -d'=' -f2 | tr -d ' "')
    region=$(grep -A20 '^\[storage\.spaces\]' "$toml_file" | grep '^region' | cut -d'=' -f2 | tr -d ' "')
    access_key=$(grep -A20 '^\[storage\.spaces\]' "$toml_file" | grep '^access_key' | cut -d'=' -f2 | tr -d ' "')
    secret_key=$(grep -A20 '^\[storage\.spaces\]' "$toml_file" | grep '^secret_key' | cut -d'=' -f2 | tr -d ' "')
    default_bucket=$(grep -A20 '^\[storage\.spaces\]' "$toml_file" | grep '^default_bucket' | cut -d'=' -f2 | tr -d ' "')

    # Use default bucket if not specified
    if [[ -z "$bucket" ]]; then
        bucket="$default_bucket"
    fi

    # Export connector details
    SPACES_ENDPOINT="$endpoint"
    SPACES_REGION="$region"
    SPACES_ACCESS_KEY="$access_key"
    SPACES_SECRET_KEY="$secret_key"
    SPACES_BUCKET="$bucket"
    SPACES_PATH="$path"

    # Build S3 URI
    if [[ -n "$path" ]]; then
        SPACES_URI="s3://$bucket/$path"
    else
        SPACES_URI="s3://$bucket/"
    fi

    # Extract host from endpoint
    SPACES_HOST=$(echo "$endpoint" | sed 's|^https\{0,1\}://||')

    return 0
}

# List Spaces contents
spaces_list() {
    local symbol="${1:-@spaces}"

    _spaces_resolve "$symbol" || return 1

    echo "Listing: $SPACES_URI"
    echo "Endpoint: $SPACES_ENDPOINT"
    echo ""

    s3cmd ls "$SPACES_URI" \
        --access_key="$SPACES_ACCESS_KEY" \
        --secret_key="$SPACES_SECRET_KEY" \
        --host="$SPACES_HOST" \
        --host-bucket="%(bucket)s.$SPACES_HOST" \
        --region="$SPACES_REGION"
}

# Download file from Spaces
spaces_get() {
    local symbol="$1"
    local dest="${2:--}"

    _spaces_resolve "$symbol" || return 1

    if [[ "$dest" == "-" ]]; then
        echo "Getting: $SPACES_URI (to stdout)" >&2
    else
        echo "Getting: $SPACES_URI → $dest"
    fi

    s3cmd get "$SPACES_URI" "$dest" \
        --access_key="$SPACES_ACCESS_KEY" \
        --secret_key="$SPACES_SECRET_KEY" \
        --host="$SPACES_HOST" \
        --host-bucket="%(bucket)s.$SPACES_HOST" \
        --region="$SPACES_REGION"
}

# Upload file to Spaces
spaces_put() {
    local source="$1"
    local symbol="$2"
    shift 2
    local options="$*"

    if [[ ! -f "$source" && ! -d "$source" ]]; then
        echo "Error: Source not found: $source" >&2
        return 1
    fi

    _spaces_resolve "$symbol" || return 1

    echo "Putting: $source → $SPACES_URI"

    s3cmd put "$source" "$SPACES_URI" \
        --access_key="$SPACES_ACCESS_KEY" \
        --secret_key="$SPACES_SECRET_KEY" \
        --host="$SPACES_HOST" \
        --host-bucket="%(bucket)s.$SPACES_HOST" \
        --region="$SPACES_REGION" \
        $options
}

# Sync directories
spaces_sync() {
    local source="$1"
    local dest="$2"
    shift 2
    local options="$*"

    # Determine which is remote
    if [[ "$source" =~ ^(@spaces|[a-z-]+:) ]]; then
        # Remote to local
        _spaces_resolve "$source" || return 1
        local remote_uri="$SPACES_URI"
        echo "Syncing: $remote_uri → $dest"

        s3cmd sync "$remote_uri" "$dest" \
            --access_key="$SPACES_ACCESS_KEY" \
            --secret_key="$SPACES_SECRET_KEY" \
            --host="$SPACES_HOST" \
            --host-bucket="%(bucket)s.$SPACES_HOST" \
            --region="$SPACES_REGION" \
            $options
    else
        # Local to remote
        _spaces_resolve "$dest" || return 1
        local remote_uri="$SPACES_URI"
        echo "Syncing: $source → $remote_uri"

        s3cmd sync "$source" "$remote_uri" \
            --access_key="$SPACES_ACCESS_KEY" \
            --secret_key="$SPACES_SECRET_KEY" \
            --host="$SPACES_HOST" \
            --host-bucket="%(bucket)s.$SPACES_HOST" \
            --region="$SPACES_REGION" \
            $options
    fi
}

# Get public URL
spaces_url() {
    local symbol="$1"

    _spaces_resolve "$symbol" || return 1

    echo "https://$SPACES_BUCKET.$SPACES_HOST/$SPACES_PATH"
}

# Delete file/directory
spaces_delete() {
    local symbol="$1"
    shift
    local options="$*"

    _spaces_resolve "$symbol" || return 1

    echo "⚠️  Deleting: $SPACES_URI"
    read -p "Are you sure? [y/N]: " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled"
        return 1
    fi

    s3cmd del "$SPACES_URI" \
        --access_key="$SPACES_ACCESS_KEY" \
        --secret_key="$SPACES_SECRET_KEY" \
        --host="$SPACES_HOST" \
        --host-bucket="%(bucket)s.$SPACES_HOST" \
        --region="$SPACES_REGION" \
        $options
}

# Export functions
export -f _spaces_resolve
export -f spaces_list
export -f spaces_get
export -f spaces_put
export -f spaces_sync
export -f spaces_url
export -f spaces_delete

# CLI interface
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    case "${1:-help}" in
        list|ls)
            shift
            spaces_list "$@"
            ;;
        get|download)
            shift
            spaces_get "$@"
            ;;
        put|upload)
            shift
            spaces_put "$@"
            ;;
        sync)
            shift
            spaces_sync "$@"
            ;;
        url|link)
            shift
            spaces_url "$@"
            ;;
        delete|rm)
            shift
            spaces_delete "$@"
            ;;
        help|--help|-h)
            cat << EOF
Tetra Spaces - DigitalOcean Spaces CLI

USAGE:
    spaces.sh <command> [args]

COMMANDS:
    list [bucket[:path]]
        List bucket contents

    get <bucket:path> [local-file]
        Download file (default: stdout)

    put <local-file> <bucket:path> [s3cmd-options]
        Upload file

    sync <source> <dest> [s3cmd-options]
        Sync directories (one must be bucket:path)

    url <bucket:path>
        Get public URL

    delete <bucket:path> [s3cmd-options]
        Delete file/directory

SYMBOL FORMAT:
    bucket:path              # Short form
    @spaces:bucket:path      # Full TES symbol

EXAMPLES:
    # Setup
    export TETRA_ORG=pixeljam-arcade

    # List bucket
    spaces.sh list pja-games
    spaces.sh list pja-games:games/

    # Download file
    spaces.sh get pja-games:games.json
    spaces.sh get pja-games:games.json ./local.json
    spaces.sh get pja-games:games.json - | jq .

    # Upload file
    spaces.sh put ./games.json pja-games:games.json

    # Upload with cache header
    spaces.sh put ./game.js pja-games:games/game.js \\
      --add-header="Cache-Control: public, max-age=31536000"

    # Sync local to Spaces
    spaces.sh sync ./local-games/ pja-games:games/

    # Sync Spaces to local
    spaces.sh sync pja-games:games/ ./backup-games/

    # Get public URL
    spaces.sh url pja-games:games/manifest.json
    # Output: https://pja-games.sfo3.digitaloceanspaces.com/games/manifest.json

SETUP:
    1. Configure in resources.toml:
       [_config.storage]
       backend = "digitalocean-spaces"
       bucket = "pja-games"
       endpoint = "https://sfo3.digitaloceanspaces.com"
       region = "sfo3"
       credentials_env = "DO_SPACES"

    2. Add credentials to secrets.env:
       DO_SPACES_KEY=DO00GXQ243FCVDLQT9CF
       DO_SPACES_SECRET=+kH1E4zhaaisTmKwQRoJS9nfDRK2j9ZOigXmm0PJygY

    3. Compile tetra.toml:
       bash/org/compiler.sh compile pixeljam-arcade

    4. Use:
       export TETRA_ORG=pixeljam-arcade
       spaces.sh list pja-games:games/

TES RESOLUTION:
    Symbol: pja-games:games/
      → Resolve @spaces from tetra.toml [storage.spaces]
      → Extract endpoint, credentials, bucket
      → Execute: s3cmd ls s3://pja-games/games/

REQUIREMENTS:
    - s3cmd (brew install s3cmd)
    - TETRA_ORG environment variable
    - Compiled tetra.toml with [storage.spaces] section
EOF
            ;;
        *)
            echo "Unknown command: $1"
            echo "Use 'spaces.sh help' for usage information"
            exit 1
            ;;
    esac
fi
