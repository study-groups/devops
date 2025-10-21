#!/usr/bin/env bash

# TDS Typography System
# Semantic text rendering using color tokens

# Render heading at specified level
# Args: level (1-6), text
tds_render_heading() {
    local level="$1"
    local text="$2"

    # Cap level at 4 (we only have tokens for h1-h4)
    [[ $level -gt 4 ]] && level=4

    # Apply semantic color token
    tds_text_color "content.heading.h${level}"
    printf "\033[1m"  # Bold
    echo "$text"
    reset_color
    echo
}

# Render emphasized text
# Args: type (bold|italic|code), text
tds_render_emphasis() {
    local type="$1"
    local text="$2"

    case "$type" in
        bold)
            printf "\033[1m"  # Bold ANSI
            tds_text_color "content.emphasis.bold"
            printf "%s" "$text"
            reset_color
            ;;
        italic)
            printf "\033[3m"  # Italic ANSI
            tds_text_color "content.emphasis.italic"
            printf "%s" "$text"
            reset_color
            ;;
        code)
            tds_text_color "content.code.inline"
            printf "%s" "$text"
            reset_color
            ;;
        *)
            # Unknown type, render as-is
            echo "$text"
            ;;
    esac
}

# Render paragraph with optional width constraint
# Args: text, [width]
tds_render_paragraph() {
    local text="$1"
    local width="${2:-${COLUMNS:-80}}"

    tds_text_color "text.primary"
    if [[ ${#text} -gt $width ]]; then
        echo "$text" | fmt -w "$width"
    else
        echo "$text"
    fi
    reset_color
}

# Render link
# Args: text, [url]
tds_render_link() {
    local text="$1"
    local url="${2:-}"

    tds_text_color "content.link"
    printf "%s" "$text"
    reset_color

    # Optionally show URL
    if [[ -n "$url" ]]; then
        tds_text_color "text.secondary"
        printf " (%s)" "$url"
        reset_color
    fi
}

# Render horizontal rule
# Args: [width]
tds_render_hr() {
    local width="${1:-${COLUMNS:-80}}"

    tds_text_color "content.hr"
    printf "%*s\n" "$width" "" | tr ' ' '─'
    reset_color
}

# Render blockquote line
# Args: text
tds_render_quote() {
    local text="$1"

    tds_text_color "content.quote"
    printf "▌ %s\n" "$text"
    reset_color
}

# Render list item
# Args: text, [indent_level]
tds_render_list_item() {
    local text="$1"
    local indent="${2:-0}"

    # Create indentation
    local indent_str=""
    for ((i=0; i<indent; i++)); do
        indent_str="  $indent_str"
    done

    tds_text_color "content.list"
    printf "%s• " "$indent_str"
    reset_color

    tds_text_color "text.primary"
    echo "$text"
    reset_color
}

# Render code block line
# Args: line, [language]
tds_render_code_line() {
    local line="$1"
    local language="${2:-}"

    tds_text_color "content.code.block"
    printf "│ %s\n" "$line"
    reset_color
}

# Render code block header
# Args: language
tds_render_code_header() {
    local language="${1:-}"

    tds_text_color "content.code.block"
    printf "┌─ %s\n" "$language"
    reset_color
}

# Render code block footer
tds_render_code_footer() {
    tds_text_color "content.code.block"
    printf "└─\n"
    reset_color
}
