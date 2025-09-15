#!/usr/bin/env bash
# RAG Tools Bootstrap - Following TETRA pattern
# Usage: Explicitly load when needed

# Set RAG_SRC if not already set
if [ -z "$RAG_SRC" ]; then
    RAG_SRC="${1:-$HOME/src/bash/rag}"
fi

# Set RAG_DIR if not already set 
[ -z "$RAG_DIR" ] && RAG_DIR="$HOME/.rag"

# Create storage directory if it doesn't exist
[[ ! -d "$RAG_DIR" ]] && mkdir -p "$RAG_DIR"

# NO AUTOMATIC SOURCING
# USE EXPLICIT LOADING WHEN NEEDED

# Function to manually load RAG tools
rag_load_tools() {
    local SCRIPTS_TO_SOURCE=(
        "$RAG_SRC/bash/rag_cursor.sh"
        "$RAG_SRC/bash/rag_mcursor.sh"
        "$RAG_SRC/bash/rag_repl.sh"
        "$RAG_SRC/bash/aliases.sh"
    )

    for script in "${SCRIPTS_TO_SOURCE[@]}"; do
        [ -f "$script" ] && source "$script"
    done
}

# Export all RAG_ environment variables
for var in $(compgen -v | grep '^RAG_'); do
   export "$var=${!var}"
done

# NO AUTOMATIC MESSAGES OR STARTUP