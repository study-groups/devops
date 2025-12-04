#!/usr/bin/env bash

# TDS Module - Tetra Display System
# Module loader for Tetra module system

# Load module utilities
source "$TETRA_SRC/bash/utils/module_init.sh"
source "$TETRA_SRC/bash/utils/function_helpers.sh"

# Initialize module with standard tetra conventions
tetra_module_init_with_alias "tds" "TDS"

# Source the main TDS script
source "$TDS_SRC/tds.sh"
