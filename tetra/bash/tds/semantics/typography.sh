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

    # Use ANSI-aware wrapping if text contains ANSI codes
    if [[ "$text" =~ $'\033'\[ ]]; then
        tds_wrap_ansi_text "$text" "$width"
    else
        # Simple wrapping for plain text
        local wrapped_text="$text"
        if [[ ${#text} -gt $width ]]; then
            wrapped_text=$(echo "$text" | fmt -w "$width")
        fi

        # Apply color to each line
        while IFS= read -r line; do
            tds_text_color "text.primary"
            echo "$line"
            reset_color
        done <<< "$wrapped_text"
    fi
}

# ANSI-aware text wrapping that preserves formatting
# Wraps text while preserving ANSI escape codes at correct positions
# Args: text (with ANSI codes), width
tds_wrap_ansi_text() {
    local text="$1"
    local width="$2"

    # Check if we need wrapping using visual width
    local visual_width
    if command -v tds_visual_width >/dev/null 2>&1; then
        visual_width=$(tds_visual_width "$text")
    else
        # Fallback: strip ANSI manually
        local stripped=$(echo "$text" | sed 's/\x1b\[[0-9;]*m//g')
        visual_width=${#stripped}
    fi

    # No wrapping needed - output as-is
    if [[ $visual_width -le $width ]]; then
        echo "$text"
        return
    fi

    # Parse text into segments: plain text chunks and ANSI codes
    local -a segments=()
    local -a is_ansi=()
    local remaining="$text"

    while [[ -n "$remaining" ]]; do
        # Check for ANSI code at start
        if [[ "$remaining" =~ ^($'\033'\[[0-9\;]*m) ]]; then
            segments+=("${BASH_REMATCH[1]}")
            is_ansi+=(1)
            remaining="${remaining#${BASH_REMATCH[1]}}"
        else
            # Extract plain text until next ANSI or end
            if [[ "$remaining" =~ ^([^$'\033']+) ]]; then
                segments+=("${BASH_REMATCH[1]}")
                is_ansi+=(0)
                remaining="${remaining#${BASH_REMATCH[1]}}"
            else
                # Single character that's not part of ANSI
                segments+=("${remaining:0:1}")
                is_ansi+=(0)
                remaining="${remaining:1}"
            fi
        fi
    done

    # Build words array with attached ANSI codes
    local -a words=()
    local current_word=""
    local pending_ansi=""

    for i in "${!segments[@]}"; do
        local seg="${segments[$i]}"
        local is_code="${is_ansi[$i]}"

        if [[ $is_code -eq 1 ]]; then
            # ANSI code - attach to pending or current word
            if [[ -n "$current_word" ]]; then
                current_word+="$seg"
            else
                pending_ansi+="$seg"
            fi
        else
            # Plain text - split on spaces
            local j=0
            while [[ $j -lt ${#seg} ]]; do
                local char="${seg:$j:1}"
                if [[ "$char" == " " ]]; then
                    # Space - finish current word if any
                    if [[ -n "$current_word" ]]; then
                        words+=("$current_word")
                        current_word=""
                    fi
                    pending_ansi=""
                else
                    # Add character to word (with pending ANSI if starting new word)
                    if [[ -z "$current_word" ]]; then
                        current_word="$pending_ansi$char"
                        pending_ansi=""
                    else
                        current_word+="$char"
                    fi
                fi
                ((j++))
            done
        fi
    done

    # Add final word if any
    if [[ -n "$current_word" ]]; then
        words+=("$current_word")
    fi

    # Wrap words to lines
    local current_line=""
    local line_visual_len=0
    local active_ansi_state=""

    for word in "${words[@]}"; do
        # Calculate visual length of word
        local word_visual
        if command -v tds_visual_width >/dev/null 2>&1; then
            word_visual=$(tds_visual_width "$word")
        else
            local word_stripped=$(echo "$word" | sed 's/\x1b\[[0-9;]*m//g')
            word_visual=${#word_stripped}
        fi

        # Check if adding word would exceed width (account for space if not first word)
        local space_needed=0
        [[ $line_visual_len -gt 0 ]] && space_needed=1

        if [[ $line_visual_len -gt 0 ]] && [[ $((line_visual_len + space_needed + word_visual)) -gt $width ]]; then
            # Print current line
            echo "$current_line"
            # Start new line with current ANSI state
            current_line="$active_ansi_state$word"
            line_visual_len=$word_visual
        else
            # Add to current line
            if [[ $line_visual_len -gt 0 ]]; then
                current_line+=" $word"
                line_visual_len=$((line_visual_len + 1 + word_visual))
            else
                current_line="$active_ansi_state$word"
                line_visual_len=$word_visual
            fi
        fi

        # Track ANSI state for continuation
        # Extract all ANSI codes from word to update state
        local temp_word="$word"
        while [[ "$temp_word" =~ ($'\033'\[([0-9\;]*)m) ]]; do
            local code="${BASH_REMATCH[2]}"
            if [[ "$code" == "0" ]] || [[ -z "$code" ]]; then
                active_ansi_state=""
            else
                # Accumulate ANSI state
                active_ansi_state+="${BASH_REMATCH[1]}"
            fi
            temp_word="${temp_word#*${BASH_REMATCH[1]}}"
        done
    done

    # Print final line
    if [[ -n "$current_line" ]]; then
        echo "$current_line"
    fi
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
# Args: text, [width]
tds_render_quote() {
    local text="$1"
    local width="${2:-${TDS_MARKDOWN_WIDTH:-${COLUMNS:-80}}}"
    local text_width=$((width - 2))

    [[ ${#text} -gt $text_width ]] && text=$(echo "$text" | fmt -w "$text_width")

    local first_line=true
    while IFS= read -r line; do
        tds_text_color "content.quote"
        [[ "$first_line" == true ]] && printf "▌ %s\n" "$line" || printf "  %s\n" "$line"
        first_line=false
        reset_color
    done <<< "$text"
}

# Render unordered list item
# Args: text, [indent_level], [width]
tds_render_list_item() {
    local text="$1" indent="${2:-0}" width="${3:-${TDS_MARKDOWN_WIDTH:-${COLUMNS:-80}}}"
    local indent_str="" bullet_width text_width

    for ((i=0; i<indent; i++)); do indent_str="  $indent_str"; done

    bullet_width=$((${#indent_str} + 2))
    text_width=$((width - bullet_width))
    [[ ${#text} -gt $text_width ]] && text=$(echo "$text" | fmt -w "$text_width")

    local first_line=true
    while IFS= read -r line; do
        if [[ "$first_line" == true ]]; then
            tds_text_color "content.list"; printf "%s• " "$indent_str"; reset_color
            first_line=false
        else
            printf "%*s" "$bullet_width" ""
        fi
        tds_text_color "text.primary"; echo "$line"; reset_color
    done <<< "$text"
}

# Render ordered list item
# Args: text, number, [indent_level], [width]
tds_render_ordered_list_item() {
    local text="$1" number="$2" indent="${3:-0}" width="${4:-${TDS_MARKDOWN_WIDTH:-${COLUMNS:-80}}}"
    local indent_str="" number_str="${number}. " bullet_width text_width

    for ((i=0; i<indent; i++)); do indent_str="  $indent_str"; done

    bullet_width=$((${#indent_str} + ${#number_str}))
    text_width=$((width - bullet_width))
    [[ ${#text} -gt $text_width ]] && text=$(echo "$text" | fmt -w "$text_width")

    local first_line=true
    while IFS= read -r line; do
        if [[ "$first_line" == true ]]; then
            tds_text_color "content.list"; printf "%s%s" "$indent_str" "$number_str"; reset_color
            first_line=false
        else
            printf "%*s" "$bullet_width" ""
        fi
        tds_text_color "text.primary"; echo "$line"; reset_color
    done <<< "$text"
}

# Render list item with inline formatting support
# Args: text, [indent_level], [width]
tds_render_list_item_with_inline() {
    local text="$1" indent="${2:-0}" width="${3:-${TDS_MARKDOWN_WIDTH:-80}}"
    local indent_str="" bullet_width text_width

    for ((i=0; i<indent; i++)); do indent_str="  $indent_str"; done
    bullet_width=$((${#indent_str} + 2))
    text_width=$((width - bullet_width))

    # Render bullet
    tds_text_color "content.list"
    printf "%s• " "$indent_str"
    reset_color

    # Process inline formatting and render
    tds_render_text_with_inline "$text" "$text_width" "$bullet_width"
}

# Render ordered list item with inline formatting support
# Args: text, number, [indent_level], [width]
tds_render_ordered_list_item_with_inline() {
    local text="$1" number="$2" indent="${3:-0}" width="${4:-${TDS_MARKDOWN_WIDTH:-80}}"
    local indent_str="" number_str="${number}. " bullet_width text_width

    for ((i=0; i<indent; i++)); do indent_str="  $indent_str"; done
    bullet_width=$((${#indent_str} + ${#number_str}))
    text_width=$((width - bullet_width))

    # Render number
    tds_text_color "content.list"
    printf "%s%s" "$indent_str" "$number_str"
    reset_color

    # Process inline formatting and render
    tds_render_text_with_inline "$text" "$text_width" "$bullet_width"
}

# Render text with inline formatting (bold, code) and wrapping
# Args: text, width, [continuation_indent]
tds_render_text_with_inline() {
    local text="$1" width="$2" continuation_indent="${3:-0}"

    # Check if text has inline formatting
    if [[ "$text" =~ \*\*.*\*\* ]] || [[ "$text" =~ \`.*\` ]]; then
        # Has formatting - render on single line to preserve formatting
        # Split manually at word boundaries if needed
        _tds_render_with_manual_wrap "$text" "$width" "$continuation_indent"
    else
        # No formatting - use simple fmt wrapping
        local wrapped=$(echo "$text" | fmt -w "$width")
        local first_line=true

        while IFS= read -r line; do
            if [[ "$first_line" == false ]]; then
                printf "%*s" "$continuation_indent" ""
            fi
            first_line=false

            tds_text_color "text.primary"
            echo "$line"
            reset_color
        done <<< "$wrapped"
    fi
}

# Manual word wrap with inline formatting preservation
_tds_render_with_manual_wrap() {
    local text="$1" width="$2" continuation_indent="${3:-0}"
    local current_line="" current_len=0 first_line=true

    # Split into words
    local words=()
    while read -r word; do
        words+=("$word")
    done < <(echo "$text" | tr ' ' '\n')

    for word in "${words[@]}"; do
        # Strip formatting markers to measure real length
        local word_plain="${word//\*\*/}"
        word_plain="${word_plain//\`/}"
        local word_len=${#word_plain}

        # Check if adding word exceeds width
        if [[ $current_len -gt 0 ]] && [[ $((current_len + word_len + 1)) -gt $width ]]; then
            # Print current line
            if [[ "$first_line" == false ]]; then
                printf "%*s" "$continuation_indent" ""
            fi
            first_line=false
            _tds_render_inline_formats "$current_line"
            echo

            current_line="$word"
            current_len=$word_len
        else
            # Add word to current line
            if [[ -n "$current_line" ]]; then
                current_line+=" $word"
                current_len=$((current_len + word_len + 1))
            else
                current_line="$word"
                current_len=$word_len
            fi
        fi
    done

    # Print final line
    if [[ -n "$current_line" ]]; then
        if [[ "$first_line" == false ]]; then
            printf "%*s" "$continuation_indent" ""
        fi
        _tds_render_inline_formats "$current_line"
        echo
    fi
}

# Helper: Render inline formatting in text
_tds_render_inline_formats() {
    local text="$1"

    # Bold **text**
    while [[ "$text" =~ (.*)\*\*([^*]+)\*\*(.*) ]]; do
        if [[ -n "${BASH_REMATCH[1]}" ]]; then
            tds_text_color "text.primary"
            printf "%s" "${BASH_REMATCH[1]}"
            reset_color
        fi

        printf "\033[1m"
        tds_text_color "content.emphasis.bold"
        printf "%s" "${BASH_REMATCH[2]}"
        reset_color

        text="${BASH_REMATCH[3]}"
    done

    # Inline code `code`
    while [[ "$text" =~ (.*)\`([^\`]+)\`(.*) ]]; do
        if [[ -n "${BASH_REMATCH[1]}" ]]; then
            tds_text_color "text.primary"
            printf "%s" "${BASH_REMATCH[1]}"
            reset_color
        fi

        tds_text_color "content.code.inline"
        printf "%s" "${BASH_REMATCH[2]}"
        reset_color

        text="${BASH_REMATCH[3]}"
    done

    # Remaining text
    if [[ -n "$text" ]]; then
        tds_text_color "text.primary"
        printf "%s" "$text"
        reset_color
    fi
}

# Render code block line
# Args: line, [width]
tds_render_code_line() {
    local line="$1"
    local width="${2:-${TDS_MARKDOWN_WIDTH:-${COLUMNS:-80}}}"

    # Account for "│ " prefix (2 chars)
    local content_width=$((width - 2))

    # Wrap if needed
    local wrapped_line="$line"
    if [[ ${#line} -gt $content_width ]]; then
        wrapped_line=$(echo "$line" | fmt -w "$content_width")
    fi

    # Render each line with border
    while IFS= read -r content_line; do
        printf "\033[2m"  # Dim intensity for border
        tds_text_color "content.code.block"
        printf "│ "
        printf "\033[22m"  # Normal intensity for code text
        printf "%s\n" "$content_line"
        reset_color
    done <<< "$wrapped_line"
}

# Render code block header
# Args: language
tds_render_code_header() {
    local language="${1:-}"

    printf "\033[2m"  # Dim intensity
    tds_text_color "content.code.block"
    printf "┌─ %s\n" "$language"
    reset_color
}

# Render code block footer
tds_render_code_footer() {
    printf "\033[2m"  # Dim intensity
    tds_text_color "content.code.block"
    printf "└─\n"
    reset_color
}
