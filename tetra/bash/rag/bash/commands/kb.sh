#!/usr/bin/env bash
# kb.sh - Knowledge base commands

: "${RAG_SRC:=$TETRA_SRC/bash/rag}"

# ============================================================================
# KNOWLEDGE BASE COMMANDS
# ============================================================================

rag_cmd_tag() {
    # Lazy load KB manager
    rag_require_kb_manager

    local flow_id="$1"
    shift || true
    local tags=("$@")

    # If no flow_id, use active flow
    if [[ -z "$flow_id" ]]; then
        local flow_dir="$(get_active_flow_dir)"
        if [[ -n "$flow_dir" ]]; then
            flow_id=$(basename "$flow_dir")
        else
            echo "Error: No active flow" >&2
            echo "Usage: /tag [flow-id] tag1 tag2 ..." >&2
            return 1
        fi
    fi

    kb_promote "$flow_id" "${tags[@]}"
}

rag_cmd_kb() {
    # Lazy load KB manager
    rag_require_kb_manager

    local subcmd="$1"
    shift || true

    case "$subcmd" in
        list|ls|"")
            kb_list "$@"
            ;;
        view|v)
            kb_view "$@"
            ;;
        search|s)
            kb_search "$@"
            ;;
        reindex)
            kb_reindex
            echo "✓ Knowledge base reindexed"
            ;;
        *)
            echo "Usage: /kb {list|view|search|reindex}"
            echo ""
            echo "  list [tag]       List KB entries (optionally filtered by tag)"
            echo "  view <flow-id>   View KB entry with colored markdown"
            echo "  search <query>   Search KB entries"
            echo "  reindex          Rebuild search indexes"
            ;;
    esac
}

# Export functions
export -f rag_cmd_tag
export -f rag_cmd_kb
