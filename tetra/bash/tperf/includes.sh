#!/usr/bin/env bash
# tperf module includes

# Load module utilities
source "$TETRA_SRC/bash/utils/module_init.sh"
source "$TETRA_SRC/bash/utils/function_helpers.sh"

# Initialize module with standard tetra conventions
tetra_module_init_with_alias "tperf" "TPERF"

# Load main tperf module
source "$TPERF_SRC/tperf.sh"

# Load help tree integration if tree module is actually loaded (not just lazy stub)
# Check for TREE_TYPE which is only set when tree core is actually loaded
if [[ -v TREE_TYPE ]]; then
    tetra_source_if_exists "$TPERF_SRC/tperf_help.sh"
fi
