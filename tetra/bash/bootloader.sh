#!/usr/bin/env bash

# Tetra Bootloader
# Design: Simple, fast, predictable
# Principle: TETRA_SRC is a strong global that MUST be set

# Note: Can't use unified_log.sh yet since we need TETRA_SRC to be valid first
# Early errors go to stderr, structured logging happens after boot_core loads

# Validate TETRA_SRC is set (required for anything to work)
if [[ -z "$TETRA_SRC" ]]; then
    echo "TETRA BOOTSTRAP ERROR: TETRA_SRC not set - cannot initialize Tetra" >&2
    echo "Set TETRA_SRC to your tetra source directory" >&2
    return 1 2>/dev/null || exit 1
fi

# Validate TETRA_SRC exists
if [[ ! -d "$TETRA_SRC" ]]; then
    echo "TETRA BOOTSTRAP ERROR: TETRA_SRC directory not found: $TETRA_SRC" >&2
    return 1 2>/dev/null || exit 1
fi

# Idempotent - skip if already loaded in this shell
if [[ "${TETRA_BOOTLOADER_LOADED:-}" == "$$" ]]; then
    return 0
fi

# Set TETRA_DIR if not already set
export TETRA_DIR="${TETRA_DIR:-$HOME/tetra}"

# Initialize module tracking arrays (global associative arrays)
declare -gA TETRA_MODULE_LOADERS
declare -gA TETRA_MODULE_LOADED

# Load boot components in dependency order
BOOT_DIR="$TETRA_SRC/bash/boot"

if [[ ! -d "$BOOT_DIR" ]]; then
    echo "TETRA BOOTSTRAP ERROR: Boot directory not found: $BOOT_DIR" >&2
    return 1 2>/dev/null || exit 1
fi

# Core is required, others are optional
source "$BOOT_DIR/boot_core.sh" || {
    echo "TETRA BOOTSTRAP ERROR: Failed to load boot_core.sh" >&2
    return 1 2>/dev/null || exit 1
}

# Load unified logging after boot_core (now TETRA_DIR and basics are set)
if [[ -f "$TETRA_SRC/bash/utils/unified_log.sh" ]]; then
    export TETRA_LOG_CONSOLE=1
    export TETRA_LOG_CONSOLE_COLOR=1
    export TETRA_LOG_LEVEL=INFO
    source "$TETRA_SRC/bash/utils/unified_log.sh" 2>/dev/null || true
fi

source "$BOOT_DIR/boot_modules.sh" 2>/dev/null || true
source "$BOOT_DIR/boot_aliases.sh" 2>/dev/null || true
source "$BOOT_DIR/boot_prompt.sh" 2>/dev/null || true

# Mark as loaded
export TETRA_BOOTLOADER_LOADED=$$

# Reload function - simple and clean
tetra_reload() {
    echo "Reloading Tetra..."
    unset TETRA_BOOTLOADER_LOADED
    source "$TETRA_SRC/bash/bootloader.sh"
}

alias ttr='tetra_reload'
