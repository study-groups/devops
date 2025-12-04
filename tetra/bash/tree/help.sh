#!/usr/bin/env bash
# bash/tree/help.sh - COMPATIBILITY SHIM
#
# This file now sources bash/nav/nav_help.sh which provides tree_help_* functions
# via compatibility shims. Existing code continues to work.
#
# For new code, prefer: nav_help, nav_navigate

TREE_HELP_SRC="${TREE_HELP_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
NAV_SRC="${NAV_SRC:-$(dirname "$TREE_HELP_SRC")/nav}"

# Source core first
source "$TREE_HELP_SRC/core.sh"

# Source nav_help (provides tree_help_* shims)
if [[ -f "$NAV_SRC/nav_help.sh" ]]; then
    source "$NAV_SRC/nav_help.sh"
else
    echo "Error: nav_help module not found at $NAV_SRC/nav_help.sh" >&2
    return 1
fi

# Re-export old config variable names for compatibility
TREE_HELP_MAX_LINES="${NAV_HELP_MAX_LINES:-18}"
TREE_HELP_INDENT="${NAV_HELP_INDENT:-  }"
