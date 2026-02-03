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
        hooks)
            shift
            chroma_hooks "$@"
            return $?
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
  chroma hooks [list|info]    Discover available hooks
  chroma plugins              List loaded plugins
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
