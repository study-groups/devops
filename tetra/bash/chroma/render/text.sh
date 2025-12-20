#!/usr/bin/env bash
# Chroma - Text processing utilities
# Part of the chroma modular markdown renderer

# Render inline formatting (bold, italic, code, links)
# $1 = text to render
# $2 = base token to restore after formatting (optional, default text.primary)
_chroma_inline() {
    local text="$1"
    local base_token="${2:-text.primary}"
    local i=0
    local len=${#text}

    while (( i < len )); do
        local char="${text:i:1}"
        local next="${text:i+1:1}"

        # Inline code `...`
        if [[ "$char" == '`' ]]; then
            local end=$((i + 1))
            while (( end < len )) && [[ "${text:end:1}" != '`' ]]; do
                ((end++))
            done
            if (( end < len )); then
                local code="${text:i+1:end-i-1}"
                _chroma_color "$(_chroma_token code.inline)"
                printf '%s' "$code"
                _chroma_reset
                _chroma_color "$(_chroma_token "$base_token")"
                i=$((end + 1))
                continue
            fi
        fi

        # Bold **...**
        if [[ "$char" == '*' && "$next" == '*' ]]; then
            local end=$((i + 2))
            while (( end < len - 1 )) && [[ "${text:end:2}" != '**' ]]; do
                ((end++))
            done
            if (( end < len - 1 )); then
                local bold="${text:i+2:end-i-2}"
                _chroma_color "$(_chroma_token bold)"
                printf '%s' "$bold"
                _chroma_reset
                _chroma_color "$(_chroma_token "$base_token")"
                i=$((end + 2))
                continue
            fi
        fi

        # Italic *...* (single asterisk, not followed by another)
        if [[ "$char" == '*' && "$next" != '*' ]]; then
            local end=$((i + 1))
            while (( end < len )) && [[ "${text:end:1}" != '*' ]]; do
                ((end++))
            done
            if (( end < len )); then
                local italic="${text:i+1:end-i-1}"
                _chroma_color "$(_chroma_token italic)"
                printf '%s' "$italic"
                _chroma_reset
                _chroma_color "$(_chroma_token "$base_token")"
                i=$((end + 1))
                continue
            fi
        fi

        # Regular character
        printf '%s' "$char"
        ((i++))
    done
}

# Calculate visual width of text (strip markdown formatting)
_chroma_visual_width() {
    local text="$1"
    # Remove **bold**, *italic*, `code` markers
    text="${text//\*\*/}"
    text="${text//\*/}"
    text="${text//\`/}"
    echo "${#text}"
}

# Word-wrap text to specified width
# Args: text, width, indent (for continuation lines)
# Outputs wrapped lines
_chroma_word_wrap() {
    local text="$1"
    local width="$2"
    local indent="${3:-}"
    local indent_width=${#indent}

    # First line uses full width, continuation lines account for indent
    local first_width=$width
    local cont_width=$((width - indent_width))
    (( cont_width < 20 )) && cont_width=20

    local line=""
    local line_len=0
    local first_line=1
    local max_width=$first_width

    # Split into words
    local words
    read -ra words <<< "$text"

    for word in "${words[@]}"; do
        local word_len=$(_chroma_visual_width "$word")

        if (( line_len == 0 )); then
            # Start of line
            line="$word"
            line_len=$word_len
        elif (( line_len + 1 + word_len <= max_width )); then
            # Word fits on current line
            line="$line $word"
            line_len=$((line_len + 1 + word_len))
        else
            # Word doesn't fit, output current line and start new
            echo "$line"
            if (( first_line )); then
                first_line=0
                max_width=$cont_width
            fi
            line="${indent}${word}"
            line_len=$((indent_width + word_len))
        fi
    done

    # Output remaining text
    [[ -n "$line" ]] && echo "$line"
}

# Word-wrap with different width for first line vs continuation
# Used for topic-description patterns where first line is narrow (after topic)
# but continuation lines can be wider
# Args: text, first_width, cont_width
# Outputs wrapped lines (no indent prefix - caller handles padding)
_chroma_word_wrap_variable() {
    local text="$1"
    local first_width="$2"
    local cont_width="$3"

    local line="" line_len=0 first_line=1
    local max_width=$first_width
    local words
    read -ra words <<< "$text"

    for word in "${words[@]}"; do
        local word_len=${#word}
        if (( line_len == 0 )); then
            line="$word"
            line_len=$word_len
        elif (( line_len + 1 + word_len <= max_width )); then
            line="$line $word"
            line_len=$((line_len + 1 + word_len))
        else
            echo "$line"
            if (( first_line )); then
                first_line=0
                max_width=$cont_width
            fi
            line="$word"
            line_len=$word_len
        fi
    done
    [[ -n "$line" ]] && echo "$line"
}
