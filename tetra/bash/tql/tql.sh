#!/usr/bin/env bash
# tql.sh - TQL (Tetra Query Language) Main Entry Point

# Get TQL directory
TQL_SRC="${TQL_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"

# Source TQL modules
source "$TQL_SRC/tql_help.sh"
source "$TQL_SRC/tetra_temporal.sh" 2>/dev/null || true
source "$TQL_SRC/tetra_query_modifiers.sh" 2>/dev/null || true

# Main TQL command
tql() {
    local cmd="${1:-help}"
    shift 2>/dev/null || true

    case "$cmd" in
        help|--help|-h)
            tql_help "$@"
            ;;
        parse)
            # Parse a query and show structured output
            if [[ -z "$1" ]]; then
                echo "Usage: tql parse '<query>'" >&2
                return 1
            fi
            tql_parse_modifiers "$1"
            ;;
        temporal|time)
            # Parse temporal expression
            if [[ -z "$1" ]]; then
                echo "Usage: tql temporal '<expr>'" >&2
                echo "Examples: last:7d, since:monday, older:1h" >&2
                return 1
            fi
            tql_parse_temporal "$1"
            ;;
        duration)
            # Parse duration to seconds
            if [[ -z "$1" ]]; then
                echo "Usage: tql duration '<dur>'" >&2
                echo "Examples: 7d, 2h30m, 1w" >&2
                return 1
            fi
            tql_parse_duration "$1"
            ;;
        syntax)
            # Show colored syntax example
            _tql_help_colors
            echo -e "$(_tql_query "$*")"
            ;;
        version)
            echo "TQL 1.0 - Tetra Query Language"
            ;;
        *)
            echo "tql: unknown command '$cmd'" >&2
            echo "Use 'tql help' for usage" >&2
            return 1
            ;;
    esac
}

# Export for use as function
export -f tql

# CLI interface
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    tql "$@"
fi
