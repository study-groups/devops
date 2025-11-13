#!/usr/bin/env bash
# Deploy module includes

# Module paths
MOD_SRC="$TETRA_SRC/bash/deploy"
MOD_DIR="${MOD_DIR:-$TETRA_DIR/deploy}"

# Source main deploy module
[[ -f "$MOD_SRC/deploy.sh" ]] && source "$MOD_SRC/deploy.sh"

# Source tree help registration
[[ -f "$MOD_SRC/deploy_tree.sh" ]] && source "$MOD_SRC/deploy_tree.sh"
