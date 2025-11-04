#!/usr/bin/env bash
# bash/tree/help.sh - 18-line paginated help navigation

# Source dependencies
TREE_HELP_SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! declare -F tree_children >/dev/null 2>&1; then
    source "$TREE_HELP_SRC/core.sh"
fi

# Load helper functions
if [[ -f "$TREE_HELP_SRC/helpers.sh" ]]; then
    source "$TREE_HELP_SRC/helpers.sh"
fi

# Load color system if available
if [[ -n "$TETRA_SRC" ]] && [[ -f "$TETRA_SRC/bash/color/color.sh" ]]; then
    source "$TETRA_SRC/bash/color/color.sh"
else
    # Fallback: define stub functions
    text_color() { :; }
    reset_color() { :; }
fi

# Configuration
TREE_HELP_MAX_LINES=18
TREE_HELP_INDENT="  "

# Color palette (using hex codes for consistency)
TREE_HELP_TITLE="00AAFF"      # Bright blue
TREE_HELP_SECTION="FFAA00"    # Orange
TREE_HELP_COMMAND="00FF88"    # Bright green
TREE_HELP_TEXT="FFFFFF"       # White
TREE_HELP_DIM="888888"        # Gray
TREE_HELP_BREADCRUMB="FFFF00" # Yellow

# Color helpers
_help_title() {
    text_color "$TREE_HELP_TITLE" 2>/dev/null || true
    printf "%s" "$1"
    reset_color 2>/dev/null || true
}

_help_section() {
    text_color "$TREE_HELP_SECTION" 2>/dev/null || true
    printf "%s" "$1"
    reset_color 2>/dev/null || true
}

_help_command() {
    text_color "$TREE_HELP_COMMAND" 2>/dev/null || true
    printf "%s" "$1"
    reset_color 2>/dev/null || true
}

_help_text() {
    text_color "$TREE_HELP_TEXT" 2>/dev/null || true
    printf "%s" "$1"
    reset_color 2>/dev/null || true
}

_help_dim() {
    text_color "$TREE_HELP_DIM" 2>/dev/null || true
    printf "%s" "$1"
    reset_color 2>/dev/null || true
}

_help_breadcrumb() {
    text_color "$TREE_HELP_BREADCRUMB" 2>/dev/null || true
    printf "%s" "$1"
    reset_color 2>/dev/null || true
}

# Format and display help for a path
# Usage: tree_help_show <path> [--no-pagination]
tree_help_show() {
    local path=$(tree_normalize_path "$1")
    local no_pagination=0
    [[ "$2" == "--no-pagination" ]] && no_pagination=1

    if ! tree_exists "$path"; then
        echo "Help topic not found: $path"
        return 1
    fi

    local lines=()

    # Build help content
    _help_build_content "$path" lines

    # Display with or without pagination
    if [[ $no_pagination -eq 1 ]] || [[ ${#lines[@]} -le $TREE_HELP_MAX_LINES ]]; then
        printf '%s\n' "${lines[@]}"
    else
        _help_paginate "${lines[@]}"
    fi
}

# Build help content for a path
_help_build_content() {
    local path="$1"
    local -n output_lines="$2"

    local type=$(tree_type "$path")
    local title=$(tree_get "$path" "title")
    local help=$(tree_get "$path" "help")
    local synopsis=$(tree_get "$path" "synopsis")
    local detail=$(tree_get "$path" "detail")
    local examples=$(tree_get "$path" "examples")

    # Header with breadcrumb
    local breadcrumb
    breadcrumb=$(tree_breadcrumb "$path" | tr '\n' ' > ')
    breadcrumb="${breadcrumb% > }"
    output_lines+=("$(_help_breadcrumb "$breadcrumb")")
    output_lines+=("")

    # Title
    if [[ -n "$title" ]]; then
        output_lines+=("$(_help_title "■ $title")")
    else
        output_lines+=("$(_help_title "■ ${path##*.}")")
    fi

    # Help text
    if [[ -n "$help" ]]; then
        output_lines+=("$(_help_text "$help")")
    fi
    output_lines+=("")

    # Synopsis
    if [[ -n "$synopsis" ]]; then
        output_lines+=("$(_help_section "USAGE:")")
        output_lines+=("$TREE_HELP_INDENT$synopsis")
        output_lines+=("")
    fi

    # Detail
    if [[ -n "$detail" ]]; then
        output_lines+=("$(_help_section "DESCRIPTION:")")
        # Split detail by newlines
        while IFS= read -r line; do
            output_lines+=("$TREE_HELP_INDENT$line")
        done <<< "$detail"
        output_lines+=("")
    fi

    # Examples
    if [[ -n "$examples" ]]; then
        output_lines+=("$(_help_section "EXAMPLES:")")
        while IFS= read -r line; do
            output_lines+=("$TREE_HELP_INDENT$line")
        done <<< "$examples"
        output_lines+=("")
    fi

    # Children
    local children
    children=$(tree_children "$path")
    if [[ -n "$children" ]]; then
        # Group by type
        local commands=()
        local flags=()
        local options=()
        local categories=()
        local other=()

        for child in $children; do
            local child_type=$(tree_type "$child")
            case "$child_type" in
                command) commands+=("$child") ;;
                flag) flags+=("$child") ;;
                option) options+=("$child") ;;
                category) categories+=("$child") ;;
                *) other+=("$child") ;;
            esac
        done

        # Display categories
        if [[ ${#categories[@]} -gt 0 ]]; then
            output_lines+=("$(_help_section "TOPICS:")")
            for child in "${categories[@]}"; do
                _help_format_child "$child" output_lines
            done
            output_lines+=("")
        fi

        # Display commands
        if [[ ${#commands[@]} -gt 0 ]]; then
            output_lines+=("$(_help_section "COMMANDS:")")
            for child in "${commands[@]}"; do
                _help_format_child "$child" output_lines
            done
            output_lines+=("")
        fi

        # Display flags
        if [[ ${#flags[@]} -gt 0 ]]; then
            output_lines+=("$(_help_section "FLAGS:")")
            for child in "${flags[@]}"; do
                _help_format_child "$child" output_lines
            done
            output_lines+=("")
        fi

        # Display options
        if [[ ${#options[@]} -gt 0 ]]; then
            output_lines+=("$(_help_section "OPTIONS:")")
            for child in "${options[@]}"; do
                _help_format_child "$child" output_lines
            done
            output_lines+=("")
        fi

        # Display other
        if [[ ${#other[@]} -gt 0 ]]; then
            output_lines+=("$(_help_section "OTHER:")")
            for child in "${other[@]}"; do
                _help_format_child "$child" output_lines
            done
            output_lines+=("")
        fi
    fi

    # Navigation hint
    if [[ -n "$children" ]]; then
        output_lines+=("$(_help_dim "Type: help <topic> to explore | help to return to main")")
    fi
}

# Format a child node for display
_help_format_child() {
    local child="$1"
    local -n out_lines="$2"

    local leaf="${child##*.}"
    local child_title=$(tree_get "$child" "title")
    local child_help=$(tree_get "$child" "help")

    local name="$(_help_command "$leaf")"
    local desc="$(_help_dim "${child_title:-$child_help}")"

    out_lines+=("$TREE_HELP_INDENT$name    $desc")
}

# Paginate content (18 lines at a time)
_help_paginate() {
    local lines=("$@")
    local total=${#lines[@]}
    local page_start=0

    while [[ $page_start -lt $total ]]; do
        local page_end=$((page_start + TREE_HELP_MAX_LINES))
        [[ $page_end -gt $total ]] && page_end=$total

        # Clear screen and show page
        clear
        local i
        for ((i=page_start; i<page_end; i++)); do
            echo "${lines[$i]}"
        done

        # Show pagination info
        local current_page=$(( (page_start / TREE_HELP_MAX_LINES) + 1 ))
        local total_pages=$(( (total + TREE_HELP_MAX_LINES - 1) / TREE_HELP_MAX_LINES ))
        echo ""
        echo "$(_help_dim "Page $current_page/$total_pages")"

        # If more pages, prompt
        if [[ $page_end -lt $total ]]; then
            echo -n "$(_help_text "[Enter] next | [q] quit: ")"
            read -r -n 1 response
            echo ""
            [[ "$response" == "q" ]] && break
            page_start=$page_end
        else
            break
        fi
    done
}

# Interactive help navigation
# Usage: tree_help_navigate [starting_path]
tree_help_navigate() {
    local current_path="${1:-help}"
    current_path=$(tree_normalize_path "$current_path")

    local history=()

    while true; do
        # Show current help
        tree_help_show "$current_path" --no-pagination

        echo ""
        echo "$(_help_text "Navigate: [topic] dive | [b]ack | [m]ain | [q]uit: ")"
        read -r input

        case "$input" in
            q|quit|exit)
                break
                ;;
            b|back)
                if [[ ${#history[@]} -gt 0 ]]; then
                    # Pop from history
                    current_path="${history[-1]}"
                    unset 'history[-1]'
                else
                    echo "Already at top level"
                fi
                ;;
            m|main)
                current_path="help"
                history=()
                ;;
            "")
                # Just redisplay
                continue
                ;;
            *)
                # Try to navigate to child
                local child_path="$current_path.$input"
                if tree_exists "$child_path"; then
                    history+=("$current_path")
                    current_path="$child_path"
                else
                    echo "Topic not found: $input"
                    sleep 1
                fi
                ;;
        esac
    done
}

# Quick help lookup (non-interactive)
# Usage: help <path>
help() {
    local path="${1:-help}"

    # If path doesn't start with namespace, prepend "help"
    if [[ "$path" != *.* ]] && [[ "$path" != "help" ]]; then
        path="help.$path"
    fi

    tree_help_show "$path"
}

# Export functions
export -f tree_help_show
export -f tree_help_navigate
export -f help
export -f _help_build_content
export -f _help_format_child
export -f _help_paginate
export -f _help_title
export -f _help_section
export -f _help_command
export -f _help_text
export -f _help_dim
export -f _help_breadcrumb
