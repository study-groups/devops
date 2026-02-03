#!/usr/bin/env bash
# terrain.sh - Terrain Platform CLI
#
# Build system for Terrain UI applications.
#
# Usage:
#   terrain build [app-dir]           Build HTML from config
#   terrain config validate [path]    Validate config file
#   terrain modes list                List available modes
#   terrain themes list               List available themes
#   terrain doctor [app-dir]          Check app configuration
#   terrain help                      Show help

TERRAIN_VERSION="1.0.0"

# =============================================================================
# HELP
# =============================================================================

_terrain_help() {
    cat <<'EOF'
terrain - Terrain Platform CLI

USAGE:
    terrain <command> [arguments]

COMMANDS:
    build [app-dir]            Build HTML from terrain.config.json
    build [app-dir] -o <path>  Build to specific output path

    doc <file.json>            Build HTML from JSON using templates
    doc <file.json> -o <path>  Build doc to specific output

    local [app-dir]            Setup dist/ (build + symlinks)
    local clean [app-dir]      Remove dist/

    config validate [path]     Validate terrain.config.json
    config show [path]         Show parsed config

    modes list                 List available modes
    modes show <name>          Show mode configuration

    themes list                List available themes

    templates list             List available doc templates
    templates show <name>      Show template source

    doctor [app-dir]           Check app configuration and dependencies

    version                    Show version
    help                       Show this help

BUILD EXAMPLES:
    # Build app in current directory
    terrain build

    # Build app in specific directory
    terrain build ~/src/controldeck

    # Build to custom output
    terrain build ~/src/myapp -o ~/src/myapp/public/index.html

CONFIG:
    Apps require a terrain.config.json with:
    - terrain.name: App name
    - mode: Mode name (freerange, control, guide, deploy, reference)
    - theme: Theme name (dark, amber, forest, midnight)
    - panels: Array of panel definitions
    - scripts: Array of JS files to include
    - styles: Array of CSS files to include

SERVING:
    Use external server (caddy, python -m http.server, etc.)
EOF
}

# =============================================================================
# SUBCOMMAND: CONFIG
# =============================================================================

_terrain_config() {
    local subcmd="${1:-show}"
    shift 2>/dev/null || true

    case "$subcmd" in
        validate|v)
            local config="${1:-terrain.config.json}"
            terrain_config_validate "$config"
            ;;
        show|s)
            local path="${1:-.}"
            local config
            config=$(terrain_config_find "$path")
            if [[ -n "$config" ]]; then
                echo "Config: $config"
                echo "---"
                jq . "$config"
            else
                echo "No terrain.config.json found in $path"
                return 1
            fi
            ;;
        *)
            echo "Unknown config subcommand: $subcmd"
            echo "Usage: terrain config [validate|show] [path]"
            return 1
            ;;
    esac
}

# =============================================================================
# SUBCOMMAND: MODES
# =============================================================================

_terrain_modes() {
    local subcmd="${1:-list}"
    shift 2>/dev/null || true

    case "$subcmd" in
        list|ls)
            echo "Available modes:"
            terrain_config_list_modes
            ;;
        show|s)
            local name="$1"
            if [[ -z "$name" ]]; then
                echo "Usage: terrain modes show <name>" >&2
                return 1
            fi
            local mode_path
            mode_path=$(terrain_config_resolve_mode "$name")
            if [[ -n "$mode_path" ]]; then
                jq . "$mode_path"
            else
                echo "Mode not found: $name" >&2
                return 1
            fi
            ;;
        *)
            echo "Unknown modes subcommand: $subcmd"
            echo "Usage: terrain modes [list|show] [name]"
            return 1
            ;;
    esac
}

# =============================================================================
# SUBCOMMAND: THEMES
# =============================================================================

_terrain_themes() {
    local subcmd="${1:-list}"
    shift 2>/dev/null || true

    case "$subcmd" in
        list|ls)
            echo "Available themes:"
            terrain_config_list_themes
            ;;
        show|s)
            local name="$1"
            if [[ -z "$name" ]]; then
                echo "Usage: terrain themes show <name>" >&2
                return 1
            fi
            local theme_path
            theme_path=$(terrain_config_resolve_theme "$name")
            if [[ -n "$theme_path" ]]; then
                cat "$theme_path"
            else
                echo "Theme not found: $name" >&2
                return 1
            fi
            ;;
        *)
            echo "Unknown themes subcommand: $subcmd"
            echo "Usage: terrain themes [list|show] [name]"
            return 1
            ;;
    esac
}

# =============================================================================
# SUBCOMMAND: TEMPLATES
# =============================================================================

_terrain_templates() {
    local subcmd="${1:-list}"
    shift 2>/dev/null || true

    case "$subcmd" in
        list|ls)
            echo "Available templates:"
            local templates_dir="$TERRAIN_SRC/core/templates"
            for f in "$templates_dir"/*.html; do
                [[ -f "$f" ]] || continue
                local name=$(basename "$f" .html)
                local size=$(wc -c < "$f" | tr -d ' ')
                printf "  %-14s (%s bytes)\n" "$name" "$size"
            done
            ;;
        show|s)
            local name="$1"
            if [[ -z "$name" ]]; then
                echo "Usage: terrain templates show <name>" >&2
                return 1
            fi
            local tpl="$TERRAIN_SRC/core/templates/${name}.html"
            if [[ -f "$tpl" ]]; then
                cat "$tpl"
            else
                echo "Template not found: $name" >&2
                echo "Use 'terrain templates list' to see available templates" >&2
                return 1
            fi
            ;;
        *)
            echo "Unknown templates subcommand: $subcmd"
            echo "Usage: terrain templates [list|show] [name]"
            return 1
            ;;
    esac
}

# =============================================================================
# SUBCOMMAND: DOCTOR
# =============================================================================

_terrain_doctor() {
    local app_dir="${1:-.}"
    local errors=0

    echo "Terrain Doctor"
    echo "=============="
    echo ""

    # Check TERRAIN_SRC
    echo -n "TERRAIN_SRC: "
    if [[ -n "$TERRAIN_SRC" ]]; then
        echo "$TERRAIN_SRC"
    else
        echo "NOT SET"
        ((errors++))
    fi

    # Check jq
    echo -n "jq: "
    if command -v jq &>/dev/null; then
        echo "$(jq --version)"
    else
        echo "NOT FOUND (required)"
        ((errors++))
    fi

    # Check modes directory
    echo -n "Modes: "
    local modes_dir="$TERRAIN_SRC/dist/modes"
    if [[ -d "$modes_dir" ]]; then
        local count
        count=$(find "$modes_dir" -name "*.mode.json" 2>/dev/null | wc -l | tr -d ' ')
        echo "$count modes found"
    else
        echo "NOT FOUND"
        ((errors++))
    fi

    # Check themes directory
    echo -n "Themes: "
    local themes_dir="$TERRAIN_SRC/dist/themes"
    if [[ -d "$themes_dir" ]]; then
        local count
        count=$(find "$themes_dir" -name "*.theme.css" 2>/dev/null | wc -l | tr -d ' ')
        echo "$count themes found"
    else
        echo "NOT FOUND"
        ((errors++))
    fi

    echo ""

    # Check app config
    echo "App Directory: $app_dir"
    local config
    config=$(terrain_config_find "$app_dir")
    echo -n "Config: "
    if [[ -n "$config" ]]; then
        echo "$config"

        # Validate config
        echo ""
        terrain_config_validate "$config"
    else
        echo "NOT FOUND"
        ((errors++))
    fi

    echo ""
    if [[ $errors -eq 0 ]]; then
        echo "Status: OK"
        return 0
    else
        echo "Status: $errors error(s)"
        return 1
    fi
}

# =============================================================================
# SUBCOMMAND: BUILD
# =============================================================================

_terrain_build() {
    local app_dir="."
    local output=""

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -o|--output)
                output="$2"
                shift 2
                ;;
            -*)
                echo "Unknown option: $1" >&2
                return 1
                ;;
            *)
                app_dir="$1"
                shift
                ;;
        esac
    done

    if [[ -n "$output" ]]; then
        terrain_build "$app_dir" "$output"
    else
        terrain_build "$app_dir"
    fi
}

# =============================================================================
# SUBCOMMAND: LOCAL
# =============================================================================

_terrain_local() {
    local subcmd="${1:-.}"
    shift 2>/dev/null || true

    case "$subcmd" in
        clean|c)
            terrain_local_clean "$@"
            ;;
        *)
            # Default: setup (treat arg as app-dir)
            terrain_local_setup "$subcmd" "$@"
            ;;
    esac
}

# =============================================================================
# SUBCOMMAND: DOC
# =============================================================================

_terrain_doc() {
    local subcmd="${1:-}"

    if [[ "$subcmd" == "help" || "$subcmd" == "-h" ]]; then
        terrain_doc_help
        return 0
    fi

    local src_file=""
    local output=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            -o|--output)
                output="$2"
                shift 2
                ;;
            -*)
                echo "Unknown option: $1" >&2
                return 1
                ;;
            *)
                src_file="$1"
                shift
                ;;
        esac
    done

    terrain_doc_build "$src_file" "$output"
}

# =============================================================================
# MAIN DISPATCHER
# =============================================================================

terrain() {
    local cmd="${1:-help}"
    shift 2>/dev/null || true

    case "$cmd" in
        # Build
        build|b)
            _terrain_build "$@"
            ;;

        # Local development
        local|l)
            _terrain_local "$@"
            ;;

        # Config
        config|c)
            _terrain_config "$@"
            ;;

        # Modes
        modes|mode|m)
            _terrain_modes "$@"
            ;;

        # Themes
        themes|theme|t)
            _terrain_themes "$@"
            ;;

        # Templates
        templates|template|tp)
            _terrain_templates "$@"
            ;;

        # Doc (standalone JSON → HTML)
        doc)
            _terrain_doc "$@"
            ;;

        # Doctor
        doctor|dr)
            _terrain_doctor "$@"
            ;;

        # Help
        help|-h|--help)
            _terrain_help
            ;;

        # Version
        version|-v|--version)
            echo "terrain version $TERRAIN_VERSION"
            ;;

        # Unknown command
        *)
            echo "Unknown command: $cmd"
            echo "Run 'terrain help' for usage"
            return 1
            ;;
    esac
}

# If sourced, export; if run directly, execute
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    terrain "$@"
fi

export -f terrain _terrain_help _terrain_config _terrain_modes _terrain_themes _terrain_templates
export -f _terrain_doctor _terrain_build _terrain_local _terrain_doc
export TERRAIN_VERSION
