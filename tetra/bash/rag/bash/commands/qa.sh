#!/usr/bin/env bash
# qa.sh - QA history search and retrieval commands

: "${RAG_SRC:=$TETRA_SRC/bash/rag}"

# ============================================================================
# QA COMMAND (QA history search and retrieval)
# ============================================================================

# Quick access to last QA answer (wrapper around qa module's 'a' command)
rag_cmd_a() {
    # Ensure QA modules are fully loaded (not just qa.sh, but qa_core.sh too)
    if ! command -v a >/dev/null 2>&1; then
        # Source QA module if not already loaded
        if [[ -f "$TETRA_SRC/bash/qa/qa.sh" ]]; then
            source "$TETRA_SRC/bash/qa/qa.sh"
        fi
        # Trigger lazy loading of QA sub-modules (defines 'a' function)
        if [[ "${QA_MODULES_LOADED:-false}" != "true" ]]; then
            qa_source_modules 2>/dev/null || true
            export QA_MODULES_LOADED=true
        fi
        # Final check
        if ! command -v a >/dev/null 2>&1; then
            echo "Error: QA module 'a' function not available" >&2
            echo "Try running 'qq' or 'qa' first to initialize QA system" >&2
            return 1
        fi
    fi

    # Call the qa 'a' function
    a "$@"
}

rag_cmd_qa() {
    local subcmd="$1"
    shift || true

    # Source QA retrieval module
    if [[ -f "$RAG_SRC/core/qa_retrieval.sh" ]]; then
        source "$RAG_SRC/core/qa_retrieval.sh"
    else
        echo "Error: QA retrieval module not found" >&2
        return 1
    fi

    case "$subcmd" in
        search|find|s)
            local query="$*"
            if [[ -z "$query" ]]; then
                echo "Error: Search query required" >&2
                echo "Usage: /qa search <query>" >&2
                return 1
            fi

            # Run search and display results
            local results=$(qa_retrieval_search "$query")
            if [[ $? -eq 0 ]] && [[ -n "$results" ]]; then
                echo ""
                echo "Results (score|qa_id|flow_id|created):"
                echo "========================================"
                echo "$results" | while IFS='|' read -r score qa_id flow_id created; do
                    printf "  [%d] %s" "$score" "$qa_id"
                    [[ -n "$flow_id" ]] && printf " (flow: %s)" "$flow_id"
                    [[ -n "$created" ]] && printf " - %s" "$created"
                    printf "\n"

                    # Show preview
                    qa_retrieval_show_preview "$qa_id" | sed 's/^/      /'
                    echo ""
                done
            fi
            ;;
        list|ls)
            qa_retrieval_list "$@"
            ;;
        view|show|v)
            local qa_id="$1"
            if [[ -z "$qa_id" ]]; then
                echo "Error: QA ID required" >&2
                echo "Usage: /qa view <qa_id>" >&2
                return 1
            fi

            local prompt_file="$QA_DB_DIR/$qa_id.prompt"
            local answer_file="$QA_DB_DIR/$qa_id.answer"

            if [[ ! -f "$prompt_file" ]]; then
                echo "Error: QA entry $qa_id not found" >&2
                return 1
            fi

            echo "=== QA Entry: $qa_id ==="
            echo ""
            qa_retrieval_show_preview "$qa_id"
            echo ""
            echo "--- Full Answer ---"
            if [[ -f "$answer_file" ]]; then
                cat "$answer_file"
            else
                echo "(No answer file)"
            fi
            ;;
        add)
            local qa_id="$1"
            if [[ -z "$qa_id" ]]; then
                echo "Error: QA ID required" >&2
                echo "Usage: /qa add <qa_id>" >&2
                echo ""
                echo "Tip: Use /qa search <query> to find QA IDs" >&2
                return 1
            fi

            qa_retrieval_add_evidence "$qa_id"
            ;;
        help|h|"")
            cat <<'EOF'
/qa - QA History Search and Retrieval

USAGE:
  /qa search <query>    Search QA history for relevant Q&A pairs
  /qa list [--limit N]  List recent QA entries
  /qa view <qa_id>      View full QA entry
  /qa add <qa_id>       Add QA entry as evidence to current flow

EXAMPLES:
  /qa search authentication error
  /qa list --limit 10
  /qa view 1758025638
  /qa add 1758025638

WORKFLOW:
  1. Search QA history:  /qa search "your query"
  2. View entry:         /qa view <qa_id>
  3. Add as evidence:    /qa add <qa_id>
  4. Assemble context:   /assemble
  5. Submit:             /submit @qa

This enables RAG to learn from prior Q&A interactions!
EOF
            ;;
        *)
            echo "Unknown qa subcommand: $subcmd"
            echo "Try: /qa help"
            ;;
    esac
}

# Export functions
export -f rag_cmd_a
export -f rag_cmd_qa
