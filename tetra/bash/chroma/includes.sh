#!/usr/bin/env bash

# Chroma Module - Terminal Markdown Viewer
# Module loader for Tetra module system

CHROMA_SRC="${CHROMA_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
export CHROMA_SRC

CHROMA_DIR="${CHROMA_DIR:-$TETRA_DIR/chroma}"
export CHROMA_DIR

# Load TDS module first (chroma depends on it)
# Check if TDS functions are actually loaded, not just the flag
if [[ $(type -t tds_markdown) != "function" ]]; then
    tetra_load_module "tds" || {
        echo "Error: Failed to load TDS module (required by chroma)" >&2
        return 1
    }
fi

# Source the main chroma script
source "$CHROMA_SRC/chroma.sh"
