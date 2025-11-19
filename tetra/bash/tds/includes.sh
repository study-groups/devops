#!/usr/bin/env bash

# TDS Module - Tetra Display System
# Module loader for Tetra module system

TDS_SRC="${TDS_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
export TDS_SRC

TDS_DIR="${TDS_DIR:-$TETRA_DIR/tds}"
export TDS_DIR

# Source the main TDS script
source "$TDS_SRC/tds.sh"
