#!/usr/bin/env bash

# TKM module includes - Tetra Kubernetes Manager

# Load module utilities
source "$TETRA_SRC/bash/utils/module_init.sh"
source "$TETRA_SRC/bash/utils/function_helpers.sh"

# Initialize module with standard tetra conventions
tetra_module_init_with_alias "tkm" "TKM"

source "$TKM_SRC/tkm.sh"
