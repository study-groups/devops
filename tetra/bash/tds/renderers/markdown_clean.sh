#!/usr/bin/env bash

# TDS Markdown Renderer (Clean Refactor)
# Human-readable, token-based markdown rendering

# Load element renderers
source "${TDS_SRC}/semantics/markdown_elements.sh"

# Configuration
: "${TDS_MARKDOWN_WIDTH:=${COLUMNS:-80}}"

# ============================================================================
# MARKDOWN PARSER
# ============================================================================

tds_render_markdown_clean() {
    local file="$1"
    local in_code_block=false
    local code_language=""

    [[ ! -f "$file" ]] && { echo "Error: File not found: $file" >&2; return 1; }

    while IFS= read -r line; do

        # ====================================================================
        # CODE BLOCKS
        # ====================================================================
        if [[ "$line" =~ ^\`\`\`(.*)$ ]]; then
            if [[ "$in_code_block" == false ]]; then
                in_code_block=true
                code_language="${BASH_REMATCH[1]}"
                md_render_code_header "$code_language"
            else
                in_code_block=false
                md_render_code_footer
                echo
            fi
            continue
        fi

        if [[ "$in_code_block" == true ]]; then
            md_render_code_line "$line"
            continue
        fi

        # ====================================================================
        # HEADINGS
        # ====================================================================
        if [[ "$line" =~ ^(#{1,6})[[:space:]]+(.+)$ ]]; then
            local level=${#BASH_REMATCH[1]}
            local text="${BASH_REMATCH[2]}"
            md_render_heading "$level" "$text"
            continue
        fi

        # ====================================================================
        # HORIZONTAL RULE
        # ====================================================================
        if [[ "$line" =~ ^([-*_]){3,}$ ]]; then
            md_render_hr "$TDS_MARKDOWN_WIDTH"
            continue
        fi

        # ====================================================================
        # UNORDERED LISTS
        # ====================================================================
        if [[ "$line" =~ ^([[:space:]]*)[-*+][[:space:]]+(.+)$ ]]; then
            local indent="${BASH_REMATCH[1]}"
            local content="${BASH_REMATCH[2]}"
            local indent_level=$((${#indent} / 2))
            md_render_list_item "$content" "$indent_level" "$TDS_MARKDOWN_WIDTH"
            continue
        fi

        # ====================================================================
        # ORDERED LISTS
        # ====================================================================
        if [[ "$line" =~ ^([[:space:]]*)([0-9]+)\.[[:space:]]+(.+)$ ]]; then
            local indent="${BASH_REMATCH[1]}"
            local number="${BASH_REMATCH[2]}"
            local content="${BASH_REMATCH[3]}"
            local indent_level=$((${#indent} / 2))
            md_render_ordered_list_item "$content" "$number" "$indent_level" "$TDS_MARKDOWN_WIDTH"
            continue
        fi

        # ====================================================================
        # BLOCKQUOTES
        # ====================================================================
        if [[ "$line" =~ ^\>[[:space:]]*(.+)$ ]]; then
            local content="${BASH_REMATCH[1]}"
            md_render_quote "$content" "$TDS_MARKDOWN_WIDTH"
            continue
        fi

        # ====================================================================
        # INLINE FORMATTING
        # ====================================================================

        # Bold **text**
        while [[ "$line" =~ (.*)\*\*([^*]+)\*\*(.*) ]]; do
            printf "%s" "${BASH_REMATCH[1]}"
            md_render_bold "${BASH_REMATCH[2]}"
            line="${BASH_REMATCH[3]}"
        done

        # Inline code `code`
        while [[ "$line" =~ (.*)\`([^\`]+)\`(.*) ]]; do
            printf "%s" "${BASH_REMATCH[1]}"
            md_render_code_inline "${BASH_REMATCH[2]}"
            line="${BASH_REMATCH[3]}"
        done

        # Links [text](url)
        while [[ "$line" =~ (.*)\[([^\]]+)\]\(([^\)]+)\)(.*) ]]; do
            printf "%s" "${BASH_REMATCH[1]}"
            md_render_link "${BASH_REMATCH[2]}"
            line="${BASH_REMATCH[4]}"
        done

        # ====================================================================
        # PARAGRAPHS & BLANK LINES
        # ====================================================================
        if [[ -n "$line" ]]; then
            md_render_paragraph "$line" "$TDS_MARKDOWN_WIDTH"
        else
            echo  # Preserve blank lines
        fi

    done < "$file"
}

# Command interface (compatible with existing tds_markdown)
tds_markdown_clean() {
    local file="" use_pager=false

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --pager|-p) use_pager=true; shift ;;
            --width|-w) TDS_MARKDOWN_WIDTH="$2"; shift 2 ;;
            --help|-h)
                cat <<EOF
TDS Markdown Renderer (Clean Refactor)

Usage: tds_markdown_clean [OPTIONS] <file>

Options:
  --pager, -p       Use pager for output
  --width, -w N     Set line width (default: terminal width)
  --help, -h        Show this help

Features:
  • Token-based design system
  • Human-readable code structure
  • Complete separation of tokens, elements, and rendering
  • Easy to customize and extend

Examples:
  tds_markdown_clean README.md
  tds_markdown_clean --pager --width 100 document.md
EOF
                return 0
                ;;
            *) file="$1"; shift ;;
        esac
    done

    [[ -z "$file" ]] && { echo "Error: No file specified" >&2; return 1; }

    if [[ "$use_pager" == true ]]; then
        tds_render_markdown_clean "$file" | ${TDS_MARKDOWN_PAGER:-less -R}
    else
        tds_render_markdown_clean "$file"
    fi
}

# Export
export -f tds_render_markdown_clean tds_markdown_clean
