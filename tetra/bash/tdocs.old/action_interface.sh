#!/usr/bin/env bash

# TDOCS Action Interface
# Mode-Module-REPL integration for TUI and action discovery

# Get context-aware actions based on Environment and Mode
# Args: $1 = env (Local, Remote, etc.)
#       $2 = mode (Inspect, Execute, Admin, etc.)
# Returns: Space-separated list of verb:noun actions
tdocs_get_actions() {
    local env="${1:-Local}"
    local mode="${2:-Inspect}"

    case "$env:$mode" in
        "Local:Inspect")
            # Read-only inspection actions
            echo "view:docs list:docs search:docs view:doc evidence:docs about:tdocs audit:docs"
            ;;

        "Local:Execute")
            # Write/modification actions
            echo "init:doc tag:doc discover:docs chuck:response index:docs"
            ;;

        "Local:Navigate")
            # Interactive navigation
            echo "browse:docs"
            ;;

        "Local:Admin")
            # Administrative actions
            echo "index:rebuild audit:metadata discover:files"
            ;;

        *)
            # Default: return all actions
            echo "view:doc list:docs search:docs init:doc tag:doc discover:docs evidence:docs audit:docs index:docs browse:docs chuck:response about:tdocs"
            ;;
    esac
}

# Execute an action
# Args: $1 = action (e.g., "view:doc" or "list:docs")
#       $@ = remaining args passed to handler
# Returns: Result of action execution
tdocs_execute_action() {
    local action="$1"
    shift

    case "$action" in
        # View actions
        view:doc)
            tdocs_view_doc "$@"
            ;;

        view:docs|list:docs)
            tdocs_ls_docs "$@"
            ;;

        # Search actions
        search:docs)
            tdocs_search_docs "$@"
            ;;

        evidence:docs)
            tdocs_evidence_for_query "$@"
            ;;

        # Modification actions
        init:doc)
            tdocs_init_doc "$@"
            ;;

        tag:doc)
            tdocs_tag_interactive "$@"
            ;;

        # Discovery actions
        discover:docs|discover:files)
            tdocs_discover_docs "$@"
            ;;

        # Audit actions
        audit:docs|audit:metadata)
            tdocs_audit_docs "$@"
            ;;

        # Index actions
        index:docs)
            case "${1:-}" in
                --rebuild|rebuild)
                    tdocs_index_rebuild
                    ;;
                *)
                    tdocs_index_status
                    ;;
            esac
            ;;

        index:rebuild)
            tdocs_index_rebuild
            ;;

        # Navigation actions
        browse:docs)
            source "$TDOCS_SRC/tdocs_repl.sh"
            tdocs_repl "$@"
            ;;

        # Chuck actions
        chuck:response)
            tdoc_action_chuck "$@"
            ;;

        # Info actions
        about:tdocs)
            tdocs_about "$@"
            ;;

        *)
            echo "Unknown action: $action" >&2
            echo "Available actions:" >&2
            echo "  $(tdocs_get_actions Local Inspect)" >&2
            echo "  $(tdocs_get_actions Local Execute)" >&2
            return 1
            ;;
    esac
}

# Get action description
# Args: $1 = action (e.g., "view:doc")
# Returns: Human-readable description
tdocs_action_description() {
    local action="$1"

    case "$action" in
        view:doc)
            echo "Preview document with color rendering and metadata"
            ;;
        list:docs|view:docs)
            echo "List tracked documents with filters and preview"
            ;;
        search:docs)
            echo "Full-text search across all documents"
            ;;
        evidence:docs)
            echo "Get evidence-weighted document list for RAG"
            ;;
        init:doc)
            echo "Initialize document with metadata (interactive or non-interactive)"
            ;;
        tag:doc)
            echo "Interactive tag editor for documents"
            ;;
        discover:docs|discover:files)
            echo "Scan for undocumented markdown files and optionally initialize them"
            ;;
        audit:docs|audit:metadata)
            echo "Find documents without metadata"
            ;;
        index:docs|index:rebuild)
            echo "Show or rebuild document indexes"
            ;;
        browse:docs)
            echo "Launch interactive REPL for browsing documents"
            ;;
        chuck:response)
            echo "Capture LLM responses as lower-grade technical documentation"
            ;;
        about:tdocs)
            echo "Show comprehensive tdocs documentation and usage guide"
            ;;
        *)
            echo "Unknown action"
            ;;
    esac
}

# Check if action can execute
# Args: $1 = action
# Returns: 0 if can execute, 1 if cannot
tdocs_action_can_execute() {
    local action="$1"

    # Check if required functions exist
    case "$action" in
        view:doc|view:docs|list:docs)
            declare -F tdocs_view_doc >/dev/null 2>&1
            ;;
        search:docs)
            declare -F tdocs_search_docs >/dev/null 2>&1
            ;;
        init:doc)
            declare -F tdocs_init_doc >/dev/null 2>&1
            ;;
        browse:docs)
            [[ -f "$TDOCS_SRC/tdocs_repl.sh" ]]
            ;;
        *)
            # Default: assume can execute
            return 0
            ;;
    esac
}

# Export functions
export -f tdocs_get_actions
export -f tdocs_execute_action
export -f tdocs_action_description
export -f tdocs_action_can_execute
