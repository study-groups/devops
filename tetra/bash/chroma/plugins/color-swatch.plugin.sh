#!/usr/bin/env bash
# Chroma Plugin: Color Swatch
# Displays hex color codes with a visual color swatch

# Initialize plugin
_chroma_color_swatch_init() {
    # Declare configuration options
    chroma_config_declare "color-swatch" "enabled" "true" "Enable color swatches for hex codes"
    chroma_config_declare "color-swatch" "swatch_chars" "  " "Characters for swatch block (width)"
    chroma_config_declare "color-swatch" "mode" "text" "Display mode: swatch, text, or both"

    # Register transform hook
    chroma_hook transform_content _chroma_color_swatch_transform
}

# Convert 3-char hex to 6-char (#abc -> #aabbcc)
_chroma_hex3_to_hex6() {
    local hex="$1"
    # Remove # prefix if present
    hex="${hex#\#}"
    if [[ ${#hex} -eq 3 ]]; then
        local r="${hex:0:1}" g="${hex:1:1}" b="${hex:2:1}"
        printf '#%s%s%s%s%s%s' "$r" "$r" "$g" "$g" "$b" "$b"
    else
        printf '#%s' "$hex"
    fi
}

# Convert hex to RGB values
_chroma_hex_to_rgb() {
    local hex="$1"
    hex="${hex#\#}"
    printf '%d %d %d' "0x${hex:0:2}" "0x${hex:2:2}" "0x${hex:4:2}"
}

# Transform content: find hex colors and add swatches
_chroma_color_swatch_transform() {
    local content="$1"

    # Check if enabled
    local enabled
    enabled=$(chroma_config_get "color-swatch" "enabled")
    [[ "$enabled" != "true" ]] && { printf '%s' "$content"; return 0; }

    local swatch_chars
    swatch_chars=$(chroma_config_get "color-swatch" "swatch_chars")
    local mode
    mode=$(chroma_config_get "color-swatch" "mode")

    local result=""
    local remaining="$content"
    local esc=$'\033'

    # Process hex color patterns
    # Match #aabbcc (6-char) or #abc (3-char) hex colors
    while [[ "$remaining" =~ (#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})([^0-9a-fA-F]|$) ]]; do
        local match="${BASH_REMATCH[1]}"
        local after="${BASH_REMATCH[2]}"
        local before="${remaining%%$match*}"

        # Expand 3-char to 6-char if needed
        local hex6
        if [[ ${#match} -eq 4 ]]; then
            hex6=$(_chroma_hex3_to_hex6 "$match")
        else
            hex6="$match"
        fi

        # Convert to RGB
        local rgb
        rgb=$(_chroma_hex_to_rgb "$hex6")
        local r g b
        read -r r g b <<< "$rgb"

        # Build replacement based on mode
        local replacement
        case "$mode" in
            swatch)
                # Just the swatch block, no text
                replacement="${esc}[48;2;${r};${g};${b}m${swatch_chars}${esc}[0m"
                ;;
            text)
                # Colored text, no swatch block
                replacement="${esc}[38;2;${r};${g};${b}m${match}${esc}[0m"
                ;;
            both|*)
                # Swatch block + hex text (default)
                replacement="${esc}[48;2;${r};${g};${b}m${swatch_chars}${esc}[0m ${match}"
                ;;
        esac

        # Append before text and replacement
        result+="${before}${replacement}"

        # Continue with remainder (skip the match, keep the trailing char)
        remaining="${remaining#*$match}"
    done

    # Append any remaining text
    result+="$remaining"

    printf '%s' "$result"
}

# Register the plugin
chroma_register_plugin "color-swatch" "_chroma_color_swatch_init"
