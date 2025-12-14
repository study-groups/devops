#!/usr/bin/env bash

# Chroma Simple - Minimal markdown renderer with element detection
# Usage: chroma [-m margin] [-w width] [file]

# State for multi-line parsing
declare -g _CHROMA_IN_CODE=0
declare -g _CHROMA_CODE_LANG=""
declare -g _CHROMA_CODE_BUFFER=""

# Token mapping: element type → TDS token
declare -gA CHROMA_TOKENS=(
    [heading.1]="content.heading.h1"
    [heading.2]="content.heading.h2"
    [heading.3]="content.heading.h3"
    [heading.4]="content.heading.h4"
    [code.block]="content.code.block"
    [code.inline]="content.code.inline"
    [code.fence]="content.code.fence"
    [list.bullet]="content.list"
    [list.number]="content.list"
    [quote]="content.quote"
    [bold]="content.emphasis.strong"
    [italic]="content.emphasis.em"
    [link]="content.link"
    [hr]="ui.border"
    [text]="text.primary"
)

# Color codes (fallback if TDS not available)
_chroma_color() {
    local token="$1"
    (( CHROMA_NO_COLOR )) && return

    # Try TDS first
    if declare -F tds_text_color &>/dev/null; then
        tds_text_color "$token"
        return
    fi

    # Fallback ANSI - expanded for all element types
    case "$token" in
        content.heading.h1) printf '\033[1;38;5;39m' ;;   # bold cyan
        content.heading.h2) printf '\033[1;38;5;75m' ;;   # bold blue
        content.heading.h3) printf '\033[1;38;5;111m' ;;  # bold light blue
        content.heading.*)  printf '\033[1;38;5;117m' ;;  # bold sky
        content.code.block) printf '\033[38;5;179m' ;;    # amber
        content.code.inline) printf '\033[38;5;180m' ;;   # light amber
        content.code.fence) printf '\033[38;5;240m' ;;    # dark gray
        content.list)       printf '\033[38;5;114m' ;;    # green
        content.quote)      printf '\033[3;38;5;245m' ;;  # italic gray
        content.emphasis.strong) printf '\033[1m' ;;      # bold
        content.emphasis.em) printf '\033[3m' ;;          # italic
        content.link)       printf '\033[4;38;5;75m' ;;   # underline blue
        ui.border)          printf '\033[38;5;240m' ;;    # dark gray
        text.primary)       printf '\033[38;5;252m' ;;    # light gray
        text.secondary)     printf '\033[38;5;245m' ;;    # gray
        *)                  printf '\033[38;5;252m' ;;    # default
    esac
}

_chroma_reset() {
    (( CHROMA_NO_COLOR )) && return

    if declare -F reset_color &>/dev/null; then
        reset_color
    else
        printf '\033[0m'
    fi
}

# Get TDS token for element type
_chroma_token() {
    local elem="$1"
    echo "${CHROMA_TOKENS[$elem]:-text.primary}"
}

# Classify a single line - returns "type:level:content" or "type:content"
_chroma_classify() {
    local line="$1"

    # Code fence start/end
    if [[ "$line" =~ ^\`\`\`(.*)$ ]]; then
        local lang="${BASH_REMATCH[1]}"
        if (( _CHROMA_IN_CODE )); then
            _CHROMA_IN_CODE=0
            echo "code.end::"
        else
            _CHROMA_IN_CODE=1
            _CHROMA_CODE_LANG="$lang"
            echo "code.start:$lang:"
        fi
        return
    fi

    # Inside code block
    if (( _CHROMA_IN_CODE )); then
        echo "code.line::$line"
        return
    fi

    # Empty line
    if [[ -z "$line" ]]; then
        echo "blank::"
        return
    fi

    # Heading (ATX style: # ## ### etc)
    if [[ "$line" =~ ^(#{1,6})\ +(.*)$ ]]; then
        local level=${#BASH_REMATCH[1]}
        local content="${BASH_REMATCH[2]}"
        echo "heading:$level:$content"
        return
    fi

    # Horizontal rule
    if [[ "$line" =~ ^[-*_]{3,}\ *$ ]]; then
        echo "hr::"
        return
    fi

    # Blockquote
    if [[ "$line" =~ ^\>\ ?(.*)$ ]]; then
        echo "quote::${BASH_REMATCH[1]}"
        return
    fi

    # Bullet list (- or * or +)
    if [[ "$line" =~ ^[\ ]*[-*+]\ +(.*)$ ]]; then
        echo "list.bullet::${BASH_REMATCH[1]}"
        return
    fi

    # Numbered list
    if [[ "$line" =~ ^[\ ]*[0-9]+\.\ +(.*)$ ]]; then
        echo "list.number::${BASH_REMATCH[1]}"
        return
    fi

    # Regular paragraph text
    echo "text::$line"
}

# Render inline formatting (bold, italic, code, links)
_chroma_inline() {
    local text="$1"
    local result=""
    local i=0
    local len=${#text}

    while (( i < len )); do
        local char="${text:i:1}"
        local next="${text:i+1:1}"

        # Inline code `...`
        if [[ "$char" == '`' ]]; then
            local end=$((i + 1))
            while (( end < len )) && [[ "${text:end:1}" != '`' ]]; do
                ((end++))
            done
            if (( end < len )); then
                local code="${text:i+1:end-i-1}"
                _chroma_color "$(_chroma_token code.inline)"
                printf '%s' "$code"
                _chroma_reset
                i=$((end + 1))
                continue
            fi
        fi

        # Bold **...**
        if [[ "$char" == '*' && "$next" == '*' ]]; then
            local end=$((i + 2))
            while (( end < len - 1 )) && [[ "${text:end:2}" != '**' ]]; do
                ((end++))
            done
            if (( end < len - 1 )); then
                local bold="${text:i+2:end-i-2}"
                _chroma_color "$(_chroma_token bold)"
                printf '%s' "$bold"
                _chroma_reset
                i=$((end + 2))
                continue
            fi
        fi

        # Italic *...* (single asterisk, not followed by another)
        if [[ "$char" == '*' && "$next" != '*' ]]; then
            local end=$((i + 1))
            while (( end < len )) && [[ "${text:end:1}" != '*' ]]; do
                ((end++))
            done
            if (( end < len )); then
                local italic="${text:i+1:end-i-1}"
                _chroma_color "$(_chroma_token italic)"
                printf '%s' "$italic"
                _chroma_reset
                i=$((end + 1))
                continue
            fi
        fi

        # Regular character
        printf '%s' "$char"
        ((i++))
    done
}

# Render a single classified line
_chroma_render_line() {
    local classified="$1"
    local pad="$2"
    local width="$3"

    # Parse type:level:content
    local type="${classified%%:*}"
    local rest="${classified#*:}"
    local level="${rest%%:*}"
    local content="${rest#*:}"

    case "$type" in
        heading)
            _chroma_color "$(_chroma_token heading.$level)"
            printf '%s' "$pad"
            # Add # prefix for visual hierarchy
            local prefix=""
            for ((h=0; h<level; h++)); do prefix+="#"; done
            printf '%s %s' "$prefix" "$content"
            _chroma_reset
            echo
            ;;

        code.start)
            _chroma_color "$(_chroma_token code.fence)"
            printf '%s```%s' "$pad" "$level"
            _chroma_reset
            echo
            ;;

        code.end)
            _chroma_color "$(_chroma_token code.fence)"
            printf '%s```' "$pad"
            _chroma_reset
            echo
            ;;

        code.line)
            _chroma_color "$(_chroma_token code.block)"
            printf '%s  %s' "$pad" "$content"
            _chroma_reset
            echo
            ;;

        quote)
            _chroma_color "$(_chroma_token quote)"
            printf '%s│ ' "$pad"
            _chroma_inline "$content"
            _chroma_reset
            echo
            ;;

        list.bullet)
            printf '%s' "$pad"
            _chroma_color "$(_chroma_token list.bullet)"
            printf '• '
            _chroma_reset
            _chroma_color "$(_chroma_token text)"
            _chroma_inline "$content"
            _chroma_reset
            echo
            ;;

        list.number)
            printf '%s' "$pad"
            _chroma_color "$(_chroma_token list.number)"
            printf '  '
            _chroma_reset
            _chroma_color "$(_chroma_token text)"
            _chroma_inline "$content"
            _chroma_reset
            echo
            ;;

        hr)
            _chroma_color "$(_chroma_token hr)"
            printf '%s' "$pad"
            local hrlen=$((width - ${#pad}))
            printf '%*s' "$hrlen" '' | tr ' ' '─'
            _chroma_reset
            echo
            ;;

        blank)
            echo
            ;;

        text|*)
            printf '%s' "$pad"
            _chroma_color "$(_chroma_token text)"
            _chroma_inline "$content"
            _chroma_reset
            echo
            ;;
    esac
}

chroma() {
    local file=""
    local margin=0
    local width=${COLUMNS:-80}
    local tmp=""
    local is_tmp=0
    CHROMA_NO_COLOR=0

    # Parse args
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -m|--margin) margin="$2"; shift 2 ;;
            -w|--width) width="$2"; shift 2 ;;
            --no-color) CHROMA_NO_COLOR=1; shift ;;
            -h|--help) echo "Usage: chroma [-m N] [-w N] [--no-color] [file]"; return 0 ;;
            help) chroma_help; return 0 ;;
            -*) shift ;;
            *) file="$1"; shift ;;
        esac
    done

    # Get input
    if [[ -n "$file" && -f "$file" ]]; then
        tmp="$file"
    elif [[ ! -t 0 ]]; then
        tmp=$(mktemp)
        cat > "$tmp"
        is_tmp=1
    else
        echo "Usage: chroma [file] or pipe content" >&2
        return 1
    fi

    # Calculate content width
    # -w sets content width, -m sets offset
    # Honor terminal width: content can't exceed (terminal - left_margin - right_margin)
    local term_width=${COLUMNS:-80}
    local max_content=$((term_width - margin - margin))
    local content_width=$width
    (( content_width > max_content )) && content_width=$max_content
    (( content_width < 10 )) && content_width=10

    # Build margin string (left padding)
    local pad=""
    (( margin > 0 )) && printf -v pad "%*s" "$margin" ""

    # Top margin (empty lines)
    for ((i=0; i<margin; i++)); do echo; done

    # Render with wrapping at content_width
    while IFS= read -r line || [[ -n "$line" ]]; do
        if [[ -z "$line" ]]; then
            echo
        elif (( ${#line} > content_width )); then
            # Wrap long lines at content_width
            echo "$line" | fold -s -w "$content_width" | while IFS= read -r wrapped; do
                _chroma_color "text.primary"
                printf "%s%s" "$pad" "$wrapped"
                _chroma_reset
                echo
            done
        else
            _chroma_color "text.primary"
            printf "%s%s" "$pad" "$line"
            _chroma_reset
            echo
        fi
    done < "$tmp"

    # Cleanup
    (( is_tmp )) && rm -f "$tmp"
}

chroma_help() {
    cat <<'EOF'
chroma - Simple terminal renderer

USAGE
  chroma [file]           Render file
  cat file | chroma       Pipe content

OPTIONS
  -m, --margin N    Add margin (top/left/right)
  -w, --width N     Set width (default: terminal width)
  -h, --help        Show this help

EXAMPLES
  chroma README.md
  chroma -m 4 -w 60 doc.txt
  a | chroma -m 2
EOF
}
