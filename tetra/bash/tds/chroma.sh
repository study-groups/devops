#!/usr/bin/env bash

# Chroma - Backward compatibility wrapper for TDS markdown renderer
# DEPRECATED: This file is maintained for backward compatibility only.
# New code should use TDS directly: source tds/tds.sh && tds_markdown

# Load TDS system
TDS_SRC="${TDS_SRC:-$(dirname "${BASH_SOURCE[0]}")/../tds}"
if [[ -f "$TDS_SRC/tds.sh" ]]; then
    source "$TDS_SRC/tds.sh"
else
    echo "Error: TDS not found at $TDS_SRC" >&2
    echo "Chroma has been refactored to use the TDS (Tetra Display System)" >&2
    return 1
fi

# Chroma configuration (map to TDS config)
: "${CHROMA_PAGER:=less -R}"
export TDS_MARKDOWN_PAGER="$CHROMA_PAGER"

# Legacy chroma_render function - delegates to TDS
chroma_render() {
    tds_render_markdown "$@"
}

# Chroma command interface - delegates to TDS
chroma() {
    local file=""
    local use_pager=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --pager|-p)
                use_pager=true
                shift
                ;;
            --theme|-t)
                # Theme support deprecated, ignore for now
                shift 2
                ;;
            --width|-w)
                TDS_MARKDOWN_WIDTH="$2"
                shift 2
                ;;
            --help|-h)
                cat <<EOF
Chroma - Markdown renderer (TDS-powered)

NOTE: Chroma has been refactored to use the TDS (Tetra Display System).
      This wrapper provides backward compatibility.

Usage: chroma [OPTIONS] <file>

Options:
  --pager, -p       Use pager for output
  --width, -w N     Set line width (default: terminal width)
  --help, -h        Show this help

Environment:
  CHROMA_PAGER      Pager command (default: less -R)
  QA_VIEWER         Set to 'chroma' to use as default viewer

Examples:
  chroma README.md
  chroma --pager document.md
  QA_VIEWER=chroma qa browse

Migration:
  For new code, use TDS directly:
    source \$TETRA_SRC/bash/tds/tds.sh
    tds_markdown file.md
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
        echo "Try: chroma --help" >&2
        return 1
    fi

    # Delegate to TDS markdown renderer
    if [[ "$use_pager" == true ]]; then
        tds_markdown --pager "$file"
    else
        tds_markdown "$file"
    fi
}

# Export for use as command
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    # Script is being executed directly
    chroma "$@"
fi
