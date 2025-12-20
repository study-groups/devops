#!/usr/bin/env bash
# org/includes.sh - Module entry point
# Loads org module components in correct order

ORG_SRC="${TETRA_SRC}/bash/org"

# Load in dependency order
source "$ORG_SRC/org.sh"
