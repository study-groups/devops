#!/usr/bin/env bash

# Separator generation utilities
# Consolidates all separator line generation into single functions

# Generate separator line with specified width and character
generate_separator() {
    local width="${1:-40}"
    local char="${2:--}"
    printf "%.*s" "$width" "$(printf '%*s' "$width" '' | tr ' ' "$char")"
}

# Generate action separator with counter (the main separator line)
generate_action_separator() {
    local counter="${1:-1/9}"
    local width="${2:-${ACTION_LINE_MIN_WIDTH:-60}}"
    local char="${3:--}"

    # Generate base separator
    local separator_base="$(generate_separator "$width" "$char")"

    # Add counter at the end
    printf "%s(%s)" "$separator_base" "$counter"
}

# Generate section separator (for headers, footers, etc.)
generate_section_separator() {
    local width="${1:-60}"
    local char="${2:--}"
    generate_separator "$width" "$char"
}

# Generate emphasis separator (for special sections)
generate_emphasis_separator() {
    local width="${1:-30}"
    local char="${2:-=}"
    generate_separator "$width" "$char"
}