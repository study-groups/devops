#!/usr/bin/env bash

# Prompt module includes
# Use TETRA_SRC if available, otherwise derive from script location
if [[ -n "$TETRA_SRC" ]]; then
    PROMPT_DIR="$TETRA_SRC/bash/prompt"
else
    PROMPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

source "$PROMPT_DIR/prompt.sh"
