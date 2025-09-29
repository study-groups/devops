#!/usr/bin/env bash

# TSM Core Module Loader
# Loads all core TSM modules using strong globals

# Define module source directory
TSM_CORE_SRC="$TETRA_SRC/bash/tsm/core"

# Load core modules in dependency order
source "$TSM_CORE_SRC/core.sh"         # Core functions, no dependencies
source "$TSM_CORE_SRC/config.sh"       # Configuration and global state
source "$TSM_CORE_SRC/utils.sh"        # Utility functions, depends on core
source "$TSM_CORE_SRC/validation.sh"   # Validation & helpers, no dependencies
source "$TSM_CORE_SRC/environment.sh"  # Environment handling
source "$TSM_CORE_SRC/files.sh"        # File utilities
source "$TSM_CORE_SRC/helpers.sh"      # Helper functions
source "$TSM_CORE_SRC/setup.sh"        # Setup utilities