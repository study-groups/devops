#!/usr/bin/env bash

# MSC Module - Message Sequence Chart Generator
# Entry point following Tetra Module Convention v2.0

# Module globals (strong globals)
MSC_SRC="${MSC_SRC:-$TETRA_SRC/bash/msc}"
export MSC_SRC

MSC_DIR="${MSC_DIR:-$TETRA_DIR/msc}"
export MSC_DIR

# Load core MSC library
source "$MSC_SRC/msc.sh"
source "$MSC_SRC/msc_layout.sh"
source "$MSC_SRC/msc_render.sh"

# Ensure module data directory exists
mkdir -p "$MSC_DIR/logs"
mkdir -p "$MSC_DIR/exports"
