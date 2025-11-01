#!/usr/bin/env bash

# Typography - TES operators and design tokens from 013

# TES Operators
ENDPOINT_OP="::"
FLOW_OP="→"
ROUTE_OP="@"
CROSS_OP="×"
PAIR_SEP=":"
DOT_SEP="."

# Design tokens
TUI_SEPARATOR_WIDTH=60
TUI_SEPARATOR_CHAR="─"
TUI_BRACKET_LEFT="["
TUI_BRACKET_RIGHT="]"

# Labels
TUI_LABEL_ENV="Env:"
TUI_LABEL_MODE="Mode:"
TUI_LABEL_ACTION="Action:"

# Text styles
TUI_TEXT_DIM="\033[2m"
TUI_TEXT_BOLD="\033[1m"
TUI_TEXT_NORMAL="\033[0m"

# Generate separator
render_separator() {
    local width="${1:-$TUI_SEPARATOR_WIDTH}"
    printf '%*s' "$width" '' | tr ' ' "$TUI_SEPARATOR_CHAR"
    echo
}

# Center text in terminal
center_text() {
    local text="$1"
    local width="${2:-60}"
    local text_length=${#text}
    local padding=$(( (width - text_length) / 2 ))
    printf "%${padding}s%s\n" "" "$text"
}
