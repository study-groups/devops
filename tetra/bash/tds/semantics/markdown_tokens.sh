#!/usr/bin/env bash

# TDS Markdown Token System
# Maps markdown elements to design tokens with intensity modifiers

# ============================================================================
# TOKEN ACCESSORS
# ============================================================================

# Apply token with optional intensity modifier
# Args: token_path, [intensity: dim|normal|bright]
md_token() {
    local token="$1"
    local intensity="${2:-normal}"

    # Apply intensity ANSI code
    case "$intensity" in
        dim)    printf "\033[2m" ;;
        bright) printf "\033[1m" ;;
        normal) ;;
    esac

    # Apply color token
    tds_text_color "$token"
}

# Reset all formatting
md_reset() {
    reset_color
}

# ============================================================================
# MARKDOWN ELEMENT TOKENS
# ============================================================================

# Headings
md_token_heading_h1()     { md_token "content.heading.h1" "bright"; }
md_token_heading_h2()     { md_token "content.heading.h2" "bright"; }
md_token_heading_h3()     { md_token "content.heading.h3" "normal"; }
md_token_heading_h4()     { md_token "content.heading.h4" "normal"; }

# Code blocks
md_token_code_border()    { md_token "content.code.block" "dim"; }
md_token_code_header()    { md_token "content.code.block" "dim"; }
md_token_code_text()      { md_token "content.code.block" "normal"; }

# Inline code
md_token_code_inline()    { md_token "content.code.inline" "normal"; }

# Lists
md_token_list_bullet()    { md_token "content.list" "dim"; }
md_token_list_number()    { md_token "content.list" "dim"; }
md_token_list_text()      { md_token "text.primary" "normal"; }

# Quotes
md_token_quote_marker()   { md_token "content.quote" "dim"; }
md_token_quote_text()     { md_token "content.quote" "normal"; }

# Links
md_token_link_text()      { md_token "content.link" "normal"; }
md_token_link_url()       { md_token "text.secondary" "dim"; }

# Emphasis
md_token_bold()           { printf "\033[1m"; md_token "content.emphasis.bold" "normal"; }
md_token_italic()         { printf "\033[3m"; md_token "content.emphasis.italic" "normal"; }

# Horizontal rule
md_token_hr()             { md_token "content.hr" "dim"; }

# Text
md_token_text_primary()   { md_token "text.primary" "normal"; }
md_token_text_secondary() { md_token "text.secondary" "normal"; }

# Export token functions
export -f md_token md_reset
export -f md_token_heading_h1 md_token_heading_h2 md_token_heading_h3 md_token_heading_h4
export -f md_token_code_border md_token_code_header md_token_code_text md_token_code_inline
export -f md_token_list_bullet md_token_list_number md_token_list_text
export -f md_token_quote_marker md_token_quote_text
export -f md_token_link_text md_token_link_url
export -f md_token_bold md_token_italic
export -f md_token_hr
export -f md_token_text_primary md_token_text_secondary
