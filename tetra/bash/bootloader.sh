#!/usr/bin/env bash

# Tetra Bootloader
# Design: Simple, fast, predictable
# Principle: TETRA_SRC is a strong global that MUST be set

# Bash version check - require 5.1+
if [[ "${BASH_VERSINFO[0]}" -lt 5 ]] || [[ "${BASH_VERSINFO[0]}" -eq 5 && "${BASH_VERSINFO[1]}" -lt 1 ]]; then
    echo "Error: tetra requires bash 5.1 or higher" >&2
    echo "Current version: ${BASH_VERSION}" >&2
    echo "Please upgrade bash or ensure you're running in a bash 5.1+ environment" >&2
    return 1 2>/dev/null || exit 1
fi

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
# Use TETRA_DIR for error log (more reliable than /tmp)
BOOT_ERROR_LOG="${TETRA_DIR}/logs/boot_error.log"
mkdir -p "${TETRA_DIR}/logs" 2>/dev/null || true

if ! source "$BOOT_DIR/boot_core.sh" 2>"$BOOT_ERROR_LOG"; then
    echo "TETRA BOOTSTRAP ERROR: Failed to load boot_core.sh" >&2
    echo "  Error details in $BOOT_ERROR_LOG" >&2
    if [[ -s "$BOOT_ERROR_LOG" ]]; then
        echo "  Last error: $(tail -1 "$BOOT_ERROR_LOG")" >&2
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

source "$BOOT_DIR/boot_context.sh" 2>/dev/null || true
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

# Restore directory if TETRA_RESTORE_DIR is set (from reload)
if [[ -n "${TETRA_RESTORE_DIR:-}" && -d "$TETRA_RESTORE_DIR" ]]; then
    cd "$TETRA_RESTORE_DIR"
    unset TETRA_RESTORE_DIR
fi

# Mark as loaded
export TETRA_BOOTLOADER_LOADED=$$

# Reload function - use exec bash for true fresh shell simulation
tetra_reload() {
    local use_exec="${1:-true}"  # Default to exec mode

    if [[ "$use_exec" == "false" || "$use_exec" == "soft" ]]; then
        # Soft mode: in-place reload without exec
        tetra_reload_soft
        return $?
    fi

    echo "Reloading Tetra (starting fresh bash shell)..."

    # Check if we're in an interactive shell
    if [[ $- == *i* ]]; then
        # Save current directory to restore after exec
        local current_dir="$PWD"

        # Interactive shell: use exec to replace current shell with fresh one
        # This is the ONLY way to truly simulate a new shell
        # Use TETRA_RESTORE_DIR to return to current directory after reload
        # IMPORTANT: Use $TETRA_SHELL (validated bash 5.2+) not bare $SHELL
        # to avoid /bin/sh parsing exported bash 5.2+ functions
        TETRA_RESTORE_DIR="$current_dir" exec "${TETRA_SHELL:-$SHELL}" --login
    else
        # Non-interactive: do best-effort cleanup and re-source
        echo "Warning: Non-interactive shell detected, doing in-place reload"
        echo "For full reload in interactive mode, use: exec bash --login"

        tetra_reload_soft
    fi
}

# Alternative: soft reload that just re-sources without exec
tetra_reload_soft() {
    echo "Soft reloading Tetra (functions may persist)..."

    # Unset module state
    unset TETRA_BOOTLOADER_LOADED
    unset TETRA_MODULE_LOADERS
    unset TETRA_MODULE_LOADED

    # Reload
    source "$TETRA_SRC/bash/bootloader.sh"
    echo "Tetra soft-reloaded"
}

alias ttr='tetra_reload'
