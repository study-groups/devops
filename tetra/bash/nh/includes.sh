#!/usr/bin/env bash
# NodeHolder Bridge Module Includes

NH_SRC="${NH_SRC:-$TETRA_SRC/bash/nh}"

# Source bridge functions
source "$NH_SRC/nh_bridge.sh"

# Module is loaded
export TETRA_MODULE_LOADED[nh]="true"
export TETRA_MODULE_PATH[nh]="$NH_SRC"

# Module metadata
export TETRA_MODULE_DESC[nh]="NodeHolder bridge (helpers, not duplication)"
export TETRA_MODULE_VERSION[nh]="1.0.0"
