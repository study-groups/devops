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
    CHROMA_MARGIN=0

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
# Call after input is resolved
chroma_auto_pager() {
    if [[ -z "$CHROMA_PAGER" ]]; then
        # Default: no pager (use -p to enable)
        CHROMA_PAGER=0
    fi
}
