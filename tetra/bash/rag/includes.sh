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
