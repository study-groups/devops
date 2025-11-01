#!/usr/bin/env bash

# Action Router - Output routing to buffers

# TUI buffers (global)
declare -gA TUI_BUFFERS

# Route output to target
route_output() {
    local target="$1"
    local content="$2"

    TUI_BUFFERS["$target"]="$content"
}

# Clear content buffer
clear_content() {
    TUI_BUFFERS["@tui[content]"]=""
    TUI_BUFFERS["@tui[footer]"]=""
}
