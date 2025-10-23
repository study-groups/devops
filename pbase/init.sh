#!/bin/bash

# pbase/init.sh - Set environment variables for pbase/pdata
#
# This file just sets environment variables.
# The pbase TETRA module handles all the logic.

# Validate TETRA environment
if [ -z "$TETRA_DIR" ]; then
    echo "ERROR: TETRA_DIR not set. Source ~/tetra/tetra.sh first" >&2
    return 1
fi

if [ -z "$TETRA_SRC" ]; then
    echo "ERROR: TETRA_SRC not set. Source ~/tetra/tetra.sh first" >&2
    return 1
fi

if [ -z "$PBASE_SRC" ]; then
    echo "ERROR: PBASE_SRC not set" >&2
    return 1
fi

if [ -z "$PBASE_DIR" ]; then
    echo "ERROR: PBASE_DIR not set" >&2
    return 1
fi

# Validate PBASE_SRC exists
if [ ! -d "$PBASE_SRC" ]; then
    echo "ERROR: PBASE_SRC directory not found: $PBASE_SRC" >&2
    return 1
fi

# Set PData paths
export PDATA_SRC="${PDATA_SRC:-$HOME/src/devops/devpages/pdata}"
export PD_DIR="${PD_DIR:-$PBASE_DIR/pdata}"
export PDATA_PORT="${PDATA_PORT:-3000}"

# Validate PDATA_SRC exists
if [ ! -d "$PDATA_SRC" ]; then
    echo "ERROR: PDATA_SRC directory not found: $PDATA_SRC" >&2
    echo "  Set PDATA_SRC to your pdata location before sourcing init.sh" >&2
    return 1
fi

# Source the pbase TETRA module
source "$TETRA_SRC/bash/pbase/includes.sh"

echo "✓ pbase initialized"
echo "  PBASE_SRC:  $PBASE_SRC"
echo "  PBASE_DIR:  $PBASE_DIR"
echo "  PD_DIR:     $PD_DIR"
echo "  PDATA_SRC:  $PDATA_SRC"
echo ""
echo "Use 'pbase repl' to start interactive management"
echo "Use 'pbase help' for available commands"
