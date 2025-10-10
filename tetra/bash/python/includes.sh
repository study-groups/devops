#!/usr/bin/env bash

# python module includes
# Follow tetra convention: MOD_DIR for data, MOD_SRC for source
PYTHON_DIR="${PYTHON_DIR:-$TETRA_DIR/python}"
PYTHON_SRC="${PYTHON_SRC:-$TETRA_SRC/bash/python}"

# Create data directory if it doesn't exist
[[ ! -d "$PYTHON_DIR" ]] && mkdir -p "$PYTHON_DIR"

# Export for subprocesses
export PYTHON_DIR PYTHON_SRC

source "$PYTHON_SRC/python.sh"
