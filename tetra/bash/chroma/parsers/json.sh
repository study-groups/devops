#!/usr/bin/env bash

# Chroma JSON Parser
# Syntax highlighting for JSON using TDS semantic colors

#==============================================================================
# RENDER FUNCTION
#==============================================================================

# Render JSON content from stdin
_chroma_parse_json() {
    local line

    while IFS= read -r line || [[ -n "$line" ]]; do
        # Key-value pairs: "key": value
        if [[ "$line" =~ ^([[:space:]]*)\"([^\"]+)\"[[:space:]]*:(.*)$ ]]; then
            local indent="${BASH_REMATCH[1]}"
            local key="${BASH_REMATCH[2]}"
            local rest="${BASH_REMATCH[3]}"

            printf "%s" "$indent"
            tds_text_color "content.emphasis.bold"
            printf "\033[1m\"%s\"\033[0m" "$key"
            tds_text_color "text.secondary"
            printf ":"
            _chroma_json_value "$rest"
            echo
            continue
        fi

        # Structural characters or plain values
        echo "$line"
    done
}

#==============================================================================
# VALUE RENDERING
#==============================================================================

_chroma_json_value() {
    local value="$1"

    # String values
    if [[ "$value" =~ ^[[:space:]]*\"(.*)\"(.*)$ ]]; then
        tds_text_color "content.code.inline"
        printf " \"%s\"" "${BASH_REMATCH[1]}"
        tds_text_color "text.secondary"
        printf "%s" "${BASH_REMATCH[2]}"
        return
    fi

    # Booleans/null
    if [[ "$value" =~ ^[[:space:]]*(true|false|null)(.*)$ ]]; then
        tds_text_color "interactive.active"
        printf " %s" "${BASH_REMATCH[1]}"
        tds_text_color "text.secondary"
        printf "%s" "${BASH_REMATCH[2]}"
        return
    fi

    # Numbers
    if [[ "$value" =~ ^[[:space:]]*(-?[0-9]+\.?[0-9]*)([eE][+-]?[0-9]+)?(.*)$ ]]; then
        tds_text_color "content.link"
        printf " %s%s" "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}"
        tds_text_color "text.secondary"
        printf "%s" "${BASH_REMATCH[3]}"
        return
    fi

    # Default
    tds_text_color "text.primary"
    printf "%s" "$value"
}

#==============================================================================
# VALIDATION
#==============================================================================

_chroma_parse_json_validate() {
    declare -F tds_text_color &>/dev/null || return 1
    return 0
}

#==============================================================================
# INFO
#==============================================================================

_chroma_parse_json_info() {
    cat <<'EOF'
Renders JSON with syntax highlighting.

Color scheme:
  "keys":        -> content.emphasis.bold
  "strings"      -> content.code.inline
  numbers        -> content.link
  true/false/null -> interactive.active
  structural     -> text.secondary
EOF
}

#==============================================================================
# REGISTRATION
#==============================================================================

chroma_register_parser "json" "_chroma_parse_json" "json" \
    "JSON data files"
