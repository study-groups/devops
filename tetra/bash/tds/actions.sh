#!/usr/bin/env bash
# TDS Module Actions
# Provides verb:noun actions for Tetra Design System

# Source TDS if not already loaded (which includes action_interface.sh and tds_repl.sh)
if ! declare -f tds_switch_theme >/dev/null; then
    TDS_SRC="${TDS_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
    source "$TDS_SRC/tds.sh"
fi

# Source action interface only if not already loaded
if ! declare -f tds_get_actions >/dev/null; then
    source "$TDS_SRC/action_interface.sh"
fi
