#!/usr/bin/env bash

# Chroma Markdown Parser
# Delegates to TDS markdown renderer

#==============================================================================
# RENDER FUNCTION
#==============================================================================

# Render markdown content from stdin
_chroma_parse_markdown() {
    tds_render_markdown "-"
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
