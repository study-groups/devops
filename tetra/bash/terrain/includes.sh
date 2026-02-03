#!/usr/bin/env bash
# TERRAIN Module - UI Platform Build System
#
# Provides terrain build commands for generating HTML from config.

# Load module utilities
source "$TETRA_SRC/bash/utils/module_init.sh"
source "$TETRA_SRC/bash/utils/function_helpers.sh"

# Initialize module with standard tetra conventions
tetra_module_init_with_alias "terrain" "TERRAIN" "dist:generated"

# Source TOK for JSON utilities
source "$TETRA_SRC/bash/tok/includes.sh"

# Core modules
source "$TERRAIN_SRC/core/config.sh"
source "$TERRAIN_SRC/core/build.sh"
source "$TERRAIN_SRC/core/doc.sh"
source "$TERRAIN_SRC/core/local.sh"

# Main CLI
source "$TERRAIN_SRC/terrain.sh"

# Tab completion
tetra_source_if_exists "$TERRAIN_SRC/terrain_complete.sh"
