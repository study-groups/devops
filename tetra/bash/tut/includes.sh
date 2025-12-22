#!/usr/bin/env bash
# TUT Module - Org Documentation Wrapper for Terrain
#
# Manages JSON documentation sources for orgs.
# Delegates rendering/theming to Terrain.

# Load module utilities
source "$TETRA_SRC/bash/utils/module_init.sh"

# Initialize module
tetra_module_init_with_alias "tut" "TUT"

# Context integration
source "$TUT_SRC/tut_ctx.sh"

# Main CLI
source "$TUT_SRC/tut.sh"

# Tab completion
tetra_source_if_exists "$TUT_SRC/tut_complete.sh"
