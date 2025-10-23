#!/usr/bin/env bash

# TDS Theme Registry
# Central theme management system for TDS

# Active theme name
TDS_ACTIVE_THEME="${TDS_ACTIVE_THEME:-default}"

# Theme registry - maps theme names to loader functions
declare -gA TDS_THEME_REGISTRY=(
    [default]="tds_load_theme_default"
    [tokyo-night]="tds_load_theme_tokyo_night"
    [neon]="tds_load_theme_neon"
)

# Theme metadata (populated by theme loaders)
declare -g TDS_THEME_NAME=""
declare -g TDS_THEME_AUTHOR=""
declare -g TDS_THEME_DESCRIPTION=""

# List available themes
# Outputs list of themes with active indicator
tds_list_themes() {
    echo "Available TDS Themes:"
    echo "===================="
    echo

    for theme in "${!TDS_THEME_REGISTRY[@]}"; do
        if [[ "$theme" == "$TDS_ACTIVE_THEME" ]]; then
            printf "  ${COLOR_GREEN}●${COLOR_RESET} %s (active)\n" "$theme"
        else
            printf "  ○ %s\n" "$theme"
        fi
    done
    echo

    if [[ -n "$TDS_THEME_NAME" ]]; then
        echo "Current Theme: $TDS_THEME_NAME"
        [[ -n "$TDS_THEME_AUTHOR" ]] && echo "Author: $TDS_THEME_AUTHOR"
        [[ -n "$TDS_THEME_DESCRIPTION" ]] && echo "Description: $TDS_THEME_DESCRIPTION"
    fi
}

# Show theme details
# Args: theme_name
tds_theme_info() {
    local theme_name="$1"

    if [[ -z "${TDS_THEME_REGISTRY[$theme_name]}" ]]; then
        echo "Error: Unknown theme '$theme_name'" >&2
        return 1
    fi

    # Load theme to get metadata
    local loader="${TDS_THEME_REGISTRY[$theme_name]}"
    if declare -f "$loader" >/dev/null; then
        "$loader"

        echo "Theme: $theme_name"
        echo "Name: ${TDS_THEME_NAME:-N/A}"
        echo "Author: ${TDS_THEME_AUTHOR:-N/A}"
        echo "Description: ${TDS_THEME_DESCRIPTION:-N/A}"
        echo
        echo "Palettes:"
        echo "  ENV_PRIMARY (${#ENV_PRIMARY[@]} colors)"
        echo "  MODE_PRIMARY (${#MODE_PRIMARY[@]} colors)"
        echo "  VERBS_PRIMARY (${#VERBS_PRIMARY[@]} colors)"
        echo "  NOUNS_PRIMARY (${#NOUNS_PRIMARY[@]} colors)"

        return 0
    else
        echo "Error: Theme loader '$loader' not found" >&2
        return 1
    fi
}

# Switch active theme
# Args: theme_name
# Returns: 0 on success, 1 on error
tds_switch_theme() {
    local theme_name="$1"

    if [[ -z "$theme_name" ]]; then
        echo "Error: Theme name required" >&2
        echo "Usage: tds_switch_theme <theme_name>" >&2
        echo "Available themes: ${!TDS_THEME_REGISTRY[*]}" >&2
        return 1
    fi

    if [[ -z "${TDS_THEME_REGISTRY[$theme_name]}" ]]; then
        echo "Error: Unknown theme '$theme_name'" >&2
        echo "Available themes: ${!TDS_THEME_REGISTRY[*]}" >&2
        return 1
    fi

    # Call theme loader
    local loader="${TDS_THEME_REGISTRY[$theme_name]}"
    if declare -f "$loader" >/dev/null; then
        "$loader"
        TDS_ACTIVE_THEME="$theme_name"

        # Export theme name for subprocesses
        export TDS_ACTIVE_THEME

        # Only show message if explicitly requested (not during boot)
        [[ "${TDS_QUIET_LOAD:-0}" != "1" ]] && echo "Switched to theme: $theme_name"
        return 0
    else
        echo "Error: Theme loader '$loader' not found" >&2
        return 1
    fi
}

# Get active theme name
# Returns: active theme name
tds_active_theme() {
    echo "$TDS_ACTIVE_THEME"
}

# Register a new theme (for third-party themes)
# Args: theme_name, loader_function
tds_register_theme() {
    local theme_name="$1"
    local loader_fn="$2"

    if [[ -z "$theme_name" || -z "$loader_fn" ]]; then
        echo "Error: Theme name and loader function required" >&2
        echo "Usage: tds_register_theme <name> <loader_function>" >&2
        return 1
    fi

    if ! declare -f "$loader_fn" >/dev/null; then
        echo "Error: Loader function '$loader_fn' not found" >&2
        return 1
    fi

    TDS_THEME_REGISTRY["$theme_name"]="$loader_fn"
    echo "Registered theme: $theme_name"
    return 0
}

# Preview all themes side-by-side
# Shows a sample of each theme's colors for comparison
tds_preview_themes() {
    local saved_theme="$TDS_ACTIVE_THEME"

    echo "TDS Theme Preview"
    echo "================="
    echo

    for theme_name in "${!TDS_THEME_REGISTRY[@]}"; do
        # Load theme
        tds_switch_theme "$theme_name" 2>/dev/null || continue

        # Show theme header
        echo "Theme: $theme_name ($TDS_THEME_NAME)"
        if [[ -n "$TDS_THEME_DESCRIPTION" ]]; then
            echo "  $TDS_THEME_DESCRIPTION"
        fi
        echo

        # Show palette samples
        echo "  ENV palette:   ${ENV_PRIMARY[0]}  ${ENV_PRIMARY[1]}  ${ENV_PRIMARY[2]}  ${ENV_PRIMARY[3]}"
        echo "  MODE palette:  ${MODE_PRIMARY[0]}  ${MODE_PRIMARY[1]}  ${MODE_PRIMARY[2]}  ${MODE_PRIMARY[3]}"
        echo "  VERBS palette: ${VERBS_PRIMARY[0]}  ${VERBS_PRIMARY[1]}  ${VERBS_PRIMARY[2]}  ${VERBS_PRIMARY[3]}"
        echo "  NOUNS palette: ${NOUNS_PRIMARY[0]}  ${NOUNS_PRIMARY[1]}  ${NOUNS_PRIMARY[2]}  ${NOUNS_PRIMARY[3]}"
        echo

        # Show functional demo (requires TDS to be loaded)
        if declare -f tds_status >/dev/null 2>&1; then
            echo "  Demo:"
            echo -n "    "
            tds_status success "Success"
            echo -n "  "
            tds_status error "Error"
            echo -n "  "
            tds_status warning "Warning"
            echo
            echo -n "    "
            tds_env_badge "local"
            echo -n " "
            tds_env_badge "dev"
            echo -n " "
            tds_env_badge "staging"
            echo -n " "
            tds_env_badge "prod"
            echo
        fi
        echo
        echo "────────────────────────────────────────"
        echo
    done

    # Restore original theme
    tds_switch_theme "$saved_theme" 2>/dev/null
    echo "Restored theme: $saved_theme"
}

# Compare two themes side-by-side
# Args: theme1, theme2
tds_compare_themes() {
    local theme1="$1"
    local theme2="$2"

    if [[ -z "$theme1" || -z "$theme2" ]]; then
        echo "Error: Two theme names required" >&2
        echo "Usage: tds_compare_themes <theme1> <theme2>" >&2
        return 1
    fi

    local saved_theme="$TDS_ACTIVE_THEME"

    echo "TDS Theme Comparison: $theme1 vs $theme2"
    echo "========================================"
    echo

    # Column headers
    printf "%-30s | %-30s\n" "$theme1" "$theme2"
    printf "%s\n" "────────────────────────────────────────────────────────────────"

    # Load theme 1 and capture colors
    tds_switch_theme "$theme1" 2>/dev/null || { echo "Error loading $theme1" >&2; return 1; }
    local t1_env0="${ENV_PRIMARY[0]}"
    local t1_mode0="${MODE_PRIMARY[0]}"
    local t1_verb0="${VERBS_PRIMARY[0]}"
    local t1_noun0="${NOUNS_PRIMARY[0]}"

    # Load theme 2 and capture colors
    tds_switch_theme "$theme2" 2>/dev/null || { echo "Error loading $theme2" >&2; return 1; }
    local t2_env0="${ENV_PRIMARY[0]}"
    local t2_mode0="${MODE_PRIMARY[0]}"
    local t2_verb0="${VERBS_PRIMARY[0]}"
    local t2_noun0="${NOUNS_PRIMARY[0]}"

    # Show comparison
    printf "%-30s | %-30s\n" "ENV:  $t1_env0" "ENV:  $t2_env0"
    printf "%-30s | %-30s\n" "MODE: $t1_mode0" "MODE: $t2_mode0"
    printf "%-30s | %-30s\n" "VERB: $t1_verb0" "VERB: $t2_verb0"
    printf "%-30s | %-30s\n" "NOUN: $t1_noun0" "NOUN: $t2_noun0"

    # Restore
    tds_switch_theme "$saved_theme" 2>/dev/null
}

# Export functions
export -f tds_list_themes tds_theme_info tds_switch_theme tds_active_theme tds_register_theme
export -f tds_preview_themes tds_compare_themes
