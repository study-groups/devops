#!/usr/bin/env bash

# Test script for new TSM structure loading
# This script tests loading the new organized structure instead of the old tsm_*.sh files

echo "🧪 Testing new TSM structure loading..."

_tsm_load_new_structure() {
    local TSM_DIR="$(dirname "${BASH_SOURCE[0]}")"

    echo "📁 Loading TSM from new structure in $TSM_DIR"

    # Load core foundation first (no dependencies)
    echo "   🔧 Loading core modules..."
    source "$TSM_DIR/core/core.sh"         # Core functions, no dependencies
    source "$TSM_DIR/core/config.sh"       # Configuration and global state
    source "$TSM_DIR/core/utils.sh"        # Utility functions, depends on core
    source "$TSM_DIR/core/validation.sh"   # Validation & helpers, no dependencies
    source "$TSM_DIR/core/environment.sh"  # Environment handling
    source "$TSM_DIR/core/files.sh"        # File utilities
    source "$TSM_DIR/core/helpers.sh"      # Helper functions
    source "$TSM_DIR/core/setup.sh"        # Setup utilities

    # Load system modules (depend on core)
    echo "   🖥️  Loading system modules..."
    source "$TSM_DIR/system/ports.sh"      # Named port registry, depends on config
    source "$TSM_DIR/system/formatting.sh" # Output formatting, depends on core
    source "$TSM_DIR/system/doctor.sh"     # Diagnostics, depends on core+utils
    source "$TSM_DIR/system/patrol.sh"     # Patrol system, depends on core
    source "$TSM_DIR/system/analytics.sh"  # Analytics functions
    source "$TSM_DIR/system/audit.sh"      # Audit functions
    source "$TSM_DIR/system/monitor.sh"    # Monitor functions
    source "$TSM_DIR/system/resource_manager.sh"    # Resource management
    source "$TSM_DIR/system/session_aggregator.sh"  # Session aggregation

    # Load service modules (depend on core+system)
    echo "   🎯 Loading service modules..."
    source "$TSM_DIR/services/definitions.sh"  # Service management, depends on core+utils
    source "$TSM_DIR/services/registry.sh"     # Service registry
    source "$TSM_DIR/services/startup.sh"      # Service startup logic

    # Load process modules (depend on services)
    echo "   ⚙️  Loading process modules..."
    source "$TSM_DIR/process/inspection.sh"    # Process inspection, depends on core
    source "$TSM_DIR/process/lifecycle.sh"     # Process lifecycle, depends on validation+utils
    source "$TSM_DIR/process/management.sh"    # CLI commands, depends on process+validation
    source "$TSM_DIR/process/list.sh"          # List commands

    # Load interface modules (depend on everything above)
    echo "   🖱️  Loading interface modules..."
    source "$TSM_DIR/interfaces/cli.sh"        # Interface coordination, depends on all above
    source "$TSM_DIR/interfaces/repl.sh"       # REPL interface

    # Load integration modules last (depend on core interfaces)
    echo "   🔗 Loading integration modules..."
    source "$TSM_DIR/integrations/nginx.sh"    # Nginx integration
    source "$TSM_DIR/integrations/systemd.sh"  # Systemd integration
    source "$TSM_DIR/integrations/tview.sh"    # TView integration functions

    echo "   🚀 Initializing global state..."
    # Initialize global state after all functions are loaded
    _tsm_init_global_state

    echo "✅ New structure loaded successfully!"
}

# Test the loading
echo "Starting test..."
_tsm_load_new_structure

# Test basic functionality
echo ""
echo "🔍 Testing basic TSM functions..."

if declare -f _tsm_init_global_state >/dev/null; then
    echo "✅ Core function _tsm_init_global_state found"
else
    echo "❌ Core function _tsm_init_global_state NOT found"
fi

if declare -f tsm_validate_input >/dev/null; then
    echo "✅ Validation function tsm_validate_input found"
else
    echo "❌ Validation function tsm_validate_input NOT found"
fi

if declare -f tetra_tsm_start >/dev/null; then
    echo "✅ CLI function tetra_tsm_start found"
else
    echo "❌ CLI function tetra_tsm_start NOT found"
fi

if declare -f tsm_list_named_ports >/dev/null; then
    echo "✅ Ports function tsm_list_named_ports found"
else
    echo "❌ Ports function tsm_list_named_ports NOT found"
fi

echo ""
echo "🎯 Test completed. If all functions are found, the new structure is working!"