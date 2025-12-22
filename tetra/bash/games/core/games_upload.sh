#!/usr/bin/env bash

# Games Upload Module
# Handle ZIP file uploads like arcade admin
#
# Filename format: game-slug_ver-1.0.0.zip or game-slug-ver-1.0.0.zip
#
# Usage:
#   games upload <file.zip>              # Upload and extract
#   games upload <file.zip> --s3         # Also sync to S3
#   games upload <file.zip> --dry-run    # Parse only, no action

# =============================================================================
# ZIP FILENAME PARSING
# =============================================================================

# Parse: game-name_ver-1.0.0.zip or game-name-ver-1.0.0.zip
# Returns: slug and version via nameref
games_parse_zip_filename() {
    local filename="$1"
    local -n _slug_ref=$2
    local -n _version_ref=$3

    # Strip path and extension
    local basename="${filename##*/}"
    basename="${basename%.zip}"

    # Try underscore separator first: game-name_ver-1.0.0
    if [[ "$basename" =~ ^(.+)_ver-(.+)$ ]]; then
        _slug_ref="${BASH_REMATCH[1]}"
        _version_ref="${BASH_REMATCH[2]}"
        return 0
    fi

    # Try hyphen separator: game-name-ver-1.0.0
    if [[ "$basename" =~ ^(.+)-ver-(.+)$ ]]; then
        _slug_ref="${BASH_REMATCH[1]}"
        _version_ref="${BASH_REMATCH[2]}"
        return 0
    fi

    # No version found - use basename as slug, default version
    _slug_ref="$basename"
    _version_ref="1.0.0"
    return 1
}

# =============================================================================
# UPLOAD HANDLER
# =============================================================================

games_upload() {
    local zip_file=""
    local sync_s3=false
    local dry_run=false
    local force=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --s3|--sync) sync_s3=true; shift ;;
            --dry-run|-n) dry_run=true; shift ;;
            --force|-f) force=true; shift ;;
            -*) echo "Unknown option: $1" >&2; return 1 ;;
            *) zip_file="$1"; shift ;;
        esac
    done

    if [[ -z "$zip_file" ]]; then
        cat << 'EOF' >&2
Usage: games upload <file.zip> [options]

Options:
  --s3, --sync    Also upload to S3 after local install
  --dry-run, -n   Parse filename only, don't install
  --force, -f     Overwrite existing without prompt

Filename Format:
  game-slug_ver-1.0.0.zip   (underscore separator)
  game-slug-ver-1.0.0.zip   (hyphen separator)

Examples:
  games upload dillo-adventure_ver-2.1.0.zip
  games upload my-game-ver-1.0.0.zip --s3
EOF
        return 1
    fi

    # Validate file exists
    if [[ ! -f "$zip_file" ]]; then
        echo "File not found: $zip_file" >&2
        return 1
    fi

    # Parse filename
    local slug version
    if ! games_parse_zip_filename "$zip_file" slug version; then
        echo "Warning: No version in filename, using 1.0.0"
    fi

    echo "Parsed:"
    echo "  Slug:    $slug"
    echo "  Version: $version"
    echo "  File:    $zip_file"

    if $dry_run; then
        echo ""
        echo "(dry-run mode - no changes made)"
        return 0
    fi

    # Setup directories
    local games_dir="${PJA_GAMES_DIR:-${TETRA_DIR}/orgs/pixeljam-arcade/games}"
    local dest_dir="${games_dir}/${slug}/${version}"
    local latest_dir="${games_dir}/${slug}/latest"

    # Check existing
    if [[ -d "$dest_dir" ]] && ! $force; then
        read -p "Version $version exists. Overwrite? [y/N] " confirm
        [[ "$confirm" != [yY]* ]] && { echo "Cancelled"; return 0; }
    fi

    echo ""
    echo "Installing to: $dest_dir"

    # Create directories
    mkdir -p "$dest_dir"

    # Extract ZIP
    echo "Extracting..."
    if command -v unzip &>/dev/null; then
        unzip -o -q "$zip_file" -d "$dest_dir"
    else
        echo "Error: unzip not found" >&2
        return 1
    fi

    # Check for index.html
    if [[ ! -f "$dest_dir/index.html" ]]; then
        # Maybe extracted into subdirectory?
        local subdir=$(find "$dest_dir" -maxdepth 1 -type d ! -name "$(basename "$dest_dir")" | head -1)
        if [[ -n "$subdir" && -f "$subdir/index.html" ]]; then
            echo "Moving contents from subdirectory..."
            mv "$subdir"/* "$dest_dir/"
            rmdir "$subdir" 2>/dev/null
        else
            echo "Warning: No index.html found in extracted files"
        fi
    fi

    # Update latest symlink
    echo "Updating latest symlink..."
    rm -f "$latest_dir"
    ln -sf "$version" "$latest_dir"

    # Update manifest
    echo "Updating manifest..."
    local manifest="${games_dir}/games.json"

    if [[ -f "$manifest" ]]; then
        # Check if game exists in manifest
        if jq -e ".games[\"$slug\"]" "$manifest" >/dev/null 2>&1; then
            # Update version
            games_set "$slug" "version" "$version"
            games_set "$slug" "url_path" "${slug}/${version}/index.html"
            games_set "$slug" "src" "/api/game-files/${slug}/${version}/index.html"
        else
            # Add new game
            games_add "$slug" --version "$version"
        fi
    else
        # Create manifest with this game
        games_add "$slug" --version "$version"
    fi

    echo ""
    echo "Installed: $slug v$version"
    echo "  Path: $dest_dir"
    echo "  Latest: $latest_dir -> $version"

    # S3 sync if requested
    if $sync_s3; then
        echo ""
        echo "Syncing to S3..."
        if declare -f games_push &>/dev/null; then
            games_push "$slug"
        elif declare -f spaces_upload &>/dev/null; then
            spaces_upload "$dest_dir" "games/${slug}/${version}/"
        else
            echo "Warning: S3 sync not available (games_sync module not loaded)"
        fi
    fi

    return 0
}

# =============================================================================
# BULK UPLOAD
# =============================================================================

games_upload_dir() {
    local dir="$1"
    local sync_s3="${2:-false}"

    if [[ -z "$dir" || ! -d "$dir" ]]; then
        echo "Usage: games upload-dir <directory> [--s3]" >&2
        return 1
    fi

    echo "Scanning for ZIP files in: $dir"
    echo ""

    local count=0
    for zip in "$dir"/*.zip; do
        [[ -f "$zip" ]] || continue
        echo "=== Processing: $(basename "$zip") ==="
        if $sync_s3; then
            games_upload "$zip" --s3
        else
            games_upload "$zip"
        fi
        echo ""
        ((count++))
    done

    echo "Processed $count ZIP files"
}

# =============================================================================
# URL TESTING (like admin)
# =============================================================================

games_url() {
    local slug="$1"
    local variant="${2:-default}"
    local manifest=$(_games_manifest_path)

    if [[ -z "$slug" ]]; then
        echo "Usage: games url <slug> [variant]" >&2
        echo "Variants: default, demo, dev" >&2
        return 1
    fi

    if [[ ! -f "$manifest" ]]; then
        echo "Manifest not found" >&2
        return 1
    fi

    # Get game from manifest
    local game_json
    game_json=$(jq ".games[\"$slug\"]" "$manifest" 2>/dev/null)

    if [[ "$game_json" == "null" ]]; then
        echo "Game not found: $slug" >&2
        return 1
    fi

    # Get appropriate path
    local url_path
    case "$variant" in
        demo)
            url_path=$(echo "$game_json" | jq -r '.url_path_demo // empty')
            [[ -z "$url_path" ]] && { echo "No demo variant for $slug"; return 1; }
            ;;
        dev)
            url_path=$(echo "$game_json" | jq -r '.url_path_dev // empty')
            [[ -z "$url_path" ]] && { echo "No dev variant for $slug"; return 1; }
            ;;
        *)
            url_path=$(echo "$game_json" | jq -r '.url_path')
            ;;
    esac

    local games_dir="${PJA_GAMES_DIR:-${TETRA_DIR}/orgs/pixeljam-arcade/games}"
    local s3_bucket=$(jq -r '._config.storage.s3_bucket' "$manifest")
    local s3_endpoint=$(jq -r '._config.storage.s3_endpoint' "$manifest")

    echo "Game: $slug ($variant)"
    echo ""
    echo "Paths:"
    echo "  url_path: $url_path"
    echo "  local:    $games_dir/$url_path"
    echo "  api:      /api/game-files/$url_path"
    echo "  s3:       ${s3_endpoint}/${s3_bucket}/${url_path}"
    echo ""

    # Check local file exists
    if [[ -f "$games_dir/$url_path" ]]; then
        echo "Local: ✓ exists"
    else
        echo "Local: ✗ not found"
    fi

    # Show access control
    echo ""
    echo "Access Control:"
    echo "$game_json" | jq '.access_control'
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f games_parse_zip_filename
export -f games_upload
export -f games_upload_dir
export -f games_url
