#!/usr/bin/env bash
# Tetra Entry Point - Sources local config then bootloader
# TETRA_DIR: Dynamically set to this file's directory (~/tetra)
# TETRA_SRC: Defaults to ~/src/devops/tetra but allows override
TETRA_DIR=/Users/mricos/tetra
TETRA_SRC="${TETRA_SRC:-$HOME/src/devops/tetra}"
export TETRA_DIR
export TETRA_SRC
#source $TETRA_DIR/local.sh
source "$TETRA_SRC/bash/bootloader.sh"
