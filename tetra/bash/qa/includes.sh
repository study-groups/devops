#!/usr/bin/env bash

# QA Module Includes - Controls what gets loaded for QA functionality

# Follow tetra convention: MOD_DIR for data, MOD_SRC for source
QA_DIR="${QA_DIR:-$TETRA_DIR/qa}"
QA_SRC="${QA_SRC:-$TETRA_SRC/bash/qa}"

# Create data directory if it doesn't exist
[[ ! -d "$QA_DIR" ]] && mkdir -p "$QA_DIR"

# Export for subprocesses
export QA_DIR QA_SRC

# Source the main QA module
source "$QA_SRC/qa.sh"
