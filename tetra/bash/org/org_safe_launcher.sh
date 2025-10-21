#!/usr/bin/env bash
# Safe Org REPL Launcher
# Use this to test the REPL without risking terminal exit

set +e  # Don't exit on errors

# Set up environment
export TETRA_SRC="${TETRA_SRC:-/Users/mricos/src/devops/tetra}"
export TETRA_DIR="${TETRA_DIR:-$HOME/tetra}"
export ORG_SRC="$TETRA_SRC/bash/org"

echo "Loading org REPL system..."

# Source required files
source "$ORG_SRC/tetra_org.sh" 2>/dev/null || { echo "Warning: tetra_org.sh not loaded"; }
source "$TETRA_SRC/bash/nh/nh_bridge.sh" 2>/dev/null || { echo "Info: nh_bridge.sh not loaded"; }
source "$ORG_SRC/org_help.sh" || { echo "Error: Failed to load org_help.sh"; exit 1; }
source "$ORG_SRC/org_completion.sh" || { echo "Error: Failed to load org_completion.sh"; exit 1; }
source "$ORG_SRC/org_repl.sh" || { echo "Error: Failed to load org_repl.sh"; exit 1; }

echo "✅ All components loaded"
echo ""

# Launch REPL
org_repl

# If we get here, REPL exited cleanly
echo ""
echo "REPL exited successfully"
exit 0
