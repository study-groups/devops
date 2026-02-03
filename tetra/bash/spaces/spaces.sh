#!/usr/bin/env bash

# Tetra Spaces Module
# DigitalOcean Spaces with TES progressive resolution
#
# TES Symbol: @spaces:bucket[:path]
# Example: @spaces:pja-games:games/manifest.json
#
# Resolution Chain:
#   Symbol (@spaces:pja-games:games/)
#   → Connector (tetra.toml [storage.s3])
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
            local orgs
            readarray -t orgs < <(ls -1 "$org_dir" 2>/dev/null)
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
    local toml_file="$TETRA_DIR/orgs/$org_name/tetra.toml"

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

        local alt_toml="$TETRA_DIR/orgs/$alt_name/tetra.toml"
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
            ls -1 "$TETRA_DIR/orgs/" 2>/dev/null | sed 's/^/  /' >&2 || echo "  (none found)" >&2
            echo "" >&2
            echo "Compile with: bash/org/compiler.sh compile <org-name>" >&2
            return 1
        fi
    fi

    # Extract [storage.s3] section
    if ! grep -q '^\[storage\.s3\]' "$toml_file"; then
        echo "Error: No [storage.s3] section in $toml_file" >&2
        echo "Add storage config to resources.toml and recompile" >&2
        return 1
    fi

    # Parse storage config - extract only from [storage.s3] section
    local endpoint region access_key secret_key default_bucket

    # Use awk to extract values only from the [storage.s3] section
    # Range pattern: from [storage.s3] to next section header (but not the starting one)
    local storage_section
    storage_section=$(awk '/^\[storage\.s3\]/ {found=1; next} found && /^\[/ {exit} found {print}' "$toml_file")

    endpoint=$(echo "$storage_section" | grep '^endpoint' | head -1 | cut -d'=' -f2 | tr -d ' "')
    region=$(echo "$storage_section" | grep '^region' | head -1 | cut -d'=' -f2 | tr -d ' "')
    access_key=$(echo "$storage_section" | grep '^access_key' | head -1 | cut -d'=' -f2 | tr -d ' "')
    secret_key=$(echo "$storage_section" | grep '^secret_key' | head -1 | cut -d'=' -f2 | tr -d ' "')
    default_bucket=$(echo "$storage_section" | grep '^default_bucket' | head -1 | cut -d'=' -f2 | tr -d ' "')

    # Expand environment variables in credentials (e.g., ${DO_SPACES_KEY})
    access_key=$(eval echo "$access_key")
    secret_key=$(eval echo "$secret_key")

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
    echo ""

    local cfg=$(_spaces_s3cfg)
    s3cmd ls "$SPACES_URI" --config="$cfg"
    rm -f "$cfg"
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

    local cfg=$(_spaces_s3cfg)
    s3cmd get "$SPACES_URI" "$dest" --config="$cfg"
    local rc=$?
    rm -f "$cfg"
    return $rc
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

    local cfg=$(_spaces_s3cfg)
    s3cmd put "$source" "$SPACES_URI" --config="$cfg" $options
    local rc=$?
    rm -f "$cfg"
    return $rc
}

# Sync directories
spaces_sync() {
    local source="$1"
    local dest="$2"
    shift 2
    local options="$*"

    local cfg rc

    # Determine which is remote
    if [[ "$source" =~ ^(@spaces|[a-z-]+:) ]]; then
        # Remote to local
        _spaces_resolve "$source" || return 1
        local remote_uri="$SPACES_URI"
        echo "Syncing: $remote_uri → $dest"

        cfg=$(_spaces_s3cfg)
        s3cmd sync "$remote_uri" "$dest" --config="$cfg" $options
        rc=$?
    else
        # Local to remote
        _spaces_resolve "$dest" || return 1
        local remote_uri="$SPACES_URI"
        echo "Syncing: $source → $remote_uri"

        cfg=$(_spaces_s3cfg)
        s3cmd sync "$source" "$remote_uri" --config="$cfg" $options
        rc=$?
    fi

    rm -f "$cfg"
    return $rc
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

    echo "Deleting: $SPACES_URI"
    read -p "Are you sure? [y/N]: " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled"
        return 1
    fi

    local cfg=$(_spaces_s3cfg)
    s3cmd del "$SPACES_URI" --config="$cfg" $options
    local rc=$?
    rm -f "$cfg"
    return $rc
}

# Generate HTML index for a path and upload as index.html
# Usage: spaces_index [bucket:path] [--title "Title"]
spaces_index() {
    local symbol="${1:-}"
    local title=""

    # Parse options
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --title) title="$2"; shift 2 ;;
            --title=*) title="${1#*=}"; shift ;;
            *) symbol="${symbol:-$1}"; shift ;;
        esac
    done

    _spaces_resolve "$symbol" || return 1

    local base_url="https://$SPACES_BUCKET.$SPACES_HOST"
    local path_prefix="${SPACES_PATH%/}"
    [[ -n "$path_prefix" ]] && path_prefix="$path_prefix/"

    # Default title from path
    if [[ -z "$title" ]]; then
        title="${path_prefix:-$SPACES_BUCKET}"
        title="${title%/}"
    fi

    echo "Generating index for: $SPACES_URI" >&2

    # Get file listing
    local cfg=$(_spaces_s3cfg)
    local listing
    listing=$(s3cmd ls -r "$SPACES_URI" --config="$cfg" 2>/dev/null)

    if [[ -z "$listing" ]]; then
        echo "No files found in $SPACES_URI" >&2
        rm -f "$cfg"
        return 1
    fi

    # Generate HTML
    local html_file="${TMPDIR:-/tmp}/spaces-index-$$.html"
    local now=$(date -u +"%Y-%m-%d %H:%M UTC")

    cat > "$html_file" <<EOF
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>$title</title>
    <style>
        :root { --bg: #1a1a2e; --fg: #eee; --accent: #0f9; --dim: #888; }
        body { font-family: system-ui, sans-serif; background: var(--bg); color: var(--fg);
               max-width: 900px; margin: 0 auto; padding: 2rem; }
        h1 { color: var(--accent); border-bottom: 1px solid var(--dim); padding-bottom: 0.5rem; }
        .path { color: var(--dim); font-size: 0.9rem; margin-bottom: 1rem; }
        table { width: 100%; border-collapse: collapse; }
        th, td { text-align: left; padding: 0.5rem; border-bottom: 1px solid #333; }
        th { color: var(--dim); font-weight: normal; }
        a { color: var(--accent); text-decoration: none; }
        a:hover { text-decoration: underline; }
        .size { color: var(--dim); font-family: monospace; }
        .date { color: var(--dim); }
        .dir { color: #ff9; }
        footer { margin-top: 2rem; color: var(--dim); font-size: 0.8rem; }
    </style>
</head>
<body>
    <h1>$title</h1>
    <div class="path">$base_url/${path_prefix}</div>
    <table>
        <thead><tr><th>Name</th><th>Size</th><th>Modified</th></tr></thead>
        <tbody>
EOF

    # Track directories we've seen
    local -A dirs_seen=()

    # Parse listing and generate rows
    while IFS= read -r line; do
        [[ -z "$line" ]] && continue

        # Parse s3cmd output: "2024-01-15 10:30  12345  s3://bucket/path/file"
        local date_str size s3_path
        date_str=$(echo "$line" | awk '{print $1 " " $2}')
        size=$(echo "$line" | awk '{print $3}')
        s3_path=$(echo "$line" | awk '{print $NF}')

        # Get relative path from bucket root
        local rel_path="${s3_path#s3://$SPACES_BUCKET/}"

        # Skip if not under our prefix
        if [[ -n "$path_prefix" && "$rel_path" != "$path_prefix"* ]]; then
            continue
        fi

        # Get path relative to current directory
        local display_path="${rel_path#$path_prefix}"
        [[ -z "$display_path" ]] && continue

        # Check if this is in a subdirectory
        if [[ "$display_path" == */* ]]; then
            # Extract first directory component
            local dir_name="${display_path%%/*}/"
            if [[ ! -v dirs_seen["$dir_name"] ]]; then
                dirs_seen["$dir_name"]=1
                local dir_url="$base_url/${path_prefix}${dir_name}"
                echo "            <tr><td><a href=\"$dir_url\" class=\"dir\">$dir_name</a></td><td class=\"size\">-</td><td class=\"date\">-</td></tr>" >> "$html_file"
            fi
        else
            # Direct file
            local file_url="$base_url/${path_prefix}${display_path}"
            local size_fmt
            if [[ "$size" -ge 1048576 ]]; then
                size_fmt="$(( size / 1048576 ))M"
            elif [[ "$size" -ge 1024 ]]; then
                size_fmt="$(( size / 1024 ))K"
            else
                size_fmt="${size}B"
            fi
            echo "            <tr><td><a href=\"$file_url\">$display_path</a></td><td class=\"size\">$size_fmt</td><td class=\"date\">$date_str</td></tr>" >> "$html_file"
        fi
    done <<< "$listing"

    cat >> "$html_file" <<EOF
        </tbody>
    </table>
    <footer>Generated $now by spaces index</footer>
</body>
</html>
EOF

    # Upload index.html
    local dest_path="${path_prefix}index.html"
    echo "Uploading: index.html → s3://$SPACES_BUCKET/$dest_path" >&2

    s3cmd put "$html_file" "s3://$SPACES_BUCKET/$dest_path" \
        --config="$cfg" \
        --acl-public \
        --add-header="Content-Type: text/html" \
        --add-header="Cache-Control: public, max-age=300" 2>/dev/null

    local rc=$?
    rm -f "$cfg" "$html_file"

    if [[ $rc -eq 0 ]]; then
        local url="$base_url/${dest_path}"
        echo "" >&2
        echo "Index: $url"
    fi

    return $rc
}

# Generate s3cmd config for current credentials
# Returns path to temp config file (caller must rm)
_spaces_s3cfg() {
    local cfg="${TMPDIR:-/tmp}/spaces-s3cfg-$$"
    cat > "$cfg" <<EOF
[default]
access_key = $SPACES_ACCESS_KEY
secret_key = $SPACES_SECRET_KEY
host_base = $SPACES_HOST
host_bucket = %(bucket)s.$SPACES_HOST
use_https = True
EOF
    echo "$cfg"
}

# Export functions
export -f _spaces_resolve _spaces_s3cfg
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
      → Resolve @spaces from tetra.toml [storage.s3]
      → Extract endpoint, credentials, bucket
      → Execute: s3cmd ls s3://pja-games/games/

REQUIREMENTS:
    - s3cmd (brew install s3cmd)
    - TETRA_ORG environment variable
    - Compiled tetra.toml with [storage.s3] section
EOF
            ;;
        *)
            echo "Unknown command: $1"
            echo "Use 'spaces.sh help' for usage information"
            exit 1
            ;;
    esac
fi
