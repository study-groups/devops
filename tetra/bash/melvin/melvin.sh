#!/usr/bin/env bash

# MELVIN - Machine Electronics Live Virtual Intelligence Network
# Universal Bash Codebase Meta-Agent

# Strong globals
: "${MELVIN_SRC:=$TETRA_SRC/bash/melvin}"
: "${MELVIN_DIR:=$TETRA_DIR/melvin}"

# Export strong globals
export MELVIN_SRC MELVIN_DIR

# Load core MELVIN components (universal)
source "$MELVIN_SRC/melvin_context.sh"
source "$MELVIN_SRC/melvin_knowledge.sh"
source "$MELVIN_SRC/melvin_classify.sh"

# Load database component
[[ -f "$MELVIN_SRC/melvin_db.sh" ]] && source "$MELVIN_SRC/melvin_db.sh"

# Load registry component (Tetra enhancement)
[[ -f "$MELVIN_SRC/melvin_registry.sh" ]] && source "$MELVIN_SRC/melvin_registry.sh"

# Load knowledge plugins
for plugin in "$MELVIN_SRC/knowledge"/*.sh; do
    [[ -f "$plugin" ]] && source "$plugin"
done

# Initialize context
melvin_init_context

# Main MELVIN command dispatcher
# Usage: melvin [--root path] <command> [args...]
melvin() {
    local cmd="${1:-help}"
    shift 2>/dev/null

    case "$cmd" in
        # Root switching
        --root)
            melvin_set_root "$1"
            shift
            melvin "$@"
            return
            ;;

        # Context commands
        context)
            melvin_context_info
            ;;

        # Analysis commands (context-aware)
        health)
            melvin_cmd_health "$@"
            ;;
        explain)
            melvin_cmd_explain "$@"
            ;;
        classify)
            melvin_cmd_classify "$@"
            ;;
        list)
            melvin_cmd_list "$@"
            ;;

        # Knowledge commands
        concepts)
            melvin_cmd_concepts "$@"
            ;;
        pattern)
            melvin_cmd_pattern "$@"
            ;;

        # Query commands
        ask)
            melvin_cmd_ask "$@"
            ;;

        # Utility commands
        refresh)
            melvin_cmd_refresh "$@"
            ;;
        db)
            melvin_cmd_db "$@"
            ;;

        # Registry enhancement (Tetra integration)
        enhance)
            melvin_cmd_enhance "$@"
            ;;
        registry|reg)
            melvin_cmd_registry "$@"
            ;;

        # Help
        help|--help|-h)
            melvin_cmd_help
            ;;

        *)
            echo "Unknown command: $cmd"
            echo "Type 'melvin help' for available commands"
            return 1
            ;;
    esac
}

# Command implementations
# Context-aware health check
melvin_cmd_health() {
    case "$MELVIN_CONTEXT" in
        tetra)
            # Use tetra-self if available
            if [[ $MELVIN_HAS_SELF -eq 1 ]] && command -v tetra-self >/dev/null 2>&1; then
                echo "Using tetra-self for deep analysis..."
                echo ""
                tetra-self audit --modules "$@"
            else
                melvin_classification_summary
            fi

            # Add MELVIN insights for tetra
            echo ""
            melvin_analyze_tetra_health
            ;;
        *)
            melvin_classification_summary
            ;;
    esac
}

# Explain a module with teaching layer
melvin_cmd_explain() {
    local module="$1"

    if [[ -z "$module" ]]; then
        echo "Usage: melvin explain <module_name>"
        return 1
    fi

    # Show classification
    melvin_show_classification "$module"

    # Add teaching layer based on context
    if [[ "$MELVIN_CONTEXT" == "tetra" ]]; then
        echo ""
        echo "🎓 Understanding This Module:"
        local type=$(melvin_get_type "$module")
        case "$type" in
            LIBRARY)
                echo "  This is a LIBRARY - provides functions but no user commands"
                ;;
            MODULE)
                echo "  This is a MODULE - has actions.sh for user-facing commands"
                ;;
            APP)
                echo "  This is an APP - provides a TUI interface"
                ;;
        esac
    fi
}

# Classification command
melvin_cmd_classify() {
    local module="$1"

    if [[ -z "$module" ]]; then
        melvin_classification_summary
    else
        melvin_show_classification "$module"
    fi
}

# List modules
melvin_cmd_list() {
    local filter="${1:-all}"

    melvin_classify_all

    echo "Modules in $MELVIN_ROOT"
    echo "======================="
    echo ""

    if [[ "$filter" == "all" ]]; then
        for module in $(printf '%s\n' "${!MELVIN_CLASS_TYPE[@]}" | sort); do
            local type="${MELVIN_CLASS_TYPE[$module]}"
            printf "%-20s %-15s\n" "$module" "$type"
        done
    else
        melvin_list_by_type "$filter"
    fi
}

# Show concepts
melvin_cmd_concepts() {
    local concept="$1"

    if [[ -z "$concept" ]]; then
        melvin_list_concepts
        echo ""
        echo "Context: $MELVIN_CONTEXT"
        echo "Use: melvin concepts <name> for details"
    else
        # Use tetra-specific explanation if available
        if [[ "$MELVIN_CONTEXT" == "tetra" ]] && declare -f melvin_explain_tetra_concept >/dev/null 2>&1; then
            melvin_explain_tetra_concept "$concept"
        else
            melvin_explain_concept "$concept"
        fi
    fi
}

# Pattern command (alias for concepts)
melvin_cmd_pattern() {
    melvin_cmd_concepts "$@"
}

# Ask command (placeholder for future RAG implementation)
melvin_cmd_ask() {
    local query="$*"

    if [[ -z "$query" ]]; then
        echo "Usage: melvin ask <question>"
        echo ""
        echo "Examples:"
        echo "  melvin ask 'Where is the RAG module?'"
        echo "  melvin ask 'Show modules with REPL'"
        echo "  melvin ask 'Explain the includes pattern'"
        return 1
    fi

    echo "🤔 MELVIN analyzing: $query"
    echo ""

    # Simple keyword-based routing for now
    case "$query" in
        *"where is"*|*"find"*)
            echo "Searching modules..."
            melvin_classify_all
            local keywords=$(echo "$query" | grep -oE '\b[a-z_]+\b' | tail -1)
            for module in "${!MELVIN_CLASS_TYPE[@]}"; do
                if [[ "$module" =~ $keywords ]]; then
                    echo ""
                    melvin_show_classification "$module"
                fi
            done
            ;;
        *"show"*|*"list"*)
            melvin_classification_summary
            ;;
        *"explain"*|*"what is"*)
            local concept=$(echo "$query" | grep -oE '\b[a-z_]+\b' | tail -1)
            melvin_cmd_concepts "$concept"
            ;;
        *)
            echo "I understand you're asking about: $query"
            echo ""
            echo "Try these commands:"
            echo "  melvin health       - Analyze codebase"
            echo "  melvin concepts     - Learn patterns"
            echo "  melvin list         - List modules"
            ;;
    esac
}

# Refresh (rescan)
melvin_cmd_refresh() {
    echo "Refreshing MELVIN knowledge..."
    melvin_classify_all
    echo "✓ Classification refreshed"
}

# DB command
melvin_cmd_db() {
    if declare -f melvin_db_list >/dev/null 2>&1; then
        local subcmd="${1:-list}"
        shift 2>/dev/null
        case "$subcmd" in
            save) melvin_db_save "$@" ;;
            query) melvin_db_query_module "$@" ;;
            show) melvin_db_show "$@" ;;
            search) melvin_db_search "$@" ;;
            list) melvin_db_list "$@" ;;
            stats) melvin_db_stats ;;
            clean) melvin_db_clean "$@" ;;
            snapshots) melvin_db_list_snapshots "$@" ;;
            *) echo "db commands: save, query, show, search, list, stats, clean, snapshots" ;;
        esac
    else
        echo "Database not loaded"
    fi
}

# Enhance Tetra registry with MELVIN metadata
melvin_cmd_enhance() {
    if declare -f melvin_enhance_tetra_registry >/dev/null 2>&1; then
        melvin_enhance_tetra_registry "$@"
    else
        echo "Registry enhancement not loaded"
        return 1
    fi
}

# Show enhanced registry
melvin_cmd_registry() {
    if declare -f melvin_show_registry >/dev/null 2>&1; then
        melvin_show_registry "$@"
    else
        echo "Registry not loaded"
        return 1
    fi
}

# Help text
melvin_cmd_help() {
    echo "MELVIN - Universal Bash Codebase Meta-Agent"
    echo "============================================"
    echo ""
    echo "Usage: melvin [--root path] <command> [args]"
    echo ""
    echo "ANALYSIS:"
    echo "  health                Classification summary"
    echo "  explain <module>      Detailed module explanation"
    echo "  classify [module]     Show classification"
    echo "  list [type]           List modules (LIBRARY|MODULE|APP)"
    echo ""
    echo "REGISTRY (Tetra Enhancement):"
    echo "  enhance [--save]      Scan and populate TETRA_MODULE_META"
    echo "  enhance --cached      Load from most recent snapshot"
    echo "  registry [module]     Show enhanced module metadata"
    echo ""
    echo "KNOWLEDGE:"
    echo "  concepts [name]       Show/explain concepts"
    echo "  pattern <name>        Explain a pattern"
    echo "  ask '<question>'      Query MELVIN"
    echo ""
    echo "UTILITY:"
    echo "  context               Show context and root"
    echo "  refresh               Rescan codebase"
    echo "  db [cmd]              Database (save|query|list|stats)"
    echo ""
    echo "Context: $MELVIN_CONTEXT | Root: $MELVIN_ROOT"
}

# Utility: echo64 (kept from original for compatibility)
echo64() {
    if [[ $# -eq 0 ]]; then
        echo -n ""
    else
        echo -n "$@" | base64 -w 0 2>/dev/null || echo -n "$@" | base64
    fi
}

# Export functions
export -f melvin
export -f melvin_cmd_health
export -f melvin_cmd_explain
export -f melvin_cmd_classify
export -f melvin_cmd_list
export -f melvin_cmd_concepts
export -f melvin_cmd_pattern
export -f melvin_cmd_ask
export -f melvin_cmd_refresh
export -f melvin_cmd_db
export -f melvin_cmd_enhance
export -f melvin_cmd_registry
export -f melvin_cmd_help
