#!/usr/bin/env bash
# REPL Symbol UI Helpers
# Optional UI components for symbol handlers

# File selector using fzf
repl_symbol_select_file() {
    local pattern="${1:-.}"
    local prompt="${2:-Select file:}"

    if ! command -v fzf >/dev/null 2>&1; then
        echo "Error: fzf not available" >&2
        return 1
    fi

    find "$pattern" -type f 2>/dev/null | fzf --prompt="$prompt " --height=40%
}

# Directory selector using fzf
repl_symbol_select_dir() {
    local pattern="${1:-.}"
    local prompt="${2:-Select directory:}"

    if ! command -v fzf >/dev/null 2>&1; then
        echo "Error: fzf not available" >&2
        return 1
    fi

    find "$pattern" -type d 2>/dev/null | fzf --prompt="$prompt " --height=40%
}

# Multi-select files using fzf
repl_symbol_multiselect_files() {
    local pattern="${1:-.}"
    local prompt="${2:-Select files:}"

    if ! command -v fzf >/dev/null 2>&1; then
        echo "Error: fzf not available" >&2
        return 1
    fi

    find "$pattern" -type f 2>/dev/null | fzf --multi --prompt="$prompt " --height=40%
}

# Select from list using fzf
repl_symbol_select_from_list() {
    local prompt="$1"
    shift
    local items=("$@")

    if ! command -v fzf >/dev/null 2>&1; then
        echo "Error: fzf not available" >&2
        return 1
    fi

    printf '%s\n' "${items[@]}" | fzf --prompt="$prompt " --height=40%
}

# Range selector (interactive line/byte range picker)
repl_symbol_select_range() {
    local file="$1"

    if [[ ! -f "$file" ]]; then
        echo "Error: File not found: $file" >&2
        return 1
    fi

    # Show file with line numbers
    echo "Select range for: $file"
    nl -ba "$file" | head -20
    echo "..."
    echo ""

    read -p "Start line: " start
    read -p "End line: " end

    echo "${start},${end}"
}

# TES endpoint selector (if TES system available)
repl_symbol_select_tes() {
    local prompt="${1:-Select endpoint:}"

    # Check if TES list function exists
    if ! command -v tes_list_endpoints >/dev/null 2>&1; then
        echo "Error: TES system not available" >&2
        return 1
    fi

    if ! command -v fzf >/dev/null 2>&1; then
        echo "Error: fzf not available" >&2
        return 1
    fi

    tes_list_endpoints | fzf --prompt="$prompt " --height=40%
}

# Tag selector with autocomplete
repl_symbol_select_tag() {
    local existing_tags="$1"
    local prompt="${2:-Enter tag:}"

    if command -v fzf >/dev/null 2>&1 && [[ -n "$existing_tags" ]]; then
        echo "$existing_tags" | tr ',' '\n' | fzf --prompt="$prompt " --height=40%
    else
        read -p "$prompt " tag
        echo "$tag"
    fi
}

# Simple text input with validation
repl_symbol_input_text() {
    local prompt="$1"
    local validator="${2:-}"  # Optional validator function

    local input
    while true; do
        read -p "$prompt " input

        if [[ -z "$input" ]]; then
            echo "Error: Input cannot be empty" >&2
            continue
        fi

        # Run validator if provided
        if [[ -n "$validator" ]] && command -v "$validator" >/dev/null 2>&1; then
            if "$validator" "$input"; then
                echo "$input"
                return 0
            else
                echo "Error: Invalid input" >&2
                continue
            fi
        else
            echo "$input"
            return 0
        fi
    done
}

# Confirm dialog
repl_symbol_confirm() {
    local prompt="$1"
    local default="${2:-n}"  # y/n

    local response
    read -p "$prompt [y/N]: " response
    response="${response:-$default}"

    [[ "${response,,}" == "y" ]]
}

export -f repl_symbol_select_file
export -f repl_symbol_select_dir
export -f repl_symbol_multiselect_files
export -f repl_symbol_select_from_list
export -f repl_symbol_select_range
export -f repl_symbol_select_tes
export -f repl_symbol_select_tag
export -f repl_symbol_input_text
export -f repl_symbol_confirm
