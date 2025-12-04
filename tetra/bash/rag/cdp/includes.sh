#!/usr/bin/env bash
# CDP Module Entry Point - Chrome DevTools Protocol
# Submodule of RAG

# Load module utilities
source "$TETRA_SRC/bash/utils/module_init.sh"
source "$TETRA_SRC/bash/utils/function_helpers.sh"

# Initialize as submodule of RAG
CDP_SRC="$TETRA_SRC/bash/rag/cdp"
CDP_DIR="$TETRA_DIR/rag/cdp"
[[ ! -d "$CDP_DIR" ]] && mkdir -p "$CDP_DIR"
export CDP_SRC CDP_DIR

# Source core CDP functionality
source "$CDP_SRC/cdp_paths.sh"
source "$CDP_SRC/cdp.sh"

# Source actions if in TUI environment
tetra_call_if_exists declare_action && source "$CDP_SRC/actions.sh"
