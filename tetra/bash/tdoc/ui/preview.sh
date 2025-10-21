#!/usr/bin/env bash

# TDOC Preview System
# TDS-based document preview and viewing

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

    for meta_json in "${meta_list[@]}"; do
        local doc_path=$(echo "$meta_json" | grep -o '"doc_path": "[^"]*"' | cut -d'"' -f4)
        local filename=$(basename "$doc_path")

        # Header line
        if [[ "$TDS_LOADED" == "true" ]]; then
            tds_text_color "content.heading.h3"
            printf "● %s\n" "$filename"
            reset_color
        else
            printf "● %s\n" "$filename"
        fi

        # Metadata
        printf "  "
        tdoc_render_metadata_header "$meta_json" | sed 's/^/  /'

        # Path
        if [[ "$TDS_LOADED" == "true" ]]; then
            printf "  "
            tds_text_color "text.secondary"
            printf "%s\n" "$doc_path"
            reset_color
        else
            printf "  %s\n" "$doc_path"
        fi

        echo ""
    done
}
