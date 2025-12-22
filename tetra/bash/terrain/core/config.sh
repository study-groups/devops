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

    _tok_require_jq || return 1
    jq -r "$path // empty" "$config" 2>/dev/null
}

# Validate config file structure
# Args: $1 - config path, $2 - strict mode (optional, default: false)
# In strict mode, warnings become errors and validation fails
terrain_config_validate() {
    local config="$1"
    local strict="${2:-false}"
    local errors=0
    local warnings=0

    _tok_require_file "$config" "Config" || return 1

    # Check JSON syntax
    if ! tok_validate_syntax "$config"; then
        return 1
    fi

    # Helper for error/warning messages
    _config_issue() {
        local level="$1"
        local msg="$2"
        if [[ "$level" == "error" ]]; then
            echo "ERROR: $msg" >&2
            ((errors++))
        elif [[ "$strict" == "true" ]]; then
            echo "ERROR (strict): $msg" >&2
            ((errors++))
        else
            echo "Warning: $msg" >&2
            ((warnings++))
        fi
    }

    # Check required fields
    local name mode
    name=$(terrain_config_get "$config" '.terrain.name')
    mode=$(terrain_config_get "$config" '.mode')

    if [[ -z "$name" ]]; then
        _config_issue "warning" "Missing .terrain.name"
    fi

    if [[ -z "$mode" ]]; then
        _config_issue "warning" "Missing .mode"
    fi

    # Validate mode exists
    if [[ -n "$mode" ]]; then
        local mode_path="$TERRAIN_SRC/dist/modes/${mode}.mode.json"
        if [[ ! -f "$mode_path" ]]; then
            _config_issue "error" "Mode not found: $mode (expected $mode_path)"
        fi
    fi

    # Validate theme if specified
    local theme
    theme=$(terrain_config_get "$config" '.theme')
    if [[ -n "$theme" ]]; then
        local theme_path="$TERRAIN_SRC/dist/themes/${theme}.theme.css"
        if [[ ! -f "$theme_path" ]]; then
            _config_issue "error" "Theme not found: $theme (expected $theme_path)"
        fi
    fi

    # Validate layout columns if specified
    local layout_columns
    layout_columns=$(terrain_config_get "$config" '.layout.columns')
    if [[ -n "$layout_columns" ]]; then
        # Basic CSS grid syntax check
        if [[ ! "$layout_columns" =~ ^[0-9a-zA-Z\ \(\)%frpx\-\.]+$ ]]; then
            _config_issue "warning" "Suspicious layout.columns value: $layout_columns"
        fi
    fi

    # Validate scripts paths if specified
    local scripts
    scripts=$(jq -r '.scripts[]? // empty' "$config" 2>/dev/null)
    while IFS= read -r script; do
        if [[ -n "$script" && ! "$script" =~ ^https?:// ]]; then
            # Local file - check if it exists relative to config dir
            local script_path="$(dirname "$config")/$script"
            if [[ ! -f "$script_path" && "$strict" == "true" ]]; then
                _config_issue "warning" "Script not found: $script"
            fi
        fi
    done <<< "$scripts"

    # Validate styles paths if specified
    local styles
    styles=$(jq -r '.styles[]? // empty' "$config" 2>/dev/null)
    while IFS= read -r style; do
        if [[ -n "$style" && ! "$style" =~ ^https?:// ]]; then
            local style_path="$(dirname "$config")/$style"
            if [[ ! -f "$style_path" && "$strict" == "true" ]]; then
                _config_issue "warning" "Style not found: $style"
            fi
        fi
    done <<< "$styles"

    # Report results
    if [[ $errors -eq 0 && $warnings -eq 0 ]]; then
        echo "Config valid: $config"
        return 0
    elif [[ $errors -eq 0 ]]; then
        echo "Config valid with $warnings warning(s): $config"
        return 0
    else
        echo "Config invalid: $errors error(s), $warnings warning(s)"
        return 1
    fi
}

# Strict validation - fails on any issue
# Args: $1 - config path
terrain_config_validate_strict() {
    terrain_config_validate "$1" "true"
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

# Merge mode defaults with app config
# Mode provides base settings, app config overrides
# Args: $1 - config path
# Output: merged JSON to stdout
terrain_config_merge() {
    local config="$1"
    local mode
    mode=$(terrain_config_get "$config" '.mode')

    if [[ -z "$mode" ]]; then
        # No mode specified, return config as-is
        cat "$config"
        return 0
    fi

    local mode_path
    mode_path=$(terrain_config_resolve_mode "$mode")

    if [[ -z "$mode_path" ]]; then
        echo "Warning: Mode '$mode' not found, using config as-is" >&2
        cat "$config"
        return 0
    fi

    # Deep merge: mode * config (config wins)
    jq -s '.[0] * .[1]' "$mode_path" "$config"
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

export -f terrain_config_find terrain_config_get terrain_config_validate terrain_config_validate_strict
export -f terrain_config_resolve_mode terrain_config_resolve_theme
export -f terrain_config_merge
export -f terrain_config_list_modes terrain_config_list_themes
