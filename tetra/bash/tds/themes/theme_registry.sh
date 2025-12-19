#!/usr/bin/env bash

# TDS Theme Registry
# Central theme management system for TDS

# Active theme name
TDS_ACTIVE_THEME="${TDS_ACTIVE_THEME:-default}"

# Theme registry - maps theme names to loader functions
# Note: Only register themes that have actual loader implementations
declare -gA TDS_THEME_REGISTRY=(
    [default]="tds_load_theme_default"
)

# Theme metadata (populated by theme loaders)
declare -g TDS_THEME_NAME=""
declare -g TDS_THEME_DESCRIPTION=""

# List available themes with colored previews
# Each theme shows sample text in its own colors
# Uses: MODE for semantic states (theme-specific), VERBS for collection cycling
tds_list_themes() {
    local saved_theme="$TDS_ACTIVE_THEME"

    echo
    echo "TDS Themes"
    echo

    # Sort themes for consistent display
    local themes
    mapfile -t themes < <(printf '%s\n' "${!TDS_THEME_REGISTRY[@]}" | sort)

    for theme in "${themes[@]}"; do
        # Load theme to get its colors
        TDS_QUIET_LOAD=1 tds_switch_theme "$theme" 2>/dev/null || continue

        # Show theme name in its primary ENV color
        printf "  "
        text_color "${ENV_PRIMARY[0]}"
        printf "%-10s" "$theme"
        reset_color

        # Show MODE semantics (theme-specific bad/warning/good/info)
        text_color "${MODE_PRIMARY[0]}"; printf "bad"; reset_color; printf " "
        text_color "${MODE_PRIMARY[1]}"; printf "warn"; reset_color; printf " "
        text_color "${MODE_PRIMARY[2]}"; printf "good"; reset_color; printf " "
        text_color "${MODE_PRIMARY[3]}"; printf "info"; reset_color; printf "  "

        # Show VERBS cycling (universal rainbow) with sample verbs
        local verbs=(get set del)
        for i in "${!verbs[@]}"; do
            text_color "${VERBS_PRIMARY[$i]}"
            printf "%s" "${verbs[$i]}"
            reset_color
            printf " "
        done

        # Active indicator on far right
        if [[ "$theme" == "$saved_theme" ]]; then
            printf " ●"
        fi
        echo
    done
    echo

    # Restore original theme
    TDS_QUIET_LOAD=1 tds_switch_theme "$saved_theme" 2>/dev/null
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

    # Check if loader function exists
    if ! declare -f "$loader" >/dev/null; then
        # Function doesn't exist - try lazy loading from themes directory
        local theme_file="$TDS_SRC/themes/${theme_name}.sh"
        if [[ -f "$theme_file" ]]; then
            TDS_QUIET_LOAD=1 source "$theme_file" || {
                echo "Error: Failed to lazy-load theme '$theme_name'" >&2
                return 1
            }
        else
            echo "Error: Theme loader '$loader' not found and no theme file at: $theme_file" >&2
            return 1
        fi
    fi

    # Now call the loader
    "$loader"
    TDS_ACTIVE_THEME="$theme_name"

    # Export theme name for subprocesses
    export TDS_ACTIVE_THEME

    # Save to persistent config (unless quiet loading during init)
    [[ "${TDS_QUIET_LOAD:-0}" != "1" ]] && tds_save_current

    # Only show message if explicitly requested (not during boot)
    [[ "${TDS_QUIET_LOAD:-0}" != "1" ]] && echo "Switched to theme: $theme_name"
    return 0
}

# Save current TDS state to $TETRA_DIR/tds/current.sh
# This file is sourced on shell startup to restore theme
tds_save_current() {
    local tds_dir="${TETRA_DIR:-$HOME/tetra}/tds"
    local current_file="$tds_dir/current.sh"

    # Ensure directory exists
    [[ -d "$tds_dir" ]] || mkdir -p "$tds_dir"

    # Write current state
    cat > "$current_file" <<EOF
# TDS current state - auto-generated by tds_save_current
# Sourced on shell startup to restore theme settings

export TDS_ACTIVE_THEME="${TDS_ACTIVE_THEME:-default}"
EOF
}

# Load saved TDS state from $TETRA_DIR/tds/current.sh
tds_load_current() {
    local current_file="${TETRA_DIR:-$HOME/tetra}/tds/current.sh"
    [[ -f "$current_file" ]] && source "$current_file"
}

# Get active theme name
# Returns: active theme name
tds_active_theme() {
    echo "$TDS_ACTIVE_THEME"
}

# Register a new theme (for third-party themes)
# Args: theme_name, loader_function, description (optional)
tds_register_theme() {
    local theme_name="$1"
    local loader_fn="$2"
    local description="${3:-}"

    if [[ -z "$theme_name" || -z "$loader_fn" ]]; then
        echo "Error: Theme name and loader function required" >&2
        echo "Usage: tds_register_theme <name> <loader_function> [description]" >&2
        return 1
    fi

    if ! declare -f "$loader_fn" >/dev/null; then
        echo "Error: Loader function '$loader_fn' not found" >&2
        return 1
    fi

    # Only log if this is a new registration or being updated
    local is_new=false
    if [[ -z "${TDS_THEME_REGISTRY[$theme_name]}" ]] || \
       [[ "${TDS_THEME_REGISTRY[$theme_name]}" != "$loader_fn" ]]; then
        is_new=true
    fi

    TDS_THEME_REGISTRY["$theme_name"]="$loader_fn"

    # Only show registration message if not in quiet mode AND it's a new registration
    if [[ "${TDS_QUIET_LOAD:-0}" != "1" ]] && [[ "$is_new" == "true" ]]; then
        echo "Registered theme: $theme_name"
    fi

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
# Register lazy-loadable theme (doesn't require loader function to exist yet)
# Args: theme_name, loader_function, description (optional)
tds_register_lazy_theme() {
    local theme_name="$1"
    local loader_fn="$2"
    local description="${3:-}"

    if [[ -z "$theme_name" || -z "$loader_fn" ]]; then
        echo "Error: Theme name and loader function required" >&2
        return 1
    fi

    # Register even if loader doesn't exist yet (for lazy loading)
    TDS_THEME_REGISTRY["$theme_name"]="$loader_fn"

    # Don't print anything - this is for lazy loading
    return 0
}

export -f tds_list_themes tds_theme_info tds_switch_theme tds_active_theme tds_register_theme tds_register_lazy_theme
export -f tds_preview_themes tds_compare_themes tds_save_current tds_load_current
