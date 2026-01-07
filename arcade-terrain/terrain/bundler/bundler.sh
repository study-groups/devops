#!/usr/bin/env bash
# TERRAIN Bundler
# Build system for TERRAIN platform and modules

set -euo pipefail

# Resolve bundler directory
BUNDLER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAIN_DIR="$(dirname "$BUNDLER_DIR")"

# Source core modules
source "$BUNDLER_DIR/core/manifest.sh"
source "$BUNDLER_DIR/core/concat.sh"
source "$BUNDLER_DIR/core/wrap.sh"

# ============================================================================
# Build Functions
# ============================================================================

# Build from manifest file
# Usage: bundler_build_manifest path/to/manifest
bundler_build_manifest() {
    local manifest_path="$1"
    local manifest_dir

    [[ ! -f "$manifest_path" ]] && {
        echo "Error: Manifest not found: $manifest_path" >&2
        return 1
    }

    manifest_dir="$(dirname "$manifest_path")"

    # Parse manifest
    manifest_parse "$manifest_path"

    local name output wrapper
    name="$(manifest_get module.name)"
    output="$(manifest_get build.output)"
    wrapper="$(manifest_get build.wrapper none)"

    [[ -z "$name" ]] && {
        echo "Error: Manifest missing module.name" >&2
        return 1
    }

    [[ -z "$output" ]] && {
        echo "Error: Manifest missing build.output" >&2
        return 1
    }

    echo "[Bundler] Building $name..."

    # Get source files
    local sources=()
    manifest_get_array sources.order sources

    if [[ ${#sources[@]} -eq 0 ]]; then
        echo "Error: No source files specified" >&2
        return 1
    fi

    # Resolve paths relative to manifest directory
    local resolved_sources=()
    for src in "${sources[@]}"; do
        if [[ "$src" = /* ]]; then
            resolved_sources+=("$src")
        else
            resolved_sources+=("$manifest_dir/$src")
        fi
    done

    # Create temporary concat file
    local temp_concat
    temp_concat=$(mktemp)

    # Concatenate sources
    bundler_concat "$temp_concat" "${resolved_sources[@]}"

    # Get concatenated content
    local content
    content=$(<"$temp_concat")

    # Resolve output path relative to terrain dir
    local output_path
    if [[ "$output" = /* ]]; then
        output_path="$output"
    else
        output_path="$TERRAIN_DIR/$output"
    fi

    # Ensure output directory exists
    mkdir -p "$(dirname "$output_path")"

    # Apply wrapper
    case "$wrapper" in
        none)
            echo "$content" > "$output_path"
            ;;
        iife)
            bundler_wrap_iife "$content" > "$output_path"
            ;;
        terrain-module)
            bundler_wrap_terrain_module "$name" "$content" > "$output_path"
            ;;
        standalone)
            bundler_wrap_standalone "$name" "$content" > "$output_path"
            ;;
        *)
            # Custom template
            local template="$BUNDLER_DIR/templates/${wrapper}.template"
            if [[ -f "$template" ]]; then
                bundler_apply_template "$template" "$name" "$content" > "$output_path"
            else
                echo "Warning: Unknown wrapper '$wrapper', using none" >&2
                echo "$content" > "$output_path"
            fi
            ;;
    esac

    rm -f "$temp_concat"

    local size
    size=$(wc -c < "$output_path" | tr -d ' ')

    echo "[Bundler] Built: $output_path ($size bytes)"

    # Handle CSS if specified
    if manifest_has css.output; then
        local css_output css_sources=()
        css_output="$(manifest_get css.output)"
        manifest_get_array css.sources css_sources

        if [[ ${#css_sources[@]} -gt 0 ]]; then
            local resolved_css=()
            for src in "${css_sources[@]}"; do
                if [[ "$src" = /* ]]; then
                    resolved_css+=("$src")
                else
                    resolved_css+=("$manifest_dir/$src")
                fi
            done

            local css_output_path
            if [[ "$css_output" = /* ]]; then
                css_output_path="$css_output"
            else
                css_output_path="$TERRAIN_DIR/$css_output"
            fi

            bundler_concat_css "$css_output_path" "${resolved_css[@]}"
            local css_size
            css_size=$(wc -c < "$css_output_path" | tr -d ' ')
            echo "[Bundler] Built: $css_output_path ($css_size bytes)"
        fi
    fi

    # Handle standalone build if specified
    if manifest_has build.standalone; then
        local standalone_output
        standalone_output="$(manifest_get build.standalone)"

        local standalone_path
        if [[ "$standalone_output" = /* ]]; then
            standalone_path="$standalone_output"
        else
            standalone_path="$TERRAIN_DIR/$standalone_output"
        fi

        mkdir -p "$(dirname "$standalone_path")"
        bundler_wrap_standalone "$name" "$content" > "$standalone_path"

        local standalone_size
        standalone_size=$(wc -c < "$standalone_path" | tr -d ' ')
        echo "[Bundler] Built standalone: $standalone_path ($standalone_size bytes)"
    fi
}

# Build TERRAIN core
bundler_build_core() {
    echo "[Bundler] Building TERRAIN core..."
    bundler_build_manifest "$BUNDLER_DIR/src/terrain.manifest"
}

# Build a named module
bundler_build_module() {
    local module="$1"

    # Look for manifest in common locations
    local manifest=""
    local search_paths=(
        "$TERRAIN_DIR/../$module/terrain.manifest"
        "$TERRAIN_DIR/../$module/$module.manifest"
        "$TERRAIN_DIR/modules/$module/terrain.manifest"
        "$module"  # Direct path
    )

    for path in "${search_paths[@]}"; do
        if [[ -f "$path" ]]; then
            manifest="$path"
            break
        fi
    done

    [[ -z "$manifest" ]] && {
        echo "Error: No manifest found for module: $module" >&2
        echo "Searched:" >&2
        printf '  %s\n' "${search_paths[@]}" >&2
        return 1
    }

    bundler_build_manifest "$manifest"
}

# Build all registered modules
bundler_build_all() {
    echo "[Bundler] Building all..."

    # Build core first
    bundler_build_core

    # Find and build all module manifests
    local manifests
    manifests=$(find "$TERRAIN_DIR/.." -name "terrain.manifest" -o -name "*.manifest" 2>/dev/null | grep -v "$BUNDLER_DIR/src")

    for manifest in $manifests; do
        bundler_build_manifest "$manifest"
    done
}

# Watch for changes (requires fswatch or inotifywait)
bundler_watch() {
    local target="${1:-core}"

    echo "[Bundler] Watching for changes..."

    if command -v fswatch &>/dev/null; then
        if [[ "$target" == "core" ]]; then
            fswatch -o "$BUNDLER_DIR/src" | while read -r; do
                bundler_build_core
            done
        else
            local manifest_dir
            manifest_dir="$(dirname "$(bundler_find_manifest "$target")")"
            fswatch -o "$manifest_dir" | while read -r; do
                bundler_build_module "$target"
            done
        fi
    else
        echo "Error: fswatch not found. Install with: brew install fswatch" >&2
        return 1
    fi
}

# Find manifest for a module
bundler_find_manifest() {
    local module="$1"
    local search_paths=(
        "$TERRAIN_DIR/../$module/terrain.manifest"
        "$TERRAIN_DIR/modules/$module/terrain.manifest"
    )

    for path in "${search_paths[@]}"; do
        if [[ -f "$path" ]]; then
            echo "$path"
            return 0
        fi
    done
    return 1
}

# ============================================================================
# CLI
# ============================================================================

bundler_usage() {
    cat <<EOF
TERRAIN Bundler

Usage: bundler.sh <command> [args]

Commands:
    build core              Build TERRAIN core
    build <module>          Build a module by name
    build <path/manifest>   Build from manifest file
    build --all             Build all modules

    watch [target]          Watch for changes and rebuild

    help                    Show this help

Examples:
    bundler.sh build core
    bundler.sh build tut
    bundler.sh build ../tut/terrain.manifest
    bundler.sh watch core
EOF
}

bundler_main() {
    local cmd="${1:-help}"
    shift || true

    case "$cmd" in
        build)
            local target="${1:-core}"
            case "$target" in
                core)
                    bundler_build_core
                    ;;
                --all|-a)
                    bundler_build_all
                    ;;
                *)
                    if [[ -f "$target" ]]; then
                        bundler_build_manifest "$target"
                    else
                        bundler_build_module "$target"
                    fi
                    ;;
            esac
            ;;
        watch)
            bundler_watch "${1:-core}"
            ;;
        help|--help|-h)
            bundler_usage
            ;;
        *)
            echo "Unknown command: $cmd" >&2
            bundler_usage
            exit 1
            ;;
    esac
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    bundler_main "$@"
fi
