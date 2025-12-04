#!/usr/bin/env bash

# Chroma TOML Parser
# Syntax highlighting for TOML using TDS semantic colors

#==============================================================================
# RENDER FUNCTION
#==============================================================================

# Render TOML content from stdin
_chroma_parse_toml() {
    local line key value

    while IFS= read -r line || [[ -n "$line" ]]; do
        # Empty lines
        if [[ -z "$line" ]]; then
            echo
            continue
        fi

        # Comments
        if [[ "$line" =~ ^[[:space:]]*#(.*)$ ]]; then
            tds_text_color "text.secondary"
            printf "\033[3m%s\033[0m\n" "$line"
            continue
        fi

        # Section headers [section.name]
        if [[ "$line" =~ ^[[:space:]]*\[([^\]]+)\][[:space:]]*$ ]]; then
            tds_text_color "content.heading.h3"
            printf "\033[1m%s\033[0m\n" "$line"
            continue
        fi

        # Key-value pairs
        if [[ "$line" =~ ^([^=]+)=(.*)$ ]]; then
            key="${BASH_REMATCH[1]}"
            value="${BASH_REMATCH[2]}"

            # Render key (bold)
            tds_text_color "content.emphasis.bold"
            printf "\033[1m%s\033[0m" "$key"

            # Equals sign
            tds_text_color "text.secondary"
            printf "="

            # Render value based on type
            _chroma_toml_value "$value"
            echo
            continue
        fi

        # Default: print as-is
        echo "$line"
    done
}

#==============================================================================
# VALUE RENDERING
#==============================================================================

# Render a TOML value with appropriate coloring
_chroma_toml_value() {
    local value="$1"

    # Quoted strings
    if [[ "$value" =~ ^[[:space:]]*\"(.*)\"[[:space:]]*$ ]]; then
        tds_text_color "content.code.inline"
        printf " \"%s\"" "${BASH_REMATCH[1]}"
        return
    fi

    # Single-quoted strings
    if [[ "$value" =~ ^[[:space:]]*\'(.*)\'[[:space:]]*$ ]]; then
        tds_text_color "content.code.inline"
        printf " '%s'" "${BASH_REMATCH[1]}"
        return
    fi

    # Booleans
    if [[ "$value" =~ ^[[:space:]]*(true|false)[[:space:]]*$ ]]; then
        tds_text_color "interactive.active"
        printf " %s" "${BASH_REMATCH[1]}"
        return
    fi

    # Numbers (integers and floats)
    if [[ "$value" =~ ^[[:space:]]*(-?[0-9]+\.?[0-9]*)[[:space:]]*$ ]]; then
        tds_text_color "content.link"
        printf " %s" "${BASH_REMATCH[1]}"
        return
    fi

    # Arrays
    if [[ "$value" =~ ^\[.*\]$ ]]; then
        tds_text_color "content.list.bullet"
        printf " %s" "$value"
        return
    fi

    # Inline tables
    if [[ "$value" =~ ^\{.*\}$ ]]; then
        tds_text_color "content.quote"
        printf " %s" "$value"
        return
    fi

    # Default
    tds_text_color "text.primary"
    printf "%s" "$value"
}

#==============================================================================
# VALIDATION
#==============================================================================

_chroma_parse_toml_validate() {
    declare -F tds_text_color &>/dev/null || return 1
    return 0
}

#==============================================================================
# INFO
#==============================================================================

_chroma_parse_toml_info() {
    cat <<'EOF'
Renders TOML with syntax highlighting.

Color scheme:
  [sections]     -> content.heading.h3 (bold)
  key =          -> content.emphasis.bold
  "strings"      -> content.code.inline
  numbers        -> content.link
  true/false     -> interactive.active
  # comments     -> text.secondary (italic)
  [arrays]       -> content.list.bullet
  {inline}       -> content.quote
EOF
}

#==============================================================================
# REGISTRATION
#==============================================================================

chroma_register_parser "toml" "_chroma_parse_toml" "toml" \
    "TOML configuration files"
