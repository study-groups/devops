#!/usr/bin/env bash

# TSM Help Parser
# Parses markdown help file and renders sections for display

# Path to master help file
TSM_HELP_FILE="${TSM_HELP_FILE:-$TETRA_SRC/bash/tsm/help/tsm_help.md}"

# Color helper - fallback to simple ANSI codes if color function not available
_tsm_color() {
    local color_name="$1"
    local modifier="${2:-}"

    if declare -f color >/dev/null 2>&1; then
        color "$color_name" "$modifier"
        return
    fi

    # Fallback to ANSI codes
    case "$color_name" in
        cyan)
            [[ "$modifier" == "bold" ]] && echo -ne '\033[1;36m' || echo -ne '\033[0;36m'
            ;;
        green)
            echo -ne '\033[0;32m'
            ;;
        yellow)
            echo -ne '\033[1;33m'
            ;;
        red)
            echo -ne '\033[0;31m'
            ;;
        blue)
            [[ "$modifier" == "bold" ]] && echo -ne '\033[1;34m' || echo -ne '\033[0;34m'
            ;;
        gray)
            echo -ne '\033[0;90m'
            ;;
        reset)
            echo -ne '\033[0m'
            ;;
    esac
}

# Parse a section from markdown help file
# Usage: tsm_parse_help_section <section-type> <section-name>
# Section types: COMMAND, TOPIC, REFERENCE
# Returns: Section content without the header marker
tsm_parse_help_section() {
    local section_type="$1"
    local section_name="$2"

    if [[ ! -f "$TSM_HELP_FILE" ]]; then
        echo "Error: Help file not found: $TSM_HELP_FILE" >&2
        return 1
    fi

    local marker="## ${section_type}:${section_name}"
    local in_section=false
    local content=""

    while IFS= read -r line; do
        # Check if we're entering the target section
        if [[ "$line" == "$marker" ]]; then
            in_section=true
            continue
        fi

        # Check if we're entering a different section (exit current)
        if [[ "$line" =~ ^##[[:space:]]+(COMMAND|TOPIC|REFERENCE): ]] && [[ "$in_section" == true ]]; then
            break
        fi

        # Collect content if in target section
        if [[ "$in_section" == true ]]; then
            content+="$line"$'\n'
        fi
    done < "$TSM_HELP_FILE"

    if [[ -z "$content" ]]; then
        return 1
    fi

    echo "$content"
    return 0
}

# Render help section with optional color support
# Usage: tsm_render_help <section-type> <section-name> [color-mode]
# Color modes: color, plain, repl
tsm_render_help() {
    local section_type="$1"
    local section_name="$2"
    local color_mode="${3:-color}"

    local content
    content=$(tsm_parse_help_section "$section_type" "$section_name")

    if [[ $? -ne 0 || -z "$content" ]]; then
        echo "Help topic not found: $section_name" >&2
        echo "Try: tsm help all" >&2
        return 1
    fi

    case "$color_mode" in
        color)
            _tsm_render_help_color "$content"
            ;;
        repl)
            _tsm_render_help_repl "$content"
            ;;
        plain)
            echo "$content"
            ;;
        *)
            echo "$content"
            ;;
    esac
}

# Render with color using bash/color.sh
_tsm_render_help_color() {
    local content="$1"

    # Check if color support available
    if ! declare -f color >/dev/null 2>&1; then
        echo "$content"
        return
    fi

    # Apply colors to markdown-like syntax
    echo "$content" | while IFS= read -r line; do
        # Headers (### )
        if [[ "$line" =~ ^###[[:space:]]+(.*) ]]; then
            echo "$(_tsm_color cyan bold)${BASH_REMATCH[1]}$(_tsm_color reset)"
        # Bold headers (** **)
        elif [[ "$line" =~ ^\*\*(.*)\*\*$ ]]; then
            echo "$(_tsm_color blue bold)${BASH_REMATCH[1]}$(_tsm_color reset)"
        # Code blocks (```)
        elif [[ "$line" =~ ^\`\`\` ]]; then
            echo "$(_tsm_color gray)${line}$(_tsm_color reset)"
        # Inline code (`...`)
        elif [[ "$line" =~ \`([^\`]+)\` ]]; then
            # Replace inline code with colored version
            local colored_line="$line"
            colored_line=$(echo "$line" | sed -E 's/`([^`]+)`/'$(echo -e "$(_tsm_color yellow)")'\1'$(echo -e "$(_tsm_color reset)")'/g')
            echo "$colored_line"
        # List items (- or *)
        elif [[ "$line" =~ ^[[:space:]]*[-*][[:space:]]+(.*) ]]; then
            echo "  $(_tsm_color cyan )•$(_tsm_color reset) ${BASH_REMATCH[1]}"
        # Numbered lists
        elif [[ "$line" =~ ^[[:space:]]*[0-9]+\.[[:space:]]+(.*) ]]; then
            echo "$line"
        else
            echo "$line"
        fi
    done
}

# Render for REPL with compact formatting
_tsm_render_help_repl() {
    local content="$1"

    # Compact rendering for REPL
    # Remove blank lines, compact headers
    echo "$content" | sed '/^$/d' | while IFS= read -r line; do
        # Headers (### )
        if [[ "$line" =~ ^###[[:space:]]+(.*) ]]; then
            echo ""
            echo "$(_tsm_color cyan bold)${BASH_REMATCH[1]}$(_tsm_color reset)"
        # Skip markdown code fence markers in REPL
        elif [[ "$line" =~ ^\`\`\` ]]; then
            continue
        else
            echo "$line"
        fi
    done
}

# List all available help topics
tsm_list_help_topics() {
    if [[ ! -f "$TSM_HELP_FILE" ]]; then
        echo "Error: Help file not found: $TSM_HELP_FILE" >&2
        return 1
    fi

    echo "Available Help Topics:"
    echo ""

    echo "Commands:"
    grep -E "^## COMMAND:" "$TSM_HELP_FILE" | sed 's/^## COMMAND:/  /' | sort
    echo ""

    echo "Topics:"
    grep -E "^## TOPIC:" "$TSM_HELP_FILE" | sed 's/^## TOPIC:/  /' | sort
    echo ""

    echo "Reference:"
    grep -E "^## REFERENCE:" "$TSM_HELP_FILE" | sed 's/^## REFERENCE:/  /' | sort
}

# Get help for command (convenience wrapper)
tsm_help_command() {
    local command="$1"
    local color_mode="${2:-color}"
    tsm_render_help "COMMAND" "$command" "$color_mode"
}

# Get help for topic (convenience wrapper)
tsm_help_topic_md() {
    local topic="$1"
    local color_mode="${2:-color}"
    tsm_render_help "TOPIC" "$topic" "$color_mode"
}

# Search help content
tsm_search_help() {
    local query="$1"

    if [[ -z "$query" ]]; then
        echo "Usage: tsm_search_help <query>" >&2
        return 1
    fi

    if [[ ! -f "$TSM_HELP_FILE" ]]; then
        echo "Error: Help file not found: $TSM_HELP_FILE" >&2
        return 1
    fi

    echo "Searching help for: $query"
    echo ""

    grep -i -n -C 2 "$query" "$TSM_HELP_FILE" | while IFS= read -r line; do
        # Highlight matching line numbers
        if [[ "$line" =~ ^([0-9]+)- ]]; then
            echo "$(_tsm_color gray)Line ${BASH_REMATCH[1]}:$(_tsm_color reset)"
        fi
        echo "$line"
    done
}

export -f tsm_parse_help_section
export -f tsm_render_help
export -f tsm_list_help_topics
export -f tsm_help_command
export -f tsm_help_topic_md
export -f tsm_search_help
