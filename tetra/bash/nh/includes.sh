#!/usr/bin/env bash
# NodeHolder Bridge Module Includes

# Load module utilities
source "$TETRA_SRC/bash/utils/module_init.sh"
source "$TETRA_SRC/bash/utils/function_helpers.sh"

# Initialize module with standard tetra conventions
tetra_module_init_with_alias "nh" "NH"

# Source bridge functions
source "$NH_SRC/nh_bridge.sh"
tetra_source_if_exists "$NH_SRC/nh_import.sh"

# Module metadata
export TETRA_MODULE_DESC[nh]="NodeHolder bridge (import digocean.json -> tetra.toml)"
export TETRA_MODULE_VERSION[nh]="2.0.0"
