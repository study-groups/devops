#!/usr/bin/env bash

# TSM Doctor - Module Index
# Sources all doctor submodules

# Get the directory containing this script
DOCTOR_DIR="${BASH_SOURCE[0]%/*}"

# Source all doctor modules in dependency order
source "$DOCTOR_DIR/utils.sh"      # Shared utilities (colors, helpers)
source "$DOCTOR_DIR/ports.sh"      # Port scanning and management
source "$DOCTOR_DIR/files.sh"      # File diagnostics
source "$DOCTOR_DIR/processes.sh"  # Process cleanup and orphan detection
source "$DOCTOR_DIR/env.sh"        # Environment diagnostics
source "$DOCTOR_DIR/validate.sh"   # Command validation
source "$DOCTOR_DIR/health.sh"     # Health check
source "$DOCTOR_DIR/main.sh"       # Main entry point

# Backward compatibility aliases (map old names to new doctor_* prefix)
# These allow existing code to work without changes
log() { doctor_log "$@"; }
warn() { doctor_warn "$@"; }
error() { doctor_error "$@"; }
success() { doctor_success "$@"; }
info() { doctor_info "$@"; }
truncate_middle() { doctor_truncate_middle "$@"; }
check_dependencies() { doctor_check_dependencies "$@"; }
scan_common_ports() { doctor_scan_common_ports "$@"; }
scan_port() { doctor_scan_port "$@"; }
kill_port_process() { doctor_kill_port_process "$@"; }
diagnose_env_loading() { doctor_diagnose_env_loading "$@"; }
tsm_diagnose_startup_failure() { doctor_diagnose_startup_failure "$@"; }
tsm_scan_orphaned_processes() { doctor_scan_orphaned_processes "$@"; }
tsm_validate_command() { doctor_validate_command "$@"; }
tsm_clean_stale_processes() { doctor_clean_stale_processes "$@"; }
tsm_diagnose_files() { doctor_diagnose_files "$@"; }
tsm_healthcheck() { doctor_healthcheck "$@"; }

# Export backward compatibility aliases
export -f log warn error success info truncate_middle check_dependencies
export -f scan_common_ports scan_port kill_port_process
export -f diagnose_env_loading tsm_diagnose_startup_failure
export -f tsm_scan_orphaned_processes tsm_validate_command
export -f tsm_clean_stale_processes tsm_diagnose_files tsm_healthcheck
