#!/usr/bin/env bash
# tperf module includes

TPERF_DIR="${TPERF_DIR:-$TETRA_DIR/tperf}"
TPERF_SRC="${TPERF_SRC:-$TETRA_SRC/bash/tperf}"

# Create data directory if it doesn't exist
[[ ! -d "$TPERF_DIR" ]] && mkdir -p "$TPERF_DIR"

# Export for subprocesses
export TPERF_DIR TPERF_SRC

# Load main tperf module
source "$TPERF_SRC/tperf.sh"

# Load help tree integration if tree module is actually loaded (not just lazy stub)
# Check for TREE_TYPE which is only set when tree core is actually loaded
if [[ -v TREE_TYPE ]]; then
    source "$TPERF_SRC/tperf_help.sh"
fi
