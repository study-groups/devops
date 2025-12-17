#!/usr/bin/env bash

# TLS Module Includes - Standard tetra module entry point
# Controls what gets loaded for TLS (Time-ordered List) functionality

TLS_SRC="$TETRA_SRC/bash/tls"
TLS_DIR="$TETRA_DIR/tls"

# Create runtime directories if they don't exist
[[ ! -d "$TLS_DIR" ]] && mkdir -p "$TLS_DIR"
[[ ! -d "$TLS_DIR/config" ]] && mkdir -p "$TLS_DIR/config"

# Export for subprocesses
export TLS_SRC TLS_DIR

# =============================================================================
# COLOR CONFIGURATION (uses TDS module_config)
# =============================================================================

# Default color tokens for TLS
declare -gA TLS_COLOR_TOKENS=(
    # Time-based coloring (file age)
    [time.hot]="mode:2"               # < 1 hour (green)
    [time.warm]="mode:1"              # < 24 hours (amber)
    [time.neutral]="nouns:5"          # < 1 week
    [time.cool]="nouns:3"             # > 1 week (dim)

    # File type coloring
    [file.directory]="verbs:5"        # Directories (blue)
    [file.executable]="mode:2"        # Executables (green)
    [file.symlink]="verbs:4"          # Symlinks (cyan)
    [file.regular]="nouns:5"          # Regular files
    [file.code]="verbs:1"             # Code files .sh (orange)
    [file.config]="verbs:6"           # Config .toml/.json (purple)
    [file.markdown]="verbs:5"         # Markdown .md (blue)

    # Git status
    [git.staged]="mode:2"             # Staged (green)
    [git.modified]="mode:1"           # Modified (amber)
    [git.untracked]="verbs:1"         # Untracked (orange)
    [git.clean]="nouns:3"             # Clean (dim)

    # UI elements
    [ui.heading]="env:1"
    [ui.separator]="nouns:2"
    [ui.label]="nouns:4"
)

# Register with TDS module config system (if available)
if declare -f tds_module_register >/dev/null 2>&1; then
    tds_module_register "tls" "$TLS_DIR/config/colors.conf" TLS_COLOR_TOKENS
fi

# Source the main TLS module
source "$TLS_SRC/tls.sh"

# Source module index (metadata and tab completion)
source "$TLS_SRC/index.sh"
