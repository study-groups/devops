#!/usr/bin/env bash

# PBVM - PocketBase Version Manager
# Tetra module integration

# Set default PBVM_ROOT if not already set
export PBVM_ROOT=${PBVM_ROOT:-"$HOME/.pbvm"}

# Source the main pbvm functionality
source "$(dirname "${BASH_SOURCE[0]}")/pbvm.sh"