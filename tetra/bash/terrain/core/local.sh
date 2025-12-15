#!/usr/bin/env bash
# terrain/core/local.sh - Local development setup
#
# Sets up dist/ with symlinks for local development.
# For serving, use: tsm start http dist/

# Setup local environment for a terrain app
# Args: $1 - app directory
terrain_local_setup() {
    local app_dir="${1:-.}"
    app_dir=$(cd "$app_dir" && pwd)

    local config
    config=$(terrain_config_find "$app_dir")
    if [[ -z "$config" ]]; then
        echo "Error: No terrain.config.json found in $app_dir" >&2
        return 1
    fi

    local dist_dir="$app_dir/dist"
    mkdir -p "$dist_dir"

    echo "[local] Setting up: $app_dir"

    # Symlink to terrain platform
    local terrain_link="$dist_dir/terrain"
    [[ -L "$terrain_link" ]] && rm "$terrain_link"
    ln -sf "$TERRAIN_SRC" "$terrain_link"
    echo "[local] Linked: terrain"

    # Build
    terrain_build "$app_dir" "$dist_dir/index.html"

    # Copy app assets
    local scripts styles
    scripts=$(jq -r '.scripts[]? // empty' "$config" 2>/dev/null)
    styles=$(jq -r '.styles[]? // empty' "$config" 2>/dev/null)

    while IFS= read -r script; do
        [[ -z "$script" ]] && continue
        local src="$app_dir/$script"
        local dest="$dist_dir/$script"
        if [[ -f "$src" ]]; then
            mkdir -p "$(dirname "$dest")"
            cp "$src" "$dest"
            echo "[local] Copied: $script"
        fi
    done <<< "$scripts"

    while IFS= read -r style; do
        [[ -z "$style" ]] && continue
        local src="$app_dir/$style"
        local dest="$dist_dir/$style"
        if [[ -f "$src" ]]; then
            mkdir -p "$(dirname "$dest")"
            cp "$src" "$dest"
            echo "[local] Copied: $style"
        fi
    done <<< "$styles"

    echo ""
    echo "[local] Ready: $dist_dir"
    echo ""
    echo "Serve with:"
    echo "  tsm start http $dist_dir"
    echo "  # or: cd $dist_dir && python3 -m http.server 8080"
}

# Clean dist/
terrain_local_clean() {
    local app_dir="${1:-.}"
    local dist_dir="$app_dir/dist"

    if [[ -d "$dist_dir" ]]; then
        rm -rf "$dist_dir"
        echo "[local] Cleaned: $dist_dir"
    fi
}

export -f terrain_local_setup terrain_local_clean
