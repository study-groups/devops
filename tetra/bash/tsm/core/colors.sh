#!/usr/bin/env bash

# TSM Colors - Color configuration management using TDS module_config
# Stores preferences in $TSM_DIR/config/colors.conf

# =============================================================================
# COLOR HELPER FUNCTIONS
# =============================================================================

# Get hex color for TSM token (wrapper for tds_module_color)
tsm_color_get() {
    local token="$1"
    if declare -f tds_module_color >/dev/null 2>&1; then
        tds_module_color "tsm" "$token"
    else
        echo "888888"
    fi
}

# Print colored text using TSM token
tsm_color_print() {
    local token="$1"
    local text="$2"
    local hex=$(tsm_color_get "$token")

    if declare -f text_color >/dev/null 2>&1; then
        text_color "$hex"
        printf "%s" "$text"
        reset_color
    else
        printf "%s" "$text"
    fi
}

# Print colored text with newline
tsm_color_println() {
    tsm_color_print "$1" "$2"
    echo
}

# Get all 8 colors from a palette as space-separated hex values
tsm_color_palette() {
    local palette="$1"
    local result=""

    case "$palette" in
        env)   local -n arr=ENV_PRIMARY ;;
        mode)  local -n arr=MODE_PRIMARY ;;
        verbs) local -n arr=VERBS_PRIMARY ;;
        nouns) local -n arr=NOUNS_PRIMARY ;;
        *)     echo ""; return 1 ;;
    esac

    for i in {0..7}; do
        local hex="${arr[$i]:-888888}"
        hex="${hex#\#}"
        result+="$hex "
    done
    echo "${result% }"
}

# =============================================================================
# COLORS COMMAND HANDLER
# =============================================================================

tsm_colors() {
    local cmd="${1:-list}"
    shift 2>/dev/null || true

    case "$cmd" in
        list|ls|show)
            tsm_colors_list "$@"
            ;;
        set)
            tsm_colors_set "$@"
            ;;
        edit)
            tsm_colors_edit
            ;;
        get)
            tsm_colors_get "$@"
            ;;
        path)
            tsm_colors_path
            ;;
        init|reset)
            tsm_colors_reset
            ;;
        palette|palettes)
            tsm_colors_palette "$@"
            ;;
        help|*)
            tsm_colors_help
            ;;
    esac
}

# List all TSM color tokens with preview
tsm_colors_list() {
    if declare -f tds_module_show >/dev/null 2>&1; then
        tds_module_show "tsm"
    else
        echo "TSM Color Tokens"
        echo "================"
        echo ""
        for key in $(printf '%s\n' "${!TSM_COLOR_TOKENS[@]}" | sort); do
            printf "  %-28s = %s\n" "$key" "${TSM_COLOR_TOKENS[$key]}"
        done
    fi
}

# Set a token value
tsm_colors_set() {
    local token="$1"
    local value="$2"

    if [[ -z "$token" || -z "$value" ]]; then
        echo "Usage: tsm colors set <token> <value>"
        echo ""
        echo "Value format:"
        echo "  palette:index  - Reference palette color (e.g., verbs:5, mode:2)"
        echo "  RRGGBB         - Direct hex color (e.g., FF5500)"
        echo ""
        echo "Palettes (index 0-7):"
        echo "  env   - Environment colors (alternating hues)"
        echo "  mode  - Status colors ([0]=error [1]=warn [2]=success [3]=info)"
        echo "  verbs - Action colors (rainbow cycle)"
        echo "  nouns - Content colors (grayscale gradient)"
        echo ""
        echo "Example: tsm colors set list.header verbs:4"
        return 1
    fi

    # Validate value format
    if [[ ! "$value" =~ ^(env|mode|verbs|nouns):[0-7]$ && ! "$value" =~ ^#?[0-9A-Fa-f]{6}$ ]]; then
        echo "Invalid value: $value"
        echo "Expected: palette:index (e.g., verbs:5) or hex (e.g., FF5500)"
        return 1
    fi

    # Strip # from hex if present
    value="${value#\#}"

    # Update in-memory token
    TSM_COLOR_TOKENS["$token"]="$value"

    # Save to config file
    if declare -f tds_module_save >/dev/null 2>&1; then
        local config_file=$(tds_module_save "tsm")
        echo "Set $token = $value"
        echo "Saved to: $config_file"
    else
        echo "Set $token = $value (in-memory only, TDS not available)"
    fi

    # Show preview
    local hex=$(tsm_color_get "$token")
    printf "Preview: "
    if declare -f text_color >/dev/null 2>&1; then
        text_color "$hex"
        printf "████████"
        reset_color
    fi
    printf " #%s\n" "$hex"
}

# Get a specific token's value and color
tsm_colors_get() {
    local token="$1"

    if [[ -z "$token" ]]; then
        echo "Usage: tsm colors get <token>"
        echo "Example: tsm colors get list.header"
        return 1
    fi

    local ref="${TSM_COLOR_TOKENS[$token]}"
    if [[ -z "$ref" ]]; then
        echo "Token not found: $token"
        echo "Use 'tsm colors list' to see available tokens"
        return 1
    fi

    local hex=$(tsm_color_get "$token")

    echo "Token:   $token"
    echo "Maps to: $ref"
    printf "Hex:     #%s " "$hex"
    if declare -f text_color >/dev/null 2>&1; then
        text_color "$hex"
        printf "████"
        reset_color
    fi
    echo
}

# Open config file in editor
tsm_colors_edit() {
    local config_file
    if declare -f tds_module_config_path >/dev/null 2>&1; then
        config_file=$(tds_module_config_path "tsm")

        # Create default config if it doesn't exist
        if [[ ! -f "$config_file" ]]; then
            if declare -f tds_module_save >/dev/null 2>&1; then
                tds_module_save "tsm" >/dev/null
            fi
        fi

        ${EDITOR:-vi} "$config_file"

        # Reload after editing
        if declare -f tds_module_load >/dev/null 2>&1; then
            tds_module_load "tsm" 2>/dev/null
            echo "Colors reloaded from: $config_file"
        fi
    else
        echo "TDS module config not available" >&2
        return 1
    fi
}

# Show config file path
tsm_colors_path() {
    if declare -f tds_module_config_path >/dev/null 2>&1; then
        tds_module_config_path "tsm"
    else
        echo "$TSM_DIR/config/colors.conf"
    fi
}

# Reset colors to defaults
tsm_colors_reset() {
    # Restore defaults from includes.sh
    TSM_COLOR_TOKENS=(
        [status.error]="mode:0"
        [status.warning]="mode:1"
        [status.success]="mode:2"
        [status.info]="mode:3"
        [text.primary]="nouns:7"
        [text.secondary]="nouns:5"
        [text.tertiary]="nouns:3"
        [text.disabled]="nouns:2"
        [interactive.primary]="verbs:5"
        [interactive.secondary]="verbs:1"
        [interactive.destructive]="verbs:0"
        [interactive.constructive]="verbs:3"
        [interactive.accent]="verbs:4"
        [help.title]="env:1"
        [help.section]="verbs:5"
        [help.command]="verbs:4"
        [help.description]="nouns:3"
        [help.comment]="nouns:2"
        [list.header]="env:1"
        [list.selected]="verbs:4"
        [list.index]="nouns:3"
        [process.running]="mode:2"
        [process.stopped]="mode:0"
        [process.starting]="mode:1"
        [process.name]="verbs:4"
        [process.port]="env:1"
        [process.pid]="nouns:3"
        [doctor.log]="verbs:5"
        [doctor.warn]="mode:1"
        [doctor.error]="mode:0"
        [doctor.success]="mode:2"
        [doctor.info]="verbs:4"
        [repl.prompt]="verbs:3"
        [repl.input]="nouns:7"
        [repl.output]="nouns:5"
        [repl.error]="mode:0"
        [repl.hint]="nouns:3"
    )

    # Save to config
    if declare -f tds_module_save >/dev/null 2>&1; then
        local config_file=$(tds_module_save "tsm")
        echo "Colors reset to defaults"
        echo "Saved to: $config_file"
    else
        echo "Colors reset to defaults (in-memory only)"
    fi
}

# Show palette colors
tsm_colors_palette() {
    local palette="${1:-all}"

    if [[ "$palette" == "all" ]]; then
        for p in env mode verbs nouns; do
            _tsm_show_palette "$p"
        done
    else
        _tsm_show_palette "$palette"
    fi
}

_tsm_show_palette() {
    local palette="$1"
    local -n arr

    case "$palette" in
        env)   arr=ENV_PRIMARY; echo "ENV (environment/context):" ;;
        mode)  arr=MODE_PRIMARY; echo "MODE (status/state):" ;;
        verbs) arr=VERBS_PRIMARY; echo "VERBS (actions/rainbow):" ;;
        nouns) arr=NOUNS_PRIMARY; echo "NOUNS (content/grayscale):" ;;
        *)     echo "Unknown palette: $palette"; return 1 ;;
    esac

    printf "  "
    for i in {0..7}; do
        local hex="${arr[$i]:-888888}"
        hex="${hex#\#}"
        if declare -f text_color >/dev/null 2>&1; then
            text_color "$hex"
            bg_only "$hex"
            printf " %d " "$i"
            reset_color
        else
            printf "[%d]" "$i"
        fi
    done
    echo
    echo
}

# Help
tsm_colors_help() {
    cat <<EOF
TSM Colors - Color configuration management

Usage: tsm colors <command>

Commands:
  list           List all tokens with color preview (default)
  set <t> <v>    Set token to value (palette:index or hex)
  get <token>    Get token's current value and hex
  edit           Open config file in \$EDITOR
  path           Show config file path
  reset          Reset all colors to defaults
  palette [name] Show palette colors (env|mode|verbs|nouns|all)

Value formats:
  palette:index  Reference palette (e.g., verbs:5, mode:2, env:1)
  RRGGBB         Direct hex color (e.g., FF5500, without #)

Examples:
  tsm colors list                  # Preview all colors
  tsm colors set list.header env:0 # Change header color
  tsm colors get process.running   # Check running status color
  tsm colors palette verbs         # Show VERBS rainbow palette
  tsm colors edit                  # Edit config file
EOF
}

# Export functions
export -f tsm_color_get tsm_color_print tsm_color_println tsm_color_palette
export -f tsm_colors tsm_colors_list tsm_colors_set tsm_colors_get
export -f tsm_colors_edit tsm_colors_path tsm_colors_reset tsm_colors_palette
