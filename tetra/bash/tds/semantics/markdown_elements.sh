#!/usr/bin/env bash

# TDS Markdown Element Renderers
# Clean, token-based rendering of markdown elements

# Load token system
source "${TDS_SRC}/semantics/markdown_tokens.sh"

# ============================================================================
# HEADINGS
# ============================================================================

md_render_heading() {
    local level="$1" text="$2"
    [[ $level -gt 4 ]] && level=4

    case $level in
        1) md_token_heading_h1 ;;
        2) md_token_heading_h2 ;;
        3) md_token_heading_h3 ;;
        4) md_token_heading_h4 ;;
    esac

    echo "$text"
    md_reset
    echo
}

# ============================================================================
# CODE BLOCKS
# ============================================================================

md_render_code_header() {
    local language="$1"
    md_token_code_border
    printf "┌─ %s\n" "$language"
    md_reset
}

md_render_code_line() {
    local line="$1"
    md_token_code_border
    printf "│ "
    md_reset
    md_token_code_text
    printf "%s\n" "$line"
    md_reset
}

md_render_code_footer() {
    md_token_code_border
    printf "└─\n"
    md_reset
}

# ============================================================================
# LISTS
# ============================================================================

md_render_list_item() {
    local text="$1" indent="${2:-0}" width="${3:-${TDS_MARKDOWN_WIDTH:-80}}"
    local indent_str="" bullet_width text_width

    # Calculate indentation
    for ((i=0; i<indent; i++)); do indent_str="  $indent_str"; done
    bullet_width=$((${#indent_str} + 2))
    text_width=$((width - bullet_width))

    # Wrap text
    [[ ${#text} -gt $text_width ]] && text=$(echo "$text" | fmt -w "$text_width")

    # Render with hanging indent
    local first_line=true
    while IFS= read -r line; do
        if [[ "$first_line" == true ]]; then
            md_token_list_bullet
            printf "%s• " "$indent_str"
            md_reset
            first_line=false
        else
            printf "%*s" "$bullet_width" ""
        fi
        md_token_list_text
        echo "$line"
        md_reset
    done <<< "$text"
}

md_render_ordered_list_item() {
    local text="$1" number="$2" indent="${3:-0}" width="${4:-${TDS_MARKDOWN_WIDTH:-80}}"
    local indent_str="" number_str="${number}. " bullet_width text_width

    # Calculate indentation
    for ((i=0; i<indent; i++)); do indent_str="  $indent_str"; done
    bullet_width=$((${#indent_str} + ${#number_str}))
    text_width=$((width - bullet_width))

    # Wrap text
    [[ ${#text} -gt $text_width ]] && text=$(echo "$text" | fmt -w "$text_width")

    # Render with hanging indent
    local first_line=true
    while IFS= read -r line; do
        if [[ "$first_line" == true ]]; then
            md_token_list_number
            printf "%s%s" "$indent_str" "$number_str"
            md_reset
            first_line=false
        else
            printf "%*s" "$bullet_width" ""
        fi
        md_token_list_text
        echo "$line"
        md_reset
    done <<< "$text"
}

# ============================================================================
# BLOCKQUOTES
# ============================================================================

md_render_quote() {
    local text="$1" width="${2:-${TDS_MARKDOWN_WIDTH:-80}}"
    local text_width=$((width - 2))

    # Wrap text
    [[ ${#text} -gt $text_width ]] && text=$(echo "$text" | fmt -w "$text_width")

    # Render with quote marker
    local first_line=true
    while IFS= read -r line; do
        md_token_quote_marker
        [[ "$first_line" == true ]] && printf "▌ " || printf "  "
        md_reset
        first_line=false
        md_token_quote_text
        echo "$line"
        md_reset
    done <<< "$text"
}

# ============================================================================
# INLINE ELEMENTS
# ============================================================================

md_render_bold() {
    local text="$1"
    md_token_bold
    printf "%s" "$text"
    md_reset
}

md_render_italic() {
    local text="$1"
    md_token_italic
    printf "%s" "$text"
    md_reset
}

md_render_code_inline() {
    local text="$1"
    md_token_code_inline
    printf "%s" "$text"
    md_reset
}

md_render_link() {
    local text="$1"
    md_token_link_text
    printf "%s" "$text"
    md_reset
}

# ============================================================================
# STRUCTURAL ELEMENTS
# ============================================================================

md_render_hr() {
    local width="${1:-${TDS_MARKDOWN_WIDTH:-80}}"
    md_token_hr
    printf "%*s\n" "$width" "" | tr ' ' '─'
    md_reset
}

md_render_paragraph() {
    local text="$1" width="${2:-${TDS_MARKDOWN_WIDTH:-80}}"
    md_token_text_primary
    [[ ${#text} -gt $width ]] && echo "$text" | fmt -w "$width" || echo "$text"
    md_reset
}

# Export element renderers
export -f md_render_heading
export -f md_render_code_header md_render_code_line md_render_code_footer
export -f md_render_list_item md_render_ordered_list_item
export -f md_render_quote
export -f md_render_bold md_render_italic md_render_code_inline md_render_link
export -f md_render_hr md_render_paragraph
