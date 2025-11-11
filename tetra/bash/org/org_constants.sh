#!/usr/bin/env bash
# org_constants.sh - Canonical constants and definitions for org module
# Single source of truth for environments, modes, and other org constants
#
# This file should be sourced by all org module files to ensure consistency
# Safe to source multiple times - bash handles redeclaration fine

# Canonical environment definitions
# These represent the deployment stages: Local → Dev → Staging → Production
declare -ga ORG_ENVIRONMENTS=(
    "Local"
    "Dev"
    "Staging"
    "Production"
)

# Canonical mode definitions
# These represent the operation modes: Inspect (read-only) → Transfer (sync) → Execute (deploy)
declare -ga ORG_MODES=(
    "Inspect"
    "Transfer"
    "Execute"
)

# Layout constants for TUI (avoid magic numbers)
declare -r ORG_TUI_HEADER_TOP=0 2>/dev/null || true
declare -r ORG_TUI_HEADER_TITLE=1 2>/dev/null || true
declare -r ORG_TUI_HEADER_BOTTOM=2 2>/dev/null || true
declare -r ORG_TUI_HELP_LINE=3 2>/dev/null || true
declare -r ORG_TUI_PROMPT_BLANK=4 2>/dev/null || true
declare -r ORG_TUI_PROMPT_INPUT=5 2>/dev/null || true
declare -r ORG_TUI_CONTENT_START=6 2>/dev/null || true

# REPL settings
declare -r ORG_REPL_HISTORY_MAX=100 2>/dev/null || true    # Maximum commands in history
declare -r ORG_REPL_INPUT_MAX=1000 2>/dev/null || true     # Maximum input length

# SSH and network timeout settings (in seconds)
declare -r ORG_SSH_CONNECT_TIMEOUT="${ORG_SSH_CONNECT_TIMEOUT:-3}" 2>/dev/null || true
declare -r ORG_SSH_OVERALL_TIMEOUT="${ORG_SSH_OVERALL_TIMEOUT:-5}" 2>/dev/null || true
declare -r ORG_SSH_BATCH_MODE="${ORG_SSH_BATCH_MODE:-yes}" 2>/dev/null || true

# Export for use in other modules
export ORG_ENVIRONMENTS
export ORG_MODES
export ORG_SSH_CONNECT_TIMEOUT
export ORG_SSH_OVERALL_TIMEOUT
export ORG_SSH_BATCH_MODE
