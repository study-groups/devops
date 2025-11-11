#!/usr/bin/env bash

# Tetra Bootloader
# Design: Simple, fast, predictable
# Principle: TETRA_SRC is a strong global that MUST be set

# Note: Can't use unified_log.sh yet since we need TETRA_SRC to be valid first
# Early errors go to stderr, structured logging happens after boot_core loads

# Start boot time profiling (use milliseconds for macOS compatibility)
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS: use Python for microsecond precision
    TETRA_BOOT_START_TIME=$(python3 -c 'import time; print(int(time.time() * 1000000))')
else
    # Linux: use nanoseconds
    TETRA_BOOT_START_TIME=$(date +%s%N)
fi

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
if ! source "$BOOT_DIR/boot_core.sh" 2>/tmp/tetra_boot_error.log; then
    echo "TETRA BOOTSTRAP ERROR: Failed to load boot_core.sh" >&2
    echo "  Error details in /tmp/tetra_boot_error.log" >&2
    if [[ -s /tmp/tetra_boot_error.log ]]; then
        echo "  Last error: $(tail -1 /tmp/tetra_boot_error.log)" >&2
    fi
    return 1 2>/dev/null || exit 1
fi

# Load unified logging after boot_core (now TETRA_DIR and basics are set)
if [[ -f "$TETRA_SRC/bash/utils/unified_log.sh" ]]; then
    # Only set defaults if not already set by user
    export TETRA_LOG_CONSOLE="${TETRA_LOG_CONSOLE:-0}"
    export TETRA_LOG_CONSOLE_COLOR="${TETRA_LOG_CONSOLE_COLOR:-1}"
    export TETRA_LOG_LEVEL="${TETRA_LOG_LEVEL:-INFO}"
    source "$TETRA_SRC/bash/utils/unified_log.sh" 2>/dev/null || true
fi

source "$BOOT_DIR/boot_modules.sh" 2>/dev/null || true
source "$BOOT_DIR/boot_aliases.sh" 2>/dev/null || true
source "$BOOT_DIR/boot_prompt.sh" 2>/dev/null || true

# Load user aliases if they exist
[[ -f "$TETRA_DIR/aliases.sh" ]] && source "$TETRA_DIR/aliases.sh" 2>/dev/null || true

# Calculate and export boot time
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS: microseconds
    TETRA_BOOT_END_TIME=$(python3 -c 'import time; print(int(time.time() * 1000000))')
    TETRA_BOOT_TIME_US=$((TETRA_BOOT_END_TIME - TETRA_BOOT_START_TIME))
    export TETRA_BOOT_TIME_MS=$((TETRA_BOOT_TIME_US / 1000))
    export TETRA_BOOT_TIME_NS=$((TETRA_BOOT_TIME_US * 1000))
else
    # Linux: nanoseconds
    TETRA_BOOT_END_TIME=$(date +%s%N)
    export TETRA_BOOT_TIME_NS=$((TETRA_BOOT_END_TIME - TETRA_BOOT_START_TIME))
    export TETRA_BOOT_TIME_MS=$((TETRA_BOOT_TIME_NS / 1000000))
fi

# Mark as loaded
export TETRA_BOOTLOADER_LOADED=$$

# Reload function - simple and clean
tetra_reload() {
    echo "Reloading Tetra..."
    unset TETRA_BOOTLOADER_LOADED
    source "$TETRA_SRC/bash/bootloader.sh"
}

alias ttr='tetra_reload'
