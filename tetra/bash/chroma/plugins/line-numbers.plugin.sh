#!/usr/bin/env bash
# Chroma Plugin: Line Numbers
# Adds line numbers to rendered output

# Plugin state
declare -g _CHROMA_LINE_NUM=0

# Initialize plugin
_chroma_line_numbers_init() {
    # Declare configuration options
    chroma_config_declare "line-numbers" "enabled" "true" "Enable line numbers"
    chroma_config_declare "line-numbers" "width" "3" "Number width (digits)"
    chroma_config_declare "line-numbers" "color" "240" "ANSI 256 color code"
    chroma_config_declare "line-numbers" "separator" "│" "Separator character"
    chroma_config_declare "line-numbers" "skip_blank" "true" "Skip numbering blank lines"

    # Register hooks
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

    # Check if enabled
    local enabled=$(chroma_config_get "line-numbers" "enabled")
    [[ "$enabled" != "true" ]] && return 1

    # Skip blank lines if configured
    local skip_blank=$(chroma_config_get "line-numbers" "skip_blank")
    if [[ "$skip_blank" == "true" ]]; then
        [[ "$type" == "blank" || "$type" == table.* ]] && return 1
    fi

    # Get config values
    local width=$(chroma_config_get "line-numbers" "width")
    local color=$(chroma_config_get "line-numbers" "color")
    local sep=$(chroma_config_get "line-numbers" "separator")

    ((_CHROMA_LINE_NUM++))
    printf '\033[38;5;%sm%*d%s\033[0m ' "$color" "$width" "$_CHROMA_LINE_NUM" "$sep"
    return 1  # Don't skip default rendering
}

# Register the plugin
chroma_register_plugin "line-numbers" "_chroma_line_numbers_init"
