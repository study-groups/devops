#!/usr/bin/env bash
# CDP Module Entry Point
# Follows Tetra Module Convention 2.0

# Module source directory
CDP_MODULE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source core CDP functionality
source "$CDP_MODULE_DIR/cdp_paths.sh"
source "$CDP_MODULE_DIR/cdp.sh"

# Source actions if in TUI environment
if declare -f declare_action >/dev/null 2>&1; then
    source "$CDP_MODULE_DIR/actions.sh"
fi

echo "CDP module loaded"
