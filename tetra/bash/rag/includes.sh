#!/usr/bin/env bash

# RAG Module Includes - Controls what gets loaded for RAG functionality

# TETRA_SRC should never be redefined - it points to the tetra project root
# Use TETRA_BASH for the bash directory
: "${TETRA_BASH:=$TETRA_SRC/bash}"

# Set RAG module variables with proper override guards
: "${RAG_SRC:=$TETRA_BASH/rag}"
: "${RAG_DIR:=$TETRA_DIR/rag}"

# Source the main RAG module
source "$RAG_SRC/rag.sh"

# Export RAG module variables
export RAG_SRC RAG_DIR
