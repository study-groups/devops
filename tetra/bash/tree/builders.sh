#!/usr/bin/env bash
# bash/tree/builders.sh - COMPATIBILITY SHIM
#
# This file now sources bash/nav/nav_builders.sh which provides all builder functions.
# tree_build_* functions continue to work via shims.
#
# For new code, prefer nav_build_* functions directly.

TREE_BUILDERS_SRC="${TREE_BUILDERS_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
NAV_SRC="${NAV_SRC:-$(dirname "$TREE_BUILDERS_SRC")/nav}"

if [[ -f "$NAV_SRC/nav_builders.sh" ]]; then
    source "$NAV_SRC/nav_builders.sh"
else
    echo "Error: nav_builders module not found at $NAV_SRC/nav_builders.sh" >&2
    return 1
fi
