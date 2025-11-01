#!/usr/bin/env bash
# RAG Module Includes
# Loads all RAG functionality for TCS-compliant integration

: "${RAG_SRC:=$TETRA_SRC/bash/rag}"

# Core RAG functionality
[[ -f "$RAG_SRC/rag.sh" ]] && source "$RAG_SRC/rag.sh"

# TCS-compliant actions (for TUI integration)
[[ -f "$RAG_SRC/actions.sh" ]] && source "$RAG_SRC/actions.sh"

# Bash completion
[[ -f "$RAG_SRC/rag_completion.sh" ]] && source "$RAG_SRC/rag_completion.sh"

# State management
[[ -f "$RAG_SRC/state_manager.sh" ]] && source "$RAG_SRC/state_manager.sh"

# Extensions (if present)
[[ -f "$RAG_SRC/rag_extensions.sh" ]] && source "$RAG_SRC/rag_extensions.sh"

# Register rag actions with action registry
if [[ -f "$TETRA_SRC/bash/actions/registry.sh" ]]; then
    source "$TETRA_SRC/bash/actions/registry.sh"

    # Query actions
    action_register "rag" "query.ulm" "Search codebase using ULM semantic ranking" "<query> [path]" "no"
    action_register "rag" "query.qa" "Ask question via LLM API" "<question>" "no"
    action_register "rag" "list.queries" "Show recent ULM and QA queries" "" "no"

    # Agent actions
    action_register "rag" "set.agent" "Set LLM agent (base/openai/claude-code/chatgpt)" "<agent_name>" "no"
    action_register "rag" "list.agents" "List available LLM agent profiles" "" "no"

    # Context generation
    action_register "rag" "generate.context" "Generate MULTICAT with ULM-ranked files" "<ulm_query> <agent> [path]" "no"
fi
