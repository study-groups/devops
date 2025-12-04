#!/usr/bin/env bash
# RAG Module Includes
# Loads all RAG functionality for TCS-compliant integration

# Load module utilities
source "$TETRA_SRC/bash/utils/module_init.sh"
source "$TETRA_SRC/bash/utils/function_helpers.sh"

# Initialize module with standard tetra conventions
tetra_module_init_with_alias "rag" "RAG"

# Core RAG functionality
tetra_source_if_exists "$RAG_SRC/rag.sh"

# TCS-compliant actions (for TUI integration)
tetra_source_if_exists "$RAG_SRC/actions.sh"

# Bash completion
tetra_source_if_exists "$RAG_SRC/rag_completion.sh"

# State management
tetra_source_if_exists "$RAG_SRC/state_manager.sh"

# Extensions (if present)
tetra_source_if_exists "$RAG_SRC/rag_extensions.sh"

# Source tree help registration
tetra_source_if_exists "$RAG_SRC/rag_tree.sh"

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
