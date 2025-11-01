#!/usr/bin/env bash

# TUI CSS Design Token System
# CSS-inspired hierarchical design tokens for consistent visual styling
# Single source of truth for all visual design decisions

declare -A TUI_CSS_TOKENS=(
    # === COLOR SYSTEM ===
    # Primary colors (palette references - resolved at runtime)
    [color.primary.palette]="MODE_PRIMARY"     # Primary color palette
    [color.primary.index]="0"                  # Index 0 in MODE_PRIMARY
    [color.secondary.palette]="ENV_PRIMARY"    # Secondary color palette
    [color.secondary.index]="0"               # Index 0 in ENV_PRIMARY
    [color.accent.palette]="NOUNS_PRIMARY"     # Accent color palette
    [color.accent.index]="0"                  # Index 0 in NOUNS_PRIMARY
    [color.success.palette]="ENV_PRIMARY"      # Success color palette
    [color.success.index]="1"                 # Index 1 in ENV_PRIMARY
    [color.warning.palette]="VERBS_PRIMARY"    # Warning color palette
    [color.warning.index]="3"                 # Index 3 in VERBS_PRIMARY
    [color.error.palette]="VERBS_PRIMARY"      # Error color palette
    [color.error.index]="0"                   # Index 0 in VERBS_PRIMARY
    [color.info.palette]="MODE_PRIMARY"        # Info color palette
    [color.info.index]="4"                    # Index 4 in MODE_PRIMARY

    # Text colors (static values for contrast)
    [color.text.primary]="FFFFFF"       # Primary text (white)
    [color.text.secondary]="AAAAAA"     # Secondary text (medium gray)
    [color.text.dim]="666666"           # Dimmed text (dark gray)
    [color.text.bright]="FFFFFF"        # Bright text (bright white)

    # Footer specific colors (palette references)
    [color.footer.status.palette]="MODE_PRIMARY"     # Status color palette
    [color.footer.status.index]="0"                  # Index 0 in MODE_PRIMARY
    [color.footer.text.palette]="MODE_PRIMARY"       # Text color palette
    [color.footer.text.index]="7"                    # Index 7 in MODE_PRIMARY
    [color.footer.background]="000000"  # Black background

    # Navigation colors
    [color.nav.selected]="1;33"         # Bold yellow for selected items
    [color.nav.available]="37"          # White for available items
    [color.nav.disabled]="240"          # Dark gray for disabled items

    # === TYPOGRAPHY ===
    # Font weights
    [font.weight.normal]="0"            # Normal weight
    [font.weight.bold]="1"              # Bold weight
    [font.weight.dim]="2"               # Dimmed weight

    # Text intensity levels
    [text.intensity.bright]="1"         # Bright text
    [text.intensity.normal]="0"         # Normal intensity
    [text.intensity.dim]="2"            # Dimmed text

    # Footer text settings
    [footer.text.dim.intensity]="2"     # Dim level for long text
    [footer.text.brightness]="50"       # Brightness percentage (0-100)

    # === LAYOUT & SPACING ===
    # Content layout
    [layout.content.indent]="4"         # Standard content indentation (spaces)
    [layout.separator.width]="60"       # Default separator line width
    [layout.action.line.min_width]="60" # Minimum width for action line

    # Footer layout
    [layout.footer.center.padding]="2"  # Padding for centered content
    [layout.footer.max.text.width]="60" # Max width before text wrapping
    [layout.footer.margin]="1"          # Margin around footer elements

    # UI element spacing
    [spacing.counter.margin]="1"        # Margin around counters and indicators
    [spacing.section.between]="1"       # Lines between sections
    [spacing.item.indent]="2"           # Indentation for list items

    # === VISUAL ELEMENTS ===
    # Separators
    [separator.char.default]="-"        # Default separator character
    [separator.char.emphasis]="="       # Emphasis separator character
    [separator.char.section]="-"        # Section separator character

    # Action formatting
    [action.sigil]="/"                  # Action prefix symbol
    [action.separator]=" "              # Space between sigil+verb and noun
    [action.arrow]=" → "                # Arrow for action results

    # List formatting
    [list.bullet]="• "                  # List item bullet
    [list.indent]="  "                  # List item indentation prefix

    # === COMPONENT STYLES ===
    # Header components
    [header.line.height]="4"            # Total header height in lines
    [header.section.prefix]="## "       # Section heading prefix

    # Content area
    [content.max.height]="20"           # Maximum content height (lines)
    [content.wrap.width]="78"           # Text wrapping width

    # Footer components
    [footer.line.height]="4"            # Total footer height in lines
    [footer.status.format]="center"     # Status text alignment
    [footer.details.format]="wrap"      # Details text formatting
)

# Get CSS token value with dot notation support
# Usage: get_css_token "color.footer.status"
get_css_token() {
    local token_path="$1"
    local default_value="${2:-}"

    local value="${TUI_CSS_TOKENS[$token_path]}"
    if [[ -n "$value" ]]; then
        echo "$value"
    elif [[ -n "$default_value" ]]; then
        echo "$default_value"
    else
        echo ""
    fi
}

# Set CSS token value (for runtime customization)
# Usage: set_css_token "color.primary" "34"
set_css_token() {
    local token_path="$1"
    local token_value="$2"
    TUI_CSS_TOKENS[$token_path]="$token_value"
}

# Resolve palette color to hex value
# Usage: resolve_palette_color "color.footer.status"
resolve_palette_color() {
    local token_base="$1"
    local palette_name="$(get_css_token "${token_base}.palette")"
    local palette_index="$(get_css_token "${token_base}.index")"

    # Check if this is a palette reference
    if [[ -n "$palette_name" && -n "$palette_index" ]]; then
        # Source color palettes if not already loaded
        if ! declare -p "$palette_name" >/dev/null 2>&1; then
            local script_dir="$(dirname "${BASH_SOURCE[0]}")/.."
            source "$script_dir/colors/color_palettes.sh" 2>/dev/null || return 1
        fi

        # Get the color value from the palette array
        local -n palette_ref="$palette_name"
        if [[ $palette_index -lt ${#palette_ref[@]} ]]; then
            echo "${palette_ref[$palette_index]}"
        else
            # Fallback to direct token value
            get_css_token "$token_base"
        fi
    else
        # Not a palette reference, get direct value
        get_css_token "$token_base"
    fi
}

# Get color code with ANSI escape sequence
# Usage: get_css_color "color.footer.status"
get_css_color() {
    local token_path="$1"
    local color_hex="$(resolve_palette_color "$token_path")"

    if [[ -n "$color_hex" ]]; then
        local color_256=$(hex_to_256 "$color_hex")
        printf "\033[38;5;%sm" "$color_256"
    fi
}

# Reset color
reset_css_color() {
    printf "\033[0m"
}

# Apply CSS token styling with automatic reset
# Usage: apply_css_style "color.footer.status" "Status text"
apply_css_style() {
    local token_path="$1"
    local content="$2"

    get_css_color "$token_path"
    printf "%s" "$content"
    reset_css_color
}

# Get layout value as integer
# Usage: get_css_layout "layout.content.indent"
get_css_layout() {
    local token_path="$1"
    local default_value="${2:-0}"
    local value="$(get_css_token "$token_path" "$default_value")"
    echo "$value"
}

# Debug: Show all CSS tokens
show_css_tokens() {
    echo "TUI CSS Design Tokens:"
    echo "====================="

    local categories=("color" "font" "text" "footer" "layout" "spacing" "separator" "action" "list" "header" "content")

    for category in "${categories[@]}"; do
        echo
        echo "=== ${category^^} ==="
        for token in "${!TUI_CSS_TOKENS[@]}"; do
            if [[ "$token" == "$category"* ]]; then
                printf "  %-30s = '%s'\n" "$token" "${TUI_CSS_TOKENS[$token]}"
            fi
        done
    done
}

# Initialize CSS token system
init_css_tokens() {
    # CSS design token system loaded
    return 0
}

# Auto-initialize
init_css_tokens