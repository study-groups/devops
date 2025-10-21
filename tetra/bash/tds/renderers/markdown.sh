#!/usr/bin/env bash

# TDS Markdown Renderer
# Generic markdown renderer using semantic color tokens
# Refactored from qa/chroma.sh to use TDS token system

# Configuration
: "${TDS_MARKDOWN_PAGER:=less -R}"
: "${TDS_MARKDOWN_WIDTH:=${COLUMNS:-80}}"

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
            tds_render_code_line "$line"
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

        # List items - use semantic list renderer
        if [[ "$line" =~ ^([[:space:]]*)[-*+][[:space:]]+(.+)$ ]]; then
            local indent="${BASH_REMATCH[1]}"
            local content="${BASH_REMATCH[2]}"
            local indent_level=$((${#indent} / 2))  # Count spaces
            tds_render_list_item "$content" "$indent_level"
            continue
        fi

        # Blockquotes - use semantic quote renderer
        if [[ "$line" =~ ^\>[[:space:]]*(.+)$ ]]; then
            local content="${BASH_REMATCH[1]}"
            tds_render_quote "$content"
            continue
        fi

        # Process inline formatting
        # This is tricky with sed and color codes, so we'll do it simpler

        # Bold **text** - find and highlight
        while [[ "$line" =~ (.*)\*\*([^*]+)\*\*(.*) ]]; do
            local before="${BASH_REMATCH[1]}"
            local bold="${BASH_REMATCH[2]}"
            local after="${BASH_REMATCH[3]}"

            # Print before
            tds_text_color "text.primary"
            printf "%s" "$before"

            # Print bold
            tds_render_emphasis "bold" "$bold"

            # Continue with after
            line="$after"
        done

        # Inline code `code` - find and highlight
        while [[ "$line" =~ (.*)\`([^\`]+)\`(.*) ]]; do
            local before="${BASH_REMATCH[1]}"
            local code="${BASH_REMATCH[2]}"
            local after="${BASH_REMATCH[3]}"

            # Print before
            tds_text_color "text.primary"
            printf "%s" "$before"

            # Print code
            tds_render_emphasis "code" "$code"

            # Continue with after
            line="$after"
        done

        # Links [text](url)
        while [[ "$line" =~ (.*)\[([^\]]+)\]\(([^\)]+)\)(.*) ]]; do
            local before="${BASH_REMATCH[1]}"
            local link_text="${BASH_REMATCH[2]}"
            local url="${BASH_REMATCH[3]}"
            local after="${BASH_REMATCH[4]}"

            # Print before
            tds_text_color "text.primary"
            printf "%s" "$before"

            # Print link
            tds_render_link "$link_text"

            # Continue with after
            line="$after"
        done

        # Normal text - use semantic paragraph renderer
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
