#!/usr/bin/env bash

# Env module includes
# Follow tetra convention: MOD_DIR for data, MOD_SRC for source
ENV_DIR="${ENV_DIR:-$TETRA_DIR/env}"
ENV_SRC="${ENV_SRC:-$TETRA_SRC/bash/env}"

# Create data directory if it doesn't exist
[[ ! -d "$ENV_DIR" ]] && mkdir -p "$ENV_DIR"

# Export for subprocesses
export ENV_DIR ENV_SRC

source "$ENV_SRC/env_core.sh"
source "$ENV_SRC/env_toml.sh"
source "$ENV_SRC/env_status.sh"