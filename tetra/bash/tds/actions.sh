#!/usr/bin/env bash
# TDS Module Actions
# Provides verb:noun actions for Tetra Design System

# Source TDS if not already loaded
if ! declare -f tds_switch_theme >/dev/null; then
    TDS_SRC="${TDS_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
    source "$TDS_SRC/tds.sh"
fi

# Source action interface
source "$TDS_SRC/action_interface.sh"

# Source REPL
source "$TDS_SRC/tds_repl.sh"

# Re-export action discovery function
export -f tds_get_actions
export -f tds_repl_process
