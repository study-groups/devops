#!/usr/bin/env bash

# TSM Remote Module - Entry Point
# Enables remote TSM execution via tetra.toml endpoints

# Set module paths
MOD_SRC="$TETRA_SRC/bash/tsm/remote"
MOD_DIR="$TETRA_DIR/tsm/remote"

# Source main remote functionality
source "$MOD_SRC/tsm_remote.sh"

# Module initialization
tsm_remote_init() {
    # Create runtime directory if needed
    [[ ! -d "$MOD_DIR" ]] && mkdir -p "$MOD_DIR"

    # Note: org module check happens at runtime in tsm_remote()
    # Functions are always available, but will fail gracefully if org not loaded

    return 0
}

# Run initialization
tsm_remote_init
