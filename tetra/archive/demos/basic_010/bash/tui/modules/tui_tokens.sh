#!/usr/bin/env bash

# TUI Semantic Design Tokens - Typography and Visual Effects
# These tokens control the visual presentation of Tetra terminology and UI elements

# Get dimmed text with configurable brightness
# Usage: dim_text "brightness_percentage" "text_content"
dim_text() {
    local brightness="${1:-50}"  # Default 50% less dim
    local content="$2"

    # Calculate dim intensity: 50% less dim means brighter
    local dim_level=2
    if [[ "$brightness" -gt 66 ]]; then
        dim_level=1  # Lightest dim
    elif [[ "$brightness" -lt 33 ]]; then
        dim_level=3  # Darkest dim - not implemented in most terminals
    fi

    printf "\033[%sm%s\033[0m" "$dim_level" "$content"
}

# Render Tetra terminology with bold and reduced dimming
# Usage: tetra_term "Environment" or tetra_term "@var"
tetra_term() {
    local term="$1"
    local brightness="${TUI_DESIGN_TOKENS[TETRA_TERM_BRIGHTNESS]:-50}"

    # Bold + less dim for Tetra terms
    printf "\033[1m"
    dim_text "$brightness" "$term"
}

# Render description text with standard dimming
# Usage: description_text "explanatory text here"
description_text() {
    local content="$1"
    local dim_intensity="${TUI_DESIGN_TOKENS[TEXT_DIM_INTENSITY]:-2}"

    printf "\033[%sm%s\033[0m" "$dim_intensity" "$content"
}

# Render indented content with design token spacing
# Usage: indent_content "content here"
indent_content() {
    local content="$1"
    local indent="${TUI_DESIGN_TOKENS[CONTENT_INDENT]:-4}"

    printf "%*s%s" "$indent" "" "$content"
}