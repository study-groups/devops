#!/usr/bin/env bash

# Prompt module includes
# Follow tetra convention: MOD_DIR for data, MOD_SRC for source
PROMPT_DIR="${PROMPT_DIR:-$TETRA_DIR/prompt}"
PROMPT_SRC="${PROMPT_SRC:-$TETRA_SRC/bash/prompt}"

# Create data directory if it doesn't exist
[[ ! -d "$PROMPT_DIR" ]] && mkdir -p "$PROMPT_DIR"

# Export for subprocesses
export PROMPT_DIR PROMPT_SRC

source "$PROMPT_SRC/prompt.sh"
