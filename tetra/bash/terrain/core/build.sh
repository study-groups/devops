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

    # Template location
    local template="$TERRAIN_SRC/core/templates/app.html"
    if [[ ! -f "$template" ]]; then
        echo "Error: Template not found: $template" >&2
        echo "Falling back to inline generation..." >&2
        _terrain_generate_html_inline "$@"
        return $?
    fi

    # Read all config values in a single jq call
    local config_vals
    config_vals=$(jq -r '[
        (.header.title // ""),
        (.header.icon // ""),
        (.layout.columns // "1fr")
    ] | .[]' "$config" 2>/dev/null)

    local header_title header_icon layout_columns
    { read -r header_title; read -r header_icon; read -r layout_columns; } <<< "$config_vals"

    # Header controls
    local header_controls_html=""
    local controls_json
    controls_json=$(terrain_config_get "$config" '.header.controls')
    if [[ -n "$controls_json" && "$controls_json" != "null" ]]; then
        header_controls_html=$(_terrain_render_header_controls "$controls_json")
    fi

    # Panels
    local main_panels_html="" sidebar_panels_html=""
    local panels_json
    panels_json=$(jq -c '.panels // []' "$config" 2>/dev/null)
    if [[ -n "$panels_json" && "$panels_json" != "[]" ]]; then
        main_panels_html=$(_terrain_render_panels "$panels_json" "main")
        sidebar_panels_html=$(_terrain_render_panels "$panels_json" "sidebar")
    fi

    # Script and style tags in a single jq call
    local scripts_html="" styles_html=""
    local tags
    tags=$(jq -r '
        ((.scripts // [])[] | "    <script src=\"\(.)\">\u003c/script>"),
        "---SEPARATOR---",
        ((.styles // [])[] | "    <link rel=\"stylesheet\" href=\"\(.)\">")'  "$config" 2>/dev/null)

    local in_styles=false
    while IFS= read -r line; do
        if [[ "$line" == "---SEPARATOR---" ]]; then
            in_styles=true
            continue
        fi
        if $in_styles; then
            [[ -n "$line" ]] && styles_html+="${line}
"
        else
            [[ -n "$line" ]] && scripts_html+="${line}
"
        fi
    done <<< "$tags"

    # Merged config
    local merged_config
    merged_config=$(terrain_config_merge "$config")

    # Load template and do all replacements in memory
    local html
    html=$(<"$template")

    # Single-line replacements
    html="${html//\{\{APP_NAME\}\}/$app_name}"
    html="${html//\{\{MODE\}\}/$mode}"
    html="${html//\{\{THEME\}\}/$theme}"
    html="${html//\{\{HEADER_TITLE\}\}/$header_title}"
    html="${html//\{\{HEADER_ICON\}\}/$header_icon}"
    html="${html//\{\{LAYOUT_COLUMNS\}\}/$layout_columns}"

    # Multi-line replacements via split-and-reassemble (all in memory)
    local placeholder content before after
    local -a placeholders=(
        "{{STYLES_HTML}}"
        "{{SCRIPTS_HTML}}"
        "{{HEADER_CONTROLS_HTML}}"
        "{{MAIN_PANELS_HTML}}"
        "{{SIDEBAR_PANELS_HTML}}"
        "{{MERGED_CONFIG}}"
    )
    local -a contents=(
        "$styles_html"
        "$scripts_html"
        "$header_controls_html"
        "$main_panels_html"
        "$sidebar_panels_html"
        "$merged_config"
    )

    local i
    for i in "${!placeholders[@]}"; do
        placeholder="${placeholders[$i]}"
        content="${contents[$i]}"
        before="${html%%"$placeholder"*}"
        after="${html#*"$placeholder"}"
        html="${before}${content}${after}"
    done

    # Write output (single write, no tmpfile)
    printf '%s' "$html" > "$output"
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
