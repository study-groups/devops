#!/usr/bin/env bash

# MSC Module - Message Sequence Chart Generator
# Entry point following Tetra Module Convention v2.0

# Load module utilities
source "$TETRA_SRC/bash/utils/module_init.sh"
source "$TETRA_SRC/bash/utils/function_helpers.sh"

# Initialize module with standard tetra conventions
tetra_module_init_with_alias "msc" "MSC" "logs:exports"

# Load core MSC library
source "$MSC_SRC/msc.sh"
source "$MSC_SRC/msc_layout.sh"
source "$MSC_SRC/msc_render.sh"
