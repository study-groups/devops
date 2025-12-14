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
