#!/usr/bin/env bash
# CDP Module Entry Point - Chrome DevTools Protocol
# First-class tetra module (moved from bash/rag/cdp)

# Initialize as module
CDP_SRC="$TETRA_SRC/bash/cdp"
CDP_DIR="$TETRA_DIR/cdp"
[[ ! -d "$CDP_DIR" ]] && mkdir -p "$CDP_DIR"

# Source core CDP functionality
source "$CDP_SRC/cdp_paths.sh"
source "$CDP_SRC/cdp.sh"
