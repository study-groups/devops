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
    local dim_color
    dim_color=$(tds_text_color "content.dim" | cat)
    local reset
    reset=$(reset_color | cat)
    local heading
    heading=$(tds_text_color "content.heading.h2" | cat)

    cat <<EOF

${heading}TDS${reset} - Tetra Design System

${heading}CATEGORIES${reset}
  Themes      show switch temp info
  Palettes    palette show
  Tokens      list resolve
  Colors      hex semantic

${dim_color}Try:${reset} switch warm → palette mode → switch cool → palette mode
${dim_color}Tip:${reset} Use 'action noun' or 'action:noun'

EOF
}

# ============================================================================
# TAB COMPLETION
# ============================================================================

# Generate completion words based on current input context
_tds_repl_generate_completions() {
    # Get current input and cursor position from global state
    local input="${REPL_INPUT:-}"
    local cursor="${REPL_CURSOR_POS:-0}"

    # Debug logging if enabled
    if [[ "${TDS_COMPLETION_DEBUG:-0}" == "1" ]]; then
        echo "[TDS_COMPLETION] input='$input' cursor=$cursor" >&2
    fi

    # Parse input to determine context
    local verb noun
    if [[ "$input" =~ ^([a-z]+):(.*)$ ]]; then
        # Colon format: verb:noun
        verb="${BASH_REMATCH[1]}"
        noun="${BASH_REMATCH[2]}"
    elif [[ "$input" =~ ^([a-z]+)[[:space:]]+(.*)$ ]]; then
        # Space format: verb noun (partial)
        verb="${BASH_REMATCH[1]}"
        noun="${BASH_REMATCH[2]}"
    elif [[ "$input" =~ ^([a-z]+)$ ]]; then
        # Just verb, no space yet
        verb="$input"
        noun=""
    else
        verb=""
        noun=""
    fi

    if [[ "${TDS_COMPLETION_DEBUG:-0}" == "1" ]]; then
        echo "[TDS_COMPLETION] verb='$verb' noun='$noun'" >&2
    fi

    # If we have a verb, complete the noun
    if [[ -n "$verb" && " $input " =~ " " ]]; then
        case "$verb" in
            palette)
                # Complete palette names with hints and categories
                if command -v repl_set_completion_hint >/dev/null 2>&1; then
                    repl_set_completion_hint "env" "Palette • Environment colors (states, contexts)"
                    repl_set_completion_hint "mode" "Palette • Mode indicators and UI states"
                    repl_set_completion_hint "verbs" "Palette • Action and verb colors"
                    repl_set_completion_hint "nouns" "Palette • Entity and noun colors"
                fi
                if command -v repl_set_completion_category >/dev/null 2>&1; then
                    repl_set_completion_category "env" "Palette"
                    repl_set_completion_category "mode" "Palette"
                    repl_set_completion_category "verbs" "Palette"
                    repl_set_completion_category "nouns" "Palette"
                fi
                echo "env"
                echo "mode"
                echo "verbs"
                echo "nouns"
                ;;
            switch|info)
                # Complete theme names
                for theme in "${!TDS_THEME_REGISTRY[@]}"; do
                    echo "$theme"
                done | sort
                ;;
            temp)
                # Complete temperature themes
                echo "warm"
                echo "cool"
                echo "neutral"
                echo "electric"
                ;;
            show)
                # Complete show targets
                echo "themes"
                echo "palettes"
                echo "temps"
                ;;
            list)
                # Complete list targets
                echo "tokens"
                ;;
            validate)
                # Complete validate targets
                echo "tokens"
                ;;
            preview)
                # Complete preview targets
                echo "themes"
                ;;
        esac
    else
        # Complete top-level commands (verbs)
        # Also set hints and categories for each command
        if command -v repl_set_completion_hint >/dev/null 2>&1; then
            repl_set_completion_hint "help" "TDS • Show available commands and usage"
            repl_set_completion_hint "show" "TDS • Display themes, palettes, or temps"
            repl_set_completion_hint "switch" "TDS • Switch to a different theme"
            repl_set_completion_hint "palette" "Palette • Show color palette (env/mode/verbs/nouns)"
            repl_set_completion_hint "list" "TDS • List all available tokens"
            repl_set_completion_hint "resolve" "TDS • Resolve token to hex value"
            repl_set_completion_hint "validate" "TDS • Validate token mappings"
            repl_set_completion_hint "hex" "TDS • Display hex color swatch"
            repl_set_completion_hint "semantic" "TDS • Test semantic color rendering"
            repl_set_completion_hint "temp" "TDS • Preview temperature theme"
            repl_set_completion_hint "info" "TDS • Show theme information"
            repl_set_completion_hint "preview" "TDS • Preview all themes"

            # Hidden command - always set hint but only echo when user types 'se'
            repl_set_completion_hint "self" "REPL • Introspection (hidden)"
        fi

        # Set categories for commands
        if command -v repl_set_completion_category >/dev/null 2>&1; then
            repl_set_completion_category "help" "TDS"
            repl_set_completion_category "show" "TDS"
            repl_set_completion_category "switch" "TDS"
            repl_set_completion_category "palette" "Palette"
            repl_set_completion_category "list" "TDS"
            repl_set_completion_category "resolve" "TDS"
            repl_set_completion_category "validate" "TDS"
            repl_set_completion_category "hex" "TDS"
            repl_set_completion_category "semantic" "TDS"
            repl_set_completion_category "temp" "TDS"
            repl_set_completion_category "info" "TDS"
            repl_set_completion_category "preview" "TDS"
            repl_set_completion_category "self" "REPL"
        fi

        echo "help"
        echo "show"
        echo "switch"
        echo "palette"
        echo "list"
        echo "resolve"
        echo "validate"
        echo "hex"
        echo "semantic"
        echo "temp"
        echo "info"
        echo "preview"

        # Include 'self' only if user has typed 's' or 'se'
        # The completion system will filter based on prefix match
        if [[ "$verb" == s* ]] || [[ -z "$verb" ]]; then
            echo "self"
        fi
    fi
}

# ============================================================================
# REPL INPUT PROCESSING
# ============================================================================

_tds_repl_process_input() {
    local input="$1"

    # Strip ANSI escape codes that might have leaked into input
    # This removes sequences like \033[?25l (cursor visibility)
    # Use a more careful pattern to avoid removing actual text
    input=$(echo -n "$input" | sed $'s/\033\\[[0-9;?]*[A-Za-z]//g')

    # Trim leading and trailing whitespace
    input="${input#"${input%%[![:space:]]*}"}"  # trim leading
    input="${input%"${input##*[![:space:]]}"}"  # trim trailing

    # Debug: show exact input with visible spaces
    if [[ "${TDS_REPL_DEBUG:-0}" == "1" ]]; then
        echo "[DEBUG] input='$input' len=${#input}" >&2
        echo "[DEBUG] input_hex=$(echo -n "$input" | od -A n -t x1)" >&2
    fi

    # Handle exit
    case "$input" in
        exit|quit|q) return 1 ;;
    esac

    # Parse verb:noun or "verb noun" pattern
    local verb noun
    if [[ "$input" =~ ^([a-z]+):(.*)$ ]]; then
        # Colon format: verb:noun
        verb="${BASH_REMATCH[1]}"
        noun="${BASH_REMATCH[2]}"
        if [[ "${TDS_REPL_DEBUG:-0}" == "1" ]]; then
            echo "[PARSE] Matched colon format: verb='$verb' noun='$noun'" >&2
        fi
    elif [[ "$input" =~ ^([a-z]+)[[:space:]]+(.+)$ ]]; then
        # Space format: verb noun
        verb="${BASH_REMATCH[1]}"
        noun="${BASH_REMATCH[2]}"
        if [[ "${TDS_REPL_DEBUG:-0}" == "1" ]]; then
            echo "[PARSE] Matched space format: verb='$verb' noun='$noun'" >&2
        fi
    else
        # Single word command or unrecognized format
        verb=""
        noun=""
        if [[ "${TDS_REPL_DEBUG:-0}" == "1" ]]; then
            echo "[PARSE] No match! input='$input'" >&2
        fi
    fi

    # Process verb:noun commands
    if [[ -n "$verb" && -n "$noun" ]]; then

        case "$verb" in
            # Theme management
            show)
                case "$noun" in
                    themes) tds_repl_show_themes ;;
                    palettes) tds_repl_show_palettes ;;
                    temps) tds_repl_show_temperatures ;;
                    *) echo "Unknown show target: $noun" ;;
                esac
                ;;

            switch) tds_repl_switch_theme "$noun" ;;
            preview)
                case "$noun" in
                    themes) tds_repl_preview_themes ;;
                    *) echo "Unknown preview target: $noun" ;;
                esac
                ;;
            info) tds_repl_theme_info "$noun" ;;

            # Palettes
            palette) tds_repl_show_palette "$noun" ;;

            # Tokens
            list)
                case "$noun" in
                    tokens) tds_repl_list_tokens ;;
                    *) echo "Unknown list target: $noun" ;;
                esac
                ;;
            resolve) tds_repl_resolve_token "$noun" ;;
            validate)
                case "$noun" in
                    tokens) tds_repl_validate_tokens ;;
                    *) echo "Unknown validate target: $noun" ;;
                esac
                ;;

            # Colors
            hex) tds_repl_show_hex "$noun" ;;
            semantic) tds_repl_test_semantic "$noun" ;;

            # Temperature
            temp) tds_repl_temp_preview "$noun" ;;

            *)
                echo "Unknown command: $input"
                echo "Type 'help' for available commands"
                ;;
        esac
    else
        # Handle single-word commands
        case "$input" in
            help) tds_repl_help ;;
            self)
                if command -v repl_meta_show >/dev/null 2>&1; then
                    repl_meta_show
                else
                    echo "REPL metadata system not available"
                fi
                ;;
            "self edit"|"self:edit")
                if command -v repl_meta_edit >/dev/null 2>&1; then
                    repl_meta_edit
                else
                    echo "REPL metadata system not available"
                fi
                ;;
            "") ;; # Empty input, do nothing
            *)
                echo "Unknown command: $input"
                echo "Type 'help' for available commands"
                ;;
        esac
    fi

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
# MAIN ENTRY POINT
# ============================================================================

tds_repl() {
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
}

# Export functions
export -f _tds_repl_generate_completions
export -f tds_repl
