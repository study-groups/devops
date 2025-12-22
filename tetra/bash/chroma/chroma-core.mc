#MULTICAT_START
# dir: /Users/mricos/src/devops/tetra/bash/chroma
# file: includes.sh
# notes:
#MULTICAT_END
#!/usr/bin/env bash

# Chroma Module - Terminal Markdown Viewer (Modular Architecture)

# Load module utilities
source "$TETRA_SRC/bash/utils/module_init.sh"
source "$TETRA_SRC/bash/utils/function_helpers.sh"

# Initialize module with standard tetra conventions
tetra_module_init_with_alias "chroma" "CHROMA"

#==============================================================================
# LOAD CHROMA MODULAR CORE
#==============================================================================

# Source the modular loader which handles all dependencies
source "$CHROMA_SRC/chroma_modular.sh"

#==============================================================================
# RELOAD SUPPORT
#==============================================================================

# Reload chroma module (for development)
chroma_reload() {
    echo "Reloading chroma..."

    # Re-source the modular loader
    source "$CHROMA_SRC/chroma_modular.sh"

    echo "Chroma reloaded"
    chroma --help 2>/dev/null | head -3
}

export -f chroma_reload

#MULTICAT_START
# dir: /Users/mricos/src/devops/tetra/bash/chroma
# file: chroma_modular.sh
# notes:
#MULTICAT_END
#!/usr/bin/env bash
# Chroma - Modular markdown renderer for bash
# This loader sources all modules in dependency order

# Determine source directory
CHROMA_SRC="${CHROMA_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"

# Source modules in dependency order
source "$CHROMA_SRC/core/globals.sh"
source "$CHROMA_SRC/core/plugins.sh"
source "$CHROMA_SRC/core/config.sh"
source "$CHROMA_SRC/core/themes.sh"
source "$CHROMA_SRC/render/colors.sh"
source "$CHROMA_SRC/render/text.sh"
source "$CHROMA_SRC/render/patterns.sh"
source "$CHROMA_SRC/render/tables.sh"
source "$CHROMA_SRC/render/parser.sh"
source "$CHROMA_SRC/render/line.sh"
source "$CHROMA_SRC/main.sh"

# If executed directly (not sourced), run chroma
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    chroma "$@"
fi

#MULTICAT_START
# dir: /Users/mricos/src/devops/tetra/bash/chroma
# file: chroma.sh
# notes:
#MULTICAT_END
#!/usr/bin/env bash

# Chroma - Terminal Syntax Highlighter
# Main entry point

#==============================================================================
# CONFIGURATION
#==============================================================================

CHROMA_PAGER_CMD="${CHROMA_PAGER_CMD:-less -R}"
CHROMA_DEBUG="${CHROMA_DEBUG:-0}"

#==============================================================================
# MAIN FUNCTION
#==============================================================================

chroma() {
    # 1. Parse arguments
    chroma_parse_args "$@" || return $?

    # 2. Handle subcommands
    if [[ -n "$CHROMA_SUBCOMMAND" ]]; then
        chroma_dispatch_subcommand "$CHROMA_SUBCOMMAND" "$CHROMA_SUBCMD_ARGS"
        return $?
    fi

    # 3. Resolve input (file or stdin)
    chroma_resolve_input "$CHROMA_FILE" || return $?

    # 4. Auto-detect pager mode
    chroma_auto_pager

    # 5. Detect format
    local format
    format=$(chroma_detect_format "$CHROMA_INPUT_FILE" "$CHROMA_FORMAT")

    # Debug
    (( CHROMA_DEBUG )) && echo "[chroma] file=$CHROMA_INPUT_FILE format=$format pager=$CHROMA_PAGER" >&2

    # 6. Apply margins
    if [[ -n "$CHROMA_MARGIN" ]]; then
        # Uniform override from -m flag
        export TDS_MARGIN_TOP="$CHROMA_MARGIN"
        export TDS_MARGIN_LEFT="$CHROMA_MARGIN"
        export TDS_MARGIN_RIGHT="$CHROMA_MARGIN"
    else
        # Apply defaults
        export TDS_MARGIN_TOP="${CHROMA_MARGIN_TOP:-2}"
        export TDS_MARGIN_LEFT="${CHROMA_MARGIN_LEFT:-4}"
    fi

    # 7. Render
    chroma_render "$format" "$CHROMA_INPUT_FILE" "$CHROMA_PAGER"
    local rc=$?

    # 8. Cleanup
    chroma_cleanup_input

    return $rc
}

#==============================================================================
# STATUS
#==============================================================================

chroma_status() {
    local term_width=${COLUMNS:-$(tput cols 2>/dev/null || echo 80)}
    echo "Chroma Status"
    echo "  TDS loaded: ${TDS_LOADED:-false}"
    echo "  Parsers: ${#CHROMA_PARSER_ORDER[@]} (${CHROMA_PARSER_ORDER[*]})"
    echo "  Pager: ${CHROMA_PAGER_CMD}"
    echo "  Width: ${TDS_MARKDOWN_WIDTH:-auto} (term=$term_width)"
    echo "  Margins: top=${CHROMA_MARGIN_TOP:-2} left=${CHROMA_MARGIN_LEFT:-4}"
}

#==============================================================================
# DIRECT EXECUTION
#==============================================================================

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    chroma "$@"
fi

#MULTICAT_START
# dir: /Users/mricos/src/devops/tetra/bash/chroma
# file: main.sh
# notes:
#MULTICAT_END
#!/usr/bin/env bash
# Chroma - Main entry point and CLI
# Part of the chroma modular markdown renderer

#==============================================================================
# MARGIN PARSING
#==============================================================================
# Formats:
#   -m N    -> uniform margin on all sides
#   -m c    -> center content (auto left/right)

_chroma_parse_margin() {
    local val="${1:-}"

    # Defaults
    _M_TOP=2
    _M_LEFT=4
    _M_VAL=0
    _M_CENTER=0

    # Empty means use defaults
    if [[ -z "$val" ]]; then
        return 0
    elif [[ "$val" == "c" || "$val" == "center" ]]; then
        _M_CENTER=1
    elif [[ "$val" =~ ^[0-9]+$ ]]; then
        _M_VAL=$val
        _M_TOP=$val
        _M_LEFT=$val
    else
        echo "Error: margin must be a number or 'c' for center" >&2
        return 1
    fi
    return 0
}

# Normalize paragraphs: join continuation lines (lines with leading whitespace)
# into proper paragraphs. Preserves code blocks, lists, headers, etc.
_chroma_normalize_paragraphs() {
    local in_code=0
    local para_buf=""
    local line

    while IFS= read -r line || [[ -n "$line" ]]; do
        # Track code blocks
        if [[ "$line" =~ ^\`\`\` ]]; then
            # Flush paragraph buffer first
            [[ -n "$para_buf" ]] && { echo "$para_buf"; para_buf=""; }
            echo "$line"
            in_code=$((1 - in_code))
            continue
        fi

        # Inside code block - pass through
        if (( in_code )); then
            echo "$line"
            continue
        fi

        # Empty line - flush paragraph
        if [[ -z "$line" ]]; then
            [[ -n "$para_buf" ]] && { echo "$para_buf"; para_buf=""; }
            echo ""
            continue
        fi

        # Special lines (headers, lists, quotes, tables, hr) - flush and pass through
        if [[ "$line" =~ ^[\#\>\|\*\+] ]] || [[ "$line" =~ ^- ]] || [[ "$line" =~ ^[0-9]+\. ]]; then
            [[ -n "$para_buf" ]] && { echo "$para_buf"; para_buf=""; }
            echo "$line"
            continue
        fi

        # Continuation line (starts with whitespace) - join to buffer
        if [[ "$line" =~ ^[[:space:]]+ ]] && [[ -n "$para_buf" ]]; then
            local trimmed="${line#"${line%%[![:space:]]*}"}"
            para_buf+=" $trimmed"
            continue
        fi

        # Regular text - start or continue paragraph
        local trimmed="${line#"${line%%[![:space:]]*}"}"
        if [[ -n "$para_buf" ]]; then
            para_buf+=" $trimmed"
        else
            para_buf="$trimmed"
        fi
    done

    # Flush remaining
    [[ -n "$para_buf" ]] && echo "$para_buf"
}

# Render document header for browse mode
_chroma_render_header() {
    local file="$1"
    local theme="$2"
    local margin="${3:-0}"
    local width=${COLUMNS:-80}
    (( width > 120 )) && width=120

    local lines="?"
    local name="stdin"

    if [[ -n "$file" && -f "$file" ]]; then
        lines=$(wc -l < "$file" 2>/dev/null | tr -d ' ')
        name=$(basename "$file")
    fi

    # Top margin
    for ((i=0; i<margin; i++)); do echo; done

    # Build info string
    local info="$name"
    local right="Theme: $theme  Lines: $lines"
    local pad=""
    (( margin > 0 )) && printf -v pad "%*s" "$margin" ""
    local content_width=$((width - margin * 2))
    local padding=$((content_width - ${#info} - ${#right}))
    (( padding < 1 )) && padding=1

    # Single line header with border
    _chroma_color "$(_chroma_token table.border)"
    printf '%s%s%*s%s\n' "$pad" "$info" "$padding" "" "$right"
    printf '%s' "$pad"
    printf '─%.0s' $(seq 1 $content_width)
    printf '\n'
    _chroma_reset
}

# Browse a file with header and pager
_chroma_browse() {
    local file=""
    local theme="$CHROMA_THEME"
    local margin=2

    # Parse browse args
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -t|--theme) theme="$2"; shift 2 ;;
            -m|--margin) margin="$2"; shift 2 ;;
            -*) shift ;;
            *) file="$1"; shift ;;
        esac
    done

    # Handle stdin
    local tmp=""
    local is_tmp=0
    if [[ -z "$file" && ! -t 0 ]]; then
        tmp=$(mktemp)
        cat > "$tmp"
        file="$tmp"
        is_tmp=1
    fi

    [[ -z "$file" || ! -f "$file" ]] && {
        echo "Usage: chroma browse [options] <file>" >&2
        echo "       cat file | chroma browse" >&2
        return 1
    }

    # Get file info for status bar
    local name
    if (( is_tmp )); then
        name="stdin"
    else
        name=$(basename "$file")
    fi

    # Build less prompt: "filename | Theme: x | Line N/M (P%)"
    local prompt="$name | Theme: ${theme:-default} | Line %lt/%L (%pB\\%)"

    # Render content with pager showing info in status bar
    chroma -t "$theme" -m "$margin" "$file" | \
        ${CHROMA_PAGER:-less -R -PM"$prompt"}

    # Cleanup
    (( is_tmp )) && rm -f "$tmp"
}

chroma() {
    local file=""
    local margin=""  # empty = use defaults (top=2, left=4)
    local width=66   # default content width
    local tmp=""
    local is_tmp=0
    local theme=""
    local use_pager=""  # empty = auto (pager if piped)
    CHROMA_NO_COLOR=0
    CHROMA_TRUNCATE="${CHROMA_TRUNCATE:-0}"

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
        plugins)
            chroma_list_plugins
            return 0
            ;;
        browse)
            shift
            _chroma_browse "$@"
            return $?
            ;;
        config)
            # chroma config [list|get|set|save|load|reset]
            shift
            case "${1:-list}" in
                list|ls)
                    chroma_config_list
                    ;;
                get)
                    [[ -z "$2" ]] && { echo "Usage: chroma config get <plugin.option>"; return 1; }
                    chroma_config_show "$2"
                    ;;
                set)
                    [[ -z "$2" || -z "$3" ]] && { echo "Usage: chroma config set <plugin> <option> <value>"; return 1; }
                    chroma_config_set "$2" "$3" "$4"
                    echo "Set $2.$3 = $4"
                    ;;
                save)
                    chroma_config_save "${2:-}"
                    ;;
                load)
                    chroma_config_load "${2:-}"
                    echo "Configuration loaded"
                    ;;
                reset)
                    [[ -z "$2" || -z "$3" ]] && { echo "Usage: chroma config reset <plugin> <option>"; return 1; }
                    if chroma_config_reset "$2" "$3"; then
                        echo "Reset $2.$3 to default"
                    else
                        echo "No default for $2.$3" >&2
                        return 1
                    fi
                    ;;
                *)
                    echo "Usage: chroma config [list|get|set|save|load|reset]"
                    echo "  list                      Show all configuration"
                    echo "  get <plugin.option>       Get value"
                    echo "  set <plugin> <opt> <val>  Set value"
                    echo "  reset <plugin> <option>   Reset to default"
                    echo "  save [file]               Save to file"
                    echo "  load [file]               Load from file"
                    return 1
                    ;;
            esac
            return 0
            ;;
    esac

    # Parse args
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -m|--margin) margin="$2"; shift 2 ;;
            -w|--width) width="$2"; shift 2 ;;
            -t|--theme) theme="$2"; shift 2 ;;
            -n|--no-pager) use_pager=0; shift ;;
            -p|--pager) use_pager=1; shift ;;
            --no-color) CHROMA_NO_COLOR=1; shift ;;
            --truncate) CHROMA_TRUNCATE=1; shift ;;
            -h|--help) chroma_help; return 0 ;;
            help) chroma_help; return 0 ;;
            -*) shift ;;
            *) file="$1"; shift ;;
        esac
    done

    # Parse margin (number or 'c' for center)
    _chroma_parse_margin "$margin" || return 1

    # Apply theme if specified
    if [[ -n "$theme" ]]; then
        chroma_switch_theme "$theme" || return 1
    fi

    # Get input
    if [[ -n "$file" && -f "$file" ]]; then
        # Normalize paragraphs from file
        tmp=$(mktemp)
        _chroma_normalize_paragraphs < "$file" > "$tmp"
        is_tmp=1
    elif [[ ! -t 0 ]]; then
        # Capture stdin first, then normalize
        local raw_tmp=$(mktemp)
        cat > "$raw_tmp"
        tmp=$(mktemp)
        _chroma_normalize_paragraphs < "$raw_tmp" > "$tmp"
        # DEBUG: show normalized content
        [[ -n "${CHROMA_DEBUG:-}" ]] && { echo "=== Normalized ===" >&2; cat "$tmp" >&2; echo "=== End ===" >&2; }
        rm -f "$raw_tmp"
        is_tmp=1
    else
        echo "Usage: chroma [file] or pipe content" >&2
        return 1
    fi

    # Auto-enable pager when input is from pipe (unless explicitly set)
    if [[ -z "$use_pager" ]]; then
        if (( is_tmp )) && [[ -z "$file" ]]; then
            # Input came from pipe - enable pager by default
            use_pager=1
        else
            use_pager=0
        fi
    fi

    # Calculate content width
    local term_width=${COLUMNS:-80}
    (( term_width < 40 )) && term_width=80
    (( term_width >= 200 )) && term_width=120

    local left_margin=$_M_LEFT

    # Handle centering: auto-calculate left margin
    if (( _M_CENTER )); then
        local default_width=80
        (( default_width > term_width )) && default_width=$((term_width - 4))
        left_margin=$(( (term_width - default_width) / 2 ))
    fi

    local content_width=$width
    (( content_width < 20 )) && content_width=20

    # Build margin string (left padding)
    local pad=""
    (( left_margin > 0 )) && printf -v pad "%*s" "$left_margin" ""

    # Top margin
    if [[ -z "${_CHROMA_SKIP_TOP_MARGIN:-}" ]]; then
        for ((i=0; i<_M_TOP; i++)); do echo; done
    fi

    # Render function (can be piped to pager)
    _chroma_do_render() {
        # Reset parser state
        _CHROMA_IN_CODE=0
        _CHROMA_CODE_LANG=""
        _CHROMA_RESULT=""
        _CHROMA_IN_TABLE=0
        _CHROMA_TABLE_ROWS=()
        _CHROMA_TABLE_ALIGNS=()
        _CHROMA_TABLE_WIDTHS=()

        # Pre-render hook
        _chroma_run_hooks pre_render "$tmp" "$pad" "$content_width"

        # Parse and render each line (input already normalized)
        while IFS= read -r line || [[ -n "$line" ]]; do
            _chroma_classify "$line"
            _chroma_render_line "$_CHROMA_RESULT" "$pad" "$content_width"
        done < "$tmp"

        # Flush any pending table at end of input
        (( _CHROMA_IN_TABLE )) && _chroma_flush_table "$pad" "$content_width"

        # Post-render hook
        _chroma_run_hooks post_render "$tmp"
    }

    # Execute with or without pager
    if (( use_pager )); then
        _chroma_do_render | ${CHROMA_PAGER:-less -R}
    else
        _chroma_do_render
    fi

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
  chroma browse [file]        Browse file with header in pager
  chroma themes               List available themes
  chroma theme [name]         Show or switch theme
  chroma plugins              List loaded plugins and hooks
  chroma config [cmd]         Manage plugin configuration

OPTIONS
  -m, --margin N    Uniform margin on all sides (or 'c' to center)
  -w, --width N     Set content width (default: terminal width)
  -t, --theme NAME  Use specific theme (warm, cool, arctic, neutral, electric)
  --no-color        Disable colors
  --truncate        Show only truncated header for pattern lists (no expansion)
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

PLUGINS
  Plugins can hook into the render pipeline:
  - pre_render, post_render: Document level hooks
  - pre_line, post_line: Line processing hooks
  - render_heading, render_code, render_quote, render_list,
    render_table, render_hr: Element-specific hooks

  Plugin API:
    chroma_register_plugin <name> <init_fn>
    chroma_hook <hook_point> <callback>
    chroma_unhook <hook_point> <callback>
    chroma_load_plugins [directory]

CONFIGURATION
  chroma config list              Show all plugin config
  chroma config get <key>         Get value (e.g., line-numbers.color)
  chroma config set <p> <o> <v>   Set plugin.option = value
  chroma config reset <p> <o>     Reset option to default
  chroma config save [file]       Save config to file
  chroma config load [file]       Load config from file

  Config API for plugins:
    chroma_config_declare <plugin> <option> <default> [desc]
    chroma_config_get <plugin> <option> [default]
    chroma_config_set <plugin> <option> <value>

EXAMPLES
  chroma README.md
  chroma -t warm README.md
  chroma -m 4 -w 60 doc.txt
  echo '# Hello' | chroma
  chroma browse README.md         Browse with pager
  chroma browse -t arctic doc.md  Browse with theme
  chroma themes
  chroma plugins
  chroma config list
EOF
}

#MULTICAT_START
# dir: /Users/mricos/src/devops/tetra/bash/chroma
# file: help.sh
# notes:
#MULTICAT_END
#!/usr/bin/env bash

# Chroma Help System
# Themed help using TDS colors

#==============================================================================
# HELP PRIMITIVES
#==============================================================================

_ch() {
    # Colored heading
    local level="$1" text="$2"
    tds_text_color "content.heading.h${level}"
    printf "\033[1m%s\033[0m\n" "$text"
    reset_color
}

_cl() {
    # Colored label (dim)
    tds_text_color "text.secondary"
    printf "%s" "$1"
    reset_color
}

_cv() {
    # Colored value (primary)
    tds_text_color "text.primary"
    printf "%s" "$1"
    reset_color
}

_cc() {
    # Colored code/command
    tds_text_color "content.code.inline"
    printf "%s" "$1"
    reset_color
}

_ce() {
    # Colored emphasis
    tds_text_color "content.emphasis.bold"
    printf "\033[1m%s\033[0m" "$1"
    reset_color
}

_margin() {
    # Print margin spaces
    local m="${CHROMA_MARGIN:-0}"
    (( m > 0 )) && printf "%*s" "$m" ""
}

_nl() { echo; }

#==============================================================================
# HELP TOPICS
#==============================================================================

chroma_help() {
    local topic="${1:-}"

    # Add top margin
    local m="${CHROMA_MARGIN:-0}"
    for ((i=0; i<m; i++)); do echo; done

    case "$topic" in
        "")         _chroma_help_main ;;
        render)     _chroma_help_render ;;
        parser*)    _chroma_help_parser ;;
        format*)    _chroma_help_format ;;
        doctor)     _chroma_help_doctor ;;
        options)    _chroma_help_options ;;
        *)
            _margin; echo "Unknown help topic: $topic"
            _margin; echo "Topics: render parser format doctor options"
            return 1
            ;;
    esac
}

_chroma_help_main() {
    _margin; _ch 1 "chroma"
    _margin; _cl "Terminal Syntax Highlighter"; _nl
    _nl

    _margin; _ch 2 "USAGE"
    _margin; _cc "chroma <file>"; _cl "              Render file"; _nl
    _margin; _cc "cat file | chroma"; _cl "          Pipe content"; _nl
    _margin; _cc "chroma --toml config.toml"; _cl "  Explicit format"; _nl
    _nl

    _margin; _ch 2 "OPTIONS"
    _margin; _cc "-n"; _cl ", "; _cc "--no-pager"; _cl "    No pager"; _nl
    _margin; _cc "-m"; _cl ", "; _cc "--margin N"; _cl "    Add margin (top/left/right)"; _nl
    _margin; _cc "-t"; _cl ", "; _cc "--theme NAME"; _cl "  Use theme"; _nl
    _margin; _cc "-w"; _cl ", "; _cc "--width N"; _cl "     Set line width"; _nl
    _margin; _cc "--toml"; _cl "/"; _cc "--json"; _cl "/"; _cc "--md"; _cl "  Format shortcuts"; _nl
    _nl

    _margin; _ch 2 "COMMANDS"
    _margin; _cc "doctor"; _cl "   Health check"; _nl
    _margin; _cc "status"; _cl "   Show configuration"; _nl
    _margin; _cc "parser"; _cl "   List/info parsers"; _nl
    _margin; _cc "help"; _cl "     This help"; _nl
    _nl

    _margin; _cl "Help topics: "; _cv "render parser format doctor options"; _nl
}

_chroma_help_render() {
    _margin; _ch 1 "chroma render"
    _nl

    _margin; _ch 2 "USAGE"
    _margin; _cc "chroma [OPTIONS] <file>"; _nl
    _margin; _cc "cat file | chroma [OPTIONS]"; _nl
    _nl

    _margin; _ch 2 "FORMAT DETECTION"
    _margin; _cl "Auto-detects by extension: "; _cv ".md .toml .json"; _nl
    _margin; _cl "Or by content: "; _cv "[section]"; _cl " -> toml, "; _cv "{"; _cl " -> json"; _nl
    _margin; _cl "Default: "; _cv "markdown"; _nl
    _nl

    _margin; _ch 2 "PAGER"
    _margin; _cl "Auto-enabled for terminal output"; _nl
    _margin; _cl "Auto-disabled for piped input"; _nl
    _margin; _cc "-p"; _cl "  Force pager"; _nl
    _margin; _cc "-n"; _cl "  Force no pager"; _nl
    _nl

    _margin; _ch 2 "EXAMPLES"
    _margin; _cc "chroma README.md"; _nl
    _margin; _cc "cat data.json | chroma --json"; _nl
    _margin; _cc "chroma -m 4 -t warm doc.md"; _nl
}

_chroma_help_parser() {
    _margin; _ch 1 "chroma parser"
    _nl

    _margin; _ch 2 "COMMANDS"
    _margin; _cc "parser list"; _cl "         List all parsers"; _nl
    _margin; _cc "parser info <name>"; _cl "  Show parser details"; _nl
    _nl

    _margin; _ch 2 "EXAMPLES"
    _margin; _cc "chroma parser list"; _nl
    _margin; _cc "chroma parser info markdown"; _nl
}

_chroma_help_format() {
    _margin; _ch 1 "chroma format"
    _nl

    _margin; _ch 2 "SHORTCUTS"
    _margin; _cc "--toml"; _cl "    TOML files"; _nl
    _margin; _cc "--json"; _cl "    JSON files"; _nl
    _margin; _cc "--md"; _cl "      Markdown files"; _nl
    _margin; _cc "--claude"; _cl "  Claude ANSI output"; _nl
    _nl

    _margin; _ch 2 "EXPLICIT"
    _margin; _cc "-f, --format NAME"; _nl
    _nl

    _margin; _ch 2 "AUTO-DETECTION"
    _margin; _cl "By extension: "; _cv ".md .toml .json"; _nl
    _margin; _cl "By content: "; _cv "[section]"; _cl " or "; _cv "key=value"; _cl " -> toml"; _nl
    _margin; _cl "           "; _cv "{"; _cl " or "; _cv "["; _cl " -> json"; _nl
    _margin; _cl "Default: "; _cv "markdown"; _nl
}

_chroma_help_doctor() {
    _margin; _ch 1 "chroma doctor"
    _nl

    _margin; _ch 2 "USAGE"
    _margin; _cc "chroma doctor [-v]"; _nl
    _nl

    _margin; _ch 2 "OPTIONS"
    _margin; _cc "-v"; _cl ", "; _cc "--verbose"; _cl "   Detailed output"; _nl
    _nl

    _margin; _ch 2 "CHECKS"
    _margin; _cl "- Dependencies (TETRA_SRC, bash version)"; _nl
    _margin; _cl "- TDS integration"; _nl
    _margin; _cl "- Parser registration"; _nl
    _margin; _cl "- Theme system"; _nl
}

_chroma_help_options() {
    _margin; _ch 1 "chroma options"
    _nl

    _margin; _ch 2 "DISPLAY"
    _margin; _cc "-p"; _cl ", "; _cc "--pager"; _cl "       Use pager"; _nl
    _margin; _cc "-n"; _cl ", "; _cc "--no-pager"; _cl "    No pager"; _nl
    _margin; _cc "-m"; _cl ", "; _cc "--margin N"; _cl "    Margin (top/left/right)"; _nl
    _margin; _cc "-w"; _cl ", "; _cc "--width N"; _cl "     Line width"; _nl
    _margin; _cc "-t"; _cl ", "; _cc "--theme NAME"; _cl "  Theme"; _nl
    _nl

    _margin; _ch 2 "FORMAT"
    _margin; _cc "--toml --json --md --claude"; _nl
    _margin; _cc "-f, --format NAME"; _nl
    _nl

    _margin; _ch 2 "GENERAL"
    _margin; _cc "-h"; _cl ", "; _cc "--help"; _cl "        Show help"; _nl
    _margin; _cc "help [topic]"; _cl "      Topic help"; _nl
}

#MULTICAT_START
# dir: /Users/mricos/src/devops/tetra/bash/chroma
# file: doctor.sh
# notes:
#MULTICAT_END
#!/usr/bin/env bash

# Chroma Doctor
# Health checks and diagnostics for chroma

#==============================================================================
# MAIN DOCTOR COMMAND
#==============================================================================

chroma_doctor() {
    local verbose=0
    local check_filter=""

    # Parse args
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -v|--verbose) verbose=1; shift ;;
            --check) check_filter="$2"; shift 2 ;;
            -h|--help)
                cat <<'EOF'
Chroma Doctor - Health diagnostics

Usage: chroma doctor [OPTIONS]

Options:
  -v, --verbose     Show detailed output
  --check NAME      Run specific check only
  -h, --help        Show this help

Checks:
  dependencies      Core dependencies (TETRA_SRC, bash version)
  tds               TDS integration and functions
  parsers           Parser registration and validation
  themes            Theme system availability
  tokens            Semantic token resolution

Examples:
  chroma doctor              Run all checks
  chroma doctor -v           Verbose output
  chroma doctor --check tds  Check TDS only
EOF
                return 0
                ;;
            *) shift ;;
        esac
    done

    local exit_code=0

    echo "Chroma Health Check"
    echo "==================="
    echo

    # Run checks
    if [[ -z "$check_filter" || "$check_filter" == "dependencies" ]]; then
        _chroma_doctor_dependencies $verbose || exit_code=1
        echo
    fi

    if [[ -z "$check_filter" || "$check_filter" == "tds" ]]; then
        _chroma_doctor_tds $verbose || exit_code=1
        echo
    fi

    if [[ -z "$check_filter" || "$check_filter" == "parsers" ]]; then
        _chroma_doctor_parsers $verbose || exit_code=1
        echo
    fi

    if [[ -z "$check_filter" || "$check_filter" == "themes" ]]; then
        _chroma_doctor_themes $verbose || exit_code=1
        echo
    fi

    if [[ -z "$check_filter" || "$check_filter" == "tokens" ]]; then
        _chroma_doctor_tokens $verbose || exit_code=1
        echo
    fi

    # Summary
    echo "==================="
    if [[ $exit_code -eq 0 ]]; then
        printf "\033[32m✓ All checks passed\033[0m\n"
    else
        printf "\033[31m✗ Some checks failed\033[0m\n"
    fi

    return $exit_code
}

#==============================================================================
# INDIVIDUAL CHECKS
#==============================================================================

_chroma_doctor_dependencies() {
    local verbose="${1:-0}"
    local ok=0

    echo "Dependencies:"

    # TETRA_SRC
    if [[ -n "$TETRA_SRC" ]]; then
        printf "  \033[32m✓\033[0m TETRA_SRC: %s\n" "$TETRA_SRC"
    else
        printf "  \033[31m✗\033[0m TETRA_SRC not set\n"
        ok=1
    fi

    # CHROMA_SRC
    if [[ -n "$CHROMA_SRC" ]]; then
        printf "  \033[32m✓\033[0m CHROMA_SRC: %s\n" "$CHROMA_SRC"
    else
        printf "  \033[31m✗\033[0m CHROMA_SRC not set\n"
        ok=1
    fi

    # Bash version
    local bash_ver="${BASH_VERSINFO[0]}.${BASH_VERSINFO[1]}"
    if [[ "${BASH_VERSINFO[0]}" -ge 5 ]]; then
        printf "  \033[32m✓\033[0m Bash %s\n" "$bash_ver"
    else
        printf "  \033[31m✗\033[0m Bash %s (requires 5.0+)\n" "$bash_ver"
        ok=1
    fi

    # Terminal
    if [[ -n "$TERM" ]]; then
        printf "  \033[32m✓\033[0m TERM: %s\n" "$TERM"
    else
        printf "  \033[33m·\033[0m TERM not set\n"
    fi

    return $ok
}

_chroma_doctor_tds() {
    local verbose="${1:-0}"
    local ok=0

    echo "TDS Integration:"

    # TDS loaded flag
    if [[ "$TDS_LOADED" == "true" ]]; then
        printf "  \033[32m✓\033[0m TDS loaded"
        [[ -n "$TDS_VERSION" ]] && printf " (v%s)" "$TDS_VERSION"
        echo
    else
        printf "  \033[31m✗\033[0m TDS not loaded\n"
        return 1
    fi

    # Core TDS functions
    local required_fns=(
        tds_text_color
        tds_render_markdown
        tds_switch_theme
        reset_color
    )

    for fn in "${required_fns[@]}"; do
        if declare -F "$fn" &>/dev/null; then
            (( verbose )) && printf "  \033[32m✓\033[0m %s\n" "$fn"
        else
            printf "  \033[31m✗\033[0m %s missing\n" "$fn"
            ok=1
        fi
    done

    (( ! verbose )) && (( ok == 0 )) && \
        printf "  \033[32m✓\033[0m Core functions (%d)\n" "${#required_fns[@]}"

    return $ok
}

_chroma_doctor_parsers() {
    local verbose="${1:-0}"
    local ok=0

    echo "Parsers:"

    if [[ ${#CHROMA_PARSER_ORDER[@]} -eq 0 ]]; then
        printf "  \033[31m✗\033[0m No parsers registered\n"
        return 1
    fi

    for name in "${CHROMA_PARSER_ORDER[@]}"; do
        local fn="${CHROMA_PARSERS[$name]}"
        local validate_fn="${fn}_validate"

        # Check render function exists
        if ! declare -F "$fn" &>/dev/null; then
            printf "  \033[31m✗\033[0m %s (function missing)\n" "$name"
            ok=1
            continue
        fi

        # Run validator if exists
        if declare -F "$validate_fn" &>/dev/null; then
            if "$validate_fn" 2>/dev/null; then
                printf "  \033[32m✓\033[0m %s\n" "$name"
            else
                printf "  \033[31m✗\033[0m %s (validation failed)\n" "$name"
                ok=1
            fi
        else
            printf "  \033[32m✓\033[0m %s (no validator)\n" "$name"
        fi

        # Show extensions in verbose mode
        if (( verbose )); then
            for ext in "${!CHROMA_EXT_MAP[@]}"; do
                [[ "${CHROMA_EXT_MAP[$ext]}" == "$name" ]] && \
                    printf "      .%s\n" "$ext"
            done
        fi
    done

    return $ok
}

_chroma_doctor_themes() {
    local verbose="${1:-0}"
    local ok=0

    echo "Themes:"

    # Active theme
    if [[ -n "$TDS_ACTIVE_THEME" ]]; then
        printf "  \033[32m✓\033[0m Active: %s\n" "$TDS_ACTIVE_THEME"
    else
        printf "  \033[33m·\033[0m No active theme\n"
    fi

    # Theme registry
    if declare -p TDS_THEME_REGISTRY &>/dev/null; then
        local count=${#TDS_THEME_REGISTRY[@]}
        printf "  \033[32m✓\033[0m %d themes available\n" "$count"

        if (( verbose )); then
            for theme in "${!TDS_THEME_REGISTRY[@]}"; do
                local marker=" "
                [[ "$theme" == "$TDS_ACTIVE_THEME" ]] && marker="*"
                printf "      %s %s\n" "$marker" "$theme"
            done
        fi
    else
        printf "  \033[31m✗\033[0m Theme registry not found\n"
        ok=1
    fi

    # Test theme switching
    if declare -F tds_switch_theme &>/dev/null; then
        local current="$TDS_ACTIVE_THEME"
        if TDS_QUIET_LOAD=1 tds_switch_theme "default" 2>/dev/null; then
            TDS_QUIET_LOAD=1 tds_switch_theme "$current" 2>/dev/null
            printf "  \033[32m✓\033[0m Theme switching works\n"
        else
            printf "  \033[31m✗\033[0m Theme switching broken\n"
            ok=1
        fi
    fi

    return $ok
}

_chroma_doctor_tokens() {
    local verbose="${1:-0}"
    local ok=0

    echo "Tokens:"

    # Test critical semantic tokens
    local test_tokens=(
        "text.primary"
        "text.secondary"
        "content.heading.h1"
        "content.code.inline"
        "content.emphasis.bold"
        "content.link"
    )

    local passed=0
    local failed=0

    for token in "${test_tokens[@]}"; do
        # Try to resolve token (capture any output)
        if tds_text_color "$token" &>/dev/null; then
            (( passed++ ))
            (( verbose )) && printf "  \033[32m✓\033[0m %s\n" "$token"
        else
            (( failed++ ))
            printf "  \033[31m✗\033[0m %s (resolution failed)\n" "$token"
            ok=1
        fi
    done

    (( ! verbose )) && (( failed == 0 )) && \
        printf "  \033[32m✓\033[0m %d tokens resolved\n" "$passed"

    return $ok
}

#==============================================================================
# QUICK STATUS
#==============================================================================

# Quick one-line status
chroma_status() {
    local issues=0

    [[ "$TDS_LOADED" != "true" ]] && (( issues++ ))
    [[ ${#CHROMA_PARSER_ORDER[@]} -eq 0 ]] && (( issues++ ))
    [[ -z "$TDS_ACTIVE_THEME" ]] && (( issues++ ))

    if [[ $issues -eq 0 ]]; then
        printf "chroma: \033[32mhealthy\033[0m"
        printf " | parsers:%d" "${#CHROMA_PARSER_ORDER[@]}"
        printf " | theme:%s" "$TDS_ACTIVE_THEME"
        echo
    else
        printf "chroma: \033[31m%d issue(s)\033[0m - run 'chroma doctor'\n" "$issues"
    fi
}

export -f chroma_doctor chroma_status

#MULTICAT_START
# dir: /Users/mricos/src/devops/tetra/bash/chroma/core
# file: globals.sh
# notes:
#MULTICAT_END
#!/usr/bin/env bash
# Chroma - Global declarations and state variables
# Part of the chroma modular markdown renderer

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
    # Pattern tokens for structured list items
    [pattern.number]="pattern.number"
    [pattern.topic]="pattern.topic"
    [pattern.dash]="pattern.dash"
    [pattern.desc]="pattern.desc"
    [pattern.key]="pattern.key"
    [pattern.value]="pattern.value"
    [pattern.time]="pattern.time"
)

# Pattern detection enabled by default
declare -g CHROMA_PATTERNS_ENABLED=1

# Truncate mode: when 1, pattern lists show only header line
# When 0 (default), show header + full wrapped content
declare -g CHROMA_TRUNCATE=0

#MULTICAT_START
# dir: /Users/mricos/src/devops/tetra/bash/chroma/core
# file: plugins.sh
# notes:
#MULTICAT_END
#!/usr/bin/env bash
# Chroma - Plugin system
# Part of the chroma modular markdown renderer

# Plugin registry: name → init_function
declare -gA CHROMA_PLUGINS=()

# Hook registry: hook_name → space-separated list of callbacks
declare -gA CHROMA_HOOKS=()

# Available hook points
declare -ga CHROMA_HOOK_POINTS=(
    pre_render      # Before rendering starts
    post_render     # After rendering completes
    pre_line        # Before each line is processed
    post_line       # After each line is rendered
    render_heading  # Custom heading renderer (return 0 to skip default)
    render_code     # Custom code block renderer
    render_quote    # Custom blockquote renderer
    render_list     # Custom list item renderer
    render_table    # Custom table renderer
    render_hr       # Custom horizontal rule renderer
)

# Register a plugin
# Usage: chroma_register_plugin <name> <init_function> [description]
chroma_register_plugin() {
    local name="$1"
    local init_fn="$2"
    local desc="${3:-}"

    [[ -z "$name" || -z "$init_fn" ]] && {
        echo "Usage: chroma_register_plugin <name> <init_function> [description]" >&2
        return 1
    }

    if ! declare -f "$init_fn" &>/dev/null; then
        echo "Plugin init function not found: $init_fn" >&2
        return 1
    fi

    CHROMA_PLUGINS["$name"]="$init_fn"

    # Call init function
    "$init_fn"
    return 0
}

# Register a hook callback
# Usage: chroma_hook <hook_point> <callback_function>
chroma_hook() {
    local hook="$1"
    local callback="$2"

    [[ -z "$hook" || -z "$callback" ]] && {
        echo "Usage: chroma_hook <hook_point> <callback>" >&2
        return 1
    }

    # Validate hook point
    local valid=0
    for hp in "${CHROMA_HOOK_POINTS[@]}"; do
        [[ "$hp" == "$hook" ]] && { valid=1; break; }
    done
    (( valid )) || {
        echo "Invalid hook point: $hook" >&2
        echo "Valid: ${CHROMA_HOOK_POINTS[*]}" >&2
        return 1
    }

    # Add callback to hook (avoid duplicates)
    local existing="${CHROMA_HOOKS[$hook]:-}"
    if [[ ! " $existing " =~ " $callback " ]]; then
        CHROMA_HOOKS["$hook"]="${existing:+$existing }$callback"
    fi
    return 0
}

# Remove a hook callback
# Usage: chroma_unhook <hook_point> <callback_function>
chroma_unhook() {
    local hook="$1"
    local callback="$2"

    [[ -z "$hook" || -z "$callback" ]] && return 1

    local existing="${CHROMA_HOOKS[$hook]:-}"
    local new_list=""
    for cb in $existing; do
        [[ "$cb" != "$callback" ]] && new_list="${new_list:+$new_list }$cb"
    done
    CHROMA_HOOKS["$hook"]="$new_list"
    return 0
}

# Execute all callbacks for a hook
# Usage: _chroma_run_hooks <hook_point> [args...]
# Returns: 0 if any callback returned 0 (handled), 1 if none handled
_chroma_run_hooks() {
    local hook="$1"
    shift
    local callbacks="${CHROMA_HOOKS[$hook]:-}"

    [[ -z "$callbacks" ]] && return 1

    local handled=1
    for callback in $callbacks; do
        if declare -f "$callback" &>/dev/null; then
            "$callback" "$@"
            local rc=$?
            (( rc == 0 )) && handled=0
        fi
    done
    return $handled
}

# List registered plugins
chroma_list_plugins() {
    echo
    echo "Chroma Plugins"
    echo

    if [[ ${#CHROMA_PLUGINS[@]} -eq 0 ]]; then
        echo "  (no plugins loaded)"
    else
        for name in "${!CHROMA_PLUGINS[@]}"; do
            printf "  %-20s %s\n" "$name" "${CHROMA_PLUGINS[$name]}"
        done
    fi
    echo

    echo "Registered Hooks:"
    for hook in "${CHROMA_HOOK_POINTS[@]}"; do
        local callbacks="${CHROMA_HOOKS[$hook]:-}"
        if [[ -n "$callbacks" ]]; then
            printf "  %-16s %s\n" "$hook:" "$callbacks"
        fi
    done
    echo
}

# Load plugins from directory
# Usage: chroma_load_plugins [directory]
chroma_load_plugins() {
    local plugin_dir="${1:-${CHROMA_PLUGINS_DIR:-}}"

    # Default plugin directories
    if [[ -z "$plugin_dir" ]]; then
        local dirs=(
            "${TETRA_DIR:-$HOME/tetra}/chroma/plugins"
            "${CHROMA_SRC:-$(dirname "${BASH_SOURCE[0]}")/..}/plugins"
        )
        for d in "${dirs[@]}"; do
            [[ -d "$d" ]] && { plugin_dir="$d"; break; }
        done
    fi

    [[ -z "$plugin_dir" || ! -d "$plugin_dir" ]] && return 0

    # Load all *.plugin.sh files
    local count=0
    for plugin_file in "$plugin_dir"/*.plugin.sh; do
        [[ -f "$plugin_file" ]] || continue
        source "$plugin_file" && ((count++))
    done

    (( count > 0 )) && echo "Loaded $count plugin(s) from $plugin_dir"
    return 0
}

#MULTICAT_START
# dir: /Users/mricos/src/devops/tetra/bash/chroma/core
# file: config.sh
# notes:
#MULTICAT_END
#!/usr/bin/env bash
# Chroma - Plugin configuration system
# Part of the chroma modular markdown renderer

# Configuration storage: "plugin.option" → value
declare -gA CHROMA_CONFIG=()

# Configuration metadata: "plugin.option" → "default|description"
declare -gA CHROMA_CONFIG_META=()

# Declare a configuration option with default value
# Usage: chroma_config_declare <plugin> <option> <default> [description]
chroma_config_declare() {
    local plugin="$1"
    local option="$2"
    local default="$3"
    local desc="${4:-}"

    [[ -z "$plugin" || -z "$option" ]] && {
        echo "Usage: chroma_config_declare <plugin> <option> <default> [description]" >&2
        return 1
    }

    local key="${plugin}.${option}"

    # Store metadata (default and description)
    CHROMA_CONFIG_META["$key"]="${default}|${desc}"

    # Set default if not already configured
    [[ -z "${CHROMA_CONFIG[$key]+x}" ]] && CHROMA_CONFIG["$key"]="$default"

    return 0
}

# Get a configuration value
# Usage: chroma_config_get <plugin> <option> [default]
# Returns: value via stdout, or default if not set
chroma_config_get() {
    local plugin="$1"
    local option="$2"
    local default="${3:-}"

    local key="${plugin}.${option}"

    if [[ -n "${CHROMA_CONFIG[$key]+x}" ]]; then
        echo "${CHROMA_CONFIG[$key]}"
    elif [[ -n "${CHROMA_CONFIG_META[$key]+x}" ]]; then
        # Return declared default
        echo "${CHROMA_CONFIG_META[$key]%%|*}"
    else
        echo "$default"
    fi
}

# Set a configuration value
# Usage: chroma_config_set <plugin> <option> <value>
chroma_config_set() {
    local plugin="$1"
    local option="$2"
    local value="$3"

    [[ -z "$plugin" || -z "$option" ]] && {
        echo "Usage: chroma_config_set <plugin> <option> <value>" >&2
        return 1
    }

    local key="${plugin}.${option}"
    CHROMA_CONFIG["$key"]="$value"
    return 0
}

# Reset a configuration option to its default
# Usage: chroma_config_reset <plugin> <option>
chroma_config_reset() {
    local plugin="$1"
    local option="$2"
    local key="${plugin}.${option}"

    if [[ -n "${CHROMA_CONFIG_META[$key]+x}" ]]; then
        local default="${CHROMA_CONFIG_META[$key]%%|*}"
        CHROMA_CONFIG["$key"]="$default"
        return 0
    else
        unset "CHROMA_CONFIG[$key]"
        return 1
    fi
}

# List all configuration options
chroma_config_list() {
    echo
    echo "Chroma Configuration"
    echo

    if [[ ${#CHROMA_CONFIG_META[@]} -eq 0 && ${#CHROMA_CONFIG[@]} -eq 0 ]]; then
        echo "  (no configuration options declared)"
        echo
        return
    fi

    # Collect unique plugins
    local -A plugins=()
    for key in "${!CHROMA_CONFIG_META[@]}" "${!CHROMA_CONFIG[@]}"; do
        plugins["${key%%.*}"]=1
    done

    # Show config by plugin
    for plugin in "${!plugins[@]}"; do
        echo "[$plugin]"

        # Find all options for this plugin
        for key in "${!CHROMA_CONFIG_META[@]}"; do
            [[ "${key%%.*}" != "$plugin" ]] && continue

            local option="${key#*.}"
            local meta="${CHROMA_CONFIG_META[$key]}"
            local default="${meta%%|*}"
            local desc="${meta#*|}"
            local current="${CHROMA_CONFIG[$key]:-$default}"

            # Show option with current value and default
            printf "  %-20s = %-15s" "$option" "$current"
            if [[ "$current" != "$default" ]]; then
                printf " (default: %s)" "$default"
            fi
            if [[ -n "$desc" ]]; then
                printf "\n  %-20s   %s" "" "$desc"
            fi
            echo
        done

        # Show any undeclared config for this plugin
        for key in "${!CHROMA_CONFIG[@]}"; do
            [[ "${key%%.*}" != "$plugin" ]] && continue
            [[ -n "${CHROMA_CONFIG_META[$key]+x}" ]] && continue

            local option="${key#*.}"
            local current="${CHROMA_CONFIG[$key]}"
            printf "  %-20s = %s (custom)\n" "$option" "$current"
        done
        echo
    done
}

# Save configuration to file
# Usage: chroma_config_save [file]
chroma_config_save() {
    local config_file="${1:-${CHROMA_CONFIG_FILE:-${TETRA_DIR:-$HOME/tetra}/chroma/config.sh}}"
    local config_dir=$(dirname "$config_file")

    [[ -d "$config_dir" ]] || mkdir -p "$config_dir"

    {
        echo "#!/usr/bin/env bash"
        echo "# Chroma configuration - auto-generated"
        echo "# $(date)"
        echo

        for key in "${!CHROMA_CONFIG[@]}"; do
            # Quote value properly
            printf 'CHROMA_CONFIG[%q]=%q\n' "$key" "${CHROMA_CONFIG[$key]}"
        done
    } > "$config_file"

    echo "Configuration saved to: $config_file"
}

# Load configuration from file
# Usage: chroma_config_load [file]
chroma_config_load() {
    local config_file="${1:-${CHROMA_CONFIG_FILE:-${TETRA_DIR:-$HOME/tetra}/chroma/config.sh}}"

    [[ -f "$config_file" ]] || return 0

    source "$config_file"
    return 0
}

# Show single config value
# Usage: chroma_config_show <plugin.option>
chroma_config_show() {
    local key="$1"

    if [[ "$key" == *.* ]]; then
        local plugin="${key%%.*}"
        local option="${key#*.}"

        if [[ -n "${CHROMA_CONFIG[$key]+x}" ]]; then
            echo "${CHROMA_CONFIG[$key]}"
        elif [[ -n "${CHROMA_CONFIG_META[$key]+x}" ]]; then
            echo "${CHROMA_CONFIG_META[$key]%%|*}"
        else
            echo "Config not found: $key" >&2
            return 1
        fi
    else
        echo "Invalid key format. Use: plugin.option" >&2
        return 1
    fi
}

#MULTICAT_START
# dir: /Users/mricos/src/devops/tetra/bash/chroma/core
# file: themes.sh
# notes:
#MULTICAT_END
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
        # Pattern tokens
        [pattern.number]='\033[1;38;5;39m'        # bold cyan (bright)
        [pattern.topic]='\033[1;38;5;75m'         # bold blue (prominent)
        [pattern.dash]='\033[38;5;240m'           # dark gray (dim)
        [pattern.desc]='\033[38;5;252m'           # light gray (readable)
        [pattern.key]='\033[38;5;114m'            # green (like list)
        [pattern.value]='\033[38;5;180m'          # amber
        [pattern.time]='\033[38;5;179m'           # amber
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
        # Pattern tokens
        [pattern.number]='\033[1;38;5;214m'       # bold orange
        [pattern.topic]='\033[1;38;5;208m'        # bold dark orange
        [pattern.dash]='\033[38;5;94m'            # brown (dim)
        [pattern.desc]='\033[38;5;223m'           # warm white
        [pattern.key]='\033[38;5;178m'            # gold
        [pattern.value]='\033[38;5;180m'          # light amber
        [pattern.time]='\033[38;5;179m'           # amber
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
        # Pattern tokens
        [pattern.number]='\033[1;38;5;111m'       # bold light blue
        [pattern.topic]='\033[1;38;5;147m'        # bold lavender
        [pattern.dash]='\033[38;5;60m'            # dark purple (dim)
        [pattern.desc]='\033[38;5;189m'           # pale blue
        [pattern.key]='\033[38;5;117m'            # sky
        [pattern.value]='\033[38;5;183m'          # light purple
        [pattern.time]='\033[38;5;104m'           # purple
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
        # Pattern tokens
        [pattern.number]='\033[1;38;5;159m'       # bold ice blue
        [pattern.topic]='\033[1;38;5;123m'        # bold cyan
        [pattern.dash]='\033[38;5;30m'            # dark teal (dim)
        [pattern.desc]='\033[38;5;195m'           # white ice
        [pattern.key]='\033[38;5;87m'             # turquoise
        [pattern.value]='\033[38;5;73m'           # teal
        [pattern.time]='\033[38;5;117m'           # sky
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
        # Pattern tokens
        [pattern.number]='\033[1;38;5;114m'       # bold green
        [pattern.topic]='\033[1;38;5;150m'        # bold light green
        [pattern.dash]='\033[38;5;240m'           # dark gray (dim)
        [pattern.desc]='\033[38;5;252m'           # light gray
        [pattern.key]='\033[38;5;114m'            # green
        [pattern.value]='\033[38;5;151m'          # pale green
        [pattern.time]='\033[38;5;65m'            # olive
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
        # Pattern tokens
        [pattern.number]='\033[1;38;5;201m'       # bold magenta
        [pattern.topic]='\033[1;38;5;165m'        # bold purple
        [pattern.dash]='\033[38;5;54m'            # dark purple (dim)
        [pattern.desc]='\033[38;5;225m'           # pale pink
        [pattern.key]='\033[38;5;213m'            # pink
        [pattern.value]='\033[38;5;171m'          # orchid
        [pattern.time]='\033[38;5;99m'            # purple
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

#MULTICAT_START
# dir: /Users/mricos/src/devops/tetra/bash/chroma/core
# file: args.sh
# notes:
#MULTICAT_END
#!/usr/bin/env bash

# Chroma Argument Parsing
# Clean, simple argument handling

#==============================================================================
# ARGUMENT PARSING
#==============================================================================

# Parse chroma arguments
# Sets global CHROMA_* variables for simplicity
# Returns: 0 on success, 1 on error, 2 for early exit (help/subcommand handled)
chroma_parse_args() {
    # Reset state
    CHROMA_FILE=""
    CHROMA_FORMAT=""
    CHROMA_PAGER=""  # empty=auto, 0=no, 1=yes
    CHROMA_SUBCOMMAND=""
    CHROMA_SUBCMD_ARGS=""
    CHROMA_MARGIN=""  # empty=use defaults, number=uniform override

    # Defaults
    CHROMA_MARGIN_TOP=2
    CHROMA_MARGIN_LEFT=4
    TDS_MARKDOWN_WIDTH="${TDS_MARKDOWN_WIDTH:-66}"

    while [[ $# -gt 0 ]]; do
        case "$1" in
            # Subcommands - capture and return
            help|doctor|status|reload|parser|parsers|cst|table)
                CHROMA_SUBCOMMAND="$1"
                shift
                CHROMA_SUBCMD_ARGS="$*"
                return 0
                ;;

            # Format shortcuts
            --toml)     CHROMA_FORMAT="toml"; shift ;;
            --json)     CHROMA_FORMAT="json"; shift ;;
            --md|--markdown) CHROMA_FORMAT="markdown"; shift ;;
            --claude|--ansi) CHROMA_FORMAT="claude"; shift ;;

            # Explicit format
            -f|--format)
                [[ -z "$2" || "$2" == -* ]] && { echo "Error: --format requires a value" >&2; return 1; }
                CHROMA_FORMAT="$2"
                shift 2
                ;;

            # Pager control
            -n|--no-pager) CHROMA_PAGER=0; shift ;;
            -p|--pager)    CHROMA_PAGER=1; shift ;;

            # Margin (top, left, right)
            -m|--margin)
                [[ -z "$2" || "$2" == -* ]] && { echo "Error: --margin requires a value" >&2; return 1; }
                [[ ! "$2" =~ ^[0-9]+$ ]] && { echo "Error: --margin must be numeric" >&2; return 1; }
                CHROMA_MARGIN="$2"
                shift 2
                ;;

            # Theme
            -t|--theme)
                [[ -z "$2" || "$2" == -* ]] && { echo "Error: --theme requires a value" >&2; return 1; }
                tds_switch_theme "$2" 2>/dev/null
                shift 2
                ;;

            # Width
            -w|--width)
                [[ -z "$2" || "$2" == -* ]] && { echo "Error: --width requires a value" >&2; return 1; }
                TDS_MARKDOWN_WIDTH="$2"
                shift 2
                ;;

            # Help
            -h|--help)
                CHROMA_SUBCOMMAND="help"
                return 0
                ;;

            # Unknown option
            -*)
                echo "Error: Unknown option: $1" >&2
                echo "Try: chroma --help" >&2
                return 1
                ;;

            # File argument
            *)
                CHROMA_FILE="$1"
                shift
                ;;
        esac
    done

    return 0
}

# Auto-detect pager mode
# Call after input is resolved (stdin already consumed)
chroma_auto_pager() {
    if [[ -z "$CHROMA_PAGER" ]]; then
        # Enable pager when input came from pipe (temp file means stdin was used)
        if (( CHROMA_INPUT_IS_TEMP )); then
            CHROMA_PAGER=1
        else
            CHROMA_PAGER=0
        fi
    fi
}

#MULTICAT_START
# dir: /Users/mricos/src/devops/tetra/bash/chroma/core
# file: input.sh
# notes:
#MULTICAT_END
#!/usr/bin/env bash

# Chroma Input Handling
# Simple stdin/file input management

#==============================================================================
# INPUT CAPTURE
#==============================================================================

# Capture stdin to temp file if piped
# Returns: filepath (temp or empty string)
chroma_capture_stdin() {
    if [[ ! -t 0 ]]; then
        local tmp
        tmp=$(mktemp "${TMPDIR:-/tmp}/chroma.XXXXXX")
        cat > "$tmp"
        echo "$tmp"
    fi
}

# Get input file - either argument or captured stdin
# Args: [file_arg]
# Sets: CHROMA_INPUT_FILE, CHROMA_INPUT_IS_TEMP
chroma_resolve_input() {
    local file_arg="$1"

    CHROMA_INPUT_FILE=""
    CHROMA_INPUT_IS_TEMP=0

    if [[ -n "$file_arg" && "$file_arg" != "-" ]]; then
        # Explicit file argument
        if [[ ! -f "$file_arg" ]]; then
            echo "Error: File not found: $file_arg" >&2
            return 1
        fi
        CHROMA_INPUT_FILE="$file_arg"
    else
        # Try stdin
        local captured
        captured=$(chroma_capture_stdin)
        if [[ -n "$captured" ]]; then
            CHROMA_INPUT_FILE="$captured"
            CHROMA_INPUT_IS_TEMP=1
        fi
    fi

    if [[ -z "$CHROMA_INPUT_FILE" ]]; then
        echo "Error: No input. Provide a file or pipe content." >&2
        return 1
    fi

    return 0
}

# Cleanup temp input file if needed
chroma_cleanup_input() {
    if (( CHROMA_INPUT_IS_TEMP )) && [[ -f "$CHROMA_INPUT_FILE" ]]; then
        rm -f "$CHROMA_INPUT_FILE"
    fi
    CHROMA_INPUT_FILE=""
    CHROMA_INPUT_IS_TEMP=0
}

#==============================================================================
# FORMAT DETECTION
#==============================================================================

# Detect format from file
# Args: file [explicit_format]
# Returns: format name
chroma_detect_format() {
    local file="$1"
    local explicit="${2:-}"

    # Explicit format takes priority
    [[ -n "$explicit" ]] && { echo "$explicit"; return 0; }

    # Extension-based
    if [[ -n "$file" ]]; then
        local ext="${file##*.}"
        ext="${ext,,}"
        case "$ext" in
            md|markdown) echo "markdown"; return 0 ;;
            toml)        echo "toml"; return 0 ;;
            json)        echo "json"; return 0 ;;
        esac
    fi

    # Content-based (first line) - be conservative
    if [[ -f "$file" ]]; then
        local first_line
        first_line=$(head -1 "$file" 2>/dev/null)

        # TOML: [section] (must be word chars only, no spaces inside)
        [[ "$first_line" =~ ^\[[a-zA-Z_][a-zA-Z0-9_]*\]$ ]] && { echo "toml"; return 0; }
        # TOML: key = value (simple key, equals sign)
        [[ "$first_line" =~ ^[a-zA-Z_][a-zA-Z0-9_]*[[:space:]]*=[[:space:]] ]] && { echo "toml"; return 0; }

        # JSON: { alone or { followed by quote
        [[ "$first_line" =~ ^[[:space:]]*\{[[:space:]]*$ ]] && { echo "json"; return 0; }
        [[ "$first_line" =~ ^[[:space:]]*\{[[:space:]]*\" ]] && { echo "json"; return 0; }
        # JSON: [ alone (multiline array)
        [[ "$first_line" =~ ^[[:space:]]*\[[[:space:]]*$ ]] && { echo "json"; return 0; }
    fi

    # Default
    echo "markdown"
}

#MULTICAT_START
# dir: /Users/mricos/src/devops/tetra/bash/chroma/core
# file: render.sh
# notes:
#MULTICAT_END
#!/usr/bin/env bash

# Chroma Render Dispatch
# Routes to appropriate parser and handles pager

#==============================================================================
# RENDER
#==============================================================================

# Render file with format
# Args: format file use_pager
chroma_render() {
    local format="$1"
    local file="$2"
    local use_pager="$3"

    (( CHROMA_DEBUG )) && echo "[render] format=$format file=$file pager=$use_pager" >&2

    # Get parser function from registry
    local parser_fn
    parser_fn=$(chroma_get_parser "$format")

    (( CHROMA_DEBUG )) && echo "[render] parser_fn=$parser_fn" >&2

    if [[ -z "$parser_fn" ]]; then
        echo "Error: No parser for format '$format'" >&2
        echo "Available: ${CHROMA_PARSER_ORDER[*]}" >&2
        return 1
    fi

    (( CHROMA_DEBUG )) && echo "[render] calling parser with file=$file" >&2

    # Render - pass file path directly to parser
    if (( use_pager )); then
        local -a pager_cmd
        read -ra pager_cmd <<< "${CHROMA_PAGER_CMD:-less -R}"
        "$parser_fn" "$file" | "${pager_cmd[@]}"
    else
        "$parser_fn" "$file"
    fi
}

#==============================================================================
# SUBCOMMAND DISPATCH
#==============================================================================

# Handle subcommands
# Args: subcommand [args...]
# Returns: 0 handled, 1 error
chroma_dispatch_subcommand() {
    local cmd="$1"
    shift
    local -a args
    read -ra args <<< "$*"

    case "$cmd" in
        help)
            chroma_help "${args[@]}"
            ;;
        doctor)
            chroma_doctor "${args[@]}"
            ;;
        status)
            chroma_status
            ;;
        reload)
            chroma_reload
            ;;
        parser|parsers)
            chroma_parser_cmd "${args[@]}"
            ;;
        cst)
            chroma_cst "${args[@]}"
            ;;
        table)
            local input="${args[0]:--}"
            if [[ "$input" == "-" ]]; then
                chroma_render_table_simple
            else
                chroma_render_table_simple < "$input"
            fi
            ;;
        *)
            echo "Unknown subcommand: $cmd" >&2
            return 1
            ;;
    esac
}

# Parser subcommand handler
chroma_parser_cmd() {
    local action="${1:-list}"
    shift 2>/dev/null || true

    case "$action" in
        list|ls)
            chroma_list_parsers
            ;;
        info)
            [[ -z "$1" ]] && { echo "Usage: chroma parser info <name>" >&2; return 1; }
            chroma_parser_info "$1"
            ;;
        *)
            echo "Unknown parser command: $action" >&2
            echo "Try: list, info <name>" >&2
            return 1
            ;;
    esac
}

#MULTICAT_START
# dir: /Users/mricos/src/devops/tetra/bash/chroma/render
# file: colors.sh
# notes:
#MULTICAT_END
#!/usr/bin/env bash
# Chroma - Color output utilities
# Part of the chroma modular markdown renderer

# Color codes (uses TDS or built-in palette)
_chroma_color() {
    local token="$1"
    (( CHROMA_NO_COLOR )) && return

    # Emphasis tokens need ANSI attributes, not colors
    # Handle these specially regardless of TDS
    case "$token" in
        content.emphasis.strong|bold)
            printf '\033[1m'  # Bold attribute
            return
            ;;
        content.emphasis.em|italic)
            printf '\033[3m'  # Italic attribute
            return
            ;;
    esac

    # Try TDS first for color tokens
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

#MULTICAT_START
# dir: /Users/mricos/src/devops/tetra/bash/chroma/render
# file: text.sh
# notes:
#MULTICAT_END
#!/usr/bin/env bash
# Chroma - Text processing utilities
# Part of the chroma modular markdown renderer

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

# Word-wrap text to specified width
# Args: text, width, indent (for continuation lines)
# Outputs wrapped lines
_chroma_word_wrap() {
    local text="$1"
    local width="$2"
    local indent="${3:-}"
    local indent_width=${#indent}

    # First line uses full width, continuation lines account for indent
    local first_width=$width
    local cont_width=$((width - indent_width))
    (( cont_width < 20 )) && cont_width=20

    local line=""
    local line_len=0
    local first_line=1
    local max_width=$first_width

    # Split into words
    local words
    read -ra words <<< "$text"

    for word in "${words[@]}"; do
        local word_len=$(_chroma_visual_width "$word")

        if (( line_len == 0 )); then
            # Start of line
            line="$word"
            line_len=$word_len
        elif (( line_len + 1 + word_len <= max_width )); then
            # Word fits on current line
            line="$line $word"
            line_len=$((line_len + 1 + word_len))
        else
            # Word doesn't fit, output current line and start new
            echo "$line"
            if (( first_line )); then
                first_line=0
                max_width=$cont_width
            fi
            line="${indent}${word}"
            line_len=$((indent_width + word_len))
        fi
    done

    # Output remaining text
    [[ -n "$line" ]] && echo "$line"
}

#MULTICAT_START
# dir: /Users/mricos/src/devops/tetra/bash/chroma/render
# file: patterns.sh
# notes:
#MULTICAT_END
#!/usr/bin/env bash
# Chroma - Pattern Grammar System
# Generic pattern detection and styling for text

#==============================================================================
# PATTERN REGISTRY
#==============================================================================

# Pattern definitions: name → regex
declare -gA CHROMA_PATTERNS=()

# Pattern token mappings: name → space-separated list of tokens for each group
declare -gA CHROMA_PATTERN_TOKENS=()

# Pattern order (first match wins)
declare -ga CHROMA_PATTERN_ORDER=()

# Enable/disable patterns
declare -g CHROMA_PATTERNS_ENABLED="${CHROMA_PATTERNS_ENABLED:-1}"

#==============================================================================
# PATTERN REGISTRATION
#==============================================================================

# Register a pattern
# Usage: chroma_pattern_register <name> <regex> <tokens...>
# Tokens are applied to capture groups in order
# Example: chroma_pattern_register "numbered_item" '^([0-9]+)\. (.+) – (.+)$' "pattern.number" "pattern.topic" "pattern.desc"
chroma_pattern_register() {
    local name="$1"
    local regex="$2"
    shift 2
    local tokens="$*"

    [[ -z "$name" || -z "$regex" ]] && {
        echo "Usage: chroma_pattern_register <name> <regex> <tokens...>" >&2
        return 1
    }

    CHROMA_PATTERNS["$name"]="$regex"
    CHROMA_PATTERN_TOKENS["$name"]="$tokens"

    # Add to order if not present
    local found=0
    for p in "${CHROMA_PATTERN_ORDER[@]}"; do
        [[ "$p" == "$name" ]] && { found=1; break; }
    done
    (( found )) || CHROMA_PATTERN_ORDER+=("$name")
}

# Remove a pattern
chroma_pattern_remove() {
    local name="$1"
    unset "CHROMA_PATTERNS[$name]"
    unset "CHROMA_PATTERN_TOKENS[$name]"

    local new_order=()
    for p in "${CHROMA_PATTERN_ORDER[@]}"; do
        [[ "$p" != "$name" ]] && new_order+=("$p")
    done
    CHROMA_PATTERN_ORDER=("${new_order[@]}")
}

#==============================================================================
# BUILT-IN PATTERNS
#==============================================================================

# Initialize built-in patterns
_chroma_init_patterns() {
    # Bracketed ID format: [ID: action content...]
    # Matches: "[1765923743: update content here...]"
    chroma_pattern_register "bracketed_id" \
        '^\[([0-9]+): ([a-z_]+) (.+)$' \
        "pattern.number" "pattern.key" "pattern.desc"

    # Simple bracketed ID: [ID: ] or [ID: optional text]
    # Matches: "[1765923743: ]" or "[1765923743: some text]"
    chroma_pattern_register "bracketed_id_simple" \
        '^\[([0-9]+): ?(.*)?\]$' \
        "pattern.number" "pattern.desc"

    # Topic with description (for numbered list content after number is stripped)
    # Matches: "Andre Kronert – Raw, psychedelic repetition..."
    # Also matches en-dash (–) and em-dash (—) and regular hyphen with spaces
    chroma_pattern_register "topic_desc" \
        '^([^–—-]+[^[:space:]]) [–—-] (.+)$' \
        "pattern.topic" "pattern.desc"

    # Key: Value pairs
    chroma_pattern_register "key_value" \
        '^([A-Za-z_][A-Za-z0-9_]*): (.+)$' \
        "pattern.key" "pattern.value"

    # Time/timestamp: HH:MM content
    chroma_pattern_register "timestamp" \
        '^([0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?) (.+)$' \
        "pattern.time" "pattern.desc"
}

#==============================================================================
# PATTERN MATCHING
#==============================================================================

# Try to match text against registered patterns
# Sets CHROMA_PATTERN_MATCH_NAME and CHROMA_PATTERN_MATCH_GROUPS on success
# Returns 0 if matched, 1 if no match
_chroma_pattern_match() {
    local text="$1"

    (( ! CHROMA_PATTERNS_ENABLED )) && return 1

    for name in "${CHROMA_PATTERN_ORDER[@]}"; do
        local regex="${CHROMA_PATTERNS[$name]}"
        [[ -z "$regex" ]] && continue

        if [[ "$text" =~ $regex ]]; then
            CHROMA_PATTERN_MATCH_NAME="$name"
            CHROMA_PATTERN_MATCH_GROUPS=("${BASH_REMATCH[@]}")
            return 0
        fi
    done

    return 1
}

#==============================================================================
# PATTERN RENDERING
#==============================================================================

# Render text with pattern styling (width-aware)
# $1 = text to render
# $2 = fallback token for unmatched text
# $3 = available width (optional)
# $4 = left padding for continuation lines (optional)
_chroma_render_pattern() {
    local text="$1"
    local fallback="${2:-text.primary}"
    local width="${3:-0}"
    local cont_pad="${4:-}"

    if ! _chroma_pattern_match "$text"; then
        # No pattern match - render with fallback
        _chroma_color "$(_chroma_token "$fallback")"
        _chroma_inline "$text" "$fallback"
        _chroma_reset
        return 1
    fi

    local name="$CHROMA_PATTERN_MATCH_NAME"
    local -a groups=("${CHROMA_PATTERN_MATCH_GROUPS[@]}")
    local tokens
    read -ra tokens <<< "${CHROMA_PATTERN_TOKENS[$name]}"

    # Track how many chars we've used
    local used=0

    # Handle bracketed_id_simple: [ID: optional_content]
    if [[ "$name" == "bracketed_id_simple" ]]; then
        local id="${groups[1]}"
        local content="${groups[2]:-}"

        # Opening bracket
        _chroma_color "$(_chroma_token text.secondary)"
        printf '['
        _chroma_reset

        # Accent color for ID
        _chroma_color "$(_chroma_token heading.1)"
        printf '%s' "$id"
        _chroma_reset

        # Separator
        _chroma_color "$(_chroma_token text.secondary)"
        printf ': '
        _chroma_reset

        # Content if any
        if [[ -n "$content" ]]; then
            _chroma_color "$(_chroma_token pattern.desc)"
            printf '%s' "$content"
            _chroma_reset
        fi

        # Closing bracket
        _chroma_color "$(_chroma_token text.secondary)"
        printf ']'
        _chroma_reset

        return 0
    fi

    # Handle bracketed_id specially for proper structure preservation
    if [[ "$name" == "bracketed_id" ]]; then
        local id="${groups[1]}"
        local action="${groups[2]}"
        local rest="${groups[3]}"

        # Opening bracket
        _chroma_color "$(_chroma_token text.secondary)"
        printf '['
        _chroma_reset
        ((used++))

        # Accent color for outer ID (heading.h1 = bold cyan)
        _chroma_color "$(_chroma_token heading.1)"
        printf '%s' "$id"
        _chroma_reset
        ((used += ${#id}))

        # Separator
        _chroma_color "$(_chroma_token text.secondary)"
        printf ': '
        _chroma_reset
        ((used += 2))

        # Action in key color
        _chroma_color "$(_chroma_token pattern.key)"
        printf '%s' "$action"
        _chroma_reset
        ((used += ${#action}))

        printf ' '
        ((used++))

        # Handle nested or plain content
        local remaining=$((width - used))
        if [[ "$rest" == \[* ]]; then
            # Strip one trailing ] for the outer bracket
            rest="${rest%]}"
            _chroma_render_nested_bracket "$rest" "$((remaining - 2))"
            # Add outer closing bracket
            _chroma_color "$(_chroma_token text.secondary)"
            printf ' ]'
            _chroma_reset
        else
            # Strip trailing ] if present
            rest="${rest%]}"
            # Truncate description only, preserve structure
            if (( width > 0 && remaining > 2 && ${#rest} > (remaining - 2) )); then
                if (( remaining > 8 )); then
                    rest="${rest:0:$((remaining - 6))} ..."
                fi
            fi
            _chroma_color "$(_chroma_token pattern.desc)"
            printf '%s' "$rest"
            _chroma_reset
            _chroma_color "$(_chroma_token text.secondary)"
            printf ' ]'
            _chroma_reset
        fi

        return 0
    fi

    # Render pattern prefix if needed
    case "$name" in
        *)
            ;;
    esac

    # Render each captured group with its token
    local i=1
    local num_groups=$(( ${#groups[@]} - 1 ))

    for ((i=1; i<=num_groups; i++)); do
        local group="${groups[$i]}"
        local token="${tokens[$((i-1))]:-text.primary}"

        # For the last group (usually description), wrap if needed
        if (( i == num_groups )); then
            local remaining=$((width - used))

            # Word-wrap long content instead of truncating
            if (( width > 0 && remaining > 10 && ${#group} > remaining )); then
                # First line - what fits
                local wrapped_lines
                mapfile -t wrapped_lines < <(_chroma_word_wrap "$group" "$remaining" "")

                local first=1
                for wline in "${wrapped_lines[@]}"; do
                    if (( first )); then
                        _chroma_color "$(_chroma_token "$token")"
                        printf '%s' "$wline"
                        _chroma_reset
                        first=0
                    else
                        # Continuation lines - indent to align with content start
                        echo
                        printf '%*s' "$used" ""
                        _chroma_color "$(_chroma_token "$token")"
                        printf '%s' "$wline"
                        _chroma_reset
                    fi
                done
            else
                _chroma_color "$(_chroma_token "$token")"
                printf '%s' "$group"
                _chroma_reset
            fi
        else
            _chroma_color "$(_chroma_token "$token")"
            printf '%s' "$group"
            _chroma_reset
            ((used += ${#group}))
        fi

        # Add separator between groups (except last)
        if (( i < num_groups )); then
            case "$name" in
                topic_desc)
                    _chroma_color "$(_chroma_token pattern.dash)"
                    printf ' – '
                    _chroma_reset
                    ((used += 3))
                    ;;
                key_value)
                    _chroma_color "$(_chroma_token text.secondary)"
                    printf ': '
                    _chroma_reset
                    ((used += 2))
                    ;;
                timestamp)
                    printf ' '
                    ((used++))
                    ;;
                *)
                    printf ' '
                    ((used++))
                    ;;
            esac
        fi
    done

    return 0
}

# Render nested bracket with distinct styling
# $1 = nested bracket content like "[ID: action content]"
# $2 = remaining width (optional)
_chroma_render_nested_bracket() {
    local content="$1"
    local width="${2:-0}"
    local used=0

    # Parse nested bracket: [ID: action rest...]
    local nested_regex='^\[([0-9]+): ([a-z_]+) (.+)$'
    if [[ "$content" =~ $nested_regex ]]; then
        local nested_id="${BASH_REMATCH[1]}"
        local nested_action="${BASH_REMATCH[2]}"
        local nested_rest="${BASH_REMATCH[3]}"

        # Strip trailing ] from nested_rest if present
        nested_rest="${nested_rest%]}"

        # Render bracket structure with accent colors for IDs
        _chroma_color "$(_chroma_token text.secondary)"
        printf '['
        _chroma_reset
        ((used++))

        # Accent color for nested ID (use heading.h2 for prominence)
        _chroma_color "$(_chroma_token heading.2)"
        printf '%s' "$nested_id"
        _chroma_reset
        ((used += ${#nested_id}))

        _chroma_color "$(_chroma_token text.secondary)"
        printf ': '
        _chroma_reset
        ((used += 2))

        _chroma_color "$(_chroma_token pattern.key)"
        printf '%s' "$nested_action"
        _chroma_reset
        ((used += ${#nested_action}))

        printf ' '
        ((used++))

        # Calculate remaining width for content (reserve 2 for closing ])
        local remaining=$((width - used - 2))

        # Recursively check for more nested content
        if [[ "$nested_rest" == \[* ]]; then
            _chroma_render_nested_bracket "$nested_rest" "$remaining"
        else
            # Truncate description only if needed, preserve structure
            if (( width > 0 && remaining > 0 && ${#nested_rest} > remaining )); then
                if (( remaining > 6 )); then
                    nested_rest="${nested_rest:0:$((remaining - 4))} ..."
                fi
            fi
            _chroma_color "$(_chroma_token pattern.desc)"
            printf '%s' "$nested_rest"
            _chroma_reset
        fi

        # Close the bracket
        _chroma_color "$(_chroma_token text.secondary)"
        printf ' ]'
        _chroma_reset
    else
        # No nested pattern, just render as description
        _chroma_color "$(_chroma_token pattern.desc)"
        printf '%s' "$content"
        _chroma_reset
    fi
}

# Render list item content with pattern detection
# Falls back to standard inline rendering if no pattern matches
_chroma_render_list_content() {
    local content="$1"
    local base_token="${2:-text}"

    if _chroma_pattern_match "$content"; then
        _chroma_render_pattern "$content" "$base_token"
    else
        _chroma_color "$(_chroma_token "$base_token")"
        _chroma_inline "$content" "$base_token"
        _chroma_reset
    fi
}

#==============================================================================
# EXPANDED PATTERN RENDERING
#==============================================================================

# Render pattern match with header line + full wrapped content
# Format:
#   [number: topic – desc...]
#
#   Full wrapped content here with proper indentation
#   continuing as needed.
#
# $1 = list number (level)
# $2 = content
# $3 = padding
# $4 = width
_chroma_render_pattern_expanded() {
    local level="$1"
    local content="$2"
    local pad="$3"
    local width="$4"

    # Must have already matched - get match info
    local name="$CHROMA_PATTERN_MATCH_NAME"
    local -a groups=("${CHROMA_PATTERN_MATCH_GROUPS[@]}")

    # Calculate available width for header
    local header_width=$((width - ${#pad} - 4))  # Reserve for "[ " and " ]"
    local indent="    "  # 4-space indent for content

    # Build header based on pattern type
    local topic="" desc=""

    case "$name" in
        topic_desc)
            topic="${groups[1]}"
            desc="${groups[2]}"
            ;;
        key_value)
            topic="${groups[1]}"
            desc="${groups[2]}"
            ;;
        timestamp)
            topic="${groups[1]}"
            desc="${groups[2]}"
            ;;
        *)
            # Fallback: use full content as desc
            topic=""
            desc="$content"
            ;;
    esac

    # Build truncated header content
    local header_content
    if [[ -n "$topic" ]]; then
        header_content="$topic – $desc"
    else
        header_content="$desc"
    fi

    # Truncate header content if needed, showing end snippet
    local max_header=$((header_width - ${#level} - 2))  # Reserve for "N: "
    if (( ${#header_content} > max_header && max_header > 20 )); then
        # Split: show start...end
        local front_len=$(( (max_header - 5) / 2 ))
        local back_len=$(( max_header - front_len - 5 ))
        header_content="${header_content:0:$front_len}...${header_content: -$back_len}"
    fi

    # Render header line: [N: truncated content...]
    printf '%s' "$pad"
    _chroma_color "$(_chroma_token text.secondary)"
    printf '['
    _chroma_reset
    _chroma_color "$(_chroma_token heading.1)"
    printf '%s' "$level"
    _chroma_reset
    _chroma_color "$(_chroma_token text.secondary)"
    printf ': '
    _chroma_reset
    _chroma_color "$(_chroma_token pattern.topic)"
    printf '%s' "$header_content"
    _chroma_reset
    _chroma_color "$(_chroma_token text.secondary)"
    printf ' ]'
    _chroma_reset
    echo

    # Blank line
    echo

    # Full wrapped content with indent
    local content_width=$((width - ${#pad} - ${#indent}))
    local wrapped_lines
    mapfile -t wrapped_lines < <(_chroma_word_wrap "$desc" "$content_width" "")

    for wline in "${wrapped_lines[@]}"; do
        printf '%s%s' "$pad" "$indent"
        _chroma_color "$(_chroma_token text)"
        _chroma_inline "$wline" "text"
        _chroma_reset
        echo
    done
}

#==============================================================================
# PATTERN LISTING
#==============================================================================

chroma_pattern_list() {
    echo
    echo "Chroma Patterns"
    echo "  Enabled: $CHROMA_PATTERNS_ENABLED"
    echo

    if [[ ${#CHROMA_PATTERN_ORDER[@]} -eq 0 ]]; then
        echo "  (no patterns registered)"
    else
        for name in "${CHROMA_PATTERN_ORDER[@]}"; do
            printf "  %-20s %s\n" "$name" "${CHROMA_PATTERNS[$name]}"
            printf "    tokens: %s\n" "${CHROMA_PATTERN_TOKENS[$name]}"
        done
    fi
    echo
}

# Initialize patterns on source
_chroma_init_patterns

#MULTICAT_START
# dir: /Users/mricos/src/devops/tetra/bash/chroma/render
# file: tables.sh
# notes:
#MULTICAT_END
#!/usr/bin/env bash
# Chroma - Table parsing and rendering
# Part of the chroma modular markdown renderer

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
        width="${widths_ref[$i]:-10}"
        align="${aligns_ref[$i]:-left}"

        # Truncate cell if it exceeds column width
        local visual_len
        visual_len=$(_chroma_visual_width "$cell")
        if (( visual_len > width )); then
            cell=$(_chroma_truncate "$cell" "$width")
            visual_len=$(_chroma_visual_width "$cell")
        fi

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

# Truncate text to max width with ellipsis
_chroma_truncate() {
    local text="$1"
    local max_width="$2"

    local visual_len=$(_chroma_visual_width "$text")
    if (( visual_len <= max_width )); then
        echo "$text"
        return
    fi

    # Need to truncate - find cut point
    # Remove formatting markers for accurate length calc
    local plain="${text//\*\*/}"
    plain="${plain//\*/}"
    plain="${plain//\`/}"

    if (( max_width <= 3 )); then
        echo "..."
        return
    fi

    # Cut at max_width - 1 (leave room for ellipsis char)
    local cut_len=$((max_width - 1))
    local result=""
    local i=0
    local in_format=0
    local format_char=""

    # Walk through original text, tracking formatting
    while (( i < ${#text} )); do
        local char="${text:i:1}"
        local next="${text:i+1:1}"

        # Track ** or * or `
        if [[ "$char" == '*' && "$next" == '*' ]]; then
            result+="**"
            ((i+=2))
            continue
        elif [[ "$char" == '*' || "$char" == '`' ]]; then
            result+="$char"
            ((i++))
            continue
        fi

        # Regular character
        result+="$char"
        ((cut_len--))
        ((i++))

        (( cut_len <= 0 )) && break
    done

    echo "${result}…"
}

# Flush accumulated table
_chroma_flush_table() {
    local pad="$1"
    local max_width="${2:-0}"

    (( ${#_CHROMA_TABLE_ROWS[@]} == 0 )) && return

    # Calculate column widths (visual width, not raw)
    _CHROMA_TABLE_WIDTHS=()
    local row cells i num_cols=0
    for row in "${_CHROMA_TABLE_ROWS[@]}"; do
        local -a cells
        _chroma_parse_table_row "$row" cells
        (( ${#cells[@]} > num_cols )) && num_cols=${#cells[@]}
        for i in "${!cells[@]}"; do
            local len
            len=$(_chroma_visual_width "${cells[$i]}")
            if (( len > ${_CHROMA_TABLE_WIDTHS[$i]:-0} )); then
                _CHROMA_TABLE_WIDTHS[$i]=$len
            fi
        done
    done

    # Constrain table to max_width if specified
    if (( max_width > 0 )); then
        local pad_len=${#pad}
        local available=$((max_width - pad_len))

        # Calculate total table width: borders + padding + content
        # Each column: 1 (│) + 1 (space) + content + 1 (space) = content + 3
        # Plus final │ = 1
        local border_overhead=$(( num_cols * 3 + 1 ))
        local content_available=$((available - border_overhead))

        # Sum current widths
        local total_content=0
        for i in "${!_CHROMA_TABLE_WIDTHS[@]}"; do
            total_content=$(( total_content + _CHROMA_TABLE_WIDTHS[$i] ))
        done

        # If too wide, proportionally shrink columns
        if (( total_content > content_available && content_available > 0 )); then
            local min_col_width=5  # Minimum column width
            for i in "${!_CHROMA_TABLE_WIDTHS[@]}"; do
                local old_width=${_CHROMA_TABLE_WIDTHS[$i]}
                local new_width=$(( old_width * content_available / total_content ))
                (( new_width < min_col_width )) && new_width=$min_col_width
                _CHROMA_TABLE_WIDTHS[$i]=$new_width
            done
        fi
    fi

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

#MULTICAT_START
# dir: /Users/mricos/src/devops/tetra/bash/chroma/render
# file: parser.sh
# notes:
#MULTICAT_END
#!/usr/bin/env bash
# Chroma - Line classification/parsing
# Part of the chroma modular markdown renderer

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

#MULTICAT_START
# dir: /Users/mricos/src/devops/tetra/bash/chroma/render
# file: line.sh
# notes:
#MULTICAT_END
#!/usr/bin/env bash
# Chroma - Line rendering dispatcher
# Part of the chroma modular markdown renderer

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

    # Pre-line hook
    _chroma_run_hooks pre_line "$type" "$level" "$content" "$pad" "$width"

    # Handle table state transitions
    if [[ "$type" != table.* ]] && (( _CHROMA_IN_TABLE )); then
        _chroma_flush_table "$pad" "$width"
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
            # Try plugin hook first
            if ! _chroma_run_hooks render_heading "$level" "$content" "$pad"; then
                _chroma_color "$(_chroma_token heading.$level)"
                printf '%s' "$pad"
                # Add # prefix for visual hierarchy
                local prefix=""
                for ((h=0; h<level; h++)); do prefix+="#"; done
                printf '%s %s' "$prefix" "$content"
                _chroma_reset
                echo
            fi
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
            # Try plugin hook first (for syntax highlighting)
            if ! _chroma_run_hooks render_code "$_CHROMA_CODE_LANG" "$content" "$pad"; then
                _chroma_color "$(_chroma_token code.block)"
                printf '%s  %s' "$pad" "$content"
                _chroma_reset
                echo
            fi
            ;;

        quote)
            # Try plugin hook first
            if ! _chroma_run_hooks render_quote "$content" "$pad"; then
                _chroma_color "$(_chroma_token quote)"
                printf '%s│ ' "$pad"
                _chroma_inline "$content" "quote"
                _chroma_reset
                echo
            fi
            ;;

        list.bullet)
            # Try plugin hook first
            if ! _chroma_run_hooks render_list "bullet" "$content" "$pad"; then
                # Check if pattern matching is enabled and content matches a pattern
                if (( CHROMA_PATTERNS_ENABLED )) && _chroma_pattern_match "$content"; then
                    # Pattern matched - render bullet + styled content
                    printf '%s' "$pad"
                    _chroma_color "$(_chroma_token list.bullet)"
                    printf '• '
                    _chroma_reset
                    _chroma_render_pattern "$content" "text" "$((width - ${#pad} - 2))"
                    echo
                else
                    # No pattern match - use standard bullet list rendering
                    local bullet_indent="  "  # 2 spaces to align with text after "• "
                    local list_width=$((width - ${#pad} - 2))  # Account for "• "
                    local wrapped_lines
                    mapfile -t wrapped_lines < <(_chroma_word_wrap "$content" "$list_width" "")

                    local first=1
                    for wline in "${wrapped_lines[@]}"; do
                        printf '%s' "$pad"
                        if (( first )); then
                            _chroma_color "$(_chroma_token list.bullet)"
                            printf '• '
                            _chroma_reset
                            first=0
                        else
                            printf '%s' "$bullet_indent"
                        fi
                        _chroma_color "$(_chroma_token text)"
                        _chroma_inline "$wline" "text"
                        _chroma_reset
                        echo
                    done
                fi
            fi
            ;;

        list.number)
            # Try plugin hook first
            if ! _chroma_run_hooks render_list "number" "$content" "$pad" "$level"; then
                # Check if pattern matching is enabled and content matches a pattern
                if (( CHROMA_PATTERNS_ENABLED )) && _chroma_pattern_match "$content"; then
                    if (( CHROMA_TRUNCATE )); then
                        # Truncate mode - single line with truncated content
                        local num_prefix="${level}. "
                        printf '%s' "$pad"
                        _chroma_color "$(_chroma_token pattern.number)"
                        printf '%s' "$num_prefix"
                        _chroma_reset
                        _chroma_render_pattern "$content" "text" "$((width - ${#pad} - ${#num_prefix}))"
                        echo
                    else
                        # Expanded mode - header line + full wrapped content
                        _chroma_render_pattern_expanded "$level" "$content" "$pad" "$width"
                    fi
                else
                    # No pattern match - use standard numbered list rendering
                    local num_prefix="${level}. "
                    local num_indent
                    printf -v num_indent "%*s" "${#num_prefix}" ""  # Match number prefix width
                    local list_width=$((width - ${#pad} - ${#num_prefix}))
                    local wrapped_lines
                    mapfile -t wrapped_lines < <(_chroma_word_wrap "$content" "$list_width" "")

                    local first=1
                    for wline in "${wrapped_lines[@]}"; do
                        printf '%s' "$pad"
                        if (( first )); then
                            _chroma_color "$(_chroma_token list.number)"
                            printf '%s' "$num_prefix"
                            _chroma_reset
                            first=0
                        else
                            printf '%s' "$num_indent"
                        fi
                        _chroma_color "$(_chroma_token text)"
                        _chroma_inline "$wline" "text"
                        _chroma_reset
                        echo
                    done
                fi
            fi
            ;;

        hr)
            # Try plugin hook first
            if ! _chroma_run_hooks render_hr "$pad" "$width"; then
                _chroma_color "$(_chroma_token hr)"
                printf '%s' "$pad"
                local hrlen=$((width - ${#pad}))
                printf '%*s' "$hrlen" '' | tr ' ' '─'
                _chroma_reset
                echo
            fi
            ;;

        blank)
            echo
            ;;

        text|*)
            # Check if pattern matching is enabled and content matches a pattern
            if (( CHROMA_PATTERNS_ENABLED )) && _chroma_pattern_match "$content"; then
                # Pattern matched - render with pattern styling
                printf '%s' "$pad"
                _chroma_render_pattern "$content" "text" "$((width - ${#pad}))"
                echo
            else
                # No pattern match - word-wrap long lines
                local text_width=$((width - ${#pad}))
                local wrapped_lines
                mapfile -t wrapped_lines < <(_chroma_word_wrap "$content" "$text_width" "")

                local first=1
                for wline in "${wrapped_lines[@]}"; do
                    printf '%s' "$pad"
                    _chroma_color "$(_chroma_token text)"
                    _chroma_inline "$wline" "text"
                    _chroma_reset
                    echo
                done
            fi
            ;;
    esac

    # Post-line hook
    _chroma_run_hooks post_line "$type" "$level" "$content"
}

#MULTICAT_START
# dir: /Users/mricos/src/devops/tetra/bash/chroma/parsers
# file: markdown.sh
# notes:
#MULTICAT_END
#!/usr/bin/env bash

# Chroma Markdown Parser
# Delegates to TDS markdown renderer

#==============================================================================
# RENDER FUNCTION
#==============================================================================

# Wrap text to width, preserving words
# Args: text width margin_str
_chroma_wrap_text() {
    local text="$1"
    local width="$2"
    local margin_str="$3"
    local effective_width=$((width - ${#margin_str}))

    # Use fold for word wrapping, then add margin to each line
    echo "$text" | fold -s -w "$effective_width" | while IFS= read -r wrapped_line; do
        printf "%s%s\n" "$margin_str" "$wrapped_line"
    done
}

# Flush accumulated paragraph text
_chroma_flush_paragraph() {
    local text="$1"
    local width="$2"
    local margin_str="$3"

    [[ -z "$text" ]] && return

    tds_text_color "text.primary"
    _chroma_wrap_text "$text" "$width" "$margin_str"
    reset_color
}

# Render markdown content
# Args: file (path or "-" for stdin)
_chroma_parse_markdown() {
    local file="${1:--}"
    local margin="${TDS_MARGIN_LEFT:-0}"
    local width="${TDS_MARKDOWN_WIDTH:-80}"
    local margin_str=""
    local in_code=0
    local para_buffer=""  # Accumulate paragraph text

    (( margin > 0 )) && printf -v margin_str "%*s" "$margin" ""

    (( CHROMA_DEBUG )) && echo "[markdown] file=$file margin=$margin width=$width" >&2

    # Top margin
    local top="${TDS_MARGIN_TOP:-0}"
    for ((i=0; i<top; i++)); do echo; done

    local line
    while IFS= read -r line || [[ -n "$line" ]]; do
        # Code block fence
        if [[ "$line" =~ ^\`\`\` ]]; then
            _chroma_flush_paragraph "$para_buffer" "$width" "$margin_str"
            para_buffer=""
            in_code=$((1 - in_code))
            continue
        fi

        # Inside code block
        if (( in_code )); then
            tds_text_color "content.code.inline"
            printf "%s    %s\n" "$margin_str" "$line"
            reset_color
            continue
        fi

        # Headers
        if [[ "$line" =~ ^(#{1,6})[[:space:]]+(.+)$ ]]; then
            _chroma_flush_paragraph "$para_buffer" "$width" "$margin_str"
            para_buffer=""
            local level=${#BASH_REMATCH[1]}
            tds_text_color "content.heading.h${level}"
            printf "%s\033[1m%s\033[0m\n\n" "$margin_str" "${BASH_REMATCH[2]}"
            reset_color
            continue
        fi

        # Horizontal rule
        if [[ "$line" =~ ^[-_*]{3,}$ ]]; then
            _chroma_flush_paragraph "$para_buffer" "$width" "$margin_str"
            para_buffer=""
            tds_text_color "text.secondary"
            printf "%s%*s\n" "$margin_str" "$((width - margin * 2))" "" | tr ' ' '─'
            reset_color
            continue
        fi

        # List items
        if [[ "$line" =~ ^[[:space:]]*[-*+][[:space:]]+(.+)$ ]]; then
            _chroma_flush_paragraph "$para_buffer" "$width" "$margin_str"
            para_buffer=""
            tds_text_color "text.primary"
            local item_text="${BASH_REMATCH[1]}"
            local bullet_prefix="${margin_str}• "
            local item_width=$((width - ${#bullet_prefix}))
            # First line with bullet, continuation lines indented
            local first_line=true
            local cont_prefix="${margin_str}  "  # 2 spaces for continuation
            while IFS= read -r wrapped; do
                if $first_line; then
                    printf "%s%s\n" "$bullet_prefix" "$wrapped"
                    first_line=false
                else
                    printf "%s%s\n" "$cont_prefix" "$wrapped"
                fi
            done < <(echo "$item_text" | fold -s -w "$item_width")
            reset_color
            continue
        fi

        # Numbered list
        if [[ "$line" =~ ^[[:space:]]*([0-9]+)\.[[:space:]]+(.+)$ ]]; then
            _chroma_flush_paragraph "$para_buffer" "$width" "$margin_str"
            para_buffer=""
            tds_text_color "text.primary"
            printf "%s%s. %s\n" "$margin_str" "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}"
            reset_color
            continue
        fi

        # Blockquote
        if [[ "$line" =~ ^\>[[:space:]]*(.*)$ ]]; then
            _chroma_flush_paragraph "$para_buffer" "$width" "$margin_str"
            para_buffer=""
            tds_text_color "content.quote"
            printf "%s│ %s\n" "$margin_str" "${BASH_REMATCH[1]}"
            reset_color
            continue
        fi

        # Empty line - flush paragraph and output blank
        if [[ -z "$line" ]]; then
            _chroma_flush_paragraph "$para_buffer" "$width" "$margin_str"
            para_buffer=""
            echo
            continue
        fi

        # Regular text - strip leading whitespace and accumulate
        local trimmed="${line#"${line%%[![:space:]]*}"}"
        if [[ -n "$para_buffer" ]]; then
            para_buffer+=" $trimmed"
        else
            para_buffer="$trimmed"
        fi
    done < "$file"

    # Flush any remaining paragraph
    _chroma_flush_paragraph "$para_buffer" "$width" "$margin_str"
}

#==============================================================================
# VALIDATION
#==============================================================================

_chroma_parse_markdown_validate() {
    # Check TDS markdown is available
    declare -F tds_render_markdown &>/dev/null || return 1
    declare -F tds_text_color &>/dev/null || return 1
    return 0
}

#==============================================================================
# INFO
#==============================================================================

_chroma_parse_markdown_info() {
    cat <<'EOF'
Renders Markdown with TDS semantic colors.

Supported elements:
  - Headings (h1-h6)
  - Bold, italic, inline code
  - Code blocks (fenced)
  - Lists (ordered/unordered/checkbox)
  - Blockquotes
  - Links
  - Horizontal rules

Delegates to: tds_render_markdown
EOF
}

#==============================================================================
# REGISTRATION
#==============================================================================

chroma_register_parser "markdown" "_chroma_parse_markdown" "md markdown" \
    "Markdown documents"

#MULTICAT_START
# dir: /Users/mricos/src/devops/tetra/bash/chroma/parsers
# file: json.sh
# notes:
#MULTICAT_END
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

#MULTICAT_START
# dir: /Users/mricos/src/devops/tetra/bash/chroma/parsers
# file: toml.sh
# notes:
#MULTICAT_END
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

#MULTICAT_START
# dir: /Users/mricos/src/devops/tetra/bash/chroma/parsers
# file: latex.sh
# notes:
#MULTICAT_END
#!/usr/bin/env bash

# Chroma LaTeX Math Parser
# Renders LaTeX math expressions to UTF-8 terminal output
# Requires Bash 5.2+

#==============================================================================
# UNICODE CHARACTER MAPS
#==============================================================================

# Superscript characters (0-9, +, -, =, (, ), n, i)
declare -gA LATEX_SUPERSCRIPT=(
    [0]="⁰" [1]="¹" [2]="²" [3]="³" [4]="⁴"
    [5]="⁵" [6]="⁶" [7]="⁷" [8]="⁸" [9]="⁹"
    [+]="⁺" [-]="⁻" [=]="⁼" ["("]="⁽" [")"]="⁾"
    [n]="ⁿ" [i]="ⁱ" [x]="ˣ" [y]="ʸ" [a]="ᵃ" [b]="ᵇ"
    [c]="ᶜ" [d]="ᵈ" [e]="ᵉ" [f]="ᶠ" [g]="ᵍ" [h]="ʰ"
    [j]="ʲ" [k]="ᵏ" [l]="ˡ" [m]="ᵐ" [o]="ᵒ" [p]="ᵖ"
    [r]="ʳ" [s]="ˢ" [t]="ᵗ" [u]="ᵘ" [v]="ᵛ" [w]="ʷ"
    [z]="ᶻ"
)

# Bold superscript numbers (using mathematical bold)
declare -gA LATEX_SUPERSCRIPT_BOLD=(
    [0]="⁰" [1]="¹" [2]="𝟐" [3]="𝟑" [4]="𝟒"
    [5]="𝟓" [6]="𝟔" [7]="𝟕" [8]="𝟖" [9]="𝟗"
    [+]="⁺" [-]="⁻" [=]="⁼" ["("]="⁽" [")"]="⁾"
    [n]="ⁿ" [i]="ⁱ" [x]="ˣ"
)

# Subscript characters (0-9, +, -, =, (, ), common letters)
declare -gA LATEX_SUBSCRIPT=(
    [0]="₀" [1]="₁" [2]="₂" [3]="₃" [4]="₄"
    [5]="₅" [6]="₆" [7]="₇" [8]="₈" [9]="₉"
    [+]="₊" [-]="₋" [=]="₌" ["("]="₍" [")"]="₎"
    [a]="ₐ" [e]="ₑ" [h]="ₕ" [i]="ᵢ" [j]="ⱼ"
    [k]="ₖ" [l]="ₗ" [m]="ₘ" [n]="ₙ" [o]="ₒ"
    [p]="ₚ" [r]="ᵣ" [s]="ₛ" [t]="ₜ" [u]="ᵤ"
    [v]="ᵥ" [x]="ₓ"
)

# Greek letters
declare -gA LATEX_GREEK=(
    [alpha]="α"   [beta]="β"    [gamma]="γ"   [delta]="δ"
    [epsilon]="ε" [zeta]="ζ"    [eta]="η"     [theta]="θ"
    [iota]="ι"    [kappa]="κ"   [lambda]="λ"  [mu]="μ"
    [nu]="ν"      [xi]="ξ"      [omicron]="ο" [pi]="π"
    [rho]="ρ"     [sigma]="σ"   [tau]="τ"     [upsilon]="υ"
    [phi]="φ"     [chi]="χ"     [psi]="ψ"     [omega]="ω"
    [Alpha]="Α"   [Beta]="Β"    [Gamma]="Γ"   [Delta]="Δ"
    [Epsilon]="Ε" [Zeta]="Ζ"    [Eta]="Η"     [Theta]="Θ"
    [Iota]="Ι"    [Kappa]="Κ"   [Lambda]="Λ"  [Mu]="Μ"
    [Nu]="Ν"      [Xi]="Ξ"      [Omicron]="Ο" [Pi]="Π"
    [Rho]="Ρ"     [Sigma]="Σ"   [Tau]="Τ"     [Upsilon]="Υ"
    [Phi]="Φ"     [Chi]="Χ"     [Psi]="Ψ"     [Omega]="Ω"
    [varepsilon]="ε" [varphi]="φ" [varpi]="ϖ" [varrho]="ϱ"
    [varsigma]="ς" [vartheta]="ϑ"
)

# Math symbols
declare -gA LATEX_SYMBOLS=(
    [infty]="∞"   [partial]="∂" [nabla]="∇"   [forall]="∀"
    [exists]="∃"  [nexists]="∄" [emptyset]="∅" [varnothing]="∅"
    [in]="∈"      [notin]="∉"   [ni]="∋"      [subset]="⊂"
    [supset]="⊃"  [subseteq]="⊆" [supseteq]="⊇"
    [cup]="∪"     [cap]="∩"     [setminus]="∖"
    [times]="×"   [div]="÷"     [cdot]="·"    [ast]="∗"
    [star]="⋆"    [circ]="∘"    [bullet]="•"
    [pm]="±"      [mp]="∓"      [leq]="≤"     [geq]="≥"
    [neq]="≠"     [approx]="≈"  [equiv]="≡"   [sim]="∼"
    [propto]="∝"  [ll]="≪"      [gg]="≫"
    [to]="→"      [gets]="←"    [leftrightarrow]="↔"
    [Rightarrow]="⇒" [Leftarrow]="⇐" [Leftrightarrow]="⇔"
    [uparrow]="↑" [downarrow]="↓" [updownarrow]="↕"
    [Uparrow]="⇑" [Downarrow]="⇓"
    [implies]="⟹" [iff]="⟺"
    [neg]="¬"     [land]="∧"    [lor]="∨"     [oplus]="⊕"
    [otimes]="⊗"  [perp]="⊥"    [angle]="∠"
    [prime]="′"   [dprime]="″"  [therefore]="∴" [because]="∵"
    [ldots]="…"   [cdots]="⋯"   [vdots]="⋮"   [ddots]="⋱"
    [aleph]="ℵ"   [hbar]="ℏ"    [ell]="ℓ"     [wp]="℘"
    [Re]="ℜ"      [Im]="ℑ"
    [sqrt]="√"    [cbrt]="∛"    [fourthrt]="∜"
    [int]="∫"     [iint]="∬"    [iiint]="∭"   [oint]="∮"
    [prod]="∏"    [coprod]="∐"
    [langle]="⟨"  [rangle]="⟩"  [lceil]="⌈"   [rceil]="⌉"
    [lfloor]="⌊"  [rfloor]="⌋"
)

# Big operators - single char versions for inline
declare -gA LATEX_BIG_OPS=(
    [sum]="∑"
    [prod]="∏"
    [int]="∫"
    [bigcup]="⋃"
    [bigcap]="⋂"
    [bigoplus]="⨁"
    [bigotimes]="⨂"
    [lim]="lim"
)

# Compact 2-line versions for display mode
# Sum: ╲ zigzag ╱, Integral: tall with curve, Prod: pi-like
declare -gA LATEX_BIG_OPS_LARGE_TOP=(
    [sum]="╲▔"
    [prod]="┬─┬"
    [int]=" ╭"
    [lim]="   "
    [bigcup]="╭─╮"
    [bigcap]="╰─╯"
)
declare -gA LATEX_BIG_OPS_LARGE_BOT=(
    [sum]="▁╱"
    [prod]="│ │"
    [int]="╯ "
    [lim]="lim"
    [bigcup]="╰─╯"
    [bigcap]="╭─╮"
)
# For 3-line ops (integral needs 3 for proper curve)
declare -gA LATEX_BIG_OPS_LARGE_MID=(
    [int]="│ "
)

#==============================================================================
# TOKENIZER
#==============================================================================

# Token types
declare -g LATEX_TOK_EOF="EOF"
declare -g LATEX_TOK_NUM="NUM"
declare -g LATEX_TOK_VAR="VAR"
declare -g LATEX_TOK_CMD="CMD"
declare -g LATEX_TOK_LBRACE="LBRACE"
declare -g LATEX_TOK_RBRACE="RBRACE"
declare -g LATEX_TOK_LPAREN="LPAREN"
declare -g LATEX_TOK_RPAREN="RPAREN"
declare -g LATEX_TOK_LBRACK="LBRACK"
declare -g LATEX_TOK_RBRACK="RBRACK"
declare -g LATEX_TOK_CARET="CARET"
declare -g LATEX_TOK_UNDER="UNDER"
declare -g LATEX_TOK_PLUS="PLUS"
declare -g LATEX_TOK_MINUS="MINUS"
declare -g LATEX_TOK_STAR="STAR"
declare -g LATEX_TOK_SLASH="SLASH"
declare -g LATEX_TOK_EQ="EQ"
declare -g LATEX_TOK_COMMA="COMMA"
declare -g LATEX_TOK_SPACE="SPACE"

# Tokenizer state
declare -g _LATEX_INPUT=""
declare -g _LATEX_POS=0
declare -ga _LATEX_TOKENS=()
declare -ga _LATEX_TOKEN_VALS=()
declare -g _LATEX_TOK_IDX=0

# Initialize tokenizer with input string
_latex_tokenize() {
    local input="$1"
    _LATEX_INPUT="$input"
    _LATEX_POS=0
    _LATEX_TOKENS=()
    _LATEX_TOKEN_VALS=()
    _LATEX_TOK_IDX=0

    local len=${#input}

    while (( _LATEX_POS < len )); do
        local ch="${input:_LATEX_POS:1}"

        case "$ch" in
            # Whitespace - skip or mark
            ' '|$'\t'|$'\n')
                (( _LATEX_POS++ ))
                ;;

            # Single-char tokens
            '{')
                _LATEX_TOKENS+=("$LATEX_TOK_LBRACE")
                _LATEX_TOKEN_VALS+=("{")
                (( _LATEX_POS++ ))
                ;;
            '}')
                _LATEX_TOKENS+=("$LATEX_TOK_RBRACE")
                _LATEX_TOKEN_VALS+=("}")
                (( _LATEX_POS++ ))
                ;;
            '(')
                _LATEX_TOKENS+=("$LATEX_TOK_LPAREN")
                _LATEX_TOKEN_VALS+=("(")
                (( _LATEX_POS++ ))
                ;;
            ')')
                _LATEX_TOKENS+=("$LATEX_TOK_RPAREN")
                _LATEX_TOKEN_VALS+=(")")
                (( _LATEX_POS++ ))
                ;;
            '[')
                _LATEX_TOKENS+=("$LATEX_TOK_LBRACK")
                _LATEX_TOKEN_VALS+=("[")
                (( _LATEX_POS++ ))
                ;;
            ']')
                _LATEX_TOKENS+=("$LATEX_TOK_RBRACK")
                _LATEX_TOKEN_VALS+=("]")
                (( _LATEX_POS++ ))
                ;;
            '^')
                _LATEX_TOKENS+=("$LATEX_TOK_CARET")
                _LATEX_TOKEN_VALS+=("^")
                (( _LATEX_POS++ ))
                ;;
            '_')
                _LATEX_TOKENS+=("$LATEX_TOK_UNDER")
                _LATEX_TOKEN_VALS+=("_")
                (( _LATEX_POS++ ))
                ;;
            '+')
                _LATEX_TOKENS+=("$LATEX_TOK_PLUS")
                _LATEX_TOKEN_VALS+=("+")
                (( _LATEX_POS++ ))
                ;;
            '-')
                _LATEX_TOKENS+=("$LATEX_TOK_MINUS")
                _LATEX_TOKEN_VALS+=("-")
                (( _LATEX_POS++ ))
                ;;
            '*')
                _LATEX_TOKENS+=("$LATEX_TOK_STAR")
                _LATEX_TOKEN_VALS+=("*")
                (( _LATEX_POS++ ))
                ;;
            '/')
                _LATEX_TOKENS+=("$LATEX_TOK_SLASH")
                _LATEX_TOKEN_VALS+=("/")
                (( _LATEX_POS++ ))
                ;;
            '=')
                _LATEX_TOKENS+=("$LATEX_TOK_EQ")
                _LATEX_TOKEN_VALS+=("=")
                (( _LATEX_POS++ ))
                ;;
            ',')
                _LATEX_TOKENS+=("$LATEX_TOK_COMMA")
                _LATEX_TOKEN_VALS+=(",")
                (( _LATEX_POS++ ))
                ;;

            # Commands starting with backslash
            \\)
                (( _LATEX_POS++ ))
                local cmd=""
                while (( _LATEX_POS < len )); do
                    local c="${input:_LATEX_POS:1}"
                    if [[ "$c" =~ [a-zA-Z] ]]; then
                        cmd+="$c"
                        (( _LATEX_POS++ ))
                    else
                        break
                    fi
                done
                if [[ -n "$cmd" ]]; then
                    _LATEX_TOKENS+=("$LATEX_TOK_CMD")
                    _LATEX_TOKEN_VALS+=("$cmd")
                fi
                ;;

            # Numbers
            [0-9]|'.')
                local num=""
                while (( _LATEX_POS < len )); do
                    local c="${input:_LATEX_POS:1}"
                    if [[ "$c" =~ [0-9.] ]]; then
                        num+="$c"
                        (( _LATEX_POS++ ))
                    else
                        break
                    fi
                done
                _LATEX_TOKENS+=("$LATEX_TOK_NUM")
                _LATEX_TOKEN_VALS+=("$num")
                ;;

            # Variables (single letters or words)
            [a-zA-Z])
                local var=""
                while (( _LATEX_POS < len )); do
                    local c="${input:_LATEX_POS:1}"
                    if [[ "$c" =~ [a-zA-Z] ]]; then
                        var+="$c"
                        (( _LATEX_POS++ ))
                    else
                        break
                    fi
                done
                _LATEX_TOKENS+=("$LATEX_TOK_VAR")
                _LATEX_TOKEN_VALS+=("$var")
                ;;

            # Unknown - skip
            *)
                (( _LATEX_POS++ ))
                ;;
        esac
    done

    # Add EOF
    _LATEX_TOKENS+=("$LATEX_TOK_EOF")
    _LATEX_TOKEN_VALS+=("")
}

# Get current token type (sets _LATEX_CUR_TOK)
_latex_tok() {
    _LATEX_CUR_TOK="${_LATEX_TOKENS[$_LATEX_TOK_IDX]:-$LATEX_TOK_EOF}"
}

# Get current token value (sets _LATEX_CUR_VAL)
_latex_val() {
    _LATEX_CUR_VAL="${_LATEX_TOKEN_VALS[$_LATEX_TOK_IDX]:-}"
}

# Advance to next token
_latex_advance() {
    (( _LATEX_TOK_IDX++ ))
}

# Check if current token matches (no subshell)
_latex_match() {
    _latex_tok
    [[ "$_LATEX_CUR_TOK" == "$1" ]]
}

# Consume token if it matches
_latex_consume() {
    if _latex_match "$1"; then
        _latex_advance
        return 0
    fi
    return 1
}

#==============================================================================
# AST NODE STORAGE
#==============================================================================

# AST nodes stored in parallel arrays
declare -ga _LATEX_NODE_TYPE=()
declare -ga _LATEX_NODE_VAL=()
declare -ga _LATEX_NODE_LEFT=()
declare -ga _LATEX_NODE_RIGHT=()
declare -ga _LATEX_NODE_EXTRA=()
declare -g _LATEX_NODE_COUNT=0

# Create a new AST node, sets _LATEX_RESULT to node ID
_latex_new_node() {
    local type="$1"
    local val="${2:-}"
    local left="${3:--1}"
    local right="${4:--1}"
    local extra="${5:--1}"

    local id=$_LATEX_NODE_COUNT
    _LATEX_NODE_TYPE[$id]="$type"
    _LATEX_NODE_VAL[$id]="$val"
    _LATEX_NODE_LEFT[$id]="$left"
    _LATEX_NODE_RIGHT[$id]="$right"
    _LATEX_NODE_EXTRA[$id]="$extra"

    (( _LATEX_NODE_COUNT++ ))
    _LATEX_RESULT=$id
}

# Reset AST
_latex_reset_ast() {
    _LATEX_NODE_TYPE=()
    _LATEX_NODE_VAL=()
    _LATEX_NODE_LEFT=()
    _LATEX_NODE_RIGHT=()
    _LATEX_NODE_EXTRA=()
    _LATEX_NODE_COUNT=0
}

#==============================================================================
# RECURSIVE DESCENT PARSER
#==============================================================================

# Grammar (simplified):
#   expr     -> term (('+' | '-') term)*
#   term     -> factor (('*' | implicit_mult) factor)*
#   factor   -> base ('^' factor | '_' factor)*
#   base     -> NUM | VAR | CMD args | '(' expr ')' | '{' expr '}'
#   args     -> ('{' expr '}')* | subscript/superscript

# Parse full expression - sets _LATEX_RESULT
_latex_parse_expr() {
    _latex_parse_term
    local left=$_LATEX_RESULT

    while _latex_match "$LATEX_TOK_PLUS" || _latex_match "$LATEX_TOK_MINUS" || _latex_match "$LATEX_TOK_EQ"; do
        _latex_val
        local op="$_LATEX_CUR_VAL"
        _latex_advance
        _latex_parse_term
        local right=$_LATEX_RESULT
        if [[ "$op" == "+" ]]; then
            _latex_new_node "ADD" "" "$left" "$right"
        elif [[ "$op" == "-" ]]; then
            _latex_new_node "SUB" "" "$left" "$right"
        else
            _latex_new_node "EQ" "" "$left" "$right"
        fi
        left=$_LATEX_RESULT
    done

    _LATEX_RESULT=$left
}

# Check if current token can start a factor (for implicit multiplication)
_latex_can_start_factor() {
    _latex_tok
    case "$_LATEX_CUR_TOK" in
        "$LATEX_TOK_VAR"|"$LATEX_TOK_NUM"|"$LATEX_TOK_CMD"|"$LATEX_TOK_LPAREN"|"$LATEX_TOK_LBRACE")
            return 0 ;;
        *)
            return 1 ;;
    esac
}

# Parse term (multiplicative) - sets _LATEX_RESULT
_latex_parse_term() {
    _latex_parse_factor
    local left=$_LATEX_RESULT

    while true; do
        _latex_tok
        if [[ "$_LATEX_CUR_TOK" == "$LATEX_TOK_STAR" ]]; then
            _latex_advance
            _latex_parse_factor
            local right=$_LATEX_RESULT
            _latex_new_node "MUL" "" "$left" "$right"
            left=$_LATEX_RESULT
        elif [[ "$_LATEX_CUR_TOK" == "$LATEX_TOK_SLASH" ]]; then
            _latex_advance
            _latex_parse_factor
            local right=$_LATEX_RESULT
            _latex_new_node "DIV" "" "$left" "$right"
            left=$_LATEX_RESULT
        elif _latex_can_start_factor; then
            # Implicit multiplication (e.g., "2x" or "xy")
            _latex_parse_factor
            local right=$_LATEX_RESULT
            _latex_new_node "MUL" "" "$left" "$right"
            left=$_LATEX_RESULT
        else
            break
        fi
    done

    _LATEX_RESULT=$left
}

# Parse factor (exponents and subscripts) - sets _LATEX_RESULT
_latex_parse_factor() {
    _latex_parse_base
    local base=$_LATEX_RESULT

    # Handle superscripts and subscripts
    while _latex_match "$LATEX_TOK_CARET" || _latex_match "$LATEX_TOK_UNDER"; do
        _latex_tok
        if [[ "$_LATEX_CUR_TOK" == "$LATEX_TOK_CARET" ]]; then
            _latex_advance
            _latex_parse_base
            local exp=$_LATEX_RESULT
            _latex_new_node "POW" "" "$base" "$exp"
            base=$_LATEX_RESULT
        elif [[ "$_LATEX_CUR_TOK" == "$LATEX_TOK_UNDER" ]]; then
            _latex_advance
            _latex_parse_base
            local sub=$_LATEX_RESULT
            _latex_new_node "SUBSCRIPT" "" "$base" "$sub"
            base=$_LATEX_RESULT
        fi
    done

    _LATEX_RESULT=$base
}

# Parse base element - sets _LATEX_RESULT
_latex_parse_base() {
    _latex_tok
    _latex_val
    local tok="$_LATEX_CUR_TOK"
    local val="$_LATEX_CUR_VAL"

    case "$tok" in
        "$LATEX_TOK_NUM")
            _latex_advance
            _latex_new_node "NUM" "$val"
            ;;

        "$LATEX_TOK_VAR")
            _latex_advance
            _latex_new_node "VAR" "$val"
            ;;

        "$LATEX_TOK_CMD")
            _latex_advance
            _latex_parse_command "$val"
            ;;

        "$LATEX_TOK_LPAREN")
            _latex_advance
            _latex_parse_expr
            local inner=$_LATEX_RESULT
            _latex_consume "$LATEX_TOK_RPAREN" || true
            _latex_new_node "PAREN" "" "$inner"
            ;;

        "$LATEX_TOK_LBRACE")
            _latex_advance
            _latex_parse_expr
            _latex_consume "$LATEX_TOK_RBRACE" || true
            # _LATEX_RESULT already set by _latex_parse_expr
            ;;

        "$LATEX_TOK_MINUS")
            _latex_advance
            _latex_parse_factor
            local operand=$_LATEX_RESULT
            _latex_new_node "NEG" "" "$operand"
            ;;

        *)
            # Empty node for unexpected tokens
            _latex_new_node "EMPTY" ""
            ;;
    esac
}

# Parse LaTeX command with arguments - sets _LATEX_RESULT
_latex_parse_command() {
    local cmd="$1"

    case "$cmd" in
        frac)
            # \frac{num}{den}
            _latex_consume "$LATEX_TOK_LBRACE" || true
            _latex_parse_expr
            local num=$_LATEX_RESULT
            _latex_consume "$LATEX_TOK_RBRACE" || true
            _latex_consume "$LATEX_TOK_LBRACE" || true
            _latex_parse_expr
            local den=$_LATEX_RESULT
            _latex_consume "$LATEX_TOK_RBRACE" || true
            _latex_new_node "FRAC" "" "$num" "$den"
            ;;

        sqrt)
            # \sqrt{expr} or \sqrt[n]{expr}
            local index=-1
            if _latex_match "$LATEX_TOK_LBRACK"; then
                _latex_advance
                _latex_parse_expr
                index=$_LATEX_RESULT
                _latex_consume "$LATEX_TOK_RBRACK" || true
            fi
            _latex_consume "$LATEX_TOK_LBRACE" || true
            _latex_parse_expr
            local radicand=$_LATEX_RESULT
            _latex_consume "$LATEX_TOK_RBRACE" || true
            _latex_new_node "SQRT" "" "$radicand" "$index"
            ;;

        sum|prod|int|bigcup|bigcap|lim)
            # Big operators with optional limits
            local lower=-1 upper=-1 body=-1

            # Check for subscript (lower limit)
            if _latex_match "$LATEX_TOK_UNDER"; then
                _latex_advance
                _latex_parse_base
                lower=$_LATEX_RESULT
            fi

            # Check for superscript (upper limit)
            if _latex_match "$LATEX_TOK_CARET"; then
                _latex_advance
                _latex_parse_base
                upper=$_LATEX_RESULT
            fi

            # Check again for subscript if superscript came first
            if (( lower == -1 )) && _latex_match "$LATEX_TOK_UNDER"; then
                _latex_advance
                _latex_parse_base
                lower=$_LATEX_RESULT
            fi

            _latex_new_node "BIGOP" "$cmd" "$lower" "$upper" "$body"
            ;;

        left)
            # \left( ... \right)
            _latex_val
            local delim="$_LATEX_CUR_VAL"
            _latex_advance
            _latex_parse_expr
            local inner=$_LATEX_RESULT
            # Skip \right and delimiter
            _latex_tok; _latex_val
            if [[ "$_LATEX_CUR_TOK" == "$LATEX_TOK_CMD" && "$_LATEX_CUR_VAL" == "right" ]]; then
                _latex_advance
                _latex_advance 2>/dev/null || true
            fi
            _latex_new_node "PAREN" "$delim" "$inner"
            ;;

        text|mathrm|textit|mathbf)
            # Text commands
            _latex_consume "$LATEX_TOK_LBRACE" || true
            local text=""
            _latex_tok
            while [[ "$_LATEX_CUR_TOK" != "$LATEX_TOK_RBRACE" && "$_LATEX_CUR_TOK" != "$LATEX_TOK_EOF" ]]; do
                _latex_val
                text+="$_LATEX_CUR_VAL"
                _latex_advance
                _latex_tok
            done
            _latex_consume "$LATEX_TOK_RBRACE" || true
            _latex_new_node "TEXT" "$text"
            ;;

        *)
            # Greek letters, symbols, etc.
            if [[ -v "LATEX_GREEK[$cmd]" ]]; then
                _latex_new_node "SYMBOL" "${LATEX_GREEK[$cmd]}"
            elif [[ -v "LATEX_SYMBOLS[$cmd]" ]]; then
                _latex_new_node "SYMBOL" "${LATEX_SYMBOLS[$cmd]}"
            else
                # Unknown command - render as text
                _latex_new_node "TEXT" "\\$cmd"
            fi
            ;;
    esac
}

#==============================================================================
# 2D BOX LAYOUT ENGINE
#==============================================================================

# Box storage: each node gets width, height, baseline, and line array
declare -gA _LATEX_BOX_W=()
declare -gA _LATEX_BOX_H=()
declare -gA _LATEX_BOX_BL=()  # baseline (line index from top)
declare -gA _LATEX_BOX_LINES=()  # newline-separated string of lines

# Compute layout for a node, store results in box arrays
_latex_layout() {
    local id="$1"

    (( id < 0 )) && {
        _LATEX_BOX_W[$id]=0
        _LATEX_BOX_H[$id]=1
        _LATEX_BOX_BL[$id]=0
        _LATEX_BOX_LINES[$id]=""
        return
    }

    local type="${_LATEX_NODE_TYPE[$id]}"
    local val="${_LATEX_NODE_VAL[$id]}"
    local left="${_LATEX_NODE_LEFT[$id]}"
    local right="${_LATEX_NODE_RIGHT[$id]}"
    local extra="${_LATEX_NODE_EXTRA[$id]}"

    case "$type" in
        NUM|VAR|TEXT)
            _LATEX_BOX_W[$id]=${#val}
            _LATEX_BOX_H[$id]=1
            _LATEX_BOX_BL[$id]=0
            _LATEX_BOX_LINES[$id]="$val"
            ;;

        SYMBOL)
            # UTF-8 symbols are usually 1 display width
            _LATEX_BOX_W[$id]=1
            _LATEX_BOX_H[$id]=1
            _LATEX_BOX_BL[$id]=0
            _LATEX_BOX_LINES[$id]="$val"
            ;;

        EMPTY)
            _LATEX_BOX_W[$id]=0
            _LATEX_BOX_H[$id]=1
            _LATEX_BOX_BL[$id]=0
            _LATEX_BOX_LINES[$id]=""
            ;;

        ADD|SUB|EQ)
            _latex_layout "$left"
            _latex_layout "$right"
            local op_char
            case "$type" in
                ADD) op_char="+" ;;
                SUB) op_char="−" ;;
                EQ)  op_char="=" ;;
            esac
            _latex_layout_binop "$id" "$left" "$right" "$op_char"
            ;;

        MUL)
            _latex_layout "$left"
            _latex_layout "$right"
            # Use space for implicit multiplication (cleaner look)
            _latex_layout_binop "$id" "$left" "$right" " "
            ;;

        DIV)
            _latex_layout "$left"
            _latex_layout "$right"
            _latex_layout_binop "$id" "$left" "$right" "÷"
            ;;

        NEG)
            _latex_layout "$left"
            local lw=${_LATEX_BOX_W[$left]}
            local lh=${_LATEX_BOX_H[$left]}
            local lbl=${_LATEX_BOX_BL[$left]}

            _LATEX_BOX_W[$id]=$((lw + 1))
            _LATEX_BOX_H[$id]=$lh
            _LATEX_BOX_BL[$id]=$lbl

            local lines=""
            local i=0
            while IFS= read -r line || [[ -n "$line" ]]; do
                if (( i == lbl )); then
                    lines+="−$line"
                else
                    lines+=" $line"
                fi
                lines+=$'\n'
                (( i++ ))
            done <<< "${_LATEX_BOX_LINES[$left]}"
            _LATEX_BOX_LINES[$id]="${lines%$'\n'}"
            ;;

        POW)
            _latex_layout "$left"
            _latex_layout "$right"
            _latex_layout_power "$id" "$left" "$right"
            ;;

        SUBSCRIPT)
            _latex_layout "$left"
            _latex_layout "$right"
            _latex_layout_subscript "$id" "$left" "$right"
            ;;

        FRAC)
            _latex_layout "$left"
            _latex_layout "$right"
            _latex_layout_fraction "$id" "$left" "$right"
            ;;

        SQRT)
            _latex_layout "$left"
            _latex_layout_sqrt "$id" "$left" "$right"
            ;;

        BIGOP)
            _latex_layout "$left"
            _latex_layout "$right"
            _latex_layout_bigop "$id" "$val" "$left" "$right"
            ;;

        PAREN)
            _latex_layout "$left"
            _latex_layout_paren "$id" "$left"
            ;;

        *)
            _LATEX_BOX_W[$id]=0
            _LATEX_BOX_H[$id]=1
            _LATEX_BOX_BL[$id]=0
            _LATEX_BOX_LINES[$id]=""
            ;;
    esac
}

# Layout binary operator (horizontal concatenation with operator)
_latex_layout_binop() {
    local id="$1" left="$2" right="$3" op="$4"

    local lw=${_LATEX_BOX_W[$left]} lh=${_LATEX_BOX_H[$left]} lbl=${_LATEX_BOX_BL[$left]}
    local rw=${_LATEX_BOX_W[$right]} rh=${_LATEX_BOX_H[$right]} rbl=${_LATEX_BOX_BL[$right]}

    # Align baselines
    local top_above=$(( lbl > rbl ? lbl : rbl ))
    local bot_below_l=$(( lh - lbl - 1 ))
    local bot_below_r=$(( rh - rbl - 1 ))
    local bot_below=$(( bot_below_l > bot_below_r ? bot_below_l : bot_below_r ))

    local new_h=$(( top_above + 1 + bot_below ))
    local new_bl=$top_above
    local new_w=$(( lw + 3 + rw ))  # " op "

    _LATEX_BOX_W[$id]=$new_w
    _LATEX_BOX_H[$id]=$new_h
    _LATEX_BOX_BL[$id]=$new_bl

    # Build lines
    local -a l_arr r_arr
    mapfile -t l_arr <<< "${_LATEX_BOX_LINES[$left]}"
    mapfile -t r_arr <<< "${_LATEX_BOX_LINES[$right]}"

    local lines=""
    for (( i=0; i<new_h; i++ )); do
        local l_idx=$(( i - (top_above - lbl) ))
        local r_idx=$(( i - (top_above - rbl) ))

        local l_line=""
        if (( l_idx >= 0 && l_idx < lh )); then
            l_line="${l_arr[$l_idx]}"
        fi
        printf -v l_line "%-${lw}s" "$l_line"

        local r_line=""
        if (( r_idx >= 0 && r_idx < rh )); then
            r_line="${r_arr[$r_idx]}"
        fi

        local mid=" "
        if (( i == new_bl )); then
            mid="$op"
        fi

        lines+="$l_line $mid $r_line"$'\n'
    done

    _LATEX_BOX_LINES[$id]="${lines%$'\n'}"
}

# Layout power (superscript) - ALWAYS elevated above baseline
_latex_layout_power() {
    local id="$1" base="$2" exp="$3"

    local bw=${_LATEX_BOX_W[$base]} bh=${_LATEX_BOX_H[$base]} bbl=${_LATEX_BOX_BL[$base]}
    local ew=${_LATEX_BOX_W[$exp]} eh=${_LATEX_BOX_H[$exp]}

    # Try to use Unicode superscripts for simple single-char exponents
    local exp_text="${_LATEX_BOX_LINES[$exp]}"
    local use_unicode=0
    local sup_text=""

    # Only use inline superscripts for very simple cases (single digit/letter)
    if (( eh == 1 && ${#exp_text} == 1 )); then
        local ch="${exp_text:0:1}"
        if [[ -v "LATEX_SUPERSCRIPT_BOLD[$ch]" ]]; then
            sup_text="${LATEX_SUPERSCRIPT_BOLD[$ch]}"
            use_unicode=1
        elif [[ -v "LATEX_SUPERSCRIPT[$ch]" ]]; then
            sup_text="${LATEX_SUPERSCRIPT[$ch]}"
            use_unicode=1
        fi
    fi

    if (( use_unicode )); then
        # Inline bold superscript - but still elevated (add blank line above)
        local new_h=$((bh + 1))
        local new_w=$((bw + 1))
        local new_bl=$((bbl + 1))

        _LATEX_BOX_W[$id]=$new_w
        _LATEX_BOX_H[$id]=$new_h
        _LATEX_BOX_BL[$id]=$new_bl

        local -a b_arr
        mapfile -t b_arr <<< "${_LATEX_BOX_LINES[$base]}"

        local lines=""
        # Top line: spaces for base, superscript at right
        printf -v lines "%-${bw}s%s\n" "" "$sup_text"
        # Base lines
        for (( i=0; i<bh; i++ )); do
            lines+="${b_arr[$i]} "$'\n'
        done
        _LATEX_BOX_LINES[$id]="${lines%$'\n'}"
    else
        # Stack exponent fully above-right (no overlap)
        local new_w=$((bw + ew))
        local new_h=$((bh + eh))  # no overlap - exponent fully above
        local new_bl=$((eh + bbl))

        _LATEX_BOX_W[$id]=$new_w
        _LATEX_BOX_H[$id]=$new_h
        _LATEX_BOX_BL[$id]=$new_bl

        local -a b_arr e_arr
        mapfile -t b_arr <<< "${_LATEX_BOX_LINES[$base]}"
        mapfile -t e_arr <<< "${_LATEX_BOX_LINES[$exp]}"

        local lines=""
        # Exponent lines (right-aligned above base)
        for (( i=0; i<eh; i++ )); do
            printf -v lines "%s%-${bw}s%s\n" "$lines" "" "${e_arr[$i]}"
        done
        # Base lines
        for (( i=0; i<bh; i++ )); do
            printf -v lines "%s%-${bw}s%*s\n" "$lines" "${b_arr[$i]}" "$ew" ""
        done
        _LATEX_BOX_LINES[$id]="${lines%$'\n'}"
    fi
}

# Layout subscript
_latex_layout_subscript() {
    local id="$1" base="$2" sub="$3"

    local bw=${_LATEX_BOX_W[$base]} bh=${_LATEX_BOX_H[$base]} bbl=${_LATEX_BOX_BL[$base]}
    local sw=${_LATEX_BOX_W[$sub]} sh=${_LATEX_BOX_H[$sub]}

    # Try Unicode subscripts
    local sub_text="${_LATEX_BOX_LINES[$sub]}"
    local use_unicode=1
    local sub_str=""

    if (( sh == 1 )); then
        for (( i=0; i<${#sub_text}; i++ )); do
            local ch="${sub_text:i:1}"
            if [[ -v "LATEX_SUBSCRIPT[$ch]" ]]; then
                sub_str+="${LATEX_SUBSCRIPT[$ch]}"
            else
                use_unicode=0
                break
            fi
        done
    else
        use_unicode=0
    fi

    if (( use_unicode )); then
        _LATEX_BOX_W[$id]=$((bw + ${#sub_str}))
        _LATEX_BOX_H[$id]=$bh
        _LATEX_BOX_BL[$id]=$bbl

        local -a b_arr
        mapfile -t b_arr <<< "${_LATEX_BOX_LINES[$base]}"

        local lines=""
        for (( i=0; i<bh; i++ )); do
            if (( i == bh - 1 )); then
                lines+="${b_arr[$i]}$sub_str"
            else
                lines+="${b_arr[$i]}$(printf '%*s' ${#sub_str} '')"
            fi
            lines+=$'\n'
        done
        _LATEX_BOX_LINES[$id]="${lines%$'\n'}"
    else
        # Stack subscript below-right
        local new_w=$((bw + sw))
        local new_h=$((bh + sh - 1))
        local new_bl=$bbl

        _LATEX_BOX_W[$id]=$new_w
        _LATEX_BOX_H[$id]=$new_h
        _LATEX_BOX_BL[$id]=$new_bl

        local -a b_arr s_arr
        mapfile -t b_arr <<< "${_LATEX_BOX_LINES[$base]}"
        mapfile -t s_arr <<< "${_LATEX_BOX_LINES[$sub]}"

        local lines=""
        for (( i=0; i<new_h; i++ )); do
            local b_idx=$i
            local s_idx=$(( i - bh + 1 ))

            local b_line=""
            if (( b_idx < bh )); then
                b_line="${b_arr[$b_idx]}"
            fi
            printf -v b_line "%-${bw}s" "$b_line"

            local s_line=""
            if (( s_idx >= 0 && s_idx < sh )); then
                s_line="${s_arr[$s_idx]}"
            fi

            lines+="$b_line$s_line"$'\n'
        done
        _LATEX_BOX_LINES[$id]="${lines%$'\n'}"
    fi
}

# Layout fraction
_latex_layout_fraction() {
    local id="$1" num="$2" den="$3"

    local nw=${_LATEX_BOX_W[$num]} nh=${_LATEX_BOX_H[$num]}
    local dw=${_LATEX_BOX_W[$den]} dh=${_LATEX_BOX_H[$den]}

    local w=$(( nw > dw ? nw : dw ))
    local h=$(( nh + 1 + dh ))
    local bl=$nh  # baseline is the fraction bar

    _LATEX_BOX_W[$id]=$w
    _LATEX_BOX_H[$id]=$h
    _LATEX_BOX_BL[$id]=$bl

    local -a n_arr d_arr
    mapfile -t n_arr <<< "${_LATEX_BOX_LINES[$num]}"
    mapfile -t d_arr <<< "${_LATEX_BOX_LINES[$den]}"

    local lines=""

    # Numerator (centered)
    for (( i=0; i<nh; i++ )); do
        local line="${n_arr[$i]}"
        local pad_left=$(( (w - nw) / 2 ))
        local pad_right=$(( w - nw - pad_left ))
        printf -v line "%*s%s%*s" "$pad_left" "" "$line" "$pad_right" ""
        lines+="$line"$'\n'
    done

    # Fraction bar (use thicker box drawing char)
    local bar=""
    for (( i=0; i<w; i++ )); do
        bar+="━"  # Heavy horizontal (U+2501)
    done
    lines+="$bar"$'\n'

    # Denominator (centered)
    for (( i=0; i<dh; i++ )); do
        local line="${d_arr[$i]}"
        local pad_left=$(( (w - dw) / 2 ))
        local pad_right=$(( w - dw - pad_left ))
        printf -v line "%*s%s%*s" "$pad_left" "" "$line" "$pad_right" ""
        lines+="$line"$'\n'
    done

    _LATEX_BOX_LINES[$id]="${lines%$'\n'}"
}

# Layout square root - using ▁ (U+2581) for lowered top bar
_latex_layout_sqrt() {
    local id="$1" radicand="$2" index="$3"

    local rw=${_LATEX_BOX_W[$radicand]} rh=${_LATEX_BOX_H[$radicand]} rbl=${_LATEX_BOX_BL[$radicand]}

    # Clean layout with lowered top bar:
    #    ▁▁▁▁▁   <- U+2581 LOWER ONE EIGHTH BLOCK
    #  ╲╱content
    # The ▁ sits at the bottom of the cell, creating a lowered bar effect

    local w=$((rw + 3))  # "╲╱ " prefix + content
    local h=$((rh + 1))  # +1 for top bar
    local bl=$((rbl + 1))

    _LATEX_BOX_W[$id]=$w
    _LATEX_BOX_H[$id]=$h
    _LATEX_BOX_BL[$id]=$bl

    local -a r_arr
    mapfile -t r_arr <<< "${_LATEX_BOX_LINES[$radicand]}"

    local lines=""

    # Top bar using ▁ (lowered horizontal bar)
    local topbar="  "
    for (( i=0; i<rw; i++ )); do
        topbar+="▁"  # U+2581 LOWER ONE EIGHTH BLOCK
    done
    lines+="$topbar"$'\n'

    # Content with radical V at left
    for (( i=0; i<rh; i++ )); do
        if (( i == 0 )); then
            lines+="╲╱ ${r_arr[$i]}"
        else
            lines+="   ${r_arr[$i]}"
        fi
        lines+=$'\n'
    done

    _LATEX_BOX_LINES[$id]="${lines%$'\n'}"
}

# Layout big operator (sum, prod, int, etc.)
# Sum/Prod: 2-line compact, Int: 3-line for curve
# Integral upper bound shifted right, centered favoring right
_latex_layout_bigop() {
    local id="$1" op="$2" lower="$3" upper="$4"

    # Get symbol parts - check for mid (3-line) or just top/bot (2-line)
    local sym_top="${LATEX_BIG_OPS_LARGE_TOP[$op]:-__}"
    local sym_bot="${LATEX_BIG_OPS_LARGE_BOT[$op]:-──}"
    local sym_mid=""
    local sym_h=2  # Default 2 lines

    if [[ -v "LATEX_BIG_OPS_LARGE_MID[$op]" ]]; then
        sym_mid="${LATEX_BIG_OPS_LARGE_MID[$op]}"
        sym_h=3
    fi

    local sym_w=${#sym_top}
    (( ${#sym_bot} > sym_w )) && sym_w=${#sym_bot}
    (( ${#sym_mid} > sym_w )) && sym_w=${#sym_mid}
    (( sym_w < 2 )) && sym_w=2

    local total_w=$sym_w

    # Calculate dimensions with limits
    local lw=0 lh=0 uw=0 uh=0

    if (( lower >= 0 )); then
        _latex_layout "$lower"
        lw=${_LATEX_BOX_W[$lower]}
        lh=${_LATEX_BOX_H[$lower]}
    fi

    if (( upper >= 0 )); then
        _latex_layout "$upper"
        uw=${_LATEX_BOX_W[$upper]}
        uh=${_LATEX_BOX_H[$upper]}
    fi

    # Width is max of symbol, lower, upper
    total_w=$(( sym_w > lw ? sym_w : lw ))
    total_w=$(( total_w > uw ? total_w : uw ))

    # For integral, add extra width for right-shifted upper bound
    if [[ "$op" == "int" ]] && (( upper >= 0 )); then
        total_w=$(( sym_w + uw ))
    fi

    local total_h=$((uh + sym_h + lh))
    local bl
    if (( sym_h == 3 )); then
        bl=$((uh + 1))  # Baseline at middle of 3-line symbol
    else
        bl=$((uh + 1))  # Baseline at bottom of 2-line symbol
    fi

    _LATEX_BOX_W[$id]=$total_w
    _LATEX_BOX_H[$id]=$total_h
    _LATEX_BOX_BL[$id]=$bl

    local lines=""

    # Upper limit - integral: shift right; others: center
    if (( upper >= 0 )); then
        local -a u_arr
        mapfile -t u_arr <<< "${_LATEX_BOX_LINES[$upper]}"
        for (( i=0; i<uh; i++ )); do
            local line="${u_arr[$i]}"
            local pad
            if [[ "$op" == "int" ]]; then
                # Shift upper bound right (over the integral)
                pad=$(( sym_w ))
            else
                # Center with slight right bias
                pad=$(( (total_w - uw + 1) / 2 ))
            fi
            printf -v line "%*s%s" "$pad" "" "$line"
            printf -v line "%-${total_w}s" "$line"
            lines+="$line"$'\n'
        done
    fi

    # Symbol top line (left-aligned for symbol portion)
    local sym_line
    printf -v sym_line "%-${sym_w}s" "$sym_top"
    printf -v sym_line "%-${total_w}s" "$sym_line"
    lines+="$sym_line"$'\n'

    # Symbol middle line (only for 3-line operators like integral)
    if [[ -n "$sym_mid" ]]; then
        printf -v sym_line "%-${sym_w}s" "$sym_mid"
        printf -v sym_line "%-${total_w}s" "$sym_line"
        lines+="$sym_line"$'\n'
    fi

    # Symbol bottom line
    printf -v sym_line "%-${sym_w}s" "$sym_bot"
    printf -v sym_line "%-${total_w}s" "$sym_line"
    lines+="$sym_line"$'\n'

    # Lower limit (centered below symbol)
    if (( lower >= 0 )); then
        local -a l_arr
        mapfile -t l_arr <<< "${_LATEX_BOX_LINES[$lower]}"
        for (( i=0; i<lh; i++ )); do
            local line="${l_arr[$i]}"
            local pad=$(( (total_w - lw) / 2 ))
            printf -v line "%*s%s" "$pad" "" "$line"
            printf -v line "%-${total_w}s" "$line"
            lines+="$line"$'\n'
        done
    fi

    _LATEX_BOX_LINES[$id]="${lines%$'\n'}"
}

# Layout parentheses
_latex_layout_paren() {
    local id="$1" inner="$2"

    local iw=${_LATEX_BOX_W[$inner]} ih=${_LATEX_BOX_H[$inner]} ibl=${_LATEX_BOX_BL[$inner]}

    local w=$((iw + 2))  # ( content )
    local h=$ih
    local bl=$ibl

    _LATEX_BOX_W[$id]=$w
    _LATEX_BOX_H[$id]=$h
    _LATEX_BOX_BL[$id]=$bl

    local -a i_arr
    mapfile -t i_arr <<< "${_LATEX_BOX_LINES[$inner]}"

    local lines=""

    if (( ih == 1 )); then
        # Simple parens
        lines+="(${i_arr[0]})"
    else
        # Tall parens using box drawing
        for (( i=0; i<ih; i++ )); do
            local left right
            if (( i == 0 )); then
                left="⎛" right="⎞"
            elif (( i == ih - 1 )); then
                left="⎝" right="⎠"
            else
                left="⎜" right="⎟"
            fi
            lines+="$left${i_arr[$i]}$right"$'\n'
        done
        lines="${lines%$'\n'}"
    fi

    _LATEX_BOX_LINES[$id]="$lines"
}

#==============================================================================
# MAIN RENDER FUNCTION
#==============================================================================

# Render LaTeX math expression to UTF-8
latex_render() {
    local input="$1"

    # Strip $ delimiters if present
    input="${input#\$}"
    input="${input%\$}"
    input="${input#\$}"
    input="${input%\$}"

    # Reset state
    _latex_reset_ast
    _LATEX_BOX_W=()
    _LATEX_BOX_H=()
    _LATEX_BOX_BL=()
    _LATEX_BOX_LINES=()

    # Tokenize
    _latex_tokenize "$input"

    # Parse (no subshell - uses _LATEX_RESULT)
    _latex_parse_expr
    local root=$_LATEX_RESULT

    # Layout
    _latex_layout "$root"

    # Output
    echo "${_LATEX_BOX_LINES[$root]}"
}

#==============================================================================
# CHROMA PARSER INTERFACE
#==============================================================================

# Parse stdin for LaTeX math and render
_chroma_parse_latex() {
    local line in_math=0 math_buf="" display_math=0

    while IFS= read -r line || [[ -n "$line" ]]; do
        # Check for display math $$ ... $$
        if [[ "$line" =~ ^\$\$(.*)$ ]]; then
            if (( in_math )); then
                # End of display math
                latex_render "$math_buf"
                math_buf=""
                in_math=0
                display_math=0
            else
                # Start of display math
                in_math=1
                display_math=1
                math_buf="${BASH_REMATCH[1]}"
            fi
            continue
        fi

        if (( in_math && display_math )); then
            # Accumulate display math
            if [[ "$line" == *'$$'* ]]; then
                math_buf+=" ${line%%\$\$*}"
                latex_render "$math_buf"
                math_buf=""
                in_math=0
                display_math=0
            else
                math_buf+=" $line"
            fi
            continue
        fi

        # Process inline math $...$
        local processed=""
        local remaining="$line"

        while [[ "$remaining" =~ ^([^\$]*)\$([^\$]+)\$(.*)$ ]]; do
            processed+="${BASH_REMATCH[1]}"
            local math="${BASH_REMATCH[2]}"
            remaining="${BASH_REMATCH[3]}"

            # Render inline math (single line only for inline)
            local rendered
            rendered=$(latex_render "$math")
            # For inline, just take first line
            rendered="${rendered%%$'\n'*}"
            processed+="$rendered"
        done
        processed+="$remaining"

        echo "$processed"
    done
}

#==============================================================================
# STANDALONE FUNCTIONS
#==============================================================================

# Quick render function for direct use
latex() {
    if [[ $# -eq 0 ]]; then
        # Read from stdin
        local input
        input=$(cat)
        latex_render "$input"
    else
        # Arguments as input
        latex_render "$*"
    fi
}

# Demo function
latex_demo() {
    cat << 'HEADER'

╔══════════════════════════════════════════════════════════════════════╗
║                  LaTeX → UTF-8 Math Renderer                         ║
║                        Bash 5.2+ Edition                             ║
╚══════════════════════════════════════════════════════════════════════╝

HEADER

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Pythagorean Theorem"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo
    latex 'x^2 + y^2 = z^2'
    echo
    echo

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Quadratic Formula"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo
    latex '\frac{-b + \sqrt{b^2 - 4ac}}{2a}'
    echo
    echo

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Summation"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo
    latex '\sum_{i=1}^{n} x_i^2'
    echo
    echo

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Gaussian Integral"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo
    latex '\int_{-\infty}^{\infty} e^{-x^2} dx'
    echo
    echo

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Continued Fraction (Golden Ratio)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo
    latex '\frac{1}{1 + \frac{1}{1 + \frac{1}{1 + x}}}'
    echo
    echo

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Greek Letters"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo
    latex '\alpha + \beta + \gamma = \delta'
    echo
    echo

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Euler's Identity"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo
    latex 'e^{i\pi} + 1 = 0'
    echo
    echo

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Square Root"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo
    latex '\sqrt{a^2 + b^2 + c^2}'
    echo
}

#==============================================================================
# VALIDATION
#==============================================================================

_chroma_parse_latex_validate() {
    # Check bash version
    if (( BASH_VERSINFO[0] < 5 || (BASH_VERSINFO[0] == 5 && BASH_VERSINFO[1] < 2) )); then
        echo "LaTeX parser requires Bash 5.2+" >&2
        return 1
    fi
    return 0
}

#==============================================================================
# INFO
#==============================================================================

_chroma_parse_latex_info() {
    cat <<'EOF'
Renders LaTeX math expressions to UTF-8 terminal output.

Supported constructs:
  Variables       x, y, z, abc
  Numbers         123, 3.14
  Operators       + - * / = ^ _
  Fractions       \frac{num}{den}
  Square roots    \sqrt{x}, \sqrt[n]{x}
  Superscripts    x^2, x^{2+n}
  Subscripts      x_i, x_{i+1}
  Greek letters   \alpha, \beta, \gamma, ...
  Symbols         \infty, \pm, \leq, \geq, ...
  Big operators   \sum, \prod, \int with limits
  Parentheses     (, ), \left( \right)
  Text            \text{...}

Examples:
  latex '\frac{1}{2}'
  latex '\sum_{i=0}^{n} x_i'
  latex 'e^{i\pi} + 1 = 0'
  latex_demo
EOF
}

#==============================================================================
# REGISTRATION
#==============================================================================

chroma_register_parser "latex" "_chroma_parse_latex" "tex latex" \
    "LaTeX math expressions"

#MULTICAT_START
# dir: /Users/mricos/src/devops/tetra/bash/chroma/parsers
# file: claude.sh
# notes:
#MULTICAT_END
#!/usr/bin/env bash

# Chroma Claude Parser
# Cleans and re-renders Claude Code terminal output
# Fixes: broken tables, inconsistent ANSI coloring, box-drawing visibility

#==============================================================================
# ANSI STRIPPING
#==============================================================================

# Strip all ANSI escape codes from input
_chroma_strip_ansi() {
    sed 's/\x1b\[[0-9;]*m//g'
}

#==============================================================================
# TABLE RECONSTRUCTION
#==============================================================================

# Detect if line starts a table row
_chroma_starts_table_row() {
    local line="$1"
    local trimmed="${line#"${line%%[![:space:]]*}"}"
    [[ "$trimmed" == \|* ]] && return 0
    return 1
}

# Detect if line ends a table row (ends with |)
_chroma_ends_table_row() {
    local line="$1"
    local trimmed="${line%"${line##*[![:space:]]}"}"
    [[ "$trimmed" == *\| ]] && return 0
    return 1
}

# Detect if line is table-related (continuation or partial)
_chroma_is_table_continuation() {
    local line="$1"
    local trimmed="${line#"${line%%[![:space:]]*}"}"
    [[ -z "$trimmed" ]] && return 1

    # Check if line contains | anywhere (potential table content)
    local has_pipe=0
    [[ "$line" == *\|* ]] && has_pipe=1

    # STRONGEST: Line ends with | (possibly with trailing spaces)
    local rtrimmed="${line%"${line##*[![:space:]]}"}"
    if [[ "$rtrimmed" == *\| && "$trimmed" != \|* ]]; then
        return 0
    fi

    # Contains | but doesn't start with | - likely wrapped cell
    if (( has_pipe )) && [[ "$trimmed" != \|* ]]; then
        return 0
    fi

    # Just dashes and pipes - broken separator (no letters)
    if [[ "$trimmed" == *--* ]] && [[ ! "$trimmed" =~ [a-zA-Z] ]]; then
        return 0
    fi

    # Indented text (2+ spaces) without special markers - wrapped content
    if [[ "$line" =~ ^[[:space:]][[:space:]] ]]; then
        [[ "$trimmed" != \|* && "$trimmed" != \#* && ! "$trimmed" =~ ^[-\*•][[:space:]] && "$trimmed" != "---" ]] && return 0
    fi

    return 1
}

# Reconstruct tables by joining wrapped lines
_chroma_reconstruct_tables() {
    local in_table=0
    local -a raw_lines=()
    local -a table_rows=()
    local last_table_end=""  # Track recently output table content for dedup

    # First pass: collect all table-related lines
    while IFS= read -r line || [[ -n "$line" ]]; do
        line="${line%"${line##*[![:space:]]}"}"  # trim trailing ws

        if _chroma_starts_table_row "$line" || \
           { [[ $in_table -eq 1 ]] && _chroma_is_table_continuation "$line"; }; then
            in_table=1
            raw_lines+=("$line")
        else
            # End of table section
            if [[ $in_table -eq 1 && ${#raw_lines[@]} -gt 0 ]]; then
                _chroma_join_table_rows raw_lines table_rows
                _chroma_format_table "${table_rows[@]}"
                # Remember last few rows for dedup
                last_table_end="${table_rows[*]}"
                raw_lines=()
                table_rows=()
                in_table=0
            fi

            # Skip lines that look like orphaned table content after we just output a table
            local trimmed="${line#"${line%%[![:space:]]*}"}"
            if [[ -n "$last_table_end" && "$trimmed" == \|*\| ]]; then
                # This is a table row appearing right after we output a table - skip it
                continue
            fi

            # Clear dedup tracker after non-table content
            [[ "$trimmed" != \|* ]] && last_table_end=""

            printf '%s\n' "$line"
        fi
    done

    # Flush remaining
    if [[ ${#raw_lines[@]} -gt 0 ]]; then
        _chroma_join_table_rows raw_lines table_rows
        _chroma_format_table "${table_rows[@]}"
    fi
}

# Join raw table lines into proper rows based on column count
_chroma_join_table_rows() {
    local -n input_lines=$1
    local -n output_rows=$2
    output_rows=()

    # Find separator row to determine column count
    local num_cols=0
    for line in "${input_lines[@]}"; do
        if [[ "$line" == *---* ]]; then
            # Count | in this line (may be partial)
            local pipes="${line//[^|]/}"
            (( ${#pipes} > num_cols )) && num_cols=${#pipes}
        fi
    done

    # If no separator found, count from first line
    if (( num_cols == 0 )); then
        local first="${input_lines[0]}"
        local pipes="${first//[^|]/}"
        num_cols=${#pipes}
    fi

    # Now join lines until each row has num_cols pipes
    local current_row=""
    local current_pipes=0

    for line in "${input_lines[@]}"; do
        local trimmed="${line#"${line%%[![:space:]]*}"}"

        if [[ "$trimmed" == \|* ]]; then
            # New row starting
            if [[ -n "$current_row" ]]; then
                output_rows+=("$current_row")
            fi
            current_row="$trimmed"
            local p="${trimmed//[^|]/}"
            current_pipes=${#p}
        else
            # Continuation - append
            current_row+=" $trimmed"
            local p="${trimmed//[^|]/}"
            (( current_pipes += ${#p} ))
        fi
    done

    # Save last row
    [[ -n "$current_row" ]] && output_rows+=("$current_row")
}

# Format table with proper column widths - STRICTLY fits to terminal width
_chroma_format_table() {
    local -a rows=("$@")
    local -a col_max=()
    local num_cols=0
    local term_width=${COLUMNS:-$(tput cols 2>/dev/null || echo 80)}

    # First pass: count columns
    for row in "${rows[@]}"; do
        [[ "$row" == *---* && ! "$row" == *[a-zA-Z]* ]] && continue
        local trimmed="${row#|}"
        trimmed="${trimmed%|}"
        IFS='|' read -ra cells <<< "$trimmed"
        (( ${#cells[@]} > num_cols )) && num_cols=${#cells[@]}
    done

    (( num_cols == 0 )) && { printf '%s\n' "${rows[@]}"; return; }

    # Calculate STRICT per-column width to fit terminal
    # Each column: "| " (2) + content + " " (1) = 3 chars overhead
    # Plus final "|" (1)
    local overhead=$(( (num_cols * 3) + 1 ))
    local available=$((term_width - overhead))

    # Ensure minimum usable width
    (( available < num_cols * 4 )) && available=$((num_cols * 4))

    local base_width=$((available / num_cols))

    # Build width array - all columns get equal width for simplicity
    local -a final_widths=()
    for (( i=0; i<num_cols; i++ )); do
        final_widths[$i]=$base_width
    done

    # Give any remainder to first column (Variable names)
    local remainder=$((available - (base_width * num_cols)))
    (( remainder > 0 )) && (( final_widths[0] += remainder ))

    # Output formatted rows
    for row in "${rows[@]}"; do
        # Separator row
        if [[ "$row" == *---* && ! "$row" =~ [a-zA-Z] ]]; then
            printf '|'
            for (( i=0; i<num_cols; i++ )); do
                local w=${final_widths[$i]}
                printf '%*s|' "$((w + 2))" "" | tr ' ' '-'
            done
            printf '\n'
            continue
        fi

        # Data row
        local trimmed="${row#|}"
        trimmed="${trimmed%|}"
        IFS='|' read -ra cells <<< "$trimmed"

        printf '|'
        for (( i=0; i<num_cols; i++ )); do
            local cell="${cells[$i]:-}"
            # Trim whitespace
            cell="${cell#"${cell%%[![:space:]]*}"}"
            cell="${cell%"${cell##*[![:space:]]}"}"

            local max_w=${final_widths[$i]}
            # Truncate with ellipsis if too long
            if (( ${#cell} > max_w )); then
                cell="${cell:0:$((max_w-1))}…"
            fi

            printf ' %-*s |' "$max_w" "$cell"
        done
        printf '\n'
    done
}

#==============================================================================
# RENDERING
#==============================================================================

# Output buffered code block with syntax highlighting
_chroma_output_code_block() {
    local lang="$1"
    local code="$2"
    local c_fence=$(tput setaf 8)
    local c_reset=$(tput sgr0)

    [[ -z "$code" ]] && return

    # Auto-detect language if not specified
    if [[ -z "$lang" || "$lang" == "text" ]]; then
        lang=$(chroma_detect_language "$code")
    fi

    # Output fence with language hint
    printf '%s```%s%s\n' "$c_fence" "$lang" "$c_reset"

    # Highlight and output code
    printf '%s' "$code" | chroma_highlight_code "$lang"

    # Close fence
    printf '%s```%s\n' "$c_fence" "$c_reset"
}

# Render Claude output with TDS colors and syntax highlighting
_chroma_render_claude() {
    local line
    local in_code_block=0
    local code_lang=""
    local code_buffer=""
    local in_unfenced_code=0
    local unfenced_buffer=""

    # Get TDS colors
    local c_reset=$(tput sgr0)
    local c_header=$(tds_text_color header 2>/dev/null || echo "$(tput bold)")
    local c_bullet=$(tds_text_color link 2>/dev/null || echo "$(tput setaf 6)")
    local c_number=$(tds_text_color success 2>/dev/null || echo "$(tput setaf 2)")
    local c_box=$(tds_text_color dim 2>/dev/null || echo "$(tput setaf 8)")
    local c_table=$(tds_text_color normal 2>/dev/null || echo "")
    local c_thinking=$(tds_text_color dim 2>/dev/null || echo "$(tput setaf 5)")
    local c_fence=$(tput setaf 8)

    while IFS= read -r line || [[ -n "$line" ]]; do

        # === FENCED CODE BLOCKS ===
        # Opening fence: ```lang or ```
        if [[ "$line" =~ ^\`\`\`([a-zA-Z0-9_+-]*)$ ]] && (( !in_code_block )); then
            # Flush any unfenced code first
            if (( in_unfenced_code )); then
                _chroma_output_code_block "" "$unfenced_buffer"
                unfenced_buffer=""
                in_unfenced_code=0
            fi

            in_code_block=1
            code_lang="${BASH_REMATCH[1]}"
            code_buffer=""
            continue
        fi

        # Closing fence
        if [[ "$line" =~ ^\`\`\`$ ]] && (( in_code_block )); then
            _chroma_output_code_block "$code_lang" "$code_buffer"
            in_code_block=0
            code_lang=""
            code_buffer=""
            continue
        fi

        # Inside fenced block - accumulate
        if (( in_code_block )); then
            [[ -n "$code_buffer" ]] && code_buffer+=$'\n'
            code_buffer+="$line"
            continue
        fi

        # === UNFENCED CODE DETECTION (disabled - too aggressive) ===
        # Fenced code blocks (```lang) still work above
        # Uncomment to enable unfenced detection:
        # if chroma_looks_like_code "$line" 2>/dev/null; then
        #     in_unfenced_code=1
        #     [[ -n "$unfenced_buffer" ]] && unfenced_buffer+=$'\n'
        #     unfenced_buffer+="$line"
        #     continue
        # fi
        # if (( in_unfenced_code )); then
        #     _chroma_output_code_block "" "$unfenced_buffer"
        #     unfenced_buffer=""
        #     in_unfenced_code=0
        # fi

        # === NON-CODE CONTENT ===

        # Thinking indicator
        if [[ "$line" =~ ^[[:space:]]*∴ ]]; then
            printf '%s%s%s\n' "$c_thinking" "$line" "$c_reset"
            continue
        fi

        # Box-drawing lines (┌ ├ └ │ ─ ┐ ┘ ┤ ┬ ┴ ┼)
        if [[ "$line" =~ [┌┐└┘├┤┬┴┼│─] ]]; then
            printf '%s%s%s\n' "$c_box" "$line" "$c_reset"
            continue
        fi

        # Table separator |---|---|
        if [[ "$line" == \|*-*\| ]]; then
            printf '%s%s%s\n' "$c_table" "$line" "$c_reset"
            continue
        fi

        # Table row (starts and ends with |)
        if [[ "$line" == \|*\| ]]; then
            printf '%s%s%s\n' "$c_table" "$line" "$c_reset"
            continue
        fi

        # Headers (# ##)
        if [[ "$line" =~ ^[[:space:]]*\#+ ]]; then
            printf '%s%s%s\n' "$c_header" "$line" "$c_reset"
            continue
        fi

        # Numbered lists (1. 2. etc)
        if [[ "$line" =~ ^[[:space:]]*[0-9]+\.[[:space:]] ]]; then
            local num="${line%%.*}"
            local rest="${line#*.}"
            printf '%s%s.%s%s\n' "$c_number" "$num" "$c_reset" "$rest"
            continue
        fi

        # Bullet points (• - *)
        if [[ "$line" =~ ^[[:space:]]*[•\-\*][[:space:]] ]]; then
            local indent="${line%%[•\-\*]*}"
            local bullet="${line:${#indent}:1}"
            local rest="${line:$((${#indent}+1))}"
            printf '%s%s%s%s%s\n' "$indent" "$c_bullet" "$bullet" "$c_reset" "$rest"
            continue
        fi

        # Default: normal text
        printf '%s\n' "$line"
    done

    # Flush any remaining code
    if (( in_code_block )); then
        _chroma_output_code_block "$code_lang" "$code_buffer"
    elif (( in_unfenced_code )); then
        _chroma_output_code_block "" "$unfenced_buffer"
    fi
}

#==============================================================================
# MAIN PARSE FUNCTION
#==============================================================================

_chroma_parse_claude() {
    _chroma_strip_ansi | _chroma_reconstruct_tables | _chroma_render_claude
}

#==============================================================================
# VALIDATION
#==============================================================================

_chroma_parse_claude_validate() {
    # Check basic requirements
    command -v sed &>/dev/null || return 1
    command -v tput &>/dev/null || return 1
    return 0
}

#==============================================================================
# INFO
#==============================================================================

_chroma_parse_claude_info() {
    cat <<'EOF'
Cleans and re-renders Claude Code terminal output.

Fixes common issues:
  - Strips inconsistent ANSI escape codes
  - Reconstructs broken/wrapped markdown tables
  - Applies consistent TDS color scheme

Syntax Highlighting:
  - Fenced blocks (```js) use specified language
  - Auto-detects language if not specified
  - Uses bat for highlighting (falls back to basic)

Detected Languages:
  bash, python, javascript, typescript, json, toml, yaml,
  rust, go, c, cpp, java, ruby, php, sql, html, css, xml

Rendering:
  - Box-drawing characters (┌─┐) in dim color
  - Numbered lists (1. 2.) with green numbers
  - Bullet points (• - *) in cyan
  - Tables with proper structure
  - Code blocks with syntax colors
  - Thinking indicator (∴) styled

Usage:
  claude ... | chroma --claude
  pbpaste | chroma --claude
  chroma --claude < saved_output.txt
EOF
}

#==============================================================================
# REGISTRATION
#==============================================================================

chroma_register_parser "claude" "_chroma_parse_claude" "claude ansi" \
    "Claude Code terminal output"

#MULTICAT_START
# dir: /Users/mricos/src/devops/tetra/bash/chroma/plugins
# file: line-numbers.plugin.sh
# notes:
#MULTICAT_END
#!/usr/bin/env bash
# Chroma Plugin: Line Numbers
# Adds line numbers to rendered output

# Plugin state
declare -g _CHROMA_LINE_NUM=0

# Initialize plugin
_chroma_line_numbers_init() {
    # Declare configuration options
    chroma_config_declare "line-numbers" "enabled" "true" "Enable line numbers"
    chroma_config_declare "line-numbers" "width" "3" "Number width (digits)"
    chroma_config_declare "line-numbers" "color" "240" "ANSI 256 color code"
    chroma_config_declare "line-numbers" "separator" "│" "Separator character"
    chroma_config_declare "line-numbers" "skip_blank" "true" "Skip numbering blank lines"

    # Register hooks
    chroma_hook pre_render _chroma_line_numbers_reset
    chroma_hook pre_line _chroma_line_numbers_show
}

# Reset line counter
_chroma_line_numbers_reset() {
    _CHROMA_LINE_NUM=0
}

# Show line number before each line
_chroma_line_numbers_show() {
    local type="$1"

    # Check if enabled
    local enabled=$(chroma_config_get "line-numbers" "enabled")
    [[ "$enabled" != "true" ]] && return 1

    # Skip blank lines if configured
    local skip_blank=$(chroma_config_get "line-numbers" "skip_blank")
    if [[ "$skip_blank" == "true" ]]; then
        [[ "$type" == "blank" || "$type" == table.* ]] && return 1
    fi

    # Get config values
    local width=$(chroma_config_get "line-numbers" "width")
    local color=$(chroma_config_get "line-numbers" "color")
    local sep=$(chroma_config_get "line-numbers" "separator")

    ((_CHROMA_LINE_NUM++))
    printf '\033[38;5;%sm%*d%s\033[0m ' "$color" "$width" "$_CHROMA_LINE_NUM" "$sep"
    return 1  # Don't skip default rendering
}

# Register the plugin
chroma_register_plugin "line-numbers" "_chroma_line_numbers_init"

#MULTICAT_START
# dir: /Users/mricos/src/devops/tetra/bash/chroma/plugins
# file: bat-syntax.plugin.sh
# notes:
#MULTICAT_END
#!/usr/bin/env bash
# Chroma Plugin: Bat Syntax Highlighting
# Uses bat for syntax highlighting in code blocks

# Plugin state
declare -g _CHROMA_BAT_AVAILABLE=0

# Initialize plugin
_chroma_bat_init() {
    # Check if bat is available
    if command -v bat &>/dev/null; then
        _CHROMA_BAT_AVAILABLE=1
    fi

    # Declare configuration options
    chroma_config_declare "bat-syntax" "enabled" "true" "Enable bat syntax highlighting"
    chroma_config_declare "bat-syntax" "theme" "" "Bat theme (empty = default)"
    chroma_config_declare "bat-syntax" "style" "plain" "Bat style (plain, numbers, grid, etc)"
    chroma_config_declare "bat-syntax" "fallback_color" "179" "ANSI color when bat unavailable"

    # Register hook if bat is available
    if (( _CHROMA_BAT_AVAILABLE )); then
        chroma_hook render_code _chroma_bat_render_code
    fi
}

# Render code line using bat
# Args: lang, content, pad
_chroma_bat_render_code() {
    local lang="$1"
    local content="$2"
    local pad="$3"

    # Check if enabled
    local enabled=$(chroma_config_get "bat-syntax" "enabled")
    [[ "$enabled" != "true" ]] && return 1

    # If no language specified or bat not available, fall back
    [[ -z "$lang" ]] && return 1
    (( ! _CHROMA_BAT_AVAILABLE )) && return 1

    # Build bat command with config
    local style=$(chroma_config_get "bat-syntax" "style")
    local theme=$(chroma_config_get "bat-syntax" "theme")

    local bat_opts=(--style="$style" --color=always --language="$lang")
    [[ -n "$theme" ]] && bat_opts+=(--theme="$theme")

    # Use bat for syntax highlighting
    local highlighted
    highlighted=$(echo "$content" | bat "${bat_opts[@]}" 2>/dev/null)

    if [[ $? -eq 0 && -n "$highlighted" ]]; then
        printf '%s  %s\n' "$pad" "$highlighted"
        return 0  # Handled
    fi

    return 1  # Fall back to default
}

# Register the plugin
chroma_register_plugin "bat-syntax" "_chroma_bat_init"

