#!/usr/bin/env bash
# boot_spaces.sh - Auto-load spaces utilities during tetra initialization
# Part of tetra boot sequence

# Load DO Spaces helpers
if [[ -f "$TETRA_SRC/bash/deploy/do-spaces.sh" ]]; then
    source "$TETRA_SRC/bash/deploy/do-spaces.sh"
fi

# Load Spaces module (TES resolution)
if [[ -f "$TETRA_SRC/bash/spaces/spaces.sh" ]]; then
    source "$TETRA_SRC/bash/spaces/spaces.sh"
fi

# Note: spaces_repl.sh is NOT auto-loaded (only load on demand)
# To start: spaces_repl or source $TETRA_SRC/bash/spaces/spaces_repl.sh

# Set flag for other modules to check
export TETRA_SPACES_LOADED=1
