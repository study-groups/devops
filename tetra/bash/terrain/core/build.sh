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

# Internal: Generate HTML file
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
    local header_show header_title header_icon
    header_show=$(terrain_config_get "$config" '.header.show')
    header_title=$(terrain_config_get "$config" '.header.title')
    header_icon=$(terrain_config_get "$config" '.header.icon')

    # Get layout
    local layout_columns
    layout_columns=$(terrain_config_get "$config" '.layout.columns')
    [[ -z "$layout_columns" ]] && layout_columns="1fr"

    # Generate the HTML
    cat > "$output" << HTMLEOF
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <title>$app_name</title>

    <!-- Terrain Platform -->
    <link rel="stylesheet" href="terrain/css/core.css">
    <link rel="stylesheet" href="terrain/css/tokens.css">
    <link rel="stylesheet" href="terrain/dist/themes/${theme}.theme.css" id="terrain-theme">

    <!-- App Styles -->
$styles_html
    <style>
        /* Generated layout from terrain.config.json */
        :root {
            --layout-columns: $layout_columns;
        }

        .terrain-app {
            display: grid;
            grid-template-columns: var(--layout-columns);
            grid-template-rows: auto 1fr;
            grid-template-areas:
                "header header"
                "main sidebar";
            min-height: 100vh;
            background: var(--bg-primary);
        }

        .terrain-header {
            grid-area: header;
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 8px 16px;
            background: var(--bg-secondary);
            border-bottom: 1px solid var(--border-primary);
        }

        .terrain-header-title {
            font-size: 18px;
            font-weight: 600;
            color: var(--text-primary);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .terrain-header-icon {
            font-size: 20px;
        }

        .terrain-header-controls {
            display: flex;
            gap: 8px;
            margin-left: auto;
        }

        .terrain-main {
            grid-area: main;
            padding: 16px;
            overflow-y: auto;
        }

        .terrain-sidebar {
            grid-area: sidebar;
            padding: 16px;
            background: var(--bg-secondary);
            border-left: 1px solid var(--border-primary);
            overflow-y: auto;
        }

        .terrain-panel {
            background: var(--bg-tertiary);
            border: 1px solid var(--border-primary);
            border-radius: 8px;
            margin-bottom: 12px;
        }

        .terrain-panel-header {
            padding: 10px 12px;
            font-weight: 600;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--text-secondary);
            border-bottom: 1px solid var(--border-primary);
            cursor: pointer;
            user-select: none;
        }

        .terrain-panel-content {
            padding: 12px;
        }

        .terrain-btn {
            padding: 6px 12px;
            background: var(--bg-tertiary);
            border: 1px solid var(--border-primary);
            border-radius: 4px;
            color: var(--text-primary);
            font-size: 12px;
            cursor: pointer;
            transition: all 0.15s ease;
        }

        .terrain-btn:hover {
            background: var(--accent-primary);
            border-color: var(--accent-primary);
        }

        /* Loading overlay */
        .loading-overlay {
            position: fixed;
            top: 0; left: 0;
            width: 100vw; height: 100vh;
            background: var(--bg-primary);
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: opacity 0.4s ease;
        }

        .loading-overlay.fade-out {
            opacity: 0;
            pointer-events: none;
        }

        .loading-text {
            font-size: 18pt;
            font-weight: 700;
            color: var(--accent-primary);
            letter-spacing: 2px;
            text-transform: uppercase;
            animation: pulse 1.5s ease-in-out infinite;
        }

        @keyframes pulse {
            0%, 100% { opacity: 0.4; }
            50% { opacity: 1; }
        }
    </style>
</head>
<body>
    <!-- Loading overlay -->
    <div class="loading-overlay" id="loading-overlay">
        <div class="loading-text">LOADING</div>
    </div>

    <div class="terrain-app" id="terrain-app">
        <!-- Header -->
        <header class="terrain-header">
            <div class="terrain-header-title">
                <span class="terrain-header-icon">$header_icon</span>
                <span>$header_title</span>
            </div>
            <div class="terrain-header-controls" id="header-controls">
$header_controls_html
            </div>
        </header>

        <!-- Main Content -->
        <main class="terrain-main" id="terrain-main">
$main_panels_html
        </main>

        <!-- Sidebar -->
        <aside class="terrain-sidebar" id="terrain-sidebar">
$sidebar_panels_html
        </aside>
    </div>

    <!-- Terrain Core -->
    <script src="terrain/js/core/config.js"></script>
    <script src="terrain/js/core/events.js"></script>
    <script src="terrain/js/core/state.js"></script>
    <script src="terrain/js/core/mode.js"></script>

    <!-- App Config (inline) -->
    <script>
        window.TerrainAppConfig = $(cat "$config");
    </script>

    <!-- App Scripts -->
$scripts_html
    <!-- Boot -->
    <script>
        (async function() {
            // Initialize mode
            await Terrain.Mode.init('terrain/dist/modes/${mode}.mode.json', '${theme}');
            Terrain.Mode.apply();

            // Hide loading overlay
            const overlay = document.getElementById('loading-overlay');
            if (overlay) {
                overlay.classList.add('fade-out');
                setTimeout(() => overlay.remove(), 400);
            }

            // Emit ready event
            if (Terrain.Events) {
                Terrain.Events.emit('TERRAIN_READY', {
                    app: '$app_name',
                    mode: '${mode}',
                    theme: '${theme}'
                });
            }

            console.log('[Terrain] Ready:', '$app_name');
        })();
    </script>
</body>
</html>
HTMLEOF
}

# Render header controls from JSON array
_terrain_render_header_controls() {
    local controls_json="$1"

    echo "$controls_json" | jq -r '.[] |
        if .type == "button" then
            "                <button class=\"terrain-btn\" id=\"\(.id)\">\(.icon // "") \(.label // "")</button>"
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
