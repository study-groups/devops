#!/usr/bin/env bash

# Utils module includes

# Load module utilities (bootstrap - utils can't depend on itself for init)
# Manually set paths since module_init.sh is in this directory
UTILS_SRC="$TETRA_SRC/bash/utils"
UTILS_DIR="$TETRA_DIR/utils"
[[ ! -d "$UTILS_DIR" ]] && mkdir -p "$UTILS_DIR"
export UTILS_SRC UTILS_DIR

# Now source the utilities that other modules will use
source "$UTILS_SRC/module_init.sh"
source "$UTILS_SRC/function_helpers.sh"
source "$UTILS_SRC/kv_store.sh"          # Exportable key-value (replaces assoc arrays)
source "$UTILS_SRC/module_state.sh"       # Function state tracking
source "$UTILS_SRC/color_constants.sh"

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
source "$UTILS_SRC/tetra_env.sh"
