#!/usr/bin/env bash

# TSM Minimal Include - Load only essential files to test for fork issues

if [[ -z "$MOD_SRC" ]]; then
    echo "FATAL: MOD_SRC not set before sourcing tsm/include_minimal.sh" >&2
    return 1
fi

echo "Loading TSM components..."

# Core foundation first (no dependencies)
echo "Loading config..."
source "$MOD_SRC/core/config.sh"

echo "Loading core..."
source "$MOD_SRC/core/core.sh"

echo "Loading utils..."
source "$MOD_SRC/core/utils.sh"

echo "Loading validation..."
source "$MOD_SRC/core/validation.sh"

echo "Loading environment..."
source "$MOD_SRC/core/environment.sh"

echo "Loading files..."
source "$MOD_SRC/core/files.sh"

echo "Loading helpers..."
source "$MOD_SRC/core/helpers.sh"

echo "Loading setup..."
source "$MOD_SRC/core/setup.sh"

# Skipping complex lifecycle system for now - keep it simple
# echo "Loading lifecycle..."
# source "$MOD_SRC/core/lifecycle.sh"

# System modules (safe ones first)
echo "Loading formatting..."
source "$MOD_SRC/system/formatting.sh"

echo "Loading ports..."
source "$MOD_SRC/system/ports.sh"

echo "Loading doctor..."
source "$MOD_SRC/system/doctor.sh"

echo "Loading monitor..."
source "$MOD_SRC/system/monitor.sh"

echo "Loading resource manager..."
source "$MOD_SRC/system/resource_manager.sh"

# Service modules (needed for service definitions)
echo "Loading service definitions..."
source "$MOD_SRC/services/definitions.sh"

echo "Loading service registry..."
source "$MOD_SRC/services/registry.sh"

echo "Loading service startup..."
source "$MOD_SRC/services/startup.sh"

# Add process modules (need these for basic functionality)
echo "Loading process inspection..."
source "$MOD_SRC/process/inspection.sh"

echo "Loading process lifecycle..."
source "$MOD_SRC/process/lifecycle.sh"

echo "Loading process management..."
source "$MOD_SRC/process/management.sh"

echo "Loading process list..."
source "$MOD_SRC/process/list.sh"

# Add basic interface support for CLI
echo "Loading CLI interface..."
source "$MOD_SRC/interfaces/cli.sh"

echo "TSM core + system + process + interfaces loaded successfully!"