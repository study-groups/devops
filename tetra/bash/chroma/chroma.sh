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

_chroma_is_numeric() {
    [[ "$1" =~ ^[0-9]+$ ]]
}

_chroma_require_arg() {
    local opt="$1" val="$2" desc="$3"
    if [[ -z "$val" || "$val" == -* ]]; then
        echo "Error: $opt requires $desc" >&2
        return 1
    fi
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
    _chroma_is_numeric "$value" || {
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
                args_ref[subcommand]="help"
                shift
                args_ref[subcmd_args]="$*"
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
                _chroma_require_arg "--format" "$2" "a format name" || return 1
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
                _chroma_require_arg "--theme" "$2" "a theme name" || return 1
                chroma_validate_theme "$2" || return 1
                tds_switch_theme "$2" 2>/dev/null
                shift 2
                ;;

            # Width
            --width|-w)
                _chroma_require_arg "--width" "$2" "a numeric value" || return 1
                chroma_validate_numeric "$2" "width" || return 1
                TDS_MARKDOWN_WIDTH="$2"
                shift 2
                ;;

            # Margins
            --margin|-m)
                local m_top="$2"
                local m_horiz="${3:-}"

                if [[ -z "$m_top" ]] || ! _chroma_is_numeric "$m_top"; then
                    echo "Error: --margin requires at least one numeric value" >&2
                    return 1
                fi

                # Only use second value if it's numeric (not a flag or filename)
                if [[ -n "$m_horiz" ]] && ! _chroma_is_numeric "$m_horiz"; then
                    m_horiz=""  # Not a margin value, will be parsed as next arg
                fi

                # Set margins directly (single value = top/left/right, two values = top + horizontal)
                args_ref[margin_top]="$m_top"
                args_ref[margin_left]="$m_top"
                args_ref[margin_right]="$m_top"

                if [[ -n "$m_horiz" ]]; then
                    args_ref[margin_left]="$m_horiz"
                    args_ref[margin_right]="$m_horiz"
                    shift 3  # --margin top horiz
                else
                    shift 2  # --margin val
                fi
                ;;

            # Rules/presets
            --preset)
                _chroma_require_arg "--preset" "$2" "a preset name" || return 1
                if declare -F chroma_load_preset &>/dev/null; then
                    chroma_load_preset "$2" 2>/dev/null || {
                        echo "Warning: Unknown preset '$2'" >&2
                    }
                else
                    echo "Warning: Preset system not available" >&2
                fi
                shift 2
                ;;
            --rule)
                _chroma_require_arg "--rule" "$2" "a rule pattern" || return 1
                if declare -F chroma_register_rule &>/dev/null; then
                    chroma_register_rule "custom" "$2"
                else
                    echo "Warning: Rule system not available" >&2
                fi
                shift 2
                ;;
            --list-rules)
                args_ref[show_rules]=1
                shift
                ;;
            --clear-rules)
                if declare -F chroma_clear_rules &>/dev/null; then
                    chroma_clear_rules
                    echo "All rules and hooks cleared"
                else
                    echo "Warning: Rule system not available" >&2
                fi
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
# HELP SYSTEM
#==============================================================================

_chroma_help() {
    local topic="${1:-}"
    case "$topic" in
        render)     _chroma_help_render ;;
        parser|parsers) _chroma_help_parser ;;
        format|formats) _chroma_help_format ;;
        doctor)     _chroma_help_doctor ;;
        options)    _chroma_help_options ;;
        "")         _chroma_help_main ;;
        *)
            echo "Unknown help topic: $topic"
            echo "Topics: render parser format doctor options"
            return 1
            ;;
    esac
}

_chroma_help_main() {
    cat << 'EOF'
chroma - Terminal Syntax Highlighter

FIRST USE
  chroma README.md           Render markdown file
  cat file | chroma --toml   Pipe TOML content
  chroma doctor              Check health

REGULAR USE
  chroma <file>              Auto-detect format, render with pager
  chroma -n <file>           No pager (stdout)
  chroma -t warm <file>      Use warm theme

ALL COMMANDS
  Render    chroma [opts] <file>
  Info      doctor status reload
  Parse     cst table parser
  Help      help [topic]

Help topics: render parser format doctor options
EOF
}

_chroma_help_render() {
    cat << 'EOF'
chroma render - Rendering files

USAGE
  chroma [OPTIONS] <file>
  cat file | chroma --format <format>

FORMAT DETECTION
  Auto-detects by extension: .md .toml .json
  Force with: --toml --json --md --claude
  Or use: -f <parser-name>

PAGER CONTROL
  -p, --pager      Use pager (default for tty)
  -n, --no-pager   Output to stdout

DISPLAY OPTIONS
  -w, --width N       Set line width
  -m, --margin N [H]  Set margins (top [horizontal])
  -t, --theme NAME    Use theme

EXAMPLES
  chroma README.md              Auto-detect, pager
  chroma -n config.toml         No pager
  cat data.json | chroma --json Pipe with format
  chroma -t warm -w 100 doc.md  Custom theme/width
EOF
}

_chroma_help_parser() {
    cat << 'EOF'
chroma parser - Parser management

COMMANDS
  parser list           List all registered parsers
  parser info <name>    Show parser details

PARSER INFO SHOWS
  - Description and render function
  - File extensions handled
  - Validation status

EXAMPLES
  chroma parser list
  chroma parser info toml
  chroma parser info markdown
EOF
}

_chroma_help_format() {
    cat << 'EOF'
chroma format - Format selection

FORMAT FLAGS (shortcuts)
  --toml              TOML files
  --json              JSON files
  --md, --markdown    Markdown files
  --claude, --ansi    Claude Code ANSI output

EXPLICIT FORMAT
  -f, --format NAME   Use named parser

AUTO-DETECTION
  By extension: .md → markdown, .toml → toml, .json → json
  By content: [section] or key=value → toml, { or [ → json
  Default: markdown

EXAMPLES
  chroma --toml config.toml
  cat data | chroma -f json
  pbpaste | chroma --claude
EOF
}

_chroma_help_doctor() {
    cat << 'EOF'
chroma doctor - Health diagnostics

USAGE
  chroma doctor [OPTIONS]

OPTIONS
  -v, --verbose     Show detailed output
  --check NAME      Run specific check only

CHECKS
  dependencies      Core deps (TETRA_SRC, bash version)
  tds               TDS integration and functions
  parsers           Parser registration and validation
  themes            Theme system availability
  tokens            Semantic token resolution

EXAMPLES
  chroma doctor              Run all checks
  chroma doctor -v           Verbose output
  chroma doctor --check tds  Check TDS only
EOF
}

_chroma_help_options() {
    cat << 'EOF'
chroma options - All command options

DISPLAY
  -p, --pager         Use pager (default)
  -n, --no-pager      Output to stdout
  -w, --width N       Line width
  -m, --margin N [H]  Margins (top, horizontal)
  -t, --theme NAME    Theme (default warm cool neutral electric)

FORMAT
  --toml --json --md --claude  Shortcut format selection
  -f, --format NAME            Use named parser

RULES
  --preset NAME       Rule preset (markers bookmarks sections all)
  --rule PATTERN      Custom sed rule
  --list-rules        Show active rules
  --clear-rules       Clear rules

GENERAL
  -h, --help          Show help
  help [topic]        Topic help (render parser format doctor options)
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

    # Set up pager command as array for proper word splitting
    local -a pager_cmd
    read -ra pager_cmd <<< "${CHROMA_PAGER:-less -R}"

    # Render: file input or stdin, with optional pager
    if (( use_pager )); then
        if [[ -n "$file" && "$file" != "-" ]]; then
            "$parser_fn" < "$file" | "${pager_cmd[@]}"
        else
            "$parser_fn" | "${pager_cmd[@]}"
        fi
    else
        if [[ -n "$file" && "$file" != "-" ]]; then
            "$parser_fn" < "$file"
        else
            "$parser_fn"
        fi
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
        # Split subcmd_args into array for proper word handling
        local -a subcmd_argv
        read -ra subcmd_argv <<< "${args[subcmd_args]:-}"

        case "${args[subcommand]}" in
            help)
                _chroma_help "${subcmd_argv[@]}"
                return $?
                ;;
            doctor)
                chroma_doctor "${subcmd_argv[@]}"
                return $?
                ;;
            parser)
                _chroma_subcmd_parser "${subcmd_argv[@]}"
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
                chroma_cst "${subcmd_argv[@]}"
                return $?
                ;;
            table)
                local input="${subcmd_argv[0]:--}"
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
        if declare -F chroma_list_rules &>/dev/null; then
            chroma_list_rules
        else
            echo "Rule system not available" >&2
        fi
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

# Export for direct execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    chroma "$@"
fi
