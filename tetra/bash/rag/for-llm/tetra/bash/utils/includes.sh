#!/usr/bin/env bash

# Utils module includes
# Use TETRA_SRC if available, otherwise derive from script location
if [[ -n "$TETRA_SRC" ]]; then
    UTILS_DIR="$TETRA_SRC/bash/utils"
else
    UTILS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

source "$UTILS_DIR/color.sh"
source "$UTILS_DIR/dns.sh"
source "$UTILS_DIR/nvim.sh"
source "$UTILS_DIR/path.sh"
source "$UTILS_DIR/status.sh"
source "$UTILS_DIR/ufw.sh"
source "$UTILS_DIR/xargs.sh"
source "$UTILS_DIR/module_completion.sh"
source "$UTILS_DIR/dev_modules.sh"
source "$UTILS_DIR/module_index.sh"
