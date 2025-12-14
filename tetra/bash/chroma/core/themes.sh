#!/usr/bin/env bash
# Chroma - Theme definitions and switching
# Part of the chroma modular markdown renderer

# Theme palette storage: token → ANSI escape code
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

# Initialize default theme at source time
_chroma_init_theme_default
