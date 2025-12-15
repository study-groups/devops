#!/usr/bin/env bash
# terrain/core/config.sh - Configuration handling
#
# Finds, parses, and validates terrain.config.json files.

# Find terrain.config.json in given directory or current dir
# Args: $1 - directory to search (default: pwd)
# Returns: path to config or empty string
terrain_config_find() {
    local dir="${1:-.}"
    local config_path="$dir/terrain.config.json"

    if [[ -f "$config_path" ]]; then
        echo "$config_path"
        return 0
    fi

    # Also check for terrain.json (alternate name)
    config_path="$dir/terrain.json"
    if [[ -f "$config_path" ]]; then
        echo "$config_path"
        return 0
    fi

    return 1
}

# Read a JSON value from config using jq
# Args: $1 - config path, $2 - jq path
terrain_config_get() {
    local config="$1"
    local path="$2"

    if ! command -v jq &>/dev/null; then
        echo "Error: jq required" >&2
        return 1
    fi

    jq -r "$path // empty" "$config" 2>/dev/null
}

# Validate config file structure
# Args: $1 - config path
terrain_config_validate() {
    local config="$1"
    local errors=0

    if [[ ! -f "$config" ]]; then
        echo "Error: Config not found: $config" >&2
        return 1
    fi

    # Check JSON syntax
    if ! jq empty "$config" 2>/dev/null; then
        echo "Error: Invalid JSON syntax in $config" >&2
        return 1
    fi

    # Check required fields
    local name mode
    name=$(terrain_config_get "$config" '.terrain.name')
    mode=$(terrain_config_get "$config" '.mode')

    if [[ -z "$name" ]]; then
        echo "Warning: Missing .terrain.name" >&2
        ((errors++))
    fi

    if [[ -z "$mode" ]]; then
        echo "Warning: Missing .mode" >&2
        ((errors++))
    fi

    # Validate mode exists
    if [[ -n "$mode" ]]; then
        local mode_path="$TERRAIN_SRC/dist/modes/${mode}.mode.json"
        if [[ ! -f "$mode_path" ]]; then
            echo "Warning: Mode not found: $mode (expected $mode_path)" >&2
            ((errors++))
        fi
    fi

    # Validate theme if specified
    local theme
    theme=$(terrain_config_get "$config" '.theme')
    if [[ -n "$theme" ]]; then
        local theme_path="$TERRAIN_SRC/dist/themes/${theme}.theme.css"
        if [[ ! -f "$theme_path" ]]; then
            echo "Warning: Theme not found: $theme (expected $theme_path)" >&2
            ((errors++))
        fi
    fi

    if [[ $errors -eq 0 ]]; then
        echo "Config valid: $config"
        return 0
    else
        echo "Config has $errors warning(s)"
        return 1
    fi
}

# Get resolved mode path
# Args: $1 - mode name
terrain_config_resolve_mode() {
    local mode="$1"
    local mode_path="$TERRAIN_SRC/dist/modes/${mode}.mode.json"

    if [[ -f "$mode_path" ]]; then
        echo "$mode_path"
        return 0
    fi

    return 1
}

# Get resolved theme path
# Args: $1 - theme name
terrain_config_resolve_theme() {
    local theme="$1"
    local theme_path="$TERRAIN_SRC/dist/themes/${theme}.theme.css"

    if [[ -f "$theme_path" ]]; then
        echo "$theme_path"
        return 0
    fi

    return 1
}

# List available modes
terrain_config_list_modes() {
    local modes_dir="$TERRAIN_SRC/dist/modes"

    if [[ ! -d "$modes_dir" ]]; then
        echo "No modes directory found" >&2
        return 1
    fi

    for mode_file in "$modes_dir"/*.mode.json; do
        [[ -f "$mode_file" ]] || continue
        local name
        name=$(basename "$mode_file" .mode.json)
        local desc
        desc=$(jq -r '.mode.description // "No description"' "$mode_file" 2>/dev/null)
        printf "  %-12s %s\n" "$name" "$desc"
    done
}

# List available themes
terrain_config_list_themes() {
    local themes_dir="$TERRAIN_SRC/dist/themes"

    if [[ ! -d "$themes_dir" ]]; then
        echo "No themes directory found" >&2
        return 1
    fi

    for theme_file in "$themes_dir"/*.theme.css; do
        [[ -f "$theme_file" ]] || continue
        local name
        name=$(basename "$theme_file" .theme.css)
        printf "  %s\n" "$name"
    done
}

export -f terrain_config_find terrain_config_get terrain_config_validate
export -f terrain_config_resolve_mode terrain_config_resolve_theme
export -f terrain_config_list_modes terrain_config_list_themes
