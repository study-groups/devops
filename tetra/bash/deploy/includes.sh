#!/usr/bin/env bash
# deploy/includes.sh - Module loader for deploy
# Follows tetra module pattern from MODULE_SYSTEM_SPECIFICATION.md

# Strong globals (per CLAUDE.md)
MOD_SRC="${TETRA_SRC}/bash/deploy"
MOD_DIR="${TETRA_DIR}/deploy"

# Create runtime directories
mkdir -p "$MOD_DIR"/{projects,logs,history}

# Source dependencies
source "${TETRA_SRC}/bash/org/org.sh"

# Source deploy modules
source "$MOD_SRC/deploy.sh"
source "$MOD_SRC/deploy_projects.sh"
source "$MOD_SRC/deploy_remote.sh"
source "$MOD_SRC/deploy_complete.sh"

# Register completion
complete -F _deploy_complete deploy
