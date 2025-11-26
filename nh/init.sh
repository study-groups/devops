#!/usr/bin/env bash
# init.sh - NodeHolder initialization
#
# Usage:
#   export DIGITALOCEAN_CONTEXT=mycontext
#   source /path/to/nh/init.sh
#
# Or:
#   source /path/to/nh/init.sh  # Uses $DIGITALOCEAN_CONTEXT

# NH_SRC always points to bash/ subdir
NH_SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/bash" && pwd)"

# Validate environment
[[ -z "$DIGITALOCEAN_CONTEXT" ]] && {
    echo "DIGITALOCEAN_CONTEXT not set"
    echo "Usage: export DIGITALOCEAN_CONTEXT=mycontext && source init.sh"
    return 1
}

# Switch doctl context
doctl auth switch --context "$DIGITALOCEAN_CONTEXT" 2>/dev/null

# Source bootstrap
source "$NH_SRC/bootstrap.sh"
