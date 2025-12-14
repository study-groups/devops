#!/usr/bin/env bash

# Chroma Simple - Minimal markdown renderer with element detection
# Usage: chroma [-m margin] [-w width] [-t theme] [file]

# Current theme name
declare -g CHROMA_THEME="default"

# State for multi-line parsing
declare -g _CHROMA_IN_CODE=0
declare -g _CHROMA_CODE_LANG=""
declare -g _CHROMA_RESULT=""

# Table state
declare -g _CHROMA_IN_TABLE=0
declare -ga _CHROMA_TABLE_ROWS=()
declare -ga _CHROMA_TABLE_ALIGNS=()
declare -ga _CHROMA_TABLE_WIDTHS=()

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
    [table.border]="ui.border"
    [table.header]="content.heading.h3"
    [table.cell]="text.primary"
)

# ============================================================================
# BUILT-IN THEME PALETTES (fallback when TDS not available)
# ============================================================================
# Each theme defines: CHROMA_PALETTE associative array mapping tokens to ANSI codes

declare -gA _CHROMA_PALETTES

# Default theme - cool blue
_chroma_init_theme_default() {
    _CHROMA_PALETTES=(
        [content.heading.h1]='\033[1;38;5;39m'    # bold cyan
        [content.heading.h2]='\033[1;38;5;75m'    # bold blue
        [content.heading.h3]='\033[1;38;5;111m'   # bold light blue
        [content.heading.h4]='\033[1;38;5;117m'   # bold sky
        [content.code.block]='\033[38;5;179m'     # amber
        [content.code.inline]='\033[38;5;180m'    # light amber
        [content.code.fence]='\033[38;5;240m'     # dark gray
        [content.list]='\033[38;5;114m'           # green
        [content.quote]='\033[3;38;5;245m'        # italic gray
        [content.emphasis.strong]='\033[1m'       # bold
        [content.emphasis.em]='\033[3m'           # italic
        [content.link]='\033[4;38;5;75m'          # underline blue
        [ui.border]='\033[38;5;240m'              # dark gray
        [content.table.border]='\033[38;5;240m'   # dark gray
        [content.table.header]='\033[1;38;5;75m'  # bold blue
        [content.table.cell]='\033[38;5;252m'     # light gray
        [text.primary]='\033[38;5;252m'           # light gray
        [text.secondary]='\033[38;5;245m'         # gray
    )
}

# Warm theme - amber/orange tones
_chroma_init_theme_warm() {
    _CHROMA_PALETTES=(
        [content.heading.h1]='\033[1;38;5;214m'   # bold orange
        [content.heading.h2]='\033[1;38;5;208m'   # bold dark orange
        [content.heading.h3]='\033[1;38;5;179m'   # bold amber
        [content.heading.h4]='\033[1;38;5;180m'   # bold light amber
        [content.code.block]='\033[38;5;137m'     # brown
        [content.code.inline]='\033[38;5;180m'    # light amber
        [content.code.fence]='\033[38;5;240m'     # dark gray
        [content.list]='\033[38;5;178m'           # gold
        [content.quote]='\033[3;38;5;180m'        # italic amber
        [content.emphasis.strong]='\033[1m'       # bold
        [content.emphasis.em]='\033[3m'           # italic
        [content.link]='\033[4;38;5;214m'         # underline orange
        [ui.border]='\033[38;5;94m'               # brown border
        [content.table.border]='\033[38;5;94m'    # brown border
        [content.table.header]='\033[1;38;5;214m' # bold orange
        [content.table.cell]='\033[38;5;223m'     # warm white
        [text.primary]='\033[38;5;223m'           # warm white
        [text.secondary]='\033[38;5;180m'         # amber
    )
}

# Cool theme - blue/purple tones
_chroma_init_theme_cool() {
    _CHROMA_PALETTES=(
        [content.heading.h1]='\033[1;38;5;111m'   # bold light blue
        [content.heading.h2]='\033[1;38;5;147m'   # bold lavender
        [content.heading.h3]='\033[1;38;5;183m'   # bold light purple
        [content.heading.h4]='\033[1;38;5;189m'   # bold pale blue
        [content.code.block]='\033[38;5;104m'     # purple
        [content.code.inline]='\033[38;5;147m'    # lavender
        [content.code.fence]='\033[38;5;60m'      # dark purple
        [content.list]='\033[38;5;117m'           # sky
        [content.quote]='\033[3;38;5;146m'        # italic blue-gray
        [content.emphasis.strong]='\033[1m'       # bold
        [content.emphasis.em]='\033[3m'           # italic
        [content.link]='\033[4;38;5;147m'         # underline lavender
        [ui.border]='\033[38;5;60m'               # dark purple
        [content.table.border]='\033[38;5;60m'    # dark purple
        [content.table.header]='\033[1;38;5;147m' # bold lavender
        [content.table.cell]='\033[38;5;189m'     # pale blue
        [text.primary]='\033[38;5;189m'           # pale blue
        [text.secondary]='\033[38;5;146m'         # blue-gray
    )
}

# Arctic theme - icy blues
_chroma_init_theme_arctic() {
    _CHROMA_PALETTES=(
        [content.heading.h1]='\033[1;38;5;159m'   # bold ice blue
        [content.heading.h2]='\033[1;38;5;123m'   # bold cyan
        [content.heading.h3]='\033[1;38;5;87m'    # bold turquoise
        [content.heading.h4]='\033[1;38;5;117m'   # bold sky
        [content.code.block]='\033[38;5;73m'      # teal
        [content.code.inline]='\033[38;5;123m'    # cyan
        [content.code.fence]='\033[38;5;30m'      # dark teal
        [content.list]='\033[38;5;159m'           # ice blue
        [content.quote]='\033[3;38;5;109m'        # italic steel blue
        [content.emphasis.strong]='\033[1m'       # bold
        [content.emphasis.em]='\033[3m'           # italic
        [content.link]='\033[4;38;5;159m'         # underline ice
        [ui.border]='\033[38;5;30m'               # dark teal
        [content.table.border]='\033[38;5;30m'    # dark teal
        [content.table.header]='\033[1;38;5;159m' # bold ice
        [content.table.cell]='\033[38;5;195m'     # white ice
        [text.primary]='\033[38;5;195m'           # white ice
        [text.secondary]='\033[38;5;109m'         # steel blue
    )
}

# Neutral theme - green/gray tones
_chroma_init_theme_neutral() {
    _CHROMA_PALETTES=(
        [content.heading.h1]='\033[1;38;5;114m'   # bold green
        [content.heading.h2]='\033[1;38;5;150m'   # bold light green
        [content.heading.h3]='\033[1;38;5;151m'   # bold pale green
        [content.heading.h4]='\033[1;38;5;108m'   # bold sage
        [content.code.block]='\033[38;5;65m'      # olive
        [content.code.inline]='\033[38;5;150m'    # light green
        [content.code.fence]='\033[38;5;240m'     # dark gray
        [content.list]='\033[38;5;114m'           # green
        [content.quote]='\033[3;38;5;108m'        # italic sage
        [content.emphasis.strong]='\033[1m'       # bold
        [content.emphasis.em]='\033[3m'           # italic
        [content.link]='\033[4;38;5;114m'         # underline green
        [ui.border]='\033[38;5;240m'              # dark gray
        [content.table.border]='\033[38;5;240m'   # dark gray
        [content.table.header]='\033[1;38;5;114m' # bold green
        [content.table.cell]='\033[38;5;252m'     # light gray
        [text.primary]='\033[38;5;252m'           # light gray
        [text.secondary]='\033[38;5;245m'         # gray
    )
}

# Electric theme - vibrant purple/magenta
_chroma_init_theme_electric() {
    _CHROMA_PALETTES=(
        [content.heading.h1]='\033[1;38;5;201m'   # bold magenta
        [content.heading.h2]='\033[1;38;5;165m'   # bold purple
        [content.heading.h3]='\033[1;38;5;171m'   # bold orchid
        [content.heading.h4]='\033[1;38;5;177m'   # bold violet
        [content.code.block]='\033[38;5;99m'      # purple
        [content.code.inline]='\033[38;5;171m'    # orchid
        [content.code.fence]='\033[38;5;54m'      # dark purple
        [content.list]='\033[38;5;213m'           # pink
        [content.quote]='\033[3;38;5;177m'        # italic violet
        [content.emphasis.strong]='\033[1m'       # bold
        [content.emphasis.em]='\033[3m'           # italic
        [content.link]='\033[4;38;5;201m'         # underline magenta
        [ui.border]='\033[38;5;54m'               # dark purple
        [content.table.border]='\033[38;5;54m'    # dark purple
        [content.table.header]='\033[1;38;5;201m' # bold magenta
        [content.table.cell]='\033[38;5;225m'     # pale pink
        [text.primary]='\033[38;5;225m'           # pale pink
        [text.secondary]='\033[38;5;177m'         # violet
    )
}

# Available built-in themes
declare -ga CHROMA_BUILTIN_THEMES=(default warm cool arctic neutral electric)

# Switch theme
# Uses TDS if available, falls back to built-in palettes
chroma_switch_theme() {
    local theme="${1:-default}"

    # Try TDS first
    if declare -F tds_switch_theme &>/dev/null; then
        if TDS_QUIET_LOAD=1 tds_switch_theme "$theme" 2>/dev/null; then
            CHROMA_THEME="$theme"
            return 0
        fi
    fi

    # Fallback to built-in themes
    case "$theme" in
        default) _chroma_init_theme_default ;;
        warm)    _chroma_init_theme_warm ;;
        cool)    _chroma_init_theme_cool ;;
        arctic)  _chroma_init_theme_arctic ;;
        neutral) _chroma_init_theme_neutral ;;
        electric) _chroma_init_theme_electric ;;
        *)
            echo "Unknown theme: $theme" >&2
            echo "Available: ${CHROMA_BUILTIN_THEMES[*]}" >&2
            return 1
            ;;
    esac

    CHROMA_THEME="$theme"
    return 0
}

# List available themes
chroma_list_themes() {
    echo
    echo "Chroma Themes"
    echo

    # Check if TDS is available
    if declare -F tds_list_themes &>/dev/null; then
        echo "TDS themes available:"
        tds_list_themes
    else
        echo "Built-in themes:"
        local current="$CHROMA_THEME"
        for theme in "${CHROMA_BUILTIN_THEMES[@]}"; do
            printf "  %-12s" "$theme"
            if [[ "$theme" == "$current" ]]; then
                printf " ●"
            fi
            echo
        done
        echo
        echo "Load TDS for additional themes: source \$TETRA_SRC/bash/tds/tds.sh"
    fi
    echo
}

# Initialize default theme
_chroma_init_theme_default

# Color codes (uses TDS or built-in palette)
_chroma_color() {
    local token="$1"
    (( CHROMA_NO_COLOR )) && return

    # Try TDS first
    if declare -F tds_text_color &>/dev/null; then
        tds_text_color "$token"
        return
    fi

    # Use built-in palette
    local code="${_CHROMA_PALETTES[$token]}"
    if [[ -n "$code" ]]; then
        printf '%b' "$code"
        return
    fi

    # Fallback for heading levels not in palette
    case "$token" in
        content.heading.*)
            # Use h4 as fallback for h5/h6
            code="${_CHROMA_PALETTES[content.heading.h4]}"
            [[ -n "$code" ]] && printf '%b' "$code"
            ;;
        *)
            # Default to text.primary
            code="${_CHROMA_PALETTES[text.primary]}"
            [[ -n "$code" ]] && printf '%b' "$code" || printf '\033[38;5;252m'
            ;;
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

# Classify a single line - sets _CHROMA_RESULT to "type:level:content"
# Uses global state for code blocks (can't use subshell)
_chroma_classify() {
    local line="$1"

    # Code fence start/end
    if [[ "$line" =~ ^\`\`\`(.*)$ ]]; then
        local lang="${BASH_REMATCH[1]}"
        if (( _CHROMA_IN_CODE )); then
            _CHROMA_IN_CODE=0
            _CHROMA_RESULT="code.end::"
        else
            _CHROMA_IN_CODE=1
            _CHROMA_CODE_LANG="$lang"
            _CHROMA_RESULT="code.start:$lang:"
        fi
        return
    fi

    # Inside code block
    if (( _CHROMA_IN_CODE )); then
        _CHROMA_RESULT="code.line::$line"
        return
    fi

    # Empty line
    if [[ -z "$line" ]]; then
        _CHROMA_RESULT="blank::"
        return
    fi

    # Heading (ATX style: # ## ### etc)
    if [[ "$line" =~ ^(#{1,6})\ +(.*)$ ]]; then
        local level=${#BASH_REMATCH[1]}
        local content="${BASH_REMATCH[2]}"
        _CHROMA_RESULT="heading:$level:$content"
        return
    fi

    # Horizontal rule (but not table separator)
    if [[ "$line" =~ ^[-*_]{3,}\ *$ ]] && [[ ! "$line" =~ ^\| ]]; then
        _CHROMA_RESULT="hr::"
        return
    fi

    # Table row (starts with |)
    if [[ "$line" =~ ^\|.*\|$ ]]; then
        # Check if it's a separator row - only contains |, -, :, and spaces
        local stripped="${line//[|:[:space:]-]/}"
        if [[ -z "$stripped" ]]; then
            _CHROMA_RESULT="table.sep::$line"
        else
            _CHROMA_RESULT="table.row::$line"
        fi
        return
    fi

    # Blockquote
    if [[ "$line" =~ ^\>\ ?(.*)$ ]]; then
        _CHROMA_RESULT="quote::${BASH_REMATCH[1]}"
        return
    fi

    # Bullet list (- or * or +)
    if [[ "$line" =~ ^[\ ]*[-*+]\ +(.*)$ ]]; then
        _CHROMA_RESULT="list.bullet::${BASH_REMATCH[1]}"
        return
    fi

    # Numbered list - preserve the number
    if [[ "$line" =~ ^[\ ]*([0-9]+)\.\ +(.*)$ ]]; then
        local num="${BASH_REMATCH[1]}"
        local content="${BASH_REMATCH[2]}"
        _CHROMA_RESULT="list.number:$num:$content"
        return
    fi

    # Regular paragraph text
    _CHROMA_RESULT="text::$line"
}

# Render inline formatting (bold, italic, code, links)
# $1 = text to render
# $2 = base token to restore after formatting (optional, default text.primary)
_chroma_inline() {
    local text="$1"
    local base_token="${2:-text.primary}"
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
                _chroma_color "$(_chroma_token "$base_token")"
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
                _chroma_color "$(_chroma_token "$base_token")"
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
                _chroma_color "$(_chroma_token "$base_token")"
                i=$((end + 1))
                continue
            fi
        fi

        # Regular character
        printf '%s' "$char"
        ((i++))
    done
}

# Calculate visual width of text (strip markdown formatting)
_chroma_visual_width() {
    local text="$1"
    # Remove **bold**, *italic*, `code` markers
    text="${text//\*\*/}"
    text="${text//\*/}"
    text="${text//\`/}"
    echo "${#text}"
}

# Parse table row into cells array
_chroma_parse_table_row() {
    local row="$1"
    local -n cells_ref="$2"
    cells_ref=()

    # Strip leading/trailing pipes and split
    row="${row#|}"
    row="${row%|}"

    # Split by | into cells
    local IFS='|'
    read -ra cells_ref <<< "$row"

    # Trim whitespace from each cell
    local i
    for i in "${!cells_ref[@]}"; do
        cells_ref[$i]="${cells_ref[$i]#"${cells_ref[$i]%%[![:space:]]*}"}"
        cells_ref[$i]="${cells_ref[$i]%"${cells_ref[$i]##*[![:space:]]}"}"
    done
}

# Parse alignment from separator row
_chroma_parse_table_align() {
    local sep="$1"
    local -n aligns_ref="$2"
    aligns_ref=()

    sep="${sep#|}"
    sep="${sep%|}"

    local IFS='|'
    local -a parts
    read -ra parts <<< "$sep"

    local part
    for part in "${parts[@]}"; do
        part="${part#"${part%%[![:space:]]*}"}"
        part="${part%"${part##*[![:space:]]}"}"
        if [[ "$part" =~ ^:.*:$ ]]; then
            aligns_ref+=("center")
        elif [[ "$part" =~ ^: ]]; then
            aligns_ref+=("left")
        elif [[ "$part" =~ :$ ]]; then
            aligns_ref+=("right")
        else
            aligns_ref+=("left")
        fi
    done
}

# Render table row with proper alignment
_chroma_render_table_row() {
    local row="$1"
    local is_header="$2"
    local pad="$3"
    local -n widths_ref="$4"
    local -n aligns_ref="$5"

    local -a cells
    _chroma_parse_table_row "$row" cells

    printf '%s' "$pad"
    _chroma_color "$(_chroma_token table.border)"
    printf '│'
    _chroma_reset

    local i cell width align padl padr
    for i in "${!cells[@]}"; do
        cell="${cells[$i]}"
        local visual_len
        visual_len=$(_chroma_visual_width "$cell")
        width="${widths_ref[$i]:-$visual_len}"
        align="${aligns_ref[$i]:-left}"

        # Calculate padding for alignment (using visual width)
        local total_pad=$((width - visual_len))
        (( total_pad < 0 )) && total_pad=0

        case "$align" in
            center)
                padl=$((total_pad / 2))
                padr=$((total_pad - padl))
                ;;
            right)
                padl=$total_pad
                padr=0
                ;;
            *)  # left
                padl=0
                padr=$total_pad
                ;;
        esac

        printf ' '
        local cell_token
        if (( is_header )); then
            cell_token="table.header"
        else
            cell_token="table.cell"
        fi
        _chroma_color "$(_chroma_token "$cell_token")"
        printf '%*s' "$padl" ''
        _chroma_inline "$cell" "$cell_token"
        printf '%*s' "$padr" ''
        _chroma_reset
        printf ' '
        _chroma_color "$(_chroma_token table.border)"
        printf '│'
        _chroma_reset
    done
    echo
}

# Render table separator line
_chroma_render_table_sep() {
    local pad="$1"
    local -n widths_ref="$2"

    printf '%s' "$pad"
    _chroma_color "$(_chroma_token table.border)"
    printf '├'
    local i width
    for i in "${!widths_ref[@]}"; do
        width="${widths_ref[$i]}"
        printf '%*s' "$((width + 2))" '' | tr ' ' '─'
        if (( i < ${#widths_ref[@]} - 1 )); then
            printf '┼'
        fi
    done
    printf '┤'
    _chroma_reset
    echo
}

# Render table top border
_chroma_render_table_top() {
    local pad="$1"
    local -n widths_ref="$2"

    printf '%s' "$pad"
    _chroma_color "$(_chroma_token table.border)"
    printf '┌'
    local i width
    for i in "${!widths_ref[@]}"; do
        width="${widths_ref[$i]}"
        printf '%*s' "$((width + 2))" '' | tr ' ' '─'
        if (( i < ${#widths_ref[@]} - 1 )); then
            printf '┬'
        fi
    done
    printf '┐'
    _chroma_reset
    echo
}

# Render table bottom border
_chroma_render_table_bottom() {
    local pad="$1"
    local -n widths_ref="$2"

    printf '%s' "$pad"
    _chroma_color "$(_chroma_token table.border)"
    printf '└'
    local i width
    for i in "${!widths_ref[@]}"; do
        width="${widths_ref[$i]}"
        printf '%*s' "$((width + 2))" '' | tr ' ' '─'
        if (( i < ${#widths_ref[@]} - 1 )); then
            printf '┴'
        fi
    done
    printf '┘'
    _chroma_reset
    echo
}

# Flush accumulated table
_chroma_flush_table() {
    local pad="$1"

    (( ${#_CHROMA_TABLE_ROWS[@]} == 0 )) && return

    # Calculate column widths (visual width, not raw)
    _CHROMA_TABLE_WIDTHS=()
    local row cells i
    for row in "${_CHROMA_TABLE_ROWS[@]}"; do
        local -a cells
        _chroma_parse_table_row "$row" cells
        for i in "${!cells[@]}"; do
            local len
            len=$(_chroma_visual_width "${cells[$i]}")
            if (( len > ${_CHROMA_TABLE_WIDTHS[$i]:-0} )); then
                _CHROMA_TABLE_WIDTHS[$i]=$len
            fi
        done
    done

    # Render table
    _chroma_render_table_top "$pad" _CHROMA_TABLE_WIDTHS

    local row_num=0
    for row in "${_CHROMA_TABLE_ROWS[@]}"; do
        if (( row_num == 0 )); then
            _chroma_render_table_row "$row" 1 "$pad" _CHROMA_TABLE_WIDTHS _CHROMA_TABLE_ALIGNS
            _chroma_render_table_sep "$pad" _CHROMA_TABLE_WIDTHS
        else
            _chroma_render_table_row "$row" 0 "$pad" _CHROMA_TABLE_WIDTHS _CHROMA_TABLE_ALIGNS
        fi
        ((row_num++))
    done

    _chroma_render_table_bottom "$pad" _CHROMA_TABLE_WIDTHS

    # Reset table state
    _CHROMA_IN_TABLE=0
    _CHROMA_TABLE_ROWS=()
    _CHROMA_TABLE_ALIGNS=()
    _CHROMA_TABLE_WIDTHS=()
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

    # Handle table state transitions
    if [[ "$type" != table.* ]] && (( _CHROMA_IN_TABLE )); then
        _chroma_flush_table "$pad"
    fi

    case "$type" in
        table.row)
            _CHROMA_IN_TABLE=1
            _CHROMA_TABLE_ROWS+=("$content")
            return  # Don't render yet, accumulate
            ;;

        table.sep)
            # Parse alignment from separator
            _chroma_parse_table_align "$content" _CHROMA_TABLE_ALIGNS
            return  # Don't render separator, just store alignment
            ;;
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
            _chroma_inline "$content" "quote"
            _chroma_reset
            echo
            ;;

        list.bullet)
            printf '%s' "$pad"
            _chroma_color "$(_chroma_token list.bullet)"
            printf '• '
            _chroma_reset
            _chroma_color "$(_chroma_token text)"
            _chroma_inline "$content" "text"
            _chroma_reset
            echo
            ;;

        list.number)
            printf '%s' "$pad"
            _chroma_color "$(_chroma_token list.number)"
            printf '%s. ' "$level"  # level holds the number
            _chroma_reset
            _chroma_color "$(_chroma_token text)"
            _chroma_inline "$content" "text"
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
            _chroma_inline "$content" "text"
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
    local theme=""
    CHROMA_NO_COLOR=0

    # Handle subcommands first
    case "${1:-}" in
        themes)
            chroma_list_themes
            return 0
            ;;
        theme)
            # chroma theme [name] - show or switch theme
            if [[ -n "${2:-}" ]]; then
                chroma_switch_theme "$2"
            else
                echo "Current theme: $CHROMA_THEME"
                echo "Use 'chroma themes' to list available themes"
            fi
            return 0
            ;;
    esac

    # Parse args
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -m|--margin) margin="$2"; shift 2 ;;
            -w|--width) width="$2"; shift 2 ;;
            -t|--theme) theme="$2"; shift 2 ;;
            --no-color) CHROMA_NO_COLOR=1; shift ;;
            -h|--help) chroma_help; return 0 ;;
            help) chroma_help; return 0 ;;
            -*) shift ;;
            *) file="$1"; shift ;;
        esac
    done

    # Apply theme if specified
    if [[ -n "$theme" ]]; then
        chroma_switch_theme "$theme" || return 1
    fi

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

    # Reset parser state
    _CHROMA_IN_CODE=0
    _CHROMA_CODE_LANG=""
    _CHROMA_RESULT=""
    _CHROMA_IN_TABLE=0
    _CHROMA_TABLE_ROWS=()
    _CHROMA_TABLE_ALIGNS=()
    _CHROMA_TABLE_WIDTHS=()

    # Parse and render each line
    while IFS= read -r line || [[ -n "$line" ]]; do
        _chroma_classify "$line"
        _chroma_render_line "$_CHROMA_RESULT" "$pad" "$content_width"
    done < "$tmp"

    # Flush any pending table at end of input
    (( _CHROMA_IN_TABLE )) && _chroma_flush_table "$pad"

    # Cleanup
    if (( is_tmp )); then
        rm -f "$tmp"
    fi
    return 0
}

chroma_help() {
    cat <<'EOF'
chroma - Markdown terminal renderer with syntax highlighting

USAGE
  chroma [options] [file]     Render markdown file
  cat file | chroma           Pipe content
  chroma themes               List available themes
  chroma theme [name]         Show or switch theme

OPTIONS
  -m, --margin N    Add margin (top/left/right)
  -w, --width N     Set content width (default: terminal width)
  -t, --theme NAME  Use specific theme (warm, cool, arctic, neutral, electric)
  --no-color        Disable colors
  -h, --help        Show this help

THEMES
  default           Cool blue tones (default)
  warm              Amber/orange tones
  cool              Blue/purple tones
  arctic            Icy blues
  neutral           Green/gray tones
  electric          Vibrant purple/magenta

  With TDS loaded, additional themes are available.
  Theme persists until changed or shell restart.

SUPPORTED ELEMENTS
  # Headings        H1-H6 with level colors
  ```code```        Fenced code blocks
  `inline`          Inline code
  **bold**          Bold text
  *italic*          Italic text
  - bullets         Bullet lists
  1. numbers        Numbered lists
  > quotes          Blockquotes
  ---               Horizontal rules
  | tables |        With alignment support

EXAMPLES
  chroma README.md
  chroma -t warm README.md
  chroma -m 4 -w 60 doc.txt
  echo '# Hello' | chroma
  chroma themes
EOF
}
