#!/usr/bin/env bash
# bootstrap.sh - NodeHolder module loader
#
# Sources the nh module and sets up environment
#
# Usage:
#   export NH_SRC=/path/to/nh/bash
#   source $NH_SRC/bootstrap.sh
#
# Or simply:
#   source ~/nh/bash/bootstrap.sh

# Set defaults
NH_SRC="${NH_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
NH_DIR="${NH_DIR:-$HOME/nh}"

export NH_SRC
export NH_DIR

# Source main module (which sources all sub-modules)
source "$NH_SRC/nh.sh"

# Auto-load context if set
if [[ -n "$DIGITALOCEAN_CONTEXT" ]]; then
    if [[ -f "$NH_DIR/$DIGITALOCEAN_CONTEXT/digocean.json" ]]; then
        nh_env_load 2>/dev/null
    fi
fi

echo "NH loaded:"
echo "  NH_SRC=$NH_SRC"
echo "  NH_DIR=$NH_DIR"
