#!/usr/bin/env bash
# Chroma Plugin: Line Numbers
# Adds line numbers to rendered output

# Plugin state
declare -g _CHROMA_LINE_NUM=0

# Initialize plugin
_chroma_line_numbers_init() {
    # Reset line counter on each render
    chroma_hook pre_render _chroma_line_numbers_reset
    chroma_hook pre_line _chroma_line_numbers_show
}

# Reset line counter
_chroma_line_numbers_reset() {
    _CHROMA_LINE_NUM=0
}

# Show line number before each line
_chroma_line_numbers_show() {
    local type="$1"
    # Skip blank lines and table accumulation
    [[ "$type" == "blank" || "$type" == table.* ]] && return 1
    ((_CHROMA_LINE_NUM++))
    printf '\033[38;5;240m%3d│\033[0m ' "$_CHROMA_LINE_NUM"
    return 1  # Don't skip default rendering
}

# Register the plugin
chroma_register_plugin "line-numbers" "_chroma_line_numbers_init"
