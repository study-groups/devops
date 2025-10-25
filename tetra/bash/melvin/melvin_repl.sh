#!/usr/bin/env bash

# MELVIN REPL - Interactive Interface
# Machine Electronics Live Virtual Intelligence Network

# Strong globals
: "${MELVIN_SRC:=$TETRA_SRC/bash/melvin}"
: "${MELVIN_DIR:=$TETRA_DIR/melvin}"

# Load dependencies
source "$MELVIN_SRC/melvin_classifier.sh"
source "$MELVIN_SRC/melvin_health.sh"
source "$MELVIN_SRC/melvin_scanner.sh"
source "$MELVIN_SRC/melvin_docs.sh"
source "$MELVIN_SRC/melvin_db.sh"

# Load REPL framework if available
if [[ -n "$TETRA_SRC" ]] && [[ -f "$TETRA_SRC/bash/repl/repl.sh" ]]; then
    source "$TETRA_SRC/bash/repl/repl.sh"
    MELVIN_USE_REPL_FRAMEWORK=1
else
    MELVIN_USE_REPL_FRAMEWORK=0
fi

# REPL Commands

# Command: health [summary|unclassified|full|<module>]
melvin_cmd_health() {
    local subcmd="${1:-summary}"

    case "$subcmd" in
        summary)
            melvin_health_summary
            ;;
        unclassified|unknown)
            melvin_health_unclassified
            ;;
        full)
            melvin_health_full
            ;;
        *)
            # Treat as module name for detailed report
            melvin_health_detail "$subcmd"
            ;;
    esac
}

# Command: explain <module>
melvin_cmd_explain() {
    local module="$1"

    if [[ -z "$module" ]]; then
        echo "Usage: explain <module>"
        echo "Example: explain rag"
        return 1
    fi

    melvin_explain_module "$module"
}

# Command: classify <module>
melvin_cmd_classify() {
    local module="${1:-}"

    if [[ -z "$module" ]]; then
        echo "Usage: classify <module>"
        echo "Shows classification reasoning for a module"
        return 1
    fi

    melvin_classify_all >/dev/null 2>&1

    local type=$(melvin_get_type "$module")
    local reason=$(melvin_get_reason "$module")
    local features=$(melvin_get_features "$module")

    echo "Module: bash/$module"
    echo "Type: $type"
    echo "Reason: $reason"
    [[ -n "$features" ]] && echo "Features: $features"
}

# Command: list <type>
melvin_cmd_list() {
    local type="${1:-MODULE}"
    type=$(echo "$type" | tr '[:lower:]' '[:upper:]')

    melvin_health_list "$type"
}

# Command: refresh
melvin_cmd_refresh() {
    echo "MELVIN: Rescanning codebase..."
    melvin_classify_all --rescan
    melvin_scan_all
    echo "MELVIN: Knowledge refresh complete."
}

# Command: stats
melvin_cmd_stats() {
    if [[ -f "$MELVIN_SRC/melvin_stats.sh" ]]; then
        source "$MELVIN_SRC/melvin_stats.sh"
        melvin_stats_report
    else
        echo "Stats tracking not yet implemented."
    fi
}

# Command: docs [summary|issues|groom|detail <module>]
melvin_cmd_docs() {
    local subcmd="${1:-summary}"

    case "$subcmd" in
        summary)
            melvin_docs_summary
            ;;
        issues)
            melvin_docs_issues
            ;;
        groom|unexpected)
            melvin_docs_unexpected
            ;;
        detail)
            melvin_docs_detail "$2"
            ;;
        *)
            # Treat as module name for detailed report
            melvin_docs_detail "$subcmd"
            ;;
    esac
}

# Command: db [save|query|show|search|list|stats|clean]
melvin_cmd_db() {
    local subcmd="${1:-list}"
    shift 2>/dev/null

    case "$subcmd" in
        save)
            melvin_db_save "$@"
            ;;
        query)
            # query <dimension> <args...>
            local dimension="$1"
            shift 2>/dev/null
            case "$dimension" in
                module|mod|m)
                    melvin_db_query_module "$@"
                    ;;
                checktype|check|c)
                    melvin_db_query_checktype "$@"
                    ;;
                time|t)
                    melvin_db_query_time "$@"
                    ;;
                *)
                    echo "Usage: db query <dimension> <args>"
                    echo "Dimensions:"
                    echo "  module <module> [checktype]    Query by module"
                    echo "  checktype <checktype> [module] Query by checktype"
                    echo "  time <start> [end]             Query by time range"
                    return 1
                    ;;
            esac
            ;;
        show|cat)
            melvin_db_show "$@"
            ;;
        search|grep)
            melvin_db_search "$@"
            ;;
        list|ls)
            melvin_db_list "$@"
            ;;
        stats)
            melvin_db_stats
            ;;
        clean)
            melvin_db_clean "$@"
            ;;
        *)
            echo "Unknown db command: $subcmd"
            echo "Available: save, query, show, search, list, stats, clean"
            return 1
            ;;
    esac
}

# Command: concepts
melvin_cmd_concepts() {
    echo "Tetra Concepts (The Tetra Way)"
    echo "=============================="
    echo ""
    echo "1. Strong Globals"
    echo "   TETRA_SRC: Must be set for anything to work"
    echo "   MOD_SRC=\$TETRA_SRC/bash/modname"
    echo "   MOD_DIR=\$TETRA_DIR/modname (unless testing)"
    echo ""
    echo "2. Module Structure"
    echo "   - Library: includes.sh only"
    echo "   - Module: has actions.sh (usually has REPL)"
    echo "   - App: implements TUI"
    echo ""
    echo "3. Lazy Loading"
    echo "   - Modules registered in boot_modules.sh"
    echo "   - tetra_register_module <name> <path>"
    echo "   - Loaded on first use"
    echo ""
    echo "4. Includes Pattern"
    echo "   - includes.sh: Entry point for module"
    echo "   - Sources main functionality"
    echo "   - Exports strong globals"
    echo ""
    echo "5. REPL Pattern"
    echo "   - bash 5.2+ always"
    echo "   - Always starts: source ~/tetra/tetra.sh"
    echo "   - Interactive command interfaces"
    echo ""
    echo "Use 'explain <module>' to see how these apply to specific modules."
}

# Command: help
melvin_cmd_help() {
    cat <<'EOF'
MELVIN - Machine Electronics Live Virtual Intelligence Network
==============================================================

MELVIN helps you understand the tetra codebase through classification
and precise accounting. MELVIN never misses.

Commands:
  help                    Show this help
  db [cmd]                Granular database (3-dimensional queries)
    save <mod> <check> <data>  Save record
    query module <mod> [check] Query by module
    query checktype <check> [mod] Query by checktype
    query time <start> [end]   Query by time range
    list [limit]          List recent records
    show <id>             Show specific record
    search <query>        Search record content
    stats                 Database statistics
    clean [days]          Clean old records (default: 30 days)
  health [type]           Module health check
    summary               Show classification counts (default)
    unclassified          List unclassified directories
    full                  Full health report
    <module>              Detailed report for module

  explain <module>        Explain a module in detail
  classify <module>       Show classification for module
  list <type>             List modules by type
    LIBRARY               Libraries (includes.sh only)
    MODULE                Modules (has actions.sh)
    APP                   Apps (has TUI)
    APP+MODULE            Both app and module
    UNKNOWN               Unclassified

  concepts                Show tetra patterns and conventions
  docs [type]             Documentation health check
    summary               Documentation coverage summary (default)
    issues                List modules with doc issues
    groom                 List misplaced documentation
    <module>              Detailed docs report for module
  refresh                 Rescan codebase and rebuild knowledge
  stats                   Show MELVIN usage statistics
  exit|quit               Exit MELVIN

Examples:
  explain rag             Detailed analysis of bash/rag
  health summary          Classification counts
  list MODULE             List all modules
  classify rag            Show why rag is classified as MODULE

The Tetra Way:
  - TETRA_SRC is a strong global (must be set)
  - Modules: bash/<name>/ with actions.sh
  - Libraries: bash/<name>/ with includes.sh only
  - Apps: Implement TUI
EOF
}

# Simple REPL loop (fallback if framework not available)
melvin_simple_repl() {
    echo "MELVIN - Machine Electronics Live Virtual Intelligence Network"
    echo "Type 'help' for commands, 'exit' to quit"
    echo ""

    while true; do
        echo -n "melvin> "
        read -r input

        # Parse command
        local cmd=$(echo "$input" | awk '{print $1}')
        local args=$(echo "$input" | cut -d' ' -f2-)
        [[ "$cmd" == "$args" ]] && args=""

        case "$cmd" in
            ""|" ")
                continue
                ;;
            help)
                melvin_cmd_help
                ;;
            health)
                melvin_cmd_health $args
                ;;
            explain)
                melvin_cmd_explain $args
                ;;
            classify)
                melvin_cmd_classify $args
                ;;
            list)
                melvin_cmd_list $args
                ;;
            refresh)
                melvin_cmd_refresh
                ;;
            stats)
                melvin_cmd_stats
                ;;
            concepts)
                melvin_cmd_concepts
                ;;
            docs)
                melvin_cmd_docs $args
                ;;
            db)
                melvin_cmd_db $args
                ;;
            exit|quit|q)
                echo "MELVIN: Farewell. Precision above all."
                break
                ;;
            *)
                echo "Unknown command: $cmd"
                echo "Type 'help' for available commands"
                ;;
        esac
        echo ""
    done
}

# Main REPL entry point
melvin_repl() {
    # Initialize on first run
    [[ ! -d "$MELVIN_DIR" ]] && mkdir -p "$MELVIN_DIR"

    # Use framework REPL if available, otherwise simple loop
    if [[ $MELVIN_USE_REPL_FRAMEWORK -eq 1 ]]; then
        # TODO: Integrate with bash/repl framework
        # For now, use simple REPL
        melvin_simple_repl
    else
        melvin_simple_repl
    fi
}

# Export functions
export -f melvin_cmd_health
export -f melvin_cmd_explain
export -f melvin_cmd_classify
export -f melvin_cmd_list
export -f melvin_cmd_refresh
export -f melvin_cmd_stats
export -f melvin_cmd_docs
export -f melvin_cmd_concepts
export -f melvin_cmd_db
export -f melvin_cmd_help
export -f melvin_simple_repl
export -f melvin_repl
