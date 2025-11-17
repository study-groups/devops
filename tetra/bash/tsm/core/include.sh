#!/usr/bin/env bash

# TSM Core Module Loader
# Loads all TSM modules using strong globals in dependency-ordered sequence

# CRITICAL: Validate TETRA_SRC is set
if [[ -z "${TETRA_SRC:-}" ]]; then
    echo "FATAL: TETRA_SRC is not set. TSM cannot load." >&2
    echo "Fix: source ~/tetra/tetra.sh first" >&2
    # Set error flag instead of returning (sourced file can't safely return non-zero)
    TSM_LOAD_FAILED=1
    return  # Early exit, but don't error code (would exit shell)
fi

# Define module source directory using strong global
TSM_CORE_SRC="$TETRA_SRC/bash/tsm/core"
TSM_SYSTEM_SRC="$TETRA_SRC/bash/tsm/system"
TSM_SERVICES_SRC="$TETRA_SRC/bash/tsm/services"
TSM_PROCESS_SRC="$TETRA_SRC/bash/tsm/process"
TSM_INTEGRATIONS_SRC="$TETRA_SRC/bash/tsm/integrations"
TSM_SRC="$TETRA_SRC/bash/tsm"

# === PHASE 1: CORE FOUNDATION (no dependencies) ===
source "$TSM_CORE_SRC/core.sh"           # Core functions
source "$TSM_CORE_SRC/config.sh"         # Configuration and global state
source "$TSM_CORE_SRC/utils.sh"          # Utility functions
source "$TSM_CORE_SRC/validation.sh"     # Validation & helpers
source "$TSM_CORE_SRC/environment.sh"    # Environment handling
source "$TSM_CORE_SRC/helpers.sh"        # Helper functions
source "$TSM_CORE_SRC/setup.sh"          # Setup utilities
source "$TSM_CORE_SRC/metadata.sh"       # PM2-style JSON metadata
source "$TSM_CORE_SRC/multi_user.sh"     # Multi-user support (root cross-user visibility)
source "$TSM_CORE_SRC/hooks.sh"          # Pre-hook system
source "$TSM_CORE_SRC/runtime.sh"        # Interpreter resolution
source "$TSM_CORE_SRC/runtime_info.sh"   # Runtime information queries
source "$TSM_CORE_SRC/port_resolution.sh"  # Port ladder (5-step)
source "$TSM_CORE_SRC/patterns.sh"       # Pattern management
source "$TSM_CORE_SRC/start.sh"          # Universal start command
source "$TSM_CORE_SRC/help.sh"           # Help system (contextual, colored)
source "$TSM_CORE_SRC/help_parser.sh"    # Help markdown parser

# === PHASE 2: SYSTEM MODULES (depend on core) ===
source "$TSM_SYSTEM_SRC/ports.sh"              # Named port registry
source "$TSM_SYSTEM_SRC/socket.sh"             # Unix domain sockets
source "$TSM_SYSTEM_SRC/formatting.sh"         # Output formatting
source "$TSM_SYSTEM_SRC/doctor.sh"             # Diagnostics
source "$TSM_SYSTEM_SRC/patrol.sh"             # Patrol system
source "$TSM_SYSTEM_SRC/analytics.sh"          # Analytics functions
source "$TSM_SYSTEM_SRC/audit.sh"              # Audit functions
source "$TSM_SYSTEM_SRC/monitor.sh"            # Monitor functions
source "$TSM_SYSTEM_SRC/resource_manager.sh"   # Resource management
source "$TSM_SYSTEM_SRC/session_aggregator.sh" # Session aggregation

# === PHASE 3: SERVICE MODULES (depend on core+system) ===
source "$TSM_SERVICES_SRC/definitions.sh"  # Service management
source "$TSM_SERVICES_SRC/registry.sh"     # Service registry
source "$TSM_SERVICES_SRC/startup.sh"      # Service startup logic

# === PHASE 4: PROCESS MODULES (depend on services) ===
source "$TSM_PROCESS_SRC/inspection.sh"    # Process inspection
source "$TSM_PROCESS_SRC/lifecycle.sh"     # Process lifecycle
source "$TSM_PROCESS_SRC/management.sh"    # CLI commands
source "$TSM_PROCESS_SRC/list.sh"          # List commands - CRITICAL for tsm list

# === PHASE 5: REPL MODULE (depends on everything above) ===
source "$TSM_SRC/tsm_repl.sh"              # REPL entry point (bash/repl-based)

# === PHASE 6: INTEGRATION MODULES (depend on core) ===
source "$TSM_INTEGRATIONS_SRC/nginx.sh"    # Nginx integration
source "$TSM_INTEGRATIONS_SRC/systemd.sh"  # Systemd integration
source "$TSM_INTEGRATIONS_SRC/tview.sh"    # TView integration functions

# === PHASE 7: INITIALIZE GLOBAL STATE ===
# Initialize global state after all functions are loaded
if declare -f _tsm_init_global_state >/dev/null; then
    _tsm_init_global_state
fi

# Export module directories for runtime use
export TSM_SRC TSM_CORE_SRC TSM_SYSTEM_SRC TSM_SERVICES_SRC TSM_PROCESS_SRC TSM_INTEGRATIONS_SRC
