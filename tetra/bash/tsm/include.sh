#!/usr/bin/env bash

# TSM Include - Single entry point for all TSM components
# Loads all TSM files directly using MOD_SRC strong global

if [[ -z "$MOD_SRC" ]]; then
    echo "FATAL: MOD_SRC not set before sourcing tsm/include.sh" >&2
    echo "Caller must set MOD_SRC before including TSM module files" >&2
    return 1
fi

# Load all TSM files directly in dependency order
# Core foundation first (no dependencies)
source "$MOD_SRC/core/config.sh"       # Must be first - defines _tsm_init_global_state
source "$MOD_SRC/core/core.sh"         # Depends on config for _tsm_init_global_state
source "$MOD_SRC/core/utils.sh"
source "$MOD_SRC/core/validation.sh"
source "$MOD_SRC/core/environment.sh"
source "$MOD_SRC/core/files.sh"
source "$MOD_SRC/core/helpers.sh"
source "$MOD_SRC/core/setup.sh"

# System modules (depend on core)
source "$MOD_SRC/system/formatting.sh"
source "$MOD_SRC/system/ports.sh"
source "$MOD_SRC/system/resource_manager.sh"  # Must load before analytics & session_aggregator
source "$MOD_SRC/system/doctor.sh"
source "$MOD_SRC/system/patrol.sh"
source "$MOD_SRC/system/monitor.sh"
source "$MOD_SRC/system/analytics.sh"         # Depends on resource_manager
source "$MOD_SRC/system/session_aggregator.sh" # Depends on resource_manager
source "$MOD_SRC/system/audit.sh"

# Service modules (depend on core+system)
source "$MOD_SRC/services/definitions.sh"
source "$MOD_SRC/services/registry.sh"
source "$MOD_SRC/services/startup.sh"

# Process modules (depend on services)
source "$MOD_SRC/process/inspection.sh"
source "$MOD_SRC/process/lifecycle.sh"
source "$MOD_SRC/process/management.sh"
source "$MOD_SRC/process/list.sh"

# Interface modules (depend on everything above)
source "$MOD_SRC/interfaces/cli.sh"
source "$MOD_SRC/interfaces/repl.sh"

# Integration modules last (depend on core interfaces)
source "$MOD_SRC/integrations/nginx.sh"
source "$MOD_SRC/integrations/systemd.sh"
source "$MOD_SRC/integrations/tview.sh"