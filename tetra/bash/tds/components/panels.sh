#!/usr/bin/env bash

# TDS Panel Components
# Pre-built panel types for common use cases

# Source dependencies
TDS_ROOT="${TDS_SRC:-$(dirname "$(dirname "${BASH_SOURCE[0]}")")}"
source "$TDS_ROOT/core/ansi.sh"
source "$TDS_ROOT/core/semantic_colors.sh"
source "$TDS_ROOT/layout/borders.sh"
source "$TDS_ROOT/layout/spacing.sh"

# Success panel
# Args: title, message
tds_panel_success() {
    local title="$1"
    local message="$2"
    local width=50

    local colored_title=$(tds_color "success" "✓ $title")

    tds_border_top "$width" "simple"
    tds_border_line "$colored_title" "$width" "center" "simple"
    tds_border_line "" "$width" "center" "simple"
    tds_border_line "$message" "$width" "center" "simple"
    tds_border_bottom "$width" "simple"
}

# Error panel
# Args: title, message
tds_panel_error() {
    local title="$1"
    local message="$2"
    local width=50

    local colored_title=$(tds_color "error" "✗ $title")

    tds_border_top "$width" "simple"
    tds_border_line "$colored_title" "$width" "center" "simple"
    tds_border_line "" "$width" "center" "simple"
    tds_border_line "$message" "$width" "center" "simple"
    tds_border_bottom "$width" "simple"
}

# Info panel with icon
# Args: title, lines...
tds_panel_info() {
    local title="$1"
    shift
    local lines=("$@")
    local width=60

    local colored_title=$(tds_color "info" "ℹ $title")

    tds_border_top "$width" "simple"
    tds_border_line "$colored_title" "$width" "center" "simple"
    tds_border_line "" "$width" "center" "simple"

    for line in "${lines[@]}"; do
        tds_border_line "$line" "$width" "left" "simple"
    done

    tds_border_bottom "$width" "simple"
}

# Header panel (for section headers)
# Args: title, [subtitle]
tds_panel_section_header() {
    local title="$1"
    local subtitle="$2"
    local width=70

    local colored_title=$(tds_color "primary" "$title")

    tds_border_top "$width" "double"
    tds_border_line "$colored_title" "$width" "center" "double"

    if [[ -n "$subtitle" ]]; then
        local colored_subtitle=$(tds_color "text.secondary" "$subtitle")
        tds_border_line "$colored_subtitle" "$width" "center" "double"
    fi

    tds_border_bottom "$width" "double"
}

# Status dashboard panel
# Args: env, mode, status_items...
tds_panel_dashboard() {
    local env="$1"
    local mode="$2"
    shift 2
    local status_items=("$@")
    local width=60

    # Title with environment and mode badges
    local title=""
    title+=$(tds_env_badge "$env")
    title+=" "
    title+=$(tds_mode_badge "$mode")

    tds_border_top "$width" "double"
    tds_border_line "$title" "$width" "center" "double"
    tds_border_line "" "$width" "center" "double"

    for item in "${status_items[@]}"; do
        tds_border_line "$item" "$width" "left" "double"
    done

    tds_border_bottom "$width" "double"
}

# Code block panel (for displaying code/logs)
# Args: title, code_lines...
tds_panel_code() {
    local title="$1"
    shift
    local code_lines=("$@")
    local width=80

    local colored_title=$(tds_color "text.secondary" "[ $title ]")

    tds_border_top "$width" "simple"
    tds_border_line "$colored_title" "$width" "left" "simple"
    tds_border_line "" "$width" "center" "simple"

    for line in "${code_lines[@]}"; do
        # Indent code slightly
        local indented="  $line"
        tds_border_line "$indented" "$width" "left" "simple"
    done

    tds_border_bottom "$width" "simple"
}

# Export functions
export -f tds_panel_success tds_panel_error tds_panel_info tds_panel_section_header tds_panel_dashboard tds_panel_code
