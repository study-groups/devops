#!/usr/bin/env bash

# TDS Markdown Renderer
# Generic markdown renderer using semantic color tokens
# Refactored from qa/chroma.sh to use TDS token system

# Configuration
: "${TDS_MARKDOWN_PAGER:=less -R}"
: "${TDS_MARKDOWN_WIDTH:=${COLUMNS:-80}}"

# Margin configuration (set by chroma or other callers)
: "${TDS_MARGIN_TOP:=0}"
: "${TDS_MARGIN_RIGHT:=0}"
: "${TDS_MARGIN_BOTTOM:=0}"
: "${TDS_MARGIN_LEFT:=0}"

# Helper: Add left margin to piped input
# Usage: content | _tds_add_left_margin N
_tds_add_left_margin() {
    local margin="$1"
    [[ "$margin" -eq 0 ]] && cat && return
    while IFS= read -r line; do
        printf "%*s%s\n" "$margin" "" "$line"
    done
}

# Helper: Add top/bottom margins (static - only at start/end)
# Usage: _tds_add_vertical_margins TOP BOTTOM < content
_tds_add_vertical_margins() {
    local top="$1"
    local bottom="$2"

    # Print top margin
    for ((i=0; i<top; i++)); do
        echo
    done

    # Print content
    cat

    # Print bottom margin
    for ((i=0; i<bottom; i++)); do
        echo
    done
}


# Render a single line of terminal output with semantic tokens
# Determines line type by prefix and applies appropriate coloring
# Args: line
_tds_render_terminal_line() {
    local line="$1"

    # Determine line type by prefix and apply appropriate token
    case "$line" in
        '$'*|'>'*)
            # Command line - prompt symbol + command
            tds_text_color "content.terminal.prompt"
            printf "    %s" "${line:0:1}"
            tds_text_color "content.terminal.command"
            printf "\033[1m%s\033[0m\n" "${line:1}"
            ;;
        '#'*)
            # Comment line - dim
            tds_text_color "content.terminal.comment"
            printf "\033[2m    %s\033[0m\n" "$line"
            ;;
        '✓'*|'\[OK\]'*)
            # Success output - green
            tds_text_color "content.terminal.success"
            printf "    %s\n" "$line"
            ;;
        '⚠'*|'\[WARN\]'*)
            # Warning output - orange
            tds_text_color "content.terminal.warning"
            printf "    %s\n" "$line"
            ;;
        '✗'*|'\[ERR\]'*)
            # Error output - red
            tds_text_color "content.terminal.error"
            printf "    %s\n" "$line"
            ;;
        *)
            # Normal output
            tds_text_color "content.terminal.output"
            printf "    %s\n" "$line"
            ;;
    esac
    reset_color
}

# Process inline formatting and return formatted string
# Args: text
tds_process_inline_formatting() {
    local text="$1"
    local result=""

    # Bold **text** - simple greedy approach, process left to right
    while [[ "$text" =~ \*\*([^*]+)\*\* ]]; do
        local match="${BASH_REMATCH[0]}"
        local bold="${BASH_REMATCH[1]}"
        local before="${text%%"$match"*}"
        local after="${text#*"$match"}"

        result+="$before"
        result+="$(printf "\033[1m"; tds_text_color "content.emphasis.bold"; printf "%s" "$bold"; reset_color)"
        text="$after"
    done
    result+="$text"
    text="$result"
    result=""

    # Inline code `code`
    while [[ "$text" =~ (.*)\`([^\`]+)\`(.*) ]]; do
        result+="${BASH_REMATCH[1]}"
        result+="$(tds_text_color "content.code.inline"; printf "%s" "${BASH_REMATCH[2]}"; reset_color)"
        text="${BASH_REMATCH[3]}"
    done
    result+="$text"

    echo -n "$result"
}

# Render markdown from file or stdin using semantic tokens
tds_render_markdown() {
    local file="$1"
    local in_code_block=false
    local code_fence=""
    local code_content=""
    local input_source

    # Determine input source: stdin or file
    if [[ -z "$file" || "$file" == "-" ]]; then
        # Read from stdin
        input_source="/dev/stdin"
    elif [[ ! -f "$file" ]]; then
        echo "Error: File not found: $file" >&2
        return 1
    else
        input_source="$file"
    fi

    while IFS= read -r line; do
        # Code blocks (fenced) - handle indented fences too
        if [[ "$line" =~ ^([[:space:]]*)\`\`\`(.*)$ ]]; then
            local fence_indent="${BASH_REMATCH[1]}"
            if [[ "$in_code_block" == false ]]; then
                in_code_block=true
                code_fence="${BASH_REMATCH[2]}"
                code_content=""
                # No header - just start collecting
                continue
            else
                in_code_block=false
                # Check if this is a mermaid flowchart block
                if [[ "$code_fence" == "mermaid" && "$code_content" =~ flowchart ]]; then
                    # Load mermaid renderer if available
                    if [[ -f "${TDS_SRC}/renderers/mermaid_flowchart.sh" ]]; then
                        source "${TDS_SRC}/renderers/mermaid_flowchart.sh"
                        tds_render_mermaid_flowchart "$code_content"
                    else
                        # Fallback - just output content
                        tds_text_color "content.code.inline"
                        printf "    %s\n" "$code_content"
                        reset_color
                    fi
                fi
                # Breathing room after code block
                echo
                code_content=""
                continue
            fi
        fi

        # Inside code block - render as indented colored text
        if [[ "$in_code_block" == true ]]; then
            if [[ "$code_fence" == "mermaid" ]]; then
                # Collect mermaid content
                if [[ -n "$code_content" ]]; then
                    code_content+=$'\n'
                fi
                code_content+="$line"
            elif [[ "$code_fence" == "terminal" ]]; then
                # Terminal block - render with semantic tokens based on line prefix
                _tds_render_terminal_line "$line"
            else
                # Regular code - render indented with color
                # Comments get dimmer color
                if [[ "$line" =~ ^[[:space:]]*# ]]; then
                    tds_text_color "text.secondary"
                    printf "\033[2m    %s\033[0m\n" "$line"
                else
                    tds_text_color "content.code.inline"
                    printf "    %s\n" "$line"
                fi
                reset_color
            fi
            continue
        fi

        # Indented sub-items (notes under checkbox items)
        if [[ "$line" =~ ^[[:space:]]+[-*+][[:space:]]+(.+)$ ]]; then
            local content="${BASH_REMATCH[1]}"
            tds_text_color "text.secondary"
            printf "  • %s\n" "$content"
            reset_color
            continue
        fi

        # Headers - use semantic heading renderer
        if [[ "$line" =~ ^(#{1,6})[[:space:]]+(.+)$ ]]; then
            local level=${#BASH_REMATCH[1]}
            local text="${BASH_REMATCH[2]}"
            tds_render_heading "$level" "$text"
            continue
        fi

        # Horizontal rule
        if [[ "$line" =~ ^([-*_]){3,}$ ]]; then
            tds_render_hr "$TDS_MARKDOWN_WIDTH"
            continue
        fi

        # Checkbox list items: - [ ] **01** Title or - [x] **01** Title
        if [[ "$line" =~ ^([[:space:]]*)[-*+][[:space:]]+\[([[:space:]xX])\][[:space:]]+\*\*([0-9]+)\*\*[[:space:]]+(.+)$ ]]; then
            local indent="${BASH_REMATCH[1]}"
            local check="${BASH_REMATCH[2]}"
            local number="${BASH_REMATCH[3]}"
            local title="${BASH_REMATCH[4]}"
            local indent_level=$((${#indent} / 2))
            tds_render_checkbox_item "$check" "$number" "$title" "$indent_level"
            continue
        fi

        # Simple checkbox list items: - [ ] Text (no number)
        if [[ "$line" =~ ^([[:space:]]*)[-*+][[:space:]]+\[([[:space:]xX])\][[:space:]]+(.+)$ ]]; then
            local indent="${BASH_REMATCH[1]}"
            local check="${BASH_REMATCH[2]}"
            local content="${BASH_REMATCH[3]}"
            local indent_level=$((${#indent} / 2))
            tds_render_checkbox_item "$check" "" "$content" "$indent_level"
            continue
        fi

        # Unordered list items (-, *, +)
        if [[ "$line" =~ ^([[:space:]]*)[-*+][[:space:]]+(.+)$ ]]; then
            local indent="${BASH_REMATCH[1]}"
            local content="${BASH_REMATCH[2]}"
            local indent_level=$((${#indent} / 2))  # Count spaces
            tds_render_list_item_with_inline "$content" "$indent_level" "$TDS_MARKDOWN_WIDTH"
            continue
        fi

        # Ordered list items (1. 2. 3. etc)
        if [[ "$line" =~ ^([[:space:]]*)([0-9]+)\.[[:space:]]+(.+)$ ]]; then
            local indent="${BASH_REMATCH[1]}"
            local number="${BASH_REMATCH[2]}"
            local content="${BASH_REMATCH[3]}"
            local indent_level=$((${#indent} / 2))  # Count spaces
            tds_render_ordered_list_item_with_inline "$content" "$number" "$indent_level" "$TDS_MARKDOWN_WIDTH"
            continue
        fi

        # Blockquotes - use semantic quote renderer
        if [[ "$line" =~ ^\>[[:space:]]*(.+)$ ]]; then
            local content="${BASH_REMATCH[1]}"
            tds_render_quote "$content" "$TDS_MARKDOWN_WIDTH"
            continue
        fi

        # Process inline formatting - build formatted line with ANSI codes
        local formatted_line=""

        # Bold **text** - find and highlight, process left to right
        while [[ "$line" =~ \*\*([^*]+)\*\* ]]; do
            local match="${BASH_REMATCH[0]}"
            local bold="${BASH_REMATCH[1]}"
            local before="${line%%"$match"*}"
            local after="${line#*"$match"}"

            # Add before text to formatted line
            formatted_line+="$(tds_text_color "text.primary")$before$(reset_color)"

            # Add bold text to formatted line
            formatted_line+="$(tds_render_emphasis "bold" "$bold" | tr -d '\n')"

            # Continue with after
            line="$after"
        done

        # Add remaining text after bold processing with color
        if [[ -n "$line" ]]; then
            formatted_line+="$(tds_text_color "text.primary")$line$(reset_color)"
        fi
        line="$formatted_line"
        formatted_line=""

        # Inline code `code` - find and highlight
        while [[ "$line" =~ (.*)\`([^\`]+)\`(.*) ]]; do
            local before="${BASH_REMATCH[1]}"
            local code="${BASH_REMATCH[2]}"
            local after="${BASH_REMATCH[3]}"

            # Add before text to formatted line (already has color from previous step)
            formatted_line+="$before"

            # Add code text to formatted line
            formatted_line+="$(tds_render_emphasis "code" "$code" | tr -d '\n')"

            # Continue with after
            line="$after"
        done

        # Add remaining text after code processing (already has color from bold step)
        formatted_line+="$line"
        line="$formatted_line"
        formatted_line=""

        # Links [text](url)
        while [[ "$line" =~ (.*)\[([^\]]+)\]\(([^\)]+)\)(.*) ]]; do
            local before="${BASH_REMATCH[1]}"
            local link_text="${BASH_REMATCH[2]}"
            local url="${BASH_REMATCH[3]}"
            local after="${BASH_REMATCH[4]}"

            # Add before text to formatted line (already has color from previous steps)
            formatted_line+="$before"

            # Add link text to formatted line
            formatted_line+="$(tds_render_link "$link_text" | tr -d '\n')"

            # Continue with after
            line="$after"
        done

        # Add remaining text after link processing (already has color from bold step)
        formatted_line+="$line"
        line="$formatted_line"

        # Now render the complete formatted line with wrapping
        if [[ -n "$line" ]]; then
            tds_render_paragraph "$line" "$TDS_MARKDOWN_WIDTH"
        else
            echo  # Preserve blank lines
        fi

        reset_color
    done < "$input_source"
}

# Markdown command interface (compatible with chroma)
tds_markdown() {
    local file=""
    local use_pager=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --pager|-p)
                use_pager=true
                shift
                ;;
            --width|-w)
                TDS_MARKDOWN_WIDTH="$2"
                shift 2
                ;;
            --help|-h)
                cat <<EOF
TDS Markdown Renderer

Usage: tds_markdown [OPTIONS] <file>

Options:
  --pager, -p       Use pager for output
  --width, -w N     Set line width (default: terminal width)
  --help, -h        Show this help

Environment:
  TDS_MARKDOWN_PAGER   Pager command (default: less -R)
  TDS_MARKDOWN_WIDTH   Line width (default: \$COLUMNS)

Examples:
  tds_markdown README.md
  tds_markdown --pager document.md
  tds_markdown --width 100 file.md

Note: This is the TDS implementation of the chroma markdown renderer.
      It uses semantic color tokens from the TDS token system.
EOF
                return 0
                ;;
            *)
                file="$1"
                shift
                ;;
        esac
    done

    # If no file specified and stdin is a pipe, read from stdin
    if [[ -z "$file" ]]; then
        if [[ -p /dev/stdin || ! -t 0 ]]; then
            file="-"
        else
            echo "Error: No file specified" >&2
            echo "Try: tds_markdown --help" >&2
            return 1
        fi
    fi

    # Apply margins if set
    local margin_left="${TDS_MARGIN_LEFT:-0}"
    local margin_right="${TDS_MARGIN_RIGHT:-0}"
    local margin_top="${TDS_MARGIN_TOP:-0}"
    local margin_bottom="${TDS_MARGIN_BOTTOM:-0}"

    # Adjust content width if right margin is set
    if [[ "$margin_right" -gt 0 ]]; then
        local term_width=${COLUMNS:-80}
        local adjusted_width=$((term_width - margin_left - margin_right))
        [[ $adjusted_width -lt 40 ]] && adjusted_width=40
        TDS_MARKDOWN_WIDTH="$adjusted_width"
    fi

    # Render with margins applied
    if [[ "$use_pager" == true ]]; then
        tds_render_markdown "$file" | \
            _tds_add_left_margin "$margin_left" | \
            _tds_add_vertical_margins "$margin_top" "$margin_bottom" | \
            $TDS_MARKDOWN_PAGER
    else
        tds_render_markdown "$file" | \
            _tds_add_left_margin "$margin_left" | \
            _tds_add_vertical_margins "$margin_top" "$margin_bottom"
    fi
}

# Export functions
export -f tds_render_markdown tds_markdown

# Export for use as command
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    # Script is being executed directly
    tds_markdown "$@"
fi
