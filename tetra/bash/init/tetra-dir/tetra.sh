#!/usr/bin/env bash
TETRA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TETRA_SRC="${TETRA_SRC:-$HOME/src/devops/tetra}"
export TETRA_DIR TETRA_SRC
source "$TETRA_SRC/bash/tetra_env.sh"
