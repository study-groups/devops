#!/usr/bin/env bash

# TSM Remote Module - Entry Point
# Enables remote TSM execution via tetra.toml endpoints

# Load module utilities
source "$TETRA_SRC/bash/utils/module_init.sh"
source "$TETRA_SRC/bash/utils/function_helpers.sh"

# Initialize as submodule of TSM
TSM_REMOTE_SRC="$TETRA_SRC/bash/tsm/remote"
TSM_REMOTE_DIR="$TETRA_DIR/tsm/remote"
[[ ! -d "$TSM_REMOTE_DIR" ]] && mkdir -p "$TSM_REMOTE_DIR"
export TSM_REMOTE_SRC TSM_REMOTE_DIR

# Source main remote functionality
source "$TSM_REMOTE_SRC/tsm_remote.sh"
