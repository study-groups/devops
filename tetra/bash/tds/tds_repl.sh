#!/usr/bin/env bash
# TDS REPL - Interactive Tetra Design System Explorer
# Provides interactive access to themes, palettes, tokens, and colors

# Source dependencies
if ! declare -f repl_run >/dev/null; then
    source "$TETRA_SRC/bash/repl/repl.sh"
fi

# Source TDS if not already loaded
if ! declare -f tds_switch_theme >/dev/null; then
    TDS_SRC="${TDS_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
    source "$TDS_SRC/tds.sh"
fi

# REPL configuration
REPL_HISTORY_BASE="${TETRA_DIR}/tds/repl/history"
REPL_MODULE_NAME="tds"

# ============================================================================
# COMMAND HANDLERS
# ============================================================================

# Theme management
tds_repl_show_themes() {
    echo
    tds_text_color "content.heading.h2"
    echo "═══ Available Themes ═══"
    reset_color
    echo

    local current=$(tds_active_theme)

    # Get themes from registry directly
    for theme in "${!TDS_THEME_REGISTRY[@]}"; do
        if [[ "$theme" == "$current" ]]; then
            tds_text_color "marker.active"
            echo -n "● "
            reset_color
            tds_text_color "content.emphasis"
            echo "$theme (active)"
            reset_color
        else
            tds_text_color "content.dim"
            echo -n "○ "
            reset_color
            echo "$theme"
        fi
    done | sort
    echo
}

tds_repl_switch_theme() {
    local theme="$1"

    if [[ -z "$theme" ]]; then
        echo "Usage: switch:theme-name"
        echo "Example: switch:tokyo-night"
        return 1
    fi

    if tds_switch_theme "$theme"; then
        tds_text_color "status.success"
        echo "✓ Switched to theme: $theme"
        reset_color
    else
        tds_text_color "status.error"
        echo "✗ Failed to switch to theme: $theme"
        reset_color
        return 1
    fi
}

tds_repl_preview_themes() {
    echo
    tds_text_color "content.heading.h2"
    echo "═══ Theme Preview ═══"
    reset_color

    tds_preview_themes
}

tds_repl_theme_info() {
    local theme="${1:-$(tds_active_theme)}"

    echo
    tds_text_color "content.heading.h2"
    echo "═══ Theme: $theme ═══"
    reset_color
    echo

    # Show palette visualization
    if [[ -f "$TDS_SRC/tools/show_palette.sh" ]]; then
        bash "$TDS_SRC/tools/show_palette.sh" "$theme"
    else
        echo "Palette visualization tool not found"
    fi
}

# Palette inspection
tds_repl_show_palettes() {
    local theme="${1:-$(tds_active_theme)}"

    echo
    tds_text_color "content.heading.h2"
    echo "═══ Color Palettes: $theme ═══"
    reset_color
    echo

    # Show all palettes with swatches
    for palette_name in ENV_PRIMARY MODE_PRIMARY VERBS_PRIMARY NOUNS_PRIMARY; do
        tds_text_color "content.heading.h3"
        echo "── $palette_name ──"
        reset_color

        if declare -p "$palette_name" >/dev/null 2>&1; then
            local -n palette="$palette_name"
            for i in "${!palette[@]}"; do
                local hex="${palette[$i]}"
                printf "[%d] " "$i"

                # Show color swatch
                text_color "$hex"
                bg_only "$hex"
                printf "   "
                reset_color

                printf " %s\n" "$hex"
            done
        else
            tds_text_color "content.dim"
            echo "  (not defined)"
            reset_color
        fi
        echo
    done
}

tds_repl_show_palette() {
    local palette_name="${1^^}"  # Convert to uppercase

    if [[ -z "$palette_name" ]]; then
        echo "Usage: palette:name"
        echo "Available: env, mode, verbs, nouns"
        return 1
    fi

    # Map friendly names to full names
    case "$palette_name" in
        ENV) palette_name="ENV_PRIMARY" ;;
        MODE) palette_name="MODE_PRIMARY" ;;
        VERBS) palette_name="VERBS_PRIMARY" ;;
        NOUNS) palette_name="NOUNS_PRIMARY" ;;
        *_PRIMARY) ;; # Already full name
        *)
            echo "Unknown palette: $palette_name"
            echo "Available: env, mode, verbs, nouns"
            return 1
            ;;
    esac

    echo
    tds_text_color "content.heading.h3"
    echo "═══ $palette_name ═══"
    reset_color
    echo

    if declare -p "$palette_name" >/dev/null 2>&1; then
        local -n palette="$palette_name"
        for i in "${!palette[@]}"; do
            local hex="${palette[$i]}"
            printf "[%d] " "$i"

            # Show color swatch
            text_color "$hex"
            bg_only "$hex"
            printf "   "
            reset_color

            printf " %s\n" "$hex"
        done
    else
        tds_text_color "status.error"
        echo "Palette not defined: $palette_name"
        reset_color
        return 1
    fi
    echo
}

# Token exploration
tds_repl_list_tokens() {
    echo
    tds_text_color "content.heading.h2"
    echo "═══ Color Tokens ═══"
    reset_color
    echo

    if [[ ${#TDS_COLOR_TOKENS[@]} -eq 0 ]]; then
        tds_text_color "content.dim"
        echo "No tokens defined"
        reset_color
        return
    fi

    # Group tokens by category
    local categories=()
    for token in "${!TDS_COLOR_TOKENS[@]}"; do
        local category="${token%%.*}"
        if [[ ! " ${categories[*]} " =~ " ${category} " ]]; then
            categories+=("$category")
        fi
    done

    # Sort categories
    IFS=$'\n' categories=($(sort <<<"${categories[*]}"))
    unset IFS

    for category in "${categories[@]}"; do
        tds_text_color "content.heading.h3"
        echo "── $category ──"
        reset_color

        for token in $(printf '%s\n' "${!TDS_COLOR_TOKENS[@]}" | grep "^${category}\." | sort); do
            local ref="${TDS_COLOR_TOKENS[$token]}"
            printf "  %-30s → %s\n" "$token" "$ref"
        done
        echo
    done
}

tds_repl_resolve_token() {
    local token="$1"

    if [[ -z "$token" ]]; then
        echo "Usage: resolve:token-name"
        echo "Example: resolve:content.heading.h1"
        return 1
    fi

    echo
    tds_text_color "content.heading.h3"
    echo "═══ Token Resolution: $token ═══"
    reset_color
    echo

    # Show token → palette reference
    if [[ -n "${TDS_COLOR_TOKENS[$token]}" ]]; then
        local ref="${TDS_COLOR_TOKENS[$token]}"
        echo "Token:     $token"
        echo "Maps to:   $ref"

        # Resolve to hex
        local hex=$(tds_resolve_color "$token")
        if [[ -n "$hex" ]]; then
            echo -n "Hex value: "
            text_color "$hex"
            bg_only "$hex"
            printf "   "
            reset_color
            echo " $hex"
        fi
    else
        tds_text_color "status.error"
        echo "Token not found: $token"
        reset_color

        echo
        echo "Use 'list:tokens' to see available tokens"
        return 1
    fi
    echo
}

tds_repl_validate_tokens() {
    echo
    tds_text_color "content.heading.h2"
    echo "═══ Token Validation ═══"
    reset_color
    echo

    if declare -f tds_show_token_validation >/dev/null; then
        tds_show_token_validation
    else
        tds_text_color "status.warning"
        echo "Token validation not available"
        echo "Source: $TDS_SRC/core/token_validation.sh"
        reset_color
    fi
}

# Color tools
tds_repl_show_hex() {
    local hex="$1"

    if [[ -z "$hex" ]]; then
        echo "Usage: hex:#RRGGBB"
        echo "Example: hex:#3b82f6"
        return 1
    fi

    # Strip # if present
    hex="${hex#\#}"

    # Validate hex format
    if ! [[ "$hex" =~ ^[0-9a-fA-F]{6}$ ]]; then
        tds_text_color "status.error"
        echo "Invalid hex color: #$hex"
        reset_color
        echo "Format: #RRGGBB (e.g., #FF0044)"
        return 1
    fi

    echo
    tds_text_color "content.heading.h3"
    echo "═══ Color Swatch ═══"
    reset_color
    echo

    # Large swatch
    text_color "#$hex"
    bg_only "#$hex"
    printf "                    \n"
    printf "   #%-14s \n" "$hex"
    printf "                    \n"
    reset_color

    # RGB values
    local r=$((16#${hex:0:2}))
    local g=$((16#${hex:2:2}))
    local b=$((16#${hex:4:2}))

    echo
    echo "RGB: ($r, $g, $b)"
    echo
}

tds_repl_test_semantic() {
    local semantic="${1:-all}"

    echo
    tds_text_color "content.heading.h2"
    echo "═══ Semantic Colors ═══"
    reset_color
    echo

    if [[ "$semantic" == "all" ]]; then
        # Show all semantic colors
        for key in "${!TDS_SEMANTIC_COLORS[@]}"; do
            printf "%-20s " "$key:"
            tds_color "$key" "Sample text"
            echo
        done
    else
        # Show specific semantic
        if [[ -n "${TDS_SEMANTIC_COLORS[$semantic]}" ]]; then
            tds_color "$semantic" "Sample text in $semantic color"
            echo
        else
            tds_text_color "status.error"
            echo "Unknown semantic: $semantic"
            reset_color
            echo "Available: ${!TDS_SEMANTIC_COLORS[*]}"
            return 1
        fi
    fi
    echo
}

# Temperature themes
tds_repl_show_temperatures() {
    echo
    tds_text_color "content.heading.h2"
    echo "═══ Temperature Themes ═══"
    reset_color
    echo

    local temps=("warm" "cool" "neutral" "electric")
    local current=$(tds_active_theme)

    for temp in "${temps[@]}"; do
        if [[ "$temp" == "$current" ]]; then
            tds_text_color "marker.active"
            echo -n "● "
        else
            tds_text_color "content.dim"
            echo -n "○ "
        fi
        reset_color

        printf "%-10s - " "$temp"

        case "$temp" in
            warm) echo "🟠 Amber/Orange (org module)" ;;
            cool) echo "🔵 Blue/Cyan (logs module)" ;;
            neutral) echo "🟢 Green/Gray (tsm module)" ;;
            electric) echo "🟣 Purple/Magenta (deploy module)" ;;
        esac
    done
    echo
}

tds_repl_temp_preview() {
    local temp="$1"

    if [[ -z "$temp" ]]; then
        echo "Usage: temp:warm|cool|neutral|electric"
        return 1
    fi

    if [[ ! " warm cool neutral electric " =~ " $temp " ]]; then
        tds_text_color "status.error"
        echo "Invalid temperature: $temp"
        reset_color
        echo "Available: warm, cool, neutral, electric"
        return 1
    fi

    tds_repl_theme_info "$temp"
}

# Help
tds_repl_help() {
    # Just delegate to main help
    _tds_cmd_help
}

# ============================================================================
# TAB COMPLETION
# ============================================================================

# Generate completion words based on current input context
_tds_repl_generate_completions() {
    local input="${REPL_INPUT:-}"
    local cursor="${REPL_CURSOR_POS:-0}"

    # Parse: count words to determine context
    local -a words
    read -ra words <<< "$input"
    local word_count=${#words[@]}

    # Check if input ends with space (ready for next word)
    local ends_with_space=false
    [[ "$input" =~ [[:space:]]$ ]] && ends_with_space=true

    # Determine completion context
    local completing_word=1  # Which word are we completing? (1=verb, 2=noun, 3+=args)
    if [[ $word_count -eq 0 ]]; then
        completing_word=1
    elif [[ "$ends_with_space" == true ]]; then
        completing_word=$((word_count + 1))
    else
        completing_word=$word_count
    fi

    local verb="${words[0]:-}"
    local noun="${words[1]:-}"

    # Set up hints helper
    _tds_hint() {
        command -v repl_set_completion_hint >/dev/null 2>&1 && repl_set_completion_hint "$1" "$2"
    }

    case $completing_word in
        1)
            # Complete verbs (operations)
            _tds_hint "get" "Read/inspect a property"
            _tds_hint "set" "Modify a property"
            _tds_hint "validate" "Check correctness"
            _tds_hint "create" "Create new theme"
            _tds_hint "delete" "Remove theme"
            _tds_hint "copy" "Duplicate theme"
            _tds_hint "edit" "Open in editor"
            _tds_hint "path" "Show file path"
            _tds_hint "help" "Show help"

            echo "get"
            echo "set"
            echo "validate"
            echo "create"
            echo "delete"
            echo "copy"
            echo "edit"
            echo "path"
            echo "help"
            ;;

        2)
            # Complete nouns based on verb
            case "$verb" in
                get)
                    _tds_hint "theme" "Active theme + palette preview"
                    _tds_hint "themes" "List all themes"
                    _tds_hint "palette" "Color palette (env/mode/verbs/nouns)"
                    _tds_hint "palettes" "List palette names"
                    _tds_hint "token" "Resolve single token"
                    _tds_hint "tokens" "List all tokens"
                    _tds_hint "hex" "Color swatch"
                    echo "theme"
                    echo "themes"
                    echo "palette"
                    echo "palettes"
                    echo "token"
                    echo "tokens"
                    echo "hex"
                    ;;
                set)
                    _tds_hint "theme" "Switch to theme"
                    echo "theme"
                    ;;
                validate)
                    _tds_hint "theme" "Check theme loads"
                    _tds_hint "tokens" "Check token mappings"
                    echo "theme"
                    echo "tokens"
                    ;;
                create|delete|edit|path)
                    _tds_hint "theme" "Theme file"
                    echo "theme"
                    ;;
                copy)
                    _tds_hint "theme" "Copy theme"
                    echo "theme"
                    ;;
            esac
            ;;

        3)
            # Complete args based on verb+noun
            case "$verb $noun" in
                "set theme"|"validate theme"|"delete theme"|"edit theme"|"path theme")
                    # Complete with theme names
                    for theme in "${!TDS_THEME_REGISTRY[@]}"; do
                        echo "$theme"
                    done | sort
                    ;;
                "get palette")
                    _tds_hint "env" "Environment colors"
                    _tds_hint "mode" "Mode indicators"
                    _tds_hint "verbs" "Action colors"
                    _tds_hint "nouns" "Entity colors"
                    echo "env"
                    echo "mode"
                    echo "verbs"
                    echo "nouns"
                    ;;
                "copy theme")
                    # Source theme
                    for theme in "${!TDS_THEME_REGISTRY[@]}"; do
                        echo "$theme"
                    done | sort
                    ;;
                "get theme")
                    # Optional -v flag or theme name
                    _tds_hint "-v" "Verbose output"
                    echo "-v"
                    for theme in "${!TDS_THEME_REGISTRY[@]}"; do
                        echo "$theme"
                    done | sort
                    ;;
            esac
            ;;

        4)
            # Fourth word - only for copy theme <src> <dst>
            case "$verb $noun" in
                "copy theme")
                    # Destination - no completion (user types new name)
                    ;;
            esac
            ;;
    esac
}

# ============================================================================
# REPL INPUT PROCESSING
# ============================================================================

_tds_repl_process_input() {
    local input="$1"

    # Strip ANSI escape codes that might have leaked into input
    input=$(echo -n "$input" | sed $'s/\033\\[[0-9;?]*[A-Za-z]//g')

    # Trim whitespace
    input="${input#"${input%%[![:space:]]*}"}"
    input="${input%"${input##*[![:space:]]}"}"

    # Handle exit
    case "$input" in
        exit|quit|q) return 1 ;;
        "") return 0 ;;  # Empty input
    esac

    # Handle REPL-specific commands
    case "$input" in
        self)
            if command -v repl_meta_show >/dev/null 2>&1; then
                repl_meta_show
            else
                echo "REPL metadata not available"
            fi
            return 0
            ;;
    esac

    # Delegate to main tds command (same verb-noun syntax)
    # shellcheck disable=SC2086
    tds $input

    return 0
}

# ============================================================================
# REPL PROMPT
# ============================================================================

_tds_repl_build_prompt() {
    local theme=$(tds_active_theme)

    # Build prompt with colors in a temporary file
    # (avoids issues with command substitution and color functions)
    local tmpfile=$(mktemp)

    # Use marker from TDS theme
    tds_text_color "marker.primary" >> "$tmpfile"
    printf "◉ " >> "$tmpfile"
    reset_color >> "$tmpfile"

    # Theme name
    tds_text_color "content.dim" >> "$tmpfile"
    printf "[%s] " "$theme" >> "$tmpfile"
    reset_color >> "$tmpfile"

    # Prompt
    tds_text_color "repl.prompt" >> "$tmpfile"
    printf "tds> " >> "$tmpfile"
    reset_color >> "$tmpfile"

    # Read the colored prompt from file
    REPL_PROMPT=$(<"$tmpfile")
    rm -f "$tmpfile"

    # Always keep TCURSES_READLINE_PROMPT in sync
    TCURSES_READLINE_PROMPT="$REPL_PROMPT"
}

# ============================================================================
# LIVE PREVIEW HOOK
# ============================================================================

# Preview hook for completion menu - applies theme temporarily when navigating
_tds_completion_preview() {
    local match="$1"
    local verb="$2"

    # Check if match looks like a theme name (exists in registry)
    # This avoids complex input parsing - if we're completing a valid theme, show preview
    if [[ -n "${TDS_THEME_REGISTRY[$match]+x}" ]]; then
        # Try to switch theme silently (suppress ALL output)
        if TDS_QUIET_LOAD=1 tds_switch_theme "$match" >/dev/null 2>&1; then
            # Generate color swatch preview for status line
            local preview=""

            # Sample colors from different palettes for variety
            # ENV (green family), MODE (blue family), VERBS (action), NOUNS (entity)
            local hex0="${ENV_PRIMARY[0]:-}"
            local hex1="${MODE_PRIMARY[0]:-}"
            local hex2="${VERBS_PRIMARY[0]:-}"
            local hex3="${NOUNS_PRIMARY[0]:-}"

            # Build color swatches using shared utility
            for hex in "$hex0" "$hex1" "$hex2" "$hex3"; do
                if [[ -n "$hex" && ${#hex} -eq 7 && "$hex" == "#"* ]]; then
                    preview+=$(tds_color_swatch "$hex")
                else
                    preview+="$(tput setaf 8)██$(tput sgr0)"
                fi
            done

            REPL_COMPLETION_PREVIEW_TEXT="${preview}"
        fi
    fi
}

# ============================================================================
# MAIN ENTRY POINT
# ============================================================================

tds_repl() {
    # Save original theme to restore on exit
    local original_theme=$(tds_active_theme)

    # Set execution mode
    REPL_EXECUTION_MODE="takeover"

    # Initialize REPL metadata
    if command -v repl_meta_init >/dev/null 2>&1; then
        repl_meta_init "TDS REPL" "tds" "Tetra Design System - Interactive color and theme explorer"
        repl_meta_set "completion_position" "above"
        repl_meta_set "completion_style" "menu"
        repl_meta_set "namespace" "tds"
    fi

    # Override callbacks
    eval 'repl_build_prompt() { _tds_repl_build_prompt "$@"; }'
    eval 'repl_process_input() { _tds_repl_process_input "$@"; }'
    export -f repl_build_prompt repl_process_input

    # Register tab completion generator
    if command -v repl_set_completion_generator >/dev/null 2>&1; then
        repl_set_completion_generator "_tds_repl_generate_completions"
    fi

    # Register preview hook for live theme preview
    REPL_COMPLETION_PREVIEW_HOOK="_tds_completion_preview"
    export REPL_COMPLETION_PREVIEW_HOOK

    # Show welcome message
    echo
    tds_text_color "content.heading.h1"
    echo "═══ TDS REPL - Tetra Design System ═══"
    reset_color
    echo
    tds_text_color "content.dim"
    echo "Interactive color, theme, and token explorer"
    echo "Type 'help' for available commands"
    reset_color
    echo

    # Run REPL
    repl_run

    # Clean up - restore original theme if user cancelled
    # (If they selected a theme, it's already applied)
}

# Export functions
export -f _tds_repl_generate_completions
export -f _tds_completion_preview
export -f tds_repl
