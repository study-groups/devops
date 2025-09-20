#!/usr/bin/env bash

# Utils module includes
# Follow tetra convention: MOD_DIR for data, MOD_SRC for source
UTILS_DIR="${UTILS_DIR:-$TETRA_DIR/utils}"
UTILS_SRC="${UTILS_SRC:-$TETRA_SRC/bash/utils}"

# Create data directory if it doesn't exist
[[ ! -d "$UTILS_DIR" ]] && mkdir -p "$UTILS_DIR"

# Export for subprocesses
export UTILS_DIR UTILS_SRC

source "$UTILS_SRC/color.sh"
source "$UTILS_SRC/dns.sh"
source "$UTILS_SRC/nvim.sh"
source "$UTILS_SRC/path.sh"
source "$UTILS_SRC/status.sh"
source "$UTILS_SRC/ufw.sh"
source "$UTILS_SRC/xargs.sh"
source "$UTILS_SRC/module_completion.sh"
source "$UTILS_SRC/dev_modules.sh"
source "$UTILS_SRC/module_index.sh"
source "$UTILS_SRC/status_utils.sh"
