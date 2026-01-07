#!/usr/bin/env bash
# terrain/core/build.sh - HTML generation from config
#
# Builds complete HTML from terrain.config.json

# Build HTML from config
# Args: $1 - app directory (containing terrain.config.json)
#       $2 - output path (optional, default: dist/index.html)
terrain_build() {
    local app_dir="${1:-.}"
    local output="${2:-}"

    # Find config
    local config
    config=$(terrain_config_find "$app_dir")
    if [[ -z "$config" ]]; then
        echo "Error: No terrain.config.json found in $app_dir" >&2
        return 1
    fi

    echo "[terrain] Building from: $config"

    # Parse config values
    local app_name mode theme
    app_name=$(terrain_config_get "$config" '.terrain.name')
    mode=$(terrain_config_get "$config" '.mode')
    theme=$(terrain_config_get "$config" '.theme')

    [[ -z "$app_name" ]] && app_name="Terrain App"
    [[ -z "$mode" ]] && mode="freerange"
    [[ -z "$theme" ]] && theme="dark"

    echo "[terrain] App: $app_name"
    echo "[terrain] Mode: $mode"
    echo "[terrain] Theme: $theme"

    # Resolve mode and theme paths
    local mode_path theme_path
    mode_path=$(terrain_config_resolve_mode "$mode")
    theme_path=$(terrain_config_resolve_theme "$theme")

    if [[ -z "$mode_path" ]]; then
        echo "Warning: Mode '$mode' not found, using freerange" >&2
        mode="freerange"
        mode_path=$(terrain_config_resolve_mode "$mode")
    fi

    if [[ -z "$theme_path" ]]; then
        echo "Warning: Theme '$theme' not found, using dark" >&2
        theme="dark"
        theme_path=$(terrain_config_resolve_theme "$theme")
    fi

    # Get layout config
    local layout_columns layout_gap header_show header_title header_icon
    layout_columns=$(terrain_config_get "$config" '.layout.columns // "1fr"')
    layout_gap=$(terrain_config_get "$config" '.layout.gap // "16px"')
    header_show=$(terrain_config_get "$config" '.header.show // false')
    header_title=$(terrain_config_get "$config" '.header.title // ""')
    header_icon=$(terrain_config_get "$config" '.header.icon // ""')

    # Get panels
    local panels_json
    panels_json=$(terrain_config_get "$config" '.panels // []')

    # Get custom scripts and styles
    local scripts_json styles_json
    scripts_json=$(terrain_config_get "$config" '.scripts // []')
    styles_json=$(terrain_config_get "$config" '.styles // []')

    # Determine output path
    if [[ -z "$output" ]]; then
        output="$app_dir/dist/index.html"
    fi

    # Ensure output directory exists
    mkdir -p "$(dirname "$output")"

    # Generate HTML
    _terrain_generate_html "$config" "$app_name" "$mode" "$theme" \
        "$mode_path" "$theme_path" "$output"

    local size
    size=$(wc -c < "$output" | tr -d ' ')
    echo "[terrain] Built: $output ($size bytes)"
}

# Internal: Generate HTML file from template
_terrain_generate_html() {
    local config="$1"
    local app_name="$2"
    local mode="$3"
    local theme="$4"
    local mode_path="$5"
    local theme_path="$6"
    local output="$7"

    local app_dir
    app_dir=$(dirname "$config")

    # Template location
    local template="$TERRAIN_SRC/core/templates/app.html"
    if [[ ! -f "$template" ]]; then
        echo "Error: Template not found: $template" >&2
        echo "Falling back to inline generation..." >&2
        _terrain_generate_html_inline "$@"
        return $?
    fi

    # Read header controls if present
    local header_controls_html=""
    local controls_json
    controls_json=$(terrain_config_get "$config" '.header.controls')
    if [[ -n "$controls_json" && "$controls_json" != "null" ]]; then
        header_controls_html=$(_terrain_render_header_controls "$controls_json")
    fi

    # Read panels for main and sidebar regions
    local main_panels_html="" sidebar_panels_html=""
    local panels_json
    panels_json=$(jq -c '.panels // []' "$config" 2>/dev/null)
    if [[ -n "$panels_json" && "$panels_json" != "[]" ]]; then
        main_panels_html=$(_terrain_render_panels "$panels_json" "main")
        sidebar_panels_html=$(_terrain_render_panels "$panels_json" "sidebar")
    fi

    # Build script tags for custom scripts
    local scripts_html=""
    local scripts
    scripts=$(jq -r '.scripts[]? // empty' "$config" 2>/dev/null)
    while IFS= read -r script; do
        [[ -n "$script" ]] && scripts_html+="    <script src=\"$script\"></script>
"
    done <<< "$scripts"

    # Build link tags for custom styles
    local styles_html=""
    local styles
    styles=$(jq -r '.styles[]? // empty' "$config" 2>/dev/null)
    while IFS= read -r style; do
        [[ -n "$style" ]] && styles_html+="    <link rel=\"stylesheet\" href=\"$style\">
"
    done <<< "$styles"

    # Get header config
    local header_title header_icon
    header_title=$(terrain_config_get "$config" '.header.title')
    header_icon=$(terrain_config_get "$config" '.header.icon')

    # Get layout
    local layout_columns
    layout_columns=$(terrain_config_get "$config" '.layout.columns')
    [[ -z "$layout_columns" ]] && layout_columns="1fr"

    # Get merged config as JSON string
    local merged_config
    merged_config=$(terrain_config_merge "$config")

    # Render template with substitutions
    # Using sed for simple {{PLACEHOLDER}} replacements
    local html
    html=$(cat "$template")

    # Escape special characters in values for sed
    _escape_sed() { printf '%s\n' "$1" | sed 's/[&/\]/\\&/g' | tr '\n' '\001'; }

    # Simple replacements (single-line values)
    html="${html//\{\{APP_NAME\}\}/$app_name}"
    html="${html//\{\{MODE\}\}/$mode}"
    html="${html//\{\{THEME\}\}/$theme}"
    html="${html//\{\{HEADER_TITLE\}\}/$header_title}"
    html="${html//\{\{HEADER_ICON\}\}/$header_icon}"
    html="${html//\{\{LAYOUT_COLUMNS\}\}/$layout_columns}"

    # Multi-line replacements (use temporary file approach for safety)
    local tmpfile
    tmpfile=$(mktemp)
    echo "$html" > "$tmpfile"

    # Replace multi-line placeholders using awk
    _replace_block() {
        local placeholder="$1"
        local content="$2"
        local file="$3"
        awk -v placeholder="$placeholder" -v content="$content" '
            { gsub(placeholder, content); print }
        ' "$file" > "${file}.tmp" && mv "${file}.tmp" "$file"
    }

    _replace_block "{{STYLES_HTML}}" "$styles_html" "$tmpfile"
    _replace_block "{{SCRIPTS_HTML}}" "$scripts_html" "$tmpfile"
    _replace_block "{{HEADER_CONTROLS_HTML}}" "$header_controls_html" "$tmpfile"
    _replace_block "{{MAIN_PANELS_HTML}}" "$main_panels_html" "$tmpfile"
    _replace_block "{{SIDEBAR_PANELS_HTML}}" "$sidebar_panels_html" "$tmpfile"
    _replace_block "{{MERGED_CONFIG}}" "$merged_config" "$tmpfile"

    # Write output
    cat "$tmpfile" > "$output"
    rm -f "$tmpfile"
}

# Render header controls from JSON array
_terrain_render_header_controls() {
    local controls_json="$1"

    echo "$controls_json" | jq -r '.[] |
        if .type == "button" then
            "                <button class=\"terrain-btn\" id=\"\(.id)\" data-action=\"\(.action // "")\" title=\"\(.title // "")\">\(.icon // "")\(.label // "")</button>"
        elif .type == "select" then
            "                <select class=\"terrain-btn\" id=\"\(.id)\"><option>Select...</option></select>"
        else
            ""
        end
    ' 2>/dev/null
}

# Render panels from JSON array for a specific region
# Args: $1 - panels JSON, $2 - region (main or sidebar)
_terrain_render_panels() {
    local panels_json="$1"
    local region="${2:-main}"

    echo "$panels_json" | jq -r --arg region "$region" '.[] |
        select(.region == $region) |
        "            <div class=\"terrain-panel\" id=\"panel-\(.id)\">
                <div class=\"terrain-panel-header\">\(.title // .id)</div>
                <div class=\"terrain-panel-content\" id=\"\(.id)-content\">
                    <!-- Panel: \(.id) -->
                </div>
            </div>"
    ' 2>/dev/null
}

# Build and serve with live preview
terrain_build_serve() {
    local app_dir="${1:-.}"
    local port="${2:-8080}"

    # Build first
    terrain_build "$app_dir" || return 1

    local dist_dir="$app_dir/dist"

    echo "[terrain] Starting preview server on http://localhost:$port"

    # Use Python's simple HTTP server
    if command -v python3 &>/dev/null; then
        (cd "$dist_dir" && python3 -m http.server "$port")
    elif command -v python &>/dev/null; then
        (cd "$dist_dir" && python -m SimpleHTTPServer "$port")
    else
        echo "Error: Python required for preview server" >&2
        return 1
    fi
}

export -f terrain_build terrain_build_serve
export -f _terrain_generate_html _terrain_render_header_controls _terrain_render_panels
