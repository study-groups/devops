#!/usr/bin/env bash

# TDS TOML Renderer
# Syntax highlighting for TOML files using semantic color tokens
# Uses TDS token system for consistent theming

# Configuration
: "${TDS_TOML_PAGER:=less -R}"
: "${TDS_TOML_WIDTH:=${COLUMNS:-80}}"

# Render TOML file with syntax highlighting
tds_render_toml() {
    local file="$1"

    if [[ ! -f "$file" ]]; then
        echo "Error: File not found: $file" >&2
        return 1
    fi

    while IFS= read -r line; do
        # Skip empty lines (preserve them)
        if [[ -z "$line" ]]; then
            echo
            continue
        fi

        # Comments - start with #
        if [[ "$line" =~ ^[[:space:]]*#(.*)$ ]]; then
            local comment="${BASH_REMATCH[1]}"
            tds_text_color "text.secondary"
            printf "\033[3m"  # Italic
            printf "#%s" "$comment"
            reset_color
            echo
            continue
        fi

        # Section headers - [section] or [section.subsection]
        if [[ "$line" =~ ^[[:space:]]*\[([^\]]+)\][[:space:]]*$ ]]; then
            local section="${BASH_REMATCH[1]}"
            tds_text_color "content.heading.h3"
            printf "\033[1m"  # Bold
            printf "[%s]" "$section"
            reset_color
            echo
            continue
        fi

        # Key-value pairs - key = value
        if [[ "$line" =~ ^[[:space:]]*([^=]+)=(.*)$ ]]; then
            local key="${BASH_REMATCH[1]}"
            local value="${BASH_REMATCH[2]}"

            # Clean up whitespace
            key=$(echo "$key" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
            value=$(echo "$value" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

            # Render key (bold)
            tds_text_color "content.emphasis.bold"
            printf "\033[1m%s\033[0m" "$key"
            reset_color

            # Render equals sign
            tds_text_color "text.secondary"
            printf " = "
            reset_color

            # Render value based on type
            tds_render_toml_value "$value"
            echo
            continue
        fi

        # Unknown line - render as-is
        tds_text_color "text.primary"
        echo "$line"
        reset_color
    done < "$file"
}

# Render TOML value with appropriate highlighting
tds_render_toml_value() {
    local value="$1"

    # String values - quoted
    if [[ "$value" =~ ^\"(.*)\"$ ]] || [[ "$value" =~ ^\'(.*)\'$ ]]; then
        local string_content="${BASH_REMATCH[1]}"
        tds_text_color "content.code.inline"
        printf '"%s"' "$string_content"
        reset_color
        return
    fi

    # Arrays - [item1, item2, item3]
    if [[ "$value" =~ ^\[(.+)\]$ ]]; then
        local array_content="${BASH_REMATCH[1]}"
        tds_text_color "text.secondary"
        printf "["
        reset_color

        # Split on commas and render each item
        local IFS=','
        local first=true
        for item in $array_content; do
            item=$(echo "$item" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

            if [[ "$first" == true ]]; then
                first=false
            else
                tds_text_color "text.secondary"
                printf ", "
                reset_color
            fi

            # Render array item (recursively)
            tds_render_toml_value "$item"
        done

        tds_text_color "text.secondary"
        printf "]"
        reset_color
        return
    fi

    # Boolean values
    if [[ "$value" =~ ^(true|false)$ ]]; then
        tds_text_color "interactive.active"
        printf "%s" "$value"
        reset_color
        return
    fi

    # Numeric values
    if [[ "$value" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
        tds_text_color "content.link"
        printf "%s" "$value"
        reset_color
        return
    fi

    # Inline comments (value followed by #comment)
    if [[ "$value" =~ ^([^#]+)#(.*)$ ]]; then
        local val_part="${BASH_REMATCH[1]}"
        local comment_part="${BASH_REMATCH[2]}"

        # Render value part (recursively)
        val_part=$(echo "$val_part" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        tds_render_toml_value "$val_part"

        # Render comment
        tds_text_color "text.secondary"
        printf "\033[3m"  # Italic
        printf " #%s" "$comment_part"
        reset_color
        return
    fi

    # Default - unquoted string or unknown type
    tds_text_color "text.primary"
    printf "%s" "$value"
    reset_color
}

# TOML command interface
tds_toml() {
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
                TDS_TOML_WIDTH="$2"
                shift 2
                ;;
            --help|-h)
                cat <<EOF
TDS TOML Renderer

Usage: tds_toml [OPTIONS] <file>

Options:
  --pager, -p       Use pager for output
  --width, -w N     Set line width (default: terminal width)
  --help, -h        Show this help

Environment:
  TDS_TOML_PAGER   Pager command (default: less -R)
  TDS_TOML_WIDTH   Line width (default: \$COLUMNS)

Examples:
  tds_toml config.toml
  tds_toml --pager settings.toml
  tds_toml ~/.config/tetra/config.toml

Color Scheme (TDS Tokens):
  [sections]       → content.heading.h3 (bold)
  key =            → content.emphasis.bold
  "strings"        → content.code.inline
  numbers          → content.link
  true/false       → interactive.active
  # comments       → text.secondary (italic)
  arrays           → text.secondary (brackets)

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
        echo "Try: tds_toml --help" >&2
        return 1
    fi

    if [[ "$use_pager" == true ]]; then
        tds_render_toml "$file" | $TDS_TOML_PAGER
    else
        tds_render_toml "$file"
    fi
}

# Export for use as command
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    # Script is being executed directly
    tds_toml "$@"
fi
