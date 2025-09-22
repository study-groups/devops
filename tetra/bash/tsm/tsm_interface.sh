#!/usr/bin/env bash

# TSM Interface Coordination
# Refactored in Phase 2 - now only contains interface coordination
# All specific functions moved to specialized modules:
# - tsm_validation.sh: validation and helpers
# - tsm_process.sh: process lifecycle management
# - tsm_cli.sh: CLI command handlers

# Functions moved to tsm_validation.sh:
# - tetra_tsm_setup, _tsm_validate_script, _tsm_auto_detect_env
# - _tsm_validate_env_file, _tsm_resolve_script_path, _tsm_generate_name
# - _tsm_save_metadata, tetra_tsm_reset_id

# Functions moved to tsm_process.sh:
# - _tsm_start_process, _tsm_start_command_process, tetra_tsm_start_python
# - tetra_tsm_start_webserver, tetra_tsm_stop_single, tetra_tsm_stop_by_id
# - tetra_tsm_delete_single, tetra_tsm_delete_by_id, tetra_tsm_restart_single
# - tetra_tsm_restart_by_id, _tsm_restart_unified

# Functions moved to tsm_cli.sh:
# - tetra_tsm_start_cli, _tsm_start_cli_internal, tetra_tsm_start_command
# - tetra_tsm_start, tetra_tsm_stop, tetra_tsm_delete, tetra_tsm_restart
# - tetra_tsm_kill, _tsm_start_from_service_definition

# === INTERFACE COORDINATION ===

# tetra_tsm_get_next_id is defined in tsm_utils.sh

# Export interface coordination (most functions now exported from their respective modules)
# This file now serves as the main interface coordination point