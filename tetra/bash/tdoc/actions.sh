#!/usr/bin/env name bash

# TDOC Module - TUI Action Declarations
# Minimal read-only actions for demo 014 integration

# Module must be sourced first
TDOC_ACTIONS_DIR="$(dirname "${BASH_SOURCE[0]}")"
if [[ ! -f "$TDOC_ACTIONS_DIR/tdoc.sh" ]]; then
    echo "Error: tdoc module not found" >&2
    return 1
fi

# Import tdoc functionality
source "$TDOC_ACTIONS_DIR/includes.sh"

# Register actions with TUI
tdoc_register_actions() {
    # Ensure declare_action exists (from demo 014/013)
    if ! declare -f declare_action >/dev/null 2>&1; then
        echo "Warning: declare_action not available, skipping tdoc action registration" >&2
        return 1
    fi

    # List core documentation
    declare_action "list_core_docs" \
        "verb=list" \
        "noun=docs" \
        "exec_at=@local" \
        "contexts=Local" \
        "modes=Inspect" \
        "tes_operation=local" \
        "output=@tui[content]" \
        "immediate=true" \
        "can=List all core documentation with color-coded metadata" \
        "cannot=Modify or create documents"

    # View document with color preview
    declare_action "view_doc" \
        "verb=view" \
        "noun=doc" \
        "exec_at=@local" \
        "contexts=Local" \
        "modes=Inspect" \
        "tes_operation=local" \
        "inputs=doc_path" \
        "output=@tui[content]" \
        "immediate=true" \
        "can=Preview document with TDS color rendering and metadata" \
        "cannot=Edit document content"

    # List module documentation
    declare_action "list_module_docs" \
        "verb=list" \
        "noun=module_docs" \
        "exec_at=@local" \
        "contexts=Local" \
        "modes=Inspect" \
        "tes_operation=local" \
        "inputs=module_name" \
        "output=@tui[content]" \
        "immediate=true" \
        "can=List documentation for a specific module" \
        "cannot=Modify documents"

    # Search documentation
    declare_action "search_docs" \
        "verb=search" \
        "noun=docs" \
        "exec_at=@local" \
        "contexts=Local" \
        "modes=Inspect" \
        "tes_operation=local" \
        "inputs=query" \
        "output=@tui[content]" \
        "immediate=false" \
        "can=Full-text search across all documentation" \
        "cannot=Modify search index"
}

# Execute tdoc actions
tdoc_execute_action() {
    local action="$1"
    shift
    local args=("$@")

    case "$action" in
        list:docs)
            # List core documents
            echo "Core Documentation"
            echo "════════════════════════════════════════════════════════"
            echo ""
            tdoc_list_docs --core
            ;;

        view:doc)
            local doc_path="${args[0]}"

            if [[ -z "$doc_path" ]]; then
                echo "Error: doc_path required"
                echo ""
                echo "Usage: view:doc <path>"
                return 1
            fi

            if [[ ! -f "$doc_path" ]]; then
                echo "Error: File not found: $doc_path"
                return 1
            fi

            # View with color preview
            tdoc_view_doc "$doc_path"
            ;;

        list:module_docs)
            local module_name="${args[0]}"

            if [[ -z "$module_name" ]]; then
                echo "Error: module_name required"
                echo ""
                echo "Usage: list:module_docs <module>"
                echo "Example: list:module_docs rag"
                return 1
            fi

            echo "Documentation for module: $module_name"
            echo "════════════════════════════════════════════════════════"
            echo ""
            tdoc_list_docs --module "$module_name"
            ;;

        search:docs)
            local query="${args[0]}"

            if [[ -z "$query" ]]; then
                echo "Error: query required"
                echo ""
                echo "Usage: search:docs <query>"
                return 1
            fi

            echo "Searching documentation..."
            echo "════════════════════════════════════════════════════════"
            echo ""
            tdoc_search_docs "$query"
            ;;

        *)
            echo "Unknown tdoc action: $action"
            return 1
            ;;
    esac
}

# Export for module discovery system
export -f tdoc_register_actions
export -f tdoc_execute_action
