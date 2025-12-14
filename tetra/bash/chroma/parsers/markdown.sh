#!/usr/bin/env bash

# Chroma Markdown Parser
# Delegates to TDS markdown renderer

#==============================================================================
# RENDER FUNCTION
#==============================================================================

# Render markdown content
# Args: file (path or "-" for stdin)
_chroma_parse_markdown() {
    local file="${1:--}"
    local margin="${TDS_MARGIN_LEFT:-0}"
    local width="${TDS_MARKDOWN_WIDTH:-80}"
    local margin_str=""
    local in_code=0

    (( margin > 0 )) && printf -v margin_str "%*s" "$margin" ""

    (( CHROMA_DEBUG )) && echo "[markdown] file=$file margin=$margin width=$width" >&2

    # Top margin
    local top="${TDS_MARGIN_TOP:-0}"
    for ((i=0; i<top; i++)); do echo; done

    local line
    while IFS= read -r line || [[ -n "$line" ]]; do
        # Code block fence
        if [[ "$line" =~ ^\`\`\` ]]; then
            in_code=$((1 - in_code))
            continue
        fi

        # Inside code block
        if (( in_code )); then
            tds_text_color "content.code.inline"
            printf "%s    %s\n" "$margin_str" "$line"
            reset_color
            continue
        fi

        # Headers
        if [[ "$line" =~ ^(#{1,6})[[:space:]]+(.+)$ ]]; then
            local level=${#BASH_REMATCH[1]}
            tds_text_color "content.heading.h${level}"
            printf "%s\033[1m%s\033[0m\n\n" "$margin_str" "${BASH_REMATCH[2]}"
            reset_color
            continue
        fi

        # Horizontal rule
        if [[ "$line" =~ ^[-_*]{3,}$ ]]; then
            tds_text_color "text.secondary"
            printf "%s%*s\n" "$margin_str" "$((width - margin * 2))" "" | tr ' ' '─'
            reset_color
            continue
        fi

        # List items
        if [[ "$line" =~ ^[[:space:]]*[-*+][[:space:]]+(.+)$ ]]; then
            tds_text_color "text.primary"
            printf "%s  • %s\n" "$margin_str" "${BASH_REMATCH[1]}"
            reset_color
            continue
        fi

        # Numbered list
        if [[ "$line" =~ ^[[:space:]]*([0-9]+)\.[[:space:]]+(.+)$ ]]; then
            tds_text_color "text.primary"
            printf "%s  %s. %s\n" "$margin_str" "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}"
            reset_color
            continue
        fi

        # Blockquote
        if [[ "$line" =~ ^\>[[:space:]]*(.*)$ ]]; then
            tds_text_color "content.quote"
            printf "%s  │ %s\n" "$margin_str" "${BASH_REMATCH[1]}"
            reset_color
            continue
        fi

        # Empty line
        if [[ -z "$line" ]]; then
            echo
            continue
        fi

        # Regular text with color
        tds_text_color "text.primary"
        printf "%s%s\n" "$margin_str" "$line"
        reset_color
    done < "$file"
}

#==============================================================================
# VALIDATION
#==============================================================================

_chroma_parse_markdown_validate() {
    # Check TDS markdown is available
    declare -F tds_render_markdown &>/dev/null || return 1
    declare -F tds_text_color &>/dev/null || return 1
    return 0
}

#==============================================================================
# INFO
#==============================================================================

_chroma_parse_markdown_info() {
    cat <<'EOF'
Renders Markdown with TDS semantic colors.

Supported elements:
  - Headings (h1-h6)
  - Bold, italic, inline code
  - Code blocks (fenced)
  - Lists (ordered/unordered/checkbox)
  - Blockquotes
  - Links
  - Horizontal rules

Delegates to: tds_render_markdown
EOF
}

#==============================================================================
# REGISTRATION
#==============================================================================

chroma_register_parser "markdown" "_chroma_parse_markdown" "md markdown" \
    "Markdown documents"
