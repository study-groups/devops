#!/usr/bin/env bash
# RAG Module TCS-Compliant Actions
# Follows Tetra Module Convention 2.0 and TCS 3.0

# Import RAG functionality
: "${RAG_SRC:=$TETRA_SRC/bash/rag}"
source "$RAG_SRC/rag.sh" 2>/dev/null || true
source "$RAG_SRC/core/utils/agents.sh" 2>/dev/null || true

# Register RAG actions with TUI
rag_register_actions() {
    # Ensure declare_action exists (from demo 014/013)
    if ! declare -f declare_action >/dev/null 2>&1; then
        echo "Warning: declare_action not available" >&2
        return 1
    fi

    # Query local ULM model for semantic code search
    declare_action "query_ulm" \
        "verb=query" \
        "noun=ulm" \
        "exec_at=@local" \
        "contexts=Local" \
        "modes=Inspect" \
        "tes_operation=local" \
        "inputs=query_text,path" \
        "output=@tui[content]" \
        "immediate=true" \
        "can=Search codebase using ULM semantic ranking" \
        "cannot=Modify files or make API calls"

    # Query QA via LLM API
    declare_action "query_qa" \
        "verb=query" \
        "noun=qa" \
        "exec_at=@local" \
        "contexts=Local" \
        "modes=Inspect" \
        "tes_operation=local" \
        "inputs=question" \
        "output=@tui[content]" \
        "effects=@rag[db/timestamp.answer]" \
        "immediate=false" \
        "can=Ask question via LLM API, store in qa/db/" \
        "cannot=Query without API key configured"

    # List recent queries
    declare_action "list_queries" \
        "verb=list" \
        "noun=queries" \
        "exec_at=@local" \
        "contexts=Local" \
        "modes=Inspect" \
        "tes_operation=local" \
        "output=@tui[content]" \
        "immediate=true" \
        "can=Show recent ULM and QA queries from logs" \
        "cannot=Modify or delete query history"

    # Set LLM agent for multicat
    declare_action "set_agent" \
        "verb=set" \
        "noun=agent" \
        "exec_at=@local" \
        "contexts=Local" \
        "modes=Execute" \
        "tes_operation=local" \
        "inputs=agent_name" \
        "output=@tui[status]" \
        "effects=@rag[config/agent]" \
        "immediate=true" \
        "can=Set LLM agent (base/openai/claude-code/chatgpt)" \
        "cannot=Create or modify agent profiles"

    # Generate MULTICAT context with ULM ranking
    declare_action "generate_context" \
        "verb=generate" \
        "noun=context" \
        "exec_at=@local" \
        "contexts=Local" \
        "modes=Execute" \
        "tes_operation=local" \
        "inputs=ulm_query,agent,path" \
        "output=@app[stdout]" \
        "effects=@rag[cache/context.mc]" \
        "immediate=false" \
        "can=Generate MULTICAT with ULM-ranked files for agent" \
        "cannot=Modify source files"

    # List available agents
    declare_action "list_agents" \
        "verb=list" \
        "noun=agents" \
        "exec_at=@local" \
        "contexts=Local" \
        "modes=Inspect" \
        "tes_operation=local" \
        "output=@tui[content]" \
        "immediate=true" \
        "can=List available LLM agent profiles" \
        "cannot=Modify agent configurations"
}

# Execute RAG actions
rag_execute_action() {
    local action="$1"
    shift
    local args=("$@")

    case "$action" in
        query:ulm)
            local query="${args[0]}"
            local path="${args[1]:-.}"

            if [[ -z "$query" ]]; then
                echo "Error: query_text required"
                return 1
            fi

            # Use ULM for semantic search
            if [[ -x "$TETRA_SRC/bash/ulm/ulm.sh" ]]; then
                "$TETRA_SRC/bash/ulm/ulm.sh" rank "$query" "$path" --algorithm multi_head --top 20
            else
                echo "Error: ULM not found at $TETRA_SRC/bash/ulm/ulm.sh"
                return 1
            fi
            ;;

        query:qa)
            local question="${args[0]}"

            if [[ -z "$question" ]]; then
                echo "Error: question required"
                return 1
            fi

            # Use existing RAG QA functionality
            if declare -f rag_query >/dev/null 2>&1; then
                rag_query "$question"
            else
                echo "Error: rag_query function not available"
                echo "Ensure rag.sh is sourced"
                return 1
            fi
            ;;

        list:queries)
            # Show recent queries from logs
            local log_file="${TETRA_DIR}/logs/tetra.jsonl"

            if [[ -f "$log_file" ]]; then
                echo "Recent RAG Queries:"
                echo "─────────────────────────────────────"
                grep '"module":"rag"' "$log_file" 2>/dev/null | \
                    tail -10 | \
                    jq -r '"\(.timestamp) | \(.verb):\(.subject) | \(.status)"' 2>/dev/null || \
                    echo "No queries found (jq not available)"
            else
                echo "No query log found at $log_file"
            fi
            ;;

        set:agent)
            local agent_name="${args[0]}"

            if [[ -z "$agent_name" ]]; then
                echo "Error: agent_name required"
                echo "Available: base, openai, claude-code, chatgpt"
                return 1
            fi

            # Validate agent exists
            local sys_dir="$TETRA_SRC/bash/rag/agents"
            local user_dir="${TETRA_DIR:-$HOME/.tetra}/rag/agents"

            if [[ -f "$sys_dir/$agent_name.conf" ]] || [[ -f "$user_dir/$agent_name.conf" ]]; then
                # Store preference
                mkdir -p "${TETRA_DIR}/rag/config"
                echo "$agent_name" > "${TETRA_DIR}/rag/config/agent"
                echo "✓ Agent set to: $agent_name"
            else
                echo "Error: Agent not found: $agent_name"
                echo ""
                echo "Available agents:"
                list_available_agents "simple"
                return 1
            fi
            ;;

        generate:context)
            local ulm_query="${args[0]}"
            local agent="${args[1]:-base}"
            local path="${args[2]:-.}"

            if [[ -z "$ulm_query" ]]; then
                echo "Error: ulm_query required"
                return 1
            fi

            # Generate MULTICAT using ULM ranking + agent profile
            "$TETRA_SRC/bash/rag/core/multicat/multicat.sh" \
                --agent "$agent" \
                --ulm-rank "$ulm_query" \
                --ulm-top 20 \
                -r \
                "$path"
            ;;

        list:agents)
            list_available_agents "simple"
            ;;

        *)
            echo "Unknown action: $action"
            return 1
            ;;
    esac
}

export -f rag_register_actions
export -f rag_execute_action
export -f list_available_agents
