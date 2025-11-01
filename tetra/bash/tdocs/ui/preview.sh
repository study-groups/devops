#!/usr/bin/env bash

# TDOC Preview System
# TDS-based document preview and viewing

# Truncate path to specified length with ... in the middle
# Usage: _tdoc_truncate_path "/very/long/path/to/file.md" 65
_tdoc_truncate_path() {
    local path="$1"
    local max_len="${2:-65}"

    local path_len=${#path}

    if (( path_len <= max_len )); then
        echo "$path"
        return 0
    fi

    # Calculate how many chars to keep on each side
    local ellipsis="..."
    local ellipsis_len=${#ellipsis}
    local available=$((max_len - ellipsis_len))
    local left_len=$((available / 2))
    local right_len=$((available - left_len))

    # Extract left and right portions
    local left="${path:0:$left_len}"
    local right="${path: -$right_len}"

    echo "${left}${ellipsis}${right}"
}

# Add left margin for centered column with left-justified text
# Usage: echo "text" | _tdoc_indent_preview
_tdoc_indent_preview() {
    local term_width="${COLUMNS:-80}"
    local content_width=70  # Width of the content column

    # Calculate left margin to center the content column
    local left_margin=$(( (term_width - content_width) / 2 ))
    [[ $left_margin -lt 4 ]] && left_margin=4  # Minimum margin

    while IFS= read -r line; do
        # Add left margin, keep text left-justified
        printf "%${left_margin}s%s\n" "" "$line"
    done
}

# Convert markdown bold (**text**) to ANSI bold with color
# Usage: _tdoc_render_bold "Some **bold** text"
_tdoc_render_bold() {
    local line="$1"

    # Replace **text** with ANSI bold + color (bold + green)
    # Use perl for reliable non-greedy matching
    if command -v perl >/dev/null 2>&1; then
        echo "$line" | perl -pe 's/\*\*(.+?)\*\*/\033[1;32m$1\033[0m/g'
    else
        # Fallback: simple sed (may not handle all edge cases)
        echo "$line" | sed -E 's/\*\*([^*]+)\*\*/\x1b[1;32m\1\x1b[0m/g'
    fi
}

# Apply markdown heading styles
# Usage: _tdoc_style_heading "### Some Heading"
_tdoc_style_heading() {
    local line="$1"

    # H1: # Title -> Bold + Cyan (bright and colorful)
    if [[ "$line" =~ ^#[[:space:]](.+)$ ]]; then
        local text="${BASH_REMATCH[1]}"
        echo -e "\033[1;36m${text}\033[0m"  # Bold + cyan
        return 0
    fi

    # H2: ## Subtitle -> Bold + Italic (magenta)
    if [[ "$line" =~ ^##[[:space:]](.+)$ ]]; then
        local text="${BASH_REMATCH[1]}"
        echo -e "\033[1;3;35m${text}\033[0m"  # Bold + italic + magenta
        return 0
    fi

    # H3: ### Heading -> Italic (yellow)
    if [[ "$line" =~ ^###[[:space:]](.+)$ ]]; then
        local text="${BASH_REMATCH[1]}"
        echo -e "\033[3;33m${text}\033[0m"  # Italic + yellow
        return 0
    fi

    # Not a heading, return as-is
    echo "$line"
}

# Format preview content with fmt and limit to width
# Usage: _tdoc_format_preview_content <file> <max_lines>
_tdoc_format_preview_content() {
    local file="$1"
    local max_lines="${2:-5}"
    local fmt_width="${3:-70}"

    local in_frontmatter=false
    local line_count=0

    # Process content lines (skip frontmatter, style headings)
    while IFS= read -r line && (( line_count < max_lines )); do
        # Skip frontmatter
        if [[ "$line" == "---" ]]; then
            if [[ "$in_frontmatter" == "false" ]]; then
                in_frontmatter=true
                continue
            else
                in_frontmatter=false
                continue
            fi
        fi

        if [[ "$in_frontmatter" == "true" ]]; then
            continue
        fi

        # Skip empty lines at start
        if [[ -z "$line" ]] && (( line_count == 0 )); then
            continue
        fi

        # Check if it's a heading and style it
        if [[ "$line" =~ ^#{1,3}[[:space:]] ]]; then
            _tdoc_style_heading "$line"
        else
            # Regular line - handle bold markdown and wrap if too long
            local processed_line="$(_tdoc_render_bold "$line")"
            if [[ ${#line} -gt $fmt_width ]]; then
                echo "$processed_line" | fmt -w "$fmt_width"
            else
                echo "$processed_line"
            fi
        fi

        ((line_count++))
    done < "$file"
}

# Preview a document with metadata and color rendering
tdoc_preview_doc() {
    local file="$1"
    local show_content="${2:-true}"

    if [[ ! -f "$file" ]]; then
        echo "Error: File not found: $file" >&2
        return 1
    fi

    # Get metadata
    local meta=$(tdoc_get_metadata "$file")

    if [[ "$meta" == "{}" ]]; then
        echo "Warning: No metadata found for $file" >&2
        echo "Run 'tdoc init $file' to add metadata" >&2
        echo ""
    else
        # Render metadata header
        tdoc_render_metadata_header "$meta"
        echo ""
    fi

    # Render document if requested
    if [[ "$show_content" == "true" ]]; then
        if [[ "$TDS_LOADED" == "true" ]] && command -v tds_render_markdown >/dev/null 2>&1; then
            tds_render_markdown "$file"
        else
            # Fallback to plain cat
            cat "$file"
        fi
    fi
}

# View document (wrapper for tdoc view command)
tdoc_view_doc() {
    local file=""
    local use_pager=false
    local meta_only=false
    local raw=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --pager|-p)
                use_pager=true
                shift
                ;;
            --meta-only)
                meta_only=true
                shift
                ;;
            --raw)
                raw=true
                shift
                ;;
            --help|-h)
                cat <<EOF
tdoc view - Preview document with color rendering

USAGE:
  tdoc view [OPTIONS] <file>

OPTIONS:
  --pager, -p       Use pager for output
  --meta-only       Show metadata only, not content
  --raw             Show raw file with frontmatter

EXAMPLES:
  tdoc view bash/rag/docs/REPL_FIXES_20251016.md
  tdoc view --pager docs/guide.md
  tdoc view --meta-only report.md

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
        echo "Try: tdoc view --help" >&2
        return 1
    fi

    # Raw mode - just cat the file
    if [[ "$raw" == "true" ]]; then
        cat "$file"
        return 0
    fi

    # Meta-only mode
    if [[ "$meta_only" == "true" ]]; then
        tdoc_preview_doc "$file" false
        return 0
    fi

    # Normal preview
    if [[ "$use_pager" == "true" ]]; then
        tdoc_preview_doc "$file" | ${PAGER:-less -R}
    else
        tdoc_preview_doc "$file"
    fi
}

# Render document list with previews
tdoc_render_list_with_preview() {
    local meta_list=("$@")
    local term_width="${COLUMNS:-80}"
    local fmt_width=70  # Narrow width for preview content

    for meta_json in "${meta_list[@]}"; do
        local doc_path=$(echo "$meta_json" | grep -o '"doc_path": "[^"]*"' | cut -d'"' -f4)
        local filename=$(basename "$doc_path")

        # Header line (BRIGHT, indented)
        if [[ "$TDS_LOADED" == "true" ]]; then
            tds_text_color "text.primary"  # Bright
            printf "● %s\n" "$filename" | _tdoc_indent_preview
            reset_color
        else
            printf "● %s\n" "$filename" | _tdoc_indent_preview
        fi

        # Metadata (BRIGHT, indented)
        tdoc_render_metadata_header "$meta_json" | _tdoc_indent_preview

        # Truncated path (BRIGHT, indented)
        local truncated_path=$(_tdoc_truncate_path "$doc_path" 65)
        if [[ "$TDS_LOADED" == "true" ]]; then
            tds_text_color "text.secondary"
            printf "%s\n" "$truncated_path" | _tdoc_indent_preview
            reset_color
        else
            printf "%s\n" "$truncated_path" | _tdoc_indent_preview
        fi

        # Show first 5 lines of document content (DIMMED, indented, formatted)
        if [[ -f "$doc_path" ]]; then
            # Content text is dimmed/muted
            if [[ "$TDS_LOADED" == "true" ]]; then
                tds_text_color "text.muted"  # Dimmed
            else
                printf "\033[2m"  # Dim ANSI code
            fi

            # Format and indent preview content
            _tdoc_format_preview_content "$doc_path" 5 "$fmt_width" | _tdoc_indent_preview

            if [[ "$TDS_LOADED" == "true" ]]; then
                reset_color
            else
                printf "\033[0m"  # Reset
            fi
        fi

        echo ""
    done
}
