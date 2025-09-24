#!/usr/bin/env bash

# TSM Core - Modular process lifecycle management
# This is the main loader that orchestrates all TSM modules

# === MODULE LOADING ===

# Load TSM modules in dependency order
source "$TETRA_DIR/bash/tsm/tsm_setup.sh"
source "$TETRA_DIR/bash/tsm/tsm_helpers.sh"
source "$TETRA_DIR/bash/tsm/tsm_files.sh"
source "$TETRA_DIR/bash/tsm/tsm_lifecycle.sh"
source "$TETRA_DIR/bash/tsm/tsm_environment.sh"

# === COMPATIBILITY EXPORTS ===

# Re-export all functions for backwards compatibility
# Setup module
export -f tetra_tsm_setup

# Helpers module
export -f _tsm_get_next_id
export -f _tsm_validate_script
export -f _tsm_generate_process_name

# Files module
export -f _tsm_get_process_file
export -f _tsm_get_pid_file
export -f _tsm_get_log_file
export -f _tsm_write_process_info
export -f _tsm_read_process_info

# Lifecycle module
export -f _tsm_is_process_running
export -f _tsm_get_process_by_name
export -f _tsm_kill_process

# Environment module
export -f _tsm_load_environment
export -f _tsm_extract_env_vars
export -f _tsm_get_env_port
export -f _tsm_get_env_name

# Note: _tsm_start_process is exported from tsm_interface.sh to avoid duplication