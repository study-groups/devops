#!/usr/bin/env bash
# deploy/includes.sh - Module loader for deploy
# Follows tetra module pattern from MODULE_SYSTEM_SPECIFICATION.md

# Load module utilities
source "$TETRA_SRC/bash/utils/module_init.sh"
source "$TETRA_SRC/bash/utils/function_helpers.sh"

# Initialize module with standard tetra conventions
tetra_module_init_with_alias "deploy" "DEPLOY" "projects:logs:history"

# Source dependencies
tetra_source_if_exists "${TETRA_SRC}/bash/org/org.sh"

# Source deploy modules
source "$MOD_SRC/deploy.sh"
tetra_source_if_exists "$MOD_SRC/deploy_projects.sh"
tetra_source_if_exists "$MOD_SRC/deploy_remote.sh"
tetra_source_if_exists "$MOD_SRC/deploy_complete.sh"

# Register completion
complete -F _deploy_complete deploy
