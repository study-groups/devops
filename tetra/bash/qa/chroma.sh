#!/usr/bin/env bash

# Chroma - Custom markdown renderer using tetra color system
# Alternative to glow with full control over colors and themes

# Load color system
CHROMA_SRC="${CHROMA_SRC:-$(dirname "${BASH_SOURCE[0]}")/../color}"
source "$CHROMA_SRC/color_core.sh"
source "$CHROMA_SRC/color_palettes.sh"

# Chroma configuration
: "${CHROMA_THEME:=dark}"
: "${CHROMA_STYLE:=default}"
: "${CHROMA_PAGER:=less -R}"

# Color scheme for markdown elements
declare -A CHROMA_COLORS=(
    [h1]="00D4AA"           # Cyan/Teal - main headings
    [h2]="7AA2F7"           # Blue - subheadings
    [h3]="BB9AF7"           # Light Purple - section headers
    [h4]="9D7CD8"           # Dark Purple - subsections
    [bold]="E0AF68"         # Orange - bold text
    [italic]="9ECE6A"       # Green - italic text
    [code]="F7768E"         # Red - inline code
    [code_block]="7AA2F7"   # Blue - code blocks
    [link]="00D4AA"         # Cyan - links
    [quote]="565F89"        # Gray - blockquotes
    [list]="9ECE6A"         # Green - list markers
    [hr]="565F89"           # Gray - horizontal rules
    [text]="C0CAF5"         # Light - normal text
)

# Simple markdown parser states
chroma_render() {
    local file="$1"
    local in_code_block=false
    local code_fence=""
    local fmt_width="${COLUMNS:-80}"

    if [[ ! -f "$file" ]]; then
        echo "Error: File not found: $file" >&2
        return 1
    fi

    while IFS= read -r line; do
        # Code blocks (fenced)
        if [[ "$line" =~ ^\`\`\`(.*)$ ]]; then
            if [[ "$in_code_block" == false ]]; then
                in_code_block=true
                code_fence="${BASH_REMATCH[1]}"
                text_color "${CHROMA_COLORS[code_block]}"
                echo "┌─ $code_fence"
                continue
            else
                in_code_block=false
                echo "└─"
                reset_color
                echo
                continue
            fi
        fi

        # Inside code block - render as-is with color (no fmt)
        if [[ "$in_code_block" == true ]]; then
            text_color "${CHROMA_COLORS[code_block]}"
            echo "│ $line"
            reset_color
            continue
        fi

        # Headers
        if [[ "$line" =~ ^(#{1,6})[[:space:]]+(.+)$ ]]; then
            local level=${#BASH_REMATCH[1]}
            local text="${BASH_REMATCH[2]}"
            local color_key="h$level"
            [[ $level -gt 4 ]] && color_key="h4"

            printf "\033[1m"  # Bold
            text_color "${CHROMA_COLORS[$color_key]}"
            echo "$text"
            reset_color
            echo
            continue
        fi

        # Horizontal rule
        if [[ "$line" =~ ^([-*_]){3,}$ ]]; then
            text_color "${CHROMA_COLORS[hr]}"
            printf "%*s\n" "${COLUMNS:-80}" "" | tr ' ' '─'
            reset_color
            continue
        fi

        # List items
        if [[ "$line" =~ ^([[:space:]]*)[-*+][[:space:]]+(.+)$ ]]; then
            local indent="${BASH_REMATCH[1]}"
            local content="${BASH_REMATCH[2]}"
            text_color "${CHROMA_COLORS[list]}"
            printf "%s• " "$indent"
            reset_color
            text_color "${CHROMA_COLORS[text]}"
            echo "$content"
            reset_color
            continue
        fi

        # Blockquotes
        if [[ "$line" =~ ^\>[[:space:]]*(.+)$ ]]; then
            local content="${BASH_REMATCH[1]}"
            text_color "${CHROMA_COLORS[quote]}"
            printf "▌ %s\n" "$content"
            reset_color
            continue
        fi

        # Inline formatting (simplified - doesn't handle nesting)
        # Bold **text**
        line=$(echo "$line" | sed -E "s/\*\*([^*]+)\*\*/$(printf '\033[1m')$(text_color "${CHROMA_COLORS[bold]}")\1$(reset_color)/g")

        # Inline code \`code\`
        line=$(echo "$line" | sed -E "s/\`([^\`]+)\`/$(text_color "${CHROMA_COLORS[code]}")\1$(reset_color)/g")

        # Links [text](url)
        line=$(echo "$line" | sed -E "s/\[([^\]]+)\]\(([^\)]+)\)/$(text_color "${CHROMA_COLORS[link]}")\1$(reset_color)/g")

        # Normal text - use fmt for long lines
        if [[ ${#line} -gt $fmt_width ]]; then
            text_color "${CHROMA_COLORS[text]}"
            echo "$line" | fmt -w "$fmt_width"
            reset_color
        else
            text_color "${CHROMA_COLORS[text]}"
            echo "$line"
            reset_color
        fi
    done < "$file"
}

# Chroma command interface
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
                CHROMA_THEME="$2"
                shift 2
                ;;
            --help|-h)
                cat <<EOF
Chroma - Custom markdown renderer

Usage: chroma [OPTIONS] <file>

Options:
  --pager, -p       Use pager for output
  --theme, -t       Set color theme (dark, light, solarized)
  --help, -h        Show this help

Environment:
  CHROMA_THEME      Color theme (default: dark)
  CHROMA_PAGER      Pager command (default: less -R)
  QA_VIEWER         Set to 'chroma' to use as default viewer

Examples:
  chroma README.md
  chroma --pager document.md
  QA_VIEWER=chroma qa browse
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

    if [[ "$use_pager" == true ]]; then
        chroma_render "$file" | $CHROMA_PAGER
    else
        chroma_render "$file"
    fi
}

# Export for use as command
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    # Script is being executed directly
    chroma "$@"
fi
