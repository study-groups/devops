#!/usr/bin/env bash

# Typography Module - Visual Design Tokens and Layout Concerns
# Handles typography, spacing, alignment, and visual hierarchy
# Single responsibility: Visual presentation configuration and utilities

# Source CSS design tokens
SCRIPT_DIR="$(dirname "${BASH_SOURCE[0]}")"
source "$SCRIPT_DIR/tokens/tui.css.sh"

# Source color system for hex color conversion
source "$SCRIPT_DIR/colors/color_core.sh" 2>/dev/null || {
    # Fallback hex_to_256 function if color_core.sh not available
    hex_to_256() {
        local hex="$1"
        local r g b
        # Simple hex to RGB conversion
        r=$((0x${hex:0:2}))
        g=$((0x${hex:2:2}))
        b=$((0x${hex:4:2}))

        # Convert to closest 256-color palette approximation
        if (( r == g && g == b )); then
            # Grayscale
            local gray=$(( r * 23 / 255 + 232 ))
            echo "$gray"
        else
            # Color cube approximation
            local r6=$(( r * 5 / 255 ))
            local g6=$(( g * 5 / 255 ))
            local b6=$(( b * 5 / 255 ))
            echo $(( 16 + 36*r6 + 6*g6 + b6 ))
        fi
    }
}

# Typography Design Tokens
declare -A TYPOGRAPHY_TOKENS=(
    # Action Presentation
    [ACTION_SIGIL]=""               # Configurable action prefix symbol (sigil)
    [ACTION_SEPARATOR]=" × "         # Multiplication symbol between verb and noun
    [ACTION_ARROW]=" → "            # Arrow for action results

    # Typography Hierarchy
    [HEADING_PREFIX]="## "          # Section heading prefix
    [ITEM_BULLET]="• "             # List item bullet
    [ITEM_PREFIX]="  "             # List item indentation

    # Text Brightness Control
    [PARAGRAPH_BRIGHTNESS]="50"     # Paragraph text brightness (0-100, 50% less bright)

    # Spacing and Layout
    [CONTENT_INDENT]="    "         # Standard content indentation (4 spaces)
    [SECTION_SPACING]=""            # Empty line between sections
    [LIST_SPACING]=""               # Empty line between list groups

    # Visual Separators (delegate to separators.sh for generation)
    [SEPARATOR_CHAR]="-"            # Default separator character
    [EMPHASIS_CHAR]="="             # Emphasis separator character
)

# Get typography token value
get_typography_token() {
    local token_name="$1"
    echo "${TYPOGRAPHY_TOKENS[$token_name]}"
}

# Set typography token value (for runtime customization)
set_typography_token() {
    local token_name="$1"
    local token_value="$2"
    TYPOGRAPHY_TOKENS[$token_name]="$token_value"
}

# Render action sigil with semantic meaning
# Usage: render_action_sigil "show"
render_action_sigil() {
    local verb="$1"
    local sigil="${TYPOGRAPHY_TOKENS[ACTION_SIGIL]}"

    # Return sigil + verb as unified visual unit (colors applied by caller)
    printf "%s%s" "$sigil" "$verb"
}

# Render action separator
render_action_separator() {
    printf "%s" "${TYPOGRAPHY_TOKENS[ACTION_SEPARATOR]}"
}

# Render action arrow (for result indication)
render_action_arrow() {
    printf "%s" "${TYPOGRAPHY_TOKENS[ACTION_ARROW]}"
}

# Typography utilities for consistent formatting

# Render section heading
render_section_heading() {
    local heading_text="$1"
    printf "%s%s\n" "${TYPOGRAPHY_TOKENS[HEADING_PREFIX]}" "$heading_text"
}

# Render list item with consistent indentation
render_list_item() {
    local item_text="$1"
    printf "%s%s%s\n" "${TYPOGRAPHY_TOKENS[ITEM_PREFIX]}" "${TYPOGRAPHY_TOKENS[ITEM_BULLET]}" "$item_text"
}

# Apply content indentation
apply_content_indent() {
    local content="$1"
    printf "%s%s" "${TYPOGRAPHY_TOKENS[CONTENT_INDENT]}" "$content"
}

# Apply paragraph brightness dimming based on design token
# Usage: apply_paragraph_brightness "text content"
apply_paragraph_brightness() {
    local content="$1"
    local brightness="${TYPOGRAPHY_TOKENS[PARAGRAPH_BRIGHTNESS]}"

    # Convert brightness percentage to ANSI dimming
    # 50% brightness = dim text (\033[2m)
    if [[ "$brightness" -le 50 ]]; then
        printf "\033[2m%s\033[0m" "$content"
    else
        printf "%s" "$content"
    fi
}

# Format paragraph text with brightness control
# Usage: format_paragraph_text "Topic:" "content text"
format_paragraph_text() {
    local topic="$1"
    local content="$2"

    printf "    %b " "$topic"  # Use %b to interpret escape sequences
    apply_paragraph_brightness "$content"
    printf "\n"
}

# Show typography configuration (debug utility)
show_typography_config() {
    echo "Typography Configuration:"
    for token in "${!TYPOGRAPHY_TOKENS[@]}"; do
        printf "  %s = '%s'\n" "$token" "${TYPOGRAPHY_TOKENS[$token]}"
    done
}

# Initialize typography module
init_typography_module() {
    # Typography module initialized with configurable tokens
    # No output - silent initialization
    return 0
}

# === FOOTER FORMATTING FUNCTIONS ===

# Format footer status text with proper styling and centering
# Usage: format_footer_status "Status message"
format_footer_status() {
    local status_text="$1"
    local term_width=${COLUMNS:-80}
    local status_color_hex="$(resolve_palette_color 'color.footer.status')"
    local status_color_256=$(hex_to_256 "$status_color_hex")

    # Calculate padding for centering
    local padding="$(get_css_layout 'layout.footer.center.padding')"
    local text_padding=$(( (term_width - ${#status_text} - padding*2) / 2 ))
    [[ $text_padding -lt 0 ]] && text_padding=0

    # Apply color and center the text
    printf "%*s\033[38;5;%sm%s\033[0m%*s" $text_padding "" "$status_color_256" "$status_text" $text_padding ""
}

# Format footer descriptive text with dimming and wrapping
# Usage: format_footer_text "Descriptive text that may be longer"
format_footer_text() {
    local text="$1"
    local max_width="$(get_css_layout 'layout.footer.max.text.width')"
    local text_color_hex="$(resolve_palette_color 'color.footer.text')"
    local text_color_256=$(hex_to_256 "$text_color_hex")
    local dim_intensity="$(get_css_token 'footer.text.dim.intensity')"

    # Apply dimming and color
    if [[ ${#text} -gt $max_width ]]; then
        # Wrap long text (simple word break)
        local wrapped_text="${text:0:$max_width}..."
        printf "\033[%s;38;5;%sm%s\033[0m" "$dim_intensity" "$text_color_256" "$wrapped_text"
    else
        printf "\033[%s;38;5;%sm%s\033[0m" "$dim_intensity" "$text_color_256" "$text"
    fi
}

# Combine status and details text with proper formatting
# Usage: format_footer_combined "Status" "Details text"
format_footer_combined() {
    local status="$1"
    local details="$2"
    local term_width=${COLUMNS:-80}

    # Format status (centered)
    local formatted_status="$(format_footer_status "$status")"

    # If details provided, show on next line
    if [[ -n "$details" ]]; then
        local formatted_details="$(format_footer_text "$details")"
        local details_padding=$(( (term_width - ${#details}) / 2 ))
        [[ $details_padding -lt 0 ]] && details_padding=0

        printf "%s\n%*s%s" "$formatted_status" $details_padding "" "$formatted_details"
    else
        printf "%s" "$formatted_status"
    fi
}

# Format footer with CSS token-based styling (main interface)
# Usage: format_footer "Status" ["Details"]
format_footer() {
    local status="$1"
    local details="${2:-}"

    if [[ -n "$details" ]]; then
        format_footer_combined "$status" "$details"
    else
        format_footer_status "$status"
    fi
}

# === DISPLAY MODE FORMATTING ===

# Format display mode indicator for footer
# Usage: format_display_mode_indicator "actionList"
format_display_mode_indicator() {
    local mode="$1"
    local display_name=""

    case "$mode" in
        "actionList") display_name="Action List" ;;
        "actionDetails") display_name="Action Details" ;;
        "") display_name="Default" ;;
        *) display_name="$mode" ;;
    esac

    format_footer_status "Display Mode: $display_name"
}

# Call initialization
init_typography_module