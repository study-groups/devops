#!/usr/bin/env bash

# Typography Module for Demo 013 - Simplified
# Handles typography, spacing, and visual hierarchy

# Typography Design Tokens
declare -A TYPOGRAPHY_TOKENS=(
    # Action Presentation
    [ACTION_SIGIL]=""               # Configurable action prefix symbol (sigil)
    [ACTION_SEPARATOR]=" × "         # Multiplication symbol between verb and noun
    [ACTION_ARROW]=" → "            # Arrow for action results
    [EMPTY_SYMBOL]="∅"              # Symbol for @[] (no input/output)

    # Typography Hierarchy
    [HEADING_PREFIX]="## "          # Section heading prefix
    [ITEM_BULLET]="• "             # List item bullet
    [ITEM_PREFIX]="  "             # List item indentation

    # Spacing and Layout
    [CONTENT_INDENT]="    "         # Standard content indentation (4 spaces)
    [SECTION_SPACING]=""            # Empty line between sections
    [LIST_SPACING]=""               # Empty line between list groups

    # Visual Separators
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

# Render empty symbol for @[]
render_empty_symbol() {
    printf "%s" "${TYPOGRAPHY_TOKENS[EMPTY_SYMBOL]}"
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
