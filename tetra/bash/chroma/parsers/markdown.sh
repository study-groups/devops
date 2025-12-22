#!/usr/bin/env bash

# Chroma Markdown Parser
# Delegates to TDS markdown renderer

#==============================================================================
# RENDER FUNCTION
#==============================================================================

# Wrap text to width, preserving words
# Args: text width margin_str
_chroma_wrap_text() {
    local text="$1"
    local width="$2"
    local margin_str="$3"
    local effective_width=$((width - ${#margin_str}))

    # Use fold for word wrapping, then add margin to each line
    echo "$text" | fold -s -w "$effective_width" | while IFS= read -r wrapped_line; do
        printf "%s%s\n" "$margin_str" "$wrapped_line"
    done
}

# Flush accumulated paragraph text
_chroma_flush_paragraph() {
    local text="$1"
    local width="$2"
    local margin_str="$3"

    [[ -z "$text" ]] && return

    tds_text_color "text.primary"
    _chroma_wrap_text "$text" "$width" "$margin_str"
    reset_color
}

# Render markdown content
# Args: file (path or "-" for stdin)
_chroma_parse_markdown() {
    local file="${1:--}"
    local margin="${TDS_MARGIN_LEFT:-0}"
    local width="${TDS_MARKDOWN_WIDTH:-80}"
    local margin_str=""
    local in_code=0
    local para_buffer=""  # Accumulate paragraph text

    (( margin > 0 )) && printf -v margin_str "%*s" "$margin" ""

    (( CHROMA_DEBUG )) && echo "[markdown] file=$file margin=$margin width=$width" >&2

    # Top margin
    local top="${TDS_MARGIN_TOP:-0}"
    for ((i=0; i<top; i++)); do echo; done

    local line
    while IFS= read -r line || [[ -n "$line" ]]; do
        # Code block fence
        if [[ "$line" =~ ^\`\`\` ]]; then
            _chroma_flush_paragraph "$para_buffer" "$width" "$margin_str"
            para_buffer=""
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
            _chroma_flush_paragraph "$para_buffer" "$width" "$margin_str"
            para_buffer=""
            local level=${#BASH_REMATCH[1]}
            tds_text_color "content.heading.h${level}"
            printf "%s\033[1m%s\033[0m\n\n" "$margin_str" "${BASH_REMATCH[2]}"
            reset_color
            continue
        fi

        # Horizontal rule
        if [[ "$line" =~ ^[-_*]{3,}$ ]]; then
            _chroma_flush_paragraph "$para_buffer" "$width" "$margin_str"
            para_buffer=""
            tds_text_color "text.secondary"
            printf "%s%*s\n" "$margin_str" "$((width - margin * 2))" "" | tr ' ' '─'
            reset_color
            continue
        fi

        # List items
        if [[ "$line" =~ ^[[:space:]]*[-*+][[:space:]]+(.+)$ ]]; then
            _chroma_flush_paragraph "$para_buffer" "$width" "$margin_str"
            para_buffer=""
            tds_text_color "text.primary"
            local item_text="${BASH_REMATCH[1]}"
            local bullet_prefix="${margin_str}• "
            local item_width=$((width - ${#bullet_prefix}))
            # First line with bullet, continuation lines indented
            local first_line=true
            local cont_prefix="${margin_str}  "  # 2 spaces for continuation
            while IFS= read -r wrapped; do
                if $first_line; then
                    printf "%s%s\n" "$bullet_prefix" "$wrapped"
                    first_line=false
                else
                    printf "%s%s\n" "$cont_prefix" "$wrapped"
                fi
            done < <(echo "$item_text" | fold -s -w "$item_width")
            reset_color
            continue
        fi

        # Numbered list
        if [[ "$line" =~ ^[[:space:]]*([0-9]+)\.[[:space:]]+(.+)$ ]]; then
            _chroma_flush_paragraph "$para_buffer" "$width" "$margin_str"
            para_buffer=""
            tds_text_color "text.primary"
            printf "%s%s. %s\n" "$margin_str" "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}"
            reset_color
            continue
        fi

        # Blockquote
        if [[ "$line" =~ ^\>[[:space:]]*(.*)$ ]]; then
            _chroma_flush_paragraph "$para_buffer" "$width" "$margin_str"
            para_buffer=""
            tds_text_color "content.quote"
            printf "%s│ %s\n" "$margin_str" "${BASH_REMATCH[1]}"
            reset_color
            continue
        fi

        # Empty line - flush paragraph and output blank
        if [[ -z "$line" ]]; then
            _chroma_flush_paragraph "$para_buffer" "$width" "$margin_str"
            para_buffer=""
            echo
            continue
        fi

        # Regular text - strip leading whitespace and accumulate
        local trimmed="${line#"${line%%[![:space:]]*}"}"
        if [[ -n "$para_buffer" ]]; then
            para_buffer+=" $trimmed"
        else
            para_buffer="$trimmed"
        fi
    done < "$file"

    # Flush any remaining paragraph
    _chroma_flush_paragraph "$para_buffer" "$width" "$margin_str"
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
