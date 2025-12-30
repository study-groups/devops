#!/usr/bin/env bash
# TSM Help Renderer - hint-based structural colorization
#
# Analyzes help text structure and generates TCOLOR_HINTS
# for the variable-based color system (tcolor_vars.sh)
#
# Line types:
#   - Title: starts with "TSM"
#   - Category: all-caps alone on line
#   - Syntax: indented, command definitions
#   - Example: indented, starts with "tsm"
#   - Plain: everything else

# Analyze help text and populate TCOLOR_HINTS
# Expects TCOLOR_INPUT to be set, populates TCOLOR_HINTS
_tsm_analyze_help() {
    TCOLOR_HINTS=""
    local line_num=0
    local line

    while IFS= read -r line || [[ -n "$line" ]]; do
        ((line_num++))

        # Empty line - no hints needed
        [[ -z "$line" ]] && continue

        # Title (TSM - ...)
        if [[ "$line" =~ ^TSM ]]; then
            tcolor_hint "$line_num" title
            continue
        fi

        # Category header (ALLCAPS alone on line)
        if [[ "$line" =~ ^[A-Z]{2,}$ ]]; then
            tcolor_hint "$line_num" heading
            continue
        fi

        # Indented lines - syntax or example
        if [[ "$line" =~ ^[[:space:]]+ ]]; then
            local indent="${BASH_REMATCH[0]}"
            local content="${line#"$indent"}"
            local indent_len=${#indent}

            if [[ "$content" == tsm\ * ]]; then
                # Example line: "tsm" is command, rest is muted
                tcolor_hint "$line_num" "$indent_len" "$((indent_len + 3))" command
                tcolor_hint "$line_num" "$((indent_len + 3))" "*" muted
            else
                # Command syntax: analyze each word
                _tsm_analyze_syntax "$line_num" "$indent_len" "$content"
            fi
            continue
        fi

        # Plain text with colon (like "Examples:") - make it a label
        if [[ "$line" =~ :$ ]]; then
            tcolor_hint "$line_num" label
            continue
        fi

        # Default - no hints (plain text)
    done <<< "$TCOLOR_INPUT"
}

# Analyze command syntax and add hints for each word
# Usage: _tsm_analyze_syntax LINE_NUM OFFSET CONTENT
_tsm_analyze_syntax() {
    local line_num="$1"
    local offset="$2"
    local content="$3"

    local pos=0
    local len=${#content}
    local word=""
    local word_start=0

    while ((pos <= len)); do
        local char="${content:$pos:1}"

        if [[ -z "$char" || "$char" == " " ]]; then
            # End of word (or end of content)
            if [[ -n "$word" ]]; then
                local abs_start=$((offset + word_start))
                local abs_end=$((offset + pos))

                case "$word" in
                    '<'*|'['*|*']'|--*|-?)
                        tcolor_hint "$line_num" "$abs_start" "$abs_end" muted ;;
                    *)
                        tcolor_hint "$line_num" "$abs_start" "$abs_end" command ;;
                esac
                word=""
            fi
            # Skip this space, next word starts after
            word_start=$((pos + 1))
        else
            word+="$char"
        fi
        ((pos++))
    done
}

export -f _tsm_analyze_help _tsm_analyze_syntax
