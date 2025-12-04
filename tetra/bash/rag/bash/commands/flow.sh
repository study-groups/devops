#!/usr/bin/env bash
# commands/flow.sh - Flow command handlers

: "${RAG_SRC:=$TETRA_SRC/bash/rag}"

# Flow command handler
rag_cmd_flow() {
    # Lazy load flow manager
    rag_require_flow_manager

    local subcmd="$1"
    shift || true

    case "$subcmd" in
        create|start)
            flow_create "$@"
            ;;
        status|"")
            flow_status "$@"
            ;;
        inspect|i)
            flow_inspect "$@"
            ;;
        list)
            # Check for --global or --all flag
            local show_global=false
            local show_all=false

            while [[ $# -gt 0 ]]; do
                case "$1" in
                    --global|-g)
                        show_global=true
                        shift
                        ;;
                    --all|-a)
                        show_all=true
                        shift
                        ;;
                    *)
                        shift
                        ;;
                esac
            done

            if [[ "$show_all" == "true" ]]; then
                flow_list_all
            elif [[ "$show_global" == "true" ]]; then
                flow_list "" true
            else
                flow_list "" false
            fi
            ;;
        resume)
            flow_resume "$@"
            ;;
        promote)
            flow_promote "$@"
            ;;
        *)
            echo "Unknown flow subcommand: $subcmd"
            echo "Usage: /flow {create|status|inspect|list|resume|promote}"
            echo ""
            echo "  create <desc>      Create new flow (local)"
            echo "  status             Show current flow status"
            echo "  inspect            Show detailed flow info (tokens, summaries, QA link)"
            echo "  list [--all|-a]    List flows (--all shows both local and global)"
            echo "  list --global|-g   List only global flows"
            echo "  resume <id>        Resume a flow"
            echo "  promote [id]       Promote flow to global"
            ;;
    esac
}

export -f rag_cmd_flow
