#!/usr/bin/env bash
# commands/session.sh - Session command handlers

: "${RAG_SRC:=$TETRA_SRC/bash/rag}"

# Session command handler
rag_cmd_session() {
    # Lazy load session manager
    rag_require_session_manager

    local subcmd="$1"
    shift || true

    case "$subcmd" in
        create|start)
            session_create "$@"
            ;;
        status|"")
            session_status "$@"
            ;;
        list|ls)
            session_list "$@"
            ;;
        resume|switch)
            session_resume "$@"
            ;;
        *)
            echo "Unknown session subcommand: $subcmd"
            echo "Usage: /session {create|status|list|resume}"
            echo ""
            echo "  create <desc>      Create new session"
            echo "  status             Show current session status"
            echo "  list               List all sessions"
            echo "  resume <id|index>  Resume a session"
            echo ""
            echo "A session is a workspace containing related flows."
            echo "Flows are automatically added to the current session."
            ;;
    esac
}

export -f rag_cmd_session
