#!/usr/bin/env bash

# Span CLI - Universal text analysis and cursor management
# Main entry point for span operations

# Source span modules
SPAN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SPAN_DIR/cursor.sh"
source "$SPAN_DIR/multispan.sh"

# CLI entry point
span() {
    local command="$1"
    shift

    case "$command" in
        "create"|"c")
            span_create_cursor "$@"
            ;;
        "extract"|"x")
            span_extract_cursor "$@"
            ;;
        "context"|"ctx")
            span_context_cursor "$@"
            ;;
        "search"|"grep"|"s")
            span_search_files "$@"
            ;;
        "multispan"|"ms")
            span_multispan_cmd "$@"
            ;;
        "store"|"save")
            span_store_multispan "$@"
            ;;
        "load")
            span_load_multispan "$@"
            ;;
        "slots"|"storage")
            multispan_show_storage
            ;;
        "stats")
            span_stats_cmd "$@"
            ;;
        "help"|"h"|"")
            span_show_help
            ;;
        *)
            echo "Unknown command: $command"
            span_show_help
            ;;
    esac
}

# Create cursor from arguments
span_create_cursor() {
    local file="$1"
    local path="$2"
    local start="$3"
    local end="$4"
    local note="$5"

    if [[ -z "$file" || -z "$path" || -z "$start" || -z "$end" ]]; then
        echo "Usage: span create <file> <path> <start> <end> [note]"
        return 1
    fi

    cursor_create "$file" "$path" "$start" "$end" "$note"
}

# Extract text from cursor
span_extract_cursor() {
    local cursor="$1"
    if [[ -z "$cursor" ]]; then
        echo "Usage: span extract <cursor>"
        return 1
    fi

    cursor_extract "$cursor"
}

# Show context around cursor
span_context_cursor() {
    local cursor="$1"
    local radius="$2"
    cursor_context "$cursor" "$radius"
}

# Search files and create cursors
span_search_files() {
    local pattern="$1"
    local file="$2"
    local note="$3"

    if [[ -z "$pattern" ]]; then
        echo "Usage: span search <pattern> [file] [note]"
        return 1
    fi

    if [[ -z "$file" ]]; then
        # Search all files in current directory
        find . -type f -name "*.sh" -o -name "*.toml" -o -name "*.conf" | while read -r f; do
            cursor_from_grep "$pattern" "$f" "$note"
        done
    else
        cursor_from_grep "$pattern" "$file" "$note"
    fi
}

# Multispan subcommands
span_multispan_cmd() {
    local subcmd="$1"
    shift

    case "$subcmd" in
        "create")
            multispan_create "$@"
            ;;
        "add")
            multispan_add_cursor "$@"
            ;;
        "list"|"ls")
            multispan_list "$@"
            ;;
        "search")
            multispan_search "$@"
            ;;
        "merge")
            multispan_merge "$@"
            ;;
        *)
            echo "Unknown multispan command: $subcmd"
            echo "Available: create, add, list, search, merge"
            ;;
    esac
}

# Store multispan in numbered slot
span_store_multispan() {
    local slot="$1"
    local name="$2"
    local description="$3"

    if [[ -z "$slot" || -z "$name" ]]; then
        echo "Usage: span store <slot> <multispan_name> [description]"
        return 1
    fi

    multispan_store "$slot" "$name" "$description"
}

# Load multispan from numbered slot
span_load_multispan() {
    local slot="$1"
    local name="${2:-loaded_span_$slot}"

    if [[ -z "$slot" ]]; then
        echo "Usage: span load <slot> [new_name]"
        return 1
    fi

    multispan_load "$slot" "$name"
}

# Show statistics
span_stats_cmd() {
    local name="$1"
    if [[ -z "$name" ]]; then
        echo "Usage: span stats <multispan_name>"
        return 1
    fi

    multispan_stats "$name"
}

# Show help
span_show_help() {
    cat << 'EOF'
Span - Universal Text Analysis and Cursor Management

CURSOR OPERATIONS:
  span create <file> <path> <start> <end> [note]  Create cursor
  span extract <cursor>                           Extract text content
  span context <cursor> [radius]                 Show surrounding context
  span search <pattern> [file] [note]            Search and create cursors

MULTISPAN OPERATIONS:
  span multispan create <name>                    Create multispan collection
  span multispan add <name> <cursor> [key]       Add cursor to multispan
  span multispan list <name>                     List cursors in multispan
  span multispan search <name> <pattern>         Search within multispan
  span multispan merge <target> <source>         Merge two multispans

STORAGE OPERATIONS:
  span store <slot> <name> [description]         Store multispan in slot 1-9
  span load <slot> [new_name]                    Load multispan from slot
  span slots                                     Show all storage slots

ANALYSIS:
  span stats <multispan_name>                    Show multispan statistics

EXAMPLES:
  span create config.toml ./config.toml 10 15 "database section"
  span search "host.*=" config.toml "host settings"
  span multispan create db_config
  span store 1 db_config "Database configuration spans"

EOF
}

# Export main function
export -f span