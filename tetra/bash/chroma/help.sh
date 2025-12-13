#!/usr/bin/env bash

# Chroma Help System
# All help text in one place

chroma_help() {
    local topic="${1:-}"
    case "$topic" in
        "")         _chroma_help_main ;;
        render)     _chroma_help_render ;;
        parser*)    _chroma_help_parser ;;
        format*)    _chroma_help_format ;;
        doctor)     _chroma_help_doctor ;;
        options)    _chroma_help_options ;;
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

USAGE
  chroma <file>              Render file (auto-detect format)
  cat file | chroma          Pipe content
  chroma --toml config.toml  Explicit format

OPTIONS
  -n, --no-pager    Output to stdout (no pager)
  -t, --theme NAME  Use theme
  -w, --width N     Set line width
  --toml/--json/--md/--claude  Format shortcuts

COMMANDS
  doctor   Health check
  status   Show configuration
  parser   List/info parsers
  help     This help

Help topics: render parser format doctor options
EOF
}

_chroma_help_render() {
    cat << 'EOF'
chroma render - Rendering files

USAGE
  chroma [OPTIONS] <file>
  cat file | chroma [OPTIONS]

FORMAT DETECTION
  Auto-detects by extension: .md .toml .json
  Or by content: [section] -> toml, { -> json
  Default: markdown

PAGER
  Auto-enabled for terminal output
  Auto-disabled for piped input
  -p, --pager      Force pager
  -n, --no-pager   Force no pager

EXAMPLES
  chroma README.md
  cat data.json | chroma --json
  chroma -t warm -w 100 doc.md
EOF
}

_chroma_help_parser() {
    cat << 'EOF'
chroma parser - Parser management

COMMANDS
  parser list         List all parsers
  parser info <name>  Show parser details

EXAMPLES
  chroma parser list
  chroma parser info markdown
EOF
}

_chroma_help_format() {
    cat << 'EOF'
chroma format - Format selection

SHORTCUTS
  --toml      TOML files
  --json      JSON files
  --md        Markdown files
  --claude    Claude ANSI output

EXPLICIT
  -f, --format NAME

AUTO-DETECTION
  By extension: .md .toml .json
  By content: [section] or key=value -> toml
              { or [ -> json
  Default: markdown
EOF
}

_chroma_help_doctor() {
    cat << 'EOF'
chroma doctor - Health diagnostics

USAGE
  chroma doctor [-v]

OPTIONS
  -v, --verbose   Detailed output

CHECKS
  - Dependencies (TETRA_SRC, bash version)
  - TDS integration
  - Parser registration
  - Theme system
EOF
}

_chroma_help_options() {
    cat << 'EOF'
chroma options - All options

DISPLAY
  -p, --pager       Use pager
  -n, --no-pager    No pager
  -w, --width N     Line width
  -t, --theme NAME  Theme

FORMAT
  --toml --json --md --claude
  -f, --format NAME

GENERAL
  -h, --help        Show help
  help [topic]      Topic help
EOF
}
