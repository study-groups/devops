#!/usr/bin/env bash
# nh_bridge - Nodeholder to Tetra Bridge Module
#
# Converts digocean.json (from Nodeholder) to Tetra infrastructure config.
# Functions use nhb_* prefix to avoid collision with standalone Nodeholder.

# Load module utilities
source "$TETRA_SRC/bash/utils/module_init.sh"
source "$TETRA_SRC/bash/utils/function_helpers.sh"

# Initialize module with standard tetra conventions
tetra_module_init_with_alias "nh_bridge" "NHB"

# Source module files
source "$NHB_SRC/nhb_bridge.sh"
source "$NHB_SRC/nhb_import.sh"
source "$NHB_SRC/nhb.sh"
source "$NHB_SRC/nhb_complete.sh"
source "$NHB_SRC/nhb_doctl.sh"
source "$NHB_SRC/nhb_api.sh"

# Module metadata (no export - bash can't export associative array elements)
TETRA_MODULE_DESC[nh_bridge]="Nodeholder bridge (import digocean.json -> tetra.toml)"
TETRA_MODULE_VERSION[nh_bridge]="2.2.0"
