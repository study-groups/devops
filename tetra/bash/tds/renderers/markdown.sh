#!/usr/bin/env bash

# TDS Markdown Renderer
# Generic markdown renderer using semantic color tokens
# Refactored from qa/chroma.sh to use TDS token system

# Configuration
: "${TDS_MARKDOWN_PAGER:=less -R}"
: "${TDS_MARKDOWN_WIDTH:=${COLUMNS:-80}}"

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

# Render markdown file using semantic tokens
tds_render_markdown() {
    local file="$1"
    local in_code_block=false
    local code_fence=""

    if [[ ! -f "$file" ]]; then
        echo "Error: File not found: $file" >&2
        return 1
    fi

    while IFS= read -r line; do
        # Code blocks (fenced)
        if [[ "$line" =~ ^\`\`\`(.*)$ ]]; then
            if [[ "$in_code_block" == false ]]; then
                in_code_block=true
                code_fence="${BASH_REMATCH[1]}"
                tds_render_code_header "$code_fence"
                continue
            else
                in_code_block=false
                tds_render_code_footer
                echo
                continue
            fi
        fi

        # Inside code block - render as-is with semantic color
        if [[ "$in_code_block" == true ]]; then
            tds_render_code_line "$line" "$TDS_MARKDOWN_WIDTH"
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
    done < "$file"
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

    if [[ -z "$file" ]]; then
        echo "Error: No file specified" >&2
        echo "Try: tds_markdown --help" >&2
        return 1
    fi

    if [[ "$use_pager" == true ]]; then
        tds_render_markdown "$file" | $TDS_MARKDOWN_PAGER
    else
        tds_render_markdown "$file"
    fi
}

# Export for use as command
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    # Script is being executed directly
    tds_markdown "$@"
fi
