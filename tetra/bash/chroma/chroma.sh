#!/usr/bin/env bash

# Chroma - Terminal Syntax Highlighter
# Beautifully render markdown, TOML, JSON and more in your terminal
# Powered by TDS (Tetra Display System)

#==============================================================================
# GLOBAL CONFIGURATION
#==============================================================================

CHROMA_DEBUG_LOG="${CHROMA_DEBUG_LOG:-/tmp/chroma_debug.log}"

# Verify TDS is loaded
if [[ "${TDS_LOADED}" != "true" ]]; then
    echo "Error: TDS not loaded. Chroma must be loaded via the module system:" >&2
    echo "  tmod load chroma" >&2
    return 1
fi

TDS_SRC="${TDS_SRC:-$TETRA_SRC/bash/tds}"

# Load rule/hook system
if [[ -f "$TDS_SRC/renderers/markdown_rules.sh" ]]; then
    source "$TDS_SRC/renderers/markdown_rules.sh"
fi

#==============================================================================
# CONFIGURATION INITIALIZATION
#==============================================================================

chroma_init_config() {
    : "${CHROMA_PAGER:=less -R}"
    : "${CHROMA_WIDTH:=$(tput cols 2>/dev/null || echo 80)}"
    : "${CHROMA_DEBUG:=0}"

    export TDS_MARKDOWN_PAGER="$CHROMA_PAGER"
    export TDS_MARKDOWN_WIDTH="${TDS_MARKDOWN_WIDTH:-$CHROMA_WIDTH}"
}

chroma_init_config

#==============================================================================
# HELPER FUNCTIONS
#==============================================================================

_chroma_debug() {
    (( CHROMA_DEBUG )) && echo "[$(date +%T)] $*" >> "$CHROMA_DEBUG_LOG"
}

_is_numeric() {
    [[ "$1" =~ ^[0-9]+$ ]]
}

chroma_validate_file() {
    local file="$1"
    [[ -n "$file" && "$file" != "-" && ! -f "$file" ]] && {
        echo "Error: File not found: $file" >&2
        return 1
    }
    return 0
}

chroma_validate_numeric() {
    local value="$1" name="$2"
    _is_numeric "$value" || {
        echo "Error: $name must be numeric, got: $value" >&2
        return 1
    }
    return 0
}

chroma_validate_theme() {
    local theme="$1"
    if [[ -v TDS_THEME_REGISTRY["$theme"] ]]; then
        return 0
    fi
    echo "Error: Unknown theme '$theme'" >&2
    echo "Available: ${!TDS_THEME_REGISTRY[*]}" >&2
    return 1
}

# Margin parsing
chroma_parse_margin() {
    local top_val="$1"
    local horiz_val="${2:-}"
    local -n top_ref="$3" left_ref="$4" right_ref="$5"

    top_ref="$top_val"
    left_ref="$top_val"
    right_ref="$top_val"

    if [[ -n "$horiz_val" ]] && _is_numeric "$horiz_val"; then
        left_ref="$horiz_val"
        right_ref="$horiz_val"
        return 2
    fi

    return 1
}

#==============================================================================
# ARGUMENT PARSING
#==============================================================================

chroma_parse_args() {
    local -n args_ref="$1"
    shift

    # Initialize defaults
    args_ref[file]=""
    args_ref[use_pager]=""
    args_ref[show_rules]=0
    args_ref[margin_top]=0
    args_ref[margin_right]=0
    args_ref[margin_bottom]=0
    args_ref[margin_left]=0
    args_ref[format]=""  # Empty = auto-detect

    _chroma_debug "Starting argument parse with $# args: $*"

    while [[ $# -gt 0 ]]; do
        _chroma_debug "Processing arg: $1"
        case "$1" in
            # Subcommands
            doctor)
                args_ref[subcommand]="doctor"
                shift
                args_ref[subcmd_args]="$*"
                return 0
                ;;
            parser|parsers)
                args_ref[subcommand]="parser"
                shift
                args_ref[subcmd_args]="$*"
                return 0
                ;;
            status)
                args_ref[subcommand]="status"
                return 0
                ;;
            reload)
                args_ref[subcommand]="reload"
                return 0
                ;;
            cst)
                args_ref[subcommand]="cst"
                shift
                args_ref[subcmd_args]="$*"
                return 0
                ;;
            table)
                args_ref[subcommand]="table"
                shift
                args_ref[subcmd_args]="$*"
                return 0
                ;;
            help)
                _chroma_help
                return 0
                ;;

            # Format selection
            --toml)
                args_ref[format]="toml"
                shift
                ;;
            --json)
                args_ref[format]="json"
                shift
                ;;
            --md|--markdown)
                args_ref[format]="markdown"
                shift
                ;;
            --claude|--ansi)
                args_ref[format]="claude"
                shift
                ;;
            --format|-f)
                if [[ -z "$2" ]]; then
                    echo "Error: --format requires a format name" >&2
                    return 1
                fi
                args_ref[format]="$2"
                shift 2
                ;;

            # Pager control
            --no-pager|-n)
                args_ref[use_pager]=0
                shift
                ;;
            --pager|-p)
                args_ref[use_pager]=1
                shift
                ;;

            # Theme
            --theme|-t)
                if [[ -z "$2" ]]; then
                    echo "Error: --theme requires a theme name" >&2
                    return 1
                fi
                chroma_validate_theme "$2" && tds_switch_theme "$2" 2>/dev/null
                shift 2
                ;;

            # Width
            --width|-w)
                if [[ -z "$2" ]]; then
                    echo "Error: --width requires a numeric value" >&2
                    return 1
                fi
                chroma_validate_numeric "$2" "width" || return 1
                TDS_MARKDOWN_WIDTH="$2"
                shift 2
                ;;

            # Margins
            --margin|-m)
                local m_top="$2"
                local m_horiz="${3:-}"

                if [[ -z "$m_top" ]] || ! _is_numeric "$m_top"; then
                    echo "Error: --margin requires at least one numeric value" >&2
                    return 1
                fi

                # Only use second value if it's numeric (not a flag or filename)
                if [[ -n "$m_horiz" ]] && ! _is_numeric "$m_horiz"; then
                    m_horiz=""  # Not a margin value, will be parsed as next arg
                fi

                chroma_parse_margin "$m_top" "$m_horiz" \
                    args_ref[margin_top] args_ref[margin_left] args_ref[margin_right]
                local consumed=$?
                shift $((consumed + 1))
                ;;

            # Rules/presets
            --preset)
                if [[ -z "$2" ]]; then
                    echo "Error: --preset requires a preset name" >&2
                    return 1
                fi
                chroma_load_preset "$2" 2>/dev/null || {
                    echo "Warning: Unknown preset '$2'" >&2
                }
                shift 2
                ;;
            --rule)
                if [[ -z "$2" ]]; then
                    echo "Error: --rule requires a rule pattern" >&2
                    return 1
                fi
                chroma_register_rule "custom" "$2"
                shift 2
                ;;
            --list-rules)
                args_ref[show_rules]=1
                shift
                ;;
            --clear-rules)
                chroma_clear_rules
                echo "All rules and hooks cleared"
                return 0
                ;;

            # Help
            --help|-h)
                _chroma_help
                return 0
                ;;

            # File argument
            *)
                args_ref[file]="$1"
                shift
                ;;
        esac
    done
}

#==============================================================================
# HELP
#==============================================================================

_chroma_help() {
    cat <<'EOF'
chroma - Terminal Syntax Highlighter

FIRST USE
  chroma README.md           Render markdown file
  cat file | chroma --toml   Pipe TOML content
  chroma doctor              Check health

REGULAR USE
  chroma <file>              Auto-detect format, render with pager
  chroma -n <file>           No pager (stdout)
  chroma --toml <file>       Force TOML format
  chroma -t warm <file>      Use warm theme

ALL COMMANDS
  Render    chroma [opts] <file>
  Info      doctor parser status reload
  Parse     cst <file>              Output CST as JSON
  Table     table <file>            Render markdown table
  Parsers   parser list, parser info <name>
  Options   -n -p -w -m -t -f --preset --rule

FORMAT FLAGS
  --toml --json --md --claude  Shortcut format selection
  -f, --format NAME            Use named parser

OPTIONS
  -p, --pager         Use pager (default)
  -n, --no-pager      Output to stdout
  -w, --width N       Line width
  -m, --margin N [H]  Margins (top, horizontal)
  -t, --theme NAME    Theme (default warm cool neutral electric)
  --preset NAME       Rule preset (markers bookmarks sections all)
  --rule PATTERN      Custom sed rule
  --list-rules        Show active rules
  --clear-rules       Clear rules

EXAMPLES
  chroma README.md
  cat config.toml | chroma --toml
  chroma -t warm -w 100 doc.md
  pbpaste | chroma --claude       Clean Claude Code output
  chroma doctor -v
  chroma parser info toml
EOF
}

#==============================================================================
# SUBCOMMAND DISPATCH
#==============================================================================

_chroma_subcmd_parser() {
    local action="${1:-list}"
    shift 2>/dev/null || true

    case "$action" in
        list|ls)
            chroma_list_parsers
            ;;
        info)
            local name="$1"
            if [[ -z "$name" ]]; then
                echo "Usage: chroma parser info <name>" >&2
                return 1
            fi
            chroma_parser_info "$name"
            ;;
        *)
            echo "Unknown parser command: $action" >&2
            echo "Try: list, info <name>" >&2
            return 1
            ;;
    esac
}

#==============================================================================
# RENDER DISPATCH
#==============================================================================

_chroma_render() {
    local format="$1"
    local file="$2"
    local use_pager="$3"

    # Get parser function
    local parser_fn
    parser_fn=$(chroma_get_parser "$format")

    if [[ -z "$parser_fn" ]]; then
        echo "Error: No parser for format '$format'" >&2
        echo "Available parsers: ${CHROMA_PARSER_ORDER[*]}" >&2
        return 1
    fi

    _chroma_debug "Using parser: $parser_fn for format: $format"

    # Set up input
    local input_cmd="cat"
    if [[ -n "$file" && "$file" != "-" ]]; then
        input_cmd="cat '$file'"
    fi

    # Render with optional pager
    if (( use_pager )); then
        eval "$input_cmd" | "$parser_fn" | ${CHROMA_PAGER:-less -R}
    else
        eval "$input_cmd" | "$parser_fn"
    fi
}

#==============================================================================
# MAIN CHROMA FUNCTION
#==============================================================================

chroma() {
    _chroma_debug "chroma called with $# args: $*"

    # Parse arguments
    declare -A args
    chroma_parse_args args "$@" || return $?

    # Handle subcommands
    if [[ -n "${args[subcommand]:-}" ]]; then
        case "${args[subcommand]}" in
            doctor)
                chroma_doctor ${args[subcmd_args]:-}
                return $?
                ;;
            parser)
                _chroma_subcmd_parser ${args[subcmd_args]:-}
                return $?
                ;;
            status)
                chroma_status
                return $?
                ;;
            reload)
                chroma_reload
                return $?
                ;;
            cst)
                chroma_cst ${args[subcmd_args]:-}
                return $?
                ;;
            table)
                local input="${args[subcmd_args]:--}"
                if [[ "$input" == "-" ]]; then
                    chroma_render_table_simple
                else
                    chroma_render_table_simple < "$input"
                fi
                return $?
                ;;
        esac
    fi

    # Show rules if requested
    if (( args[show_rules] )); then
        chroma_list_rules
        return 0
    fi

    # Validate file if specified
    if [[ -n "${args[file]}" ]]; then
        chroma_validate_file "${args[file]}" || return 1
    fi

    # Check for input
    if [[ -z "${args[file]}" || "${args[file]}" == "-" ]] && [[ -t 0 ]]; then
        echo "Error: No input provided. Provide a file or pipe content." >&2
        echo "Usage: chroma [OPTIONS] FILE" >&2
        echo "       cat file | chroma --format FORMAT" >&2
        return 1
    fi

    # Auto-detect pager mode
    if [[ -z "${args[use_pager]}" ]]; then
        args[use_pager]=1
    fi

    # Auto-detect format if not specified
    local format="${args[format]}"
    if [[ -z "$format" ]]; then
        # Read first line for content-based detection
        local first_line=""
        if [[ -n "${args[file]}" && "${args[file]}" != "-" ]]; then
            first_line=$(head -1 "${args[file]}" 2>/dev/null)
        fi
        format=$(chroma_detect_format "${args[file]}" "$first_line")
        _chroma_debug "Auto-detected format: $format"
    fi

    _chroma_debug "use_pager=${args[use_pager]} file='${args[file]}' format='$format'"

    # Export margins for TDS
    export TDS_MARGIN_TOP="${args[margin_top]}"
    export TDS_MARGIN_RIGHT="${args[margin_right]}"
    export TDS_MARGIN_BOTTOM="${args[margin_bottom]}"
    export TDS_MARGIN_LEFT="${args[margin_left]}"

    # Dispatch to renderer
    _chroma_render "$format" "${args[file]}" "${args[use_pager]}"
}

#==============================================================================
# LEGACY COMPATIBILITY
#==============================================================================

chroma_render() {
    tds_render_markdown "$@"
}

# Export for direct execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    chroma "$@"
fi
