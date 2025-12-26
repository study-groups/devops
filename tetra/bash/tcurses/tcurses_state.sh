#!/usr/bin/env bash
# TCurses State Sync Module
# File-based state synchronization for multi-process TUIs

# Include guard
[[ -n "${_TCURSES_STATE_LOADED:-}" ]] && return
declare -g _TCURSES_STATE_LOADED=1

# ============================================================================
# STATE FILE MANAGEMENT
# Provides atomic file-based state sync between processes
# ============================================================================

# State directory (defaults to /tmp/tcurses-$USER)
_TCURSES_STATE_DIR="${TCURSES_STATE_DIR:-/tmp/tcurses-${USER:-$(id -un)}}"
_TCURSES_STATE_PREFIX=""
_TCURSES_STATE_INITIALIZED=false

# State file paths (set by tcurses_state_init)
declare -g TCURSES_STATE_FILE=""
declare -g TCURSES_EVENTS_FILE=""

# Initialize state system with unique prefix
# Usage: tcurses_state_init [PREFIX]
# Example: tcurses_state_init "midi_repl"
tcurses_state_init() {
    local prefix="${1:-tcurses}"

    _TCURSES_STATE_PREFIX="${prefix}_$$"

    # Create state directory
    mkdir -p "$_TCURSES_STATE_DIR" 2>/dev/null

    # Set file paths
    TCURSES_STATE_FILE="$_TCURSES_STATE_DIR/${_TCURSES_STATE_PREFIX}_state"
    TCURSES_EVENTS_FILE="$_TCURSES_STATE_DIR/${_TCURSES_STATE_PREFIX}_events"

    # Initialize empty state file
    : > "$TCURSES_STATE_FILE"
    : > "$TCURSES_EVENTS_FILE"

    _TCURSES_STATE_INITIALIZED=true
}

# Cleanup state files
# Usage: tcurses_state_cleanup
tcurses_state_cleanup() {
    [[ "$_TCURSES_STATE_INITIALIZED" != "true" ]] && return

    rm -f "$TCURSES_STATE_FILE" 2>/dev/null
    rm -f "$TCURSES_EVENTS_FILE" 2>/dev/null

    _TCURSES_STATE_INITIALIZED=false
}

# ============================================================================
# KEY-VALUE STATE
# Simple key=value storage with atomic writes
# ============================================================================

# Set a state value (atomic write)
# Usage: tcurses_state_set KEY VALUE
tcurses_state_set() {
    local key="$1"
    local value="$2"

    [[ "$_TCURSES_STATE_INITIALIZED" != "true" ]] && return 1

    # Read current state, update key, write back atomically
    local tmpfile="${TCURSES_STATE_FILE}.tmp.$$"
    {
        # Copy existing keys except the one we're updating
        grep -v "^${key}=" "$TCURSES_STATE_FILE" 2>/dev/null || true
        # Add new key=value
        echo "${key}=${value}"
    } > "$tmpfile"

    mv "$tmpfile" "$TCURSES_STATE_FILE"
}

# Get a state value
# Usage: value=$(tcurses_state_get KEY [DEFAULT])
tcurses_state_get() {
    local key="$1"
    local default="${2:-}"

    [[ "$_TCURSES_STATE_INITIALIZED" != "true" ]] && { echo "$default"; return 1; }

    local value
    value=$(grep "^${key}=" "$TCURSES_STATE_FILE" 2>/dev/null | head -1 | cut -d= -f2-)

    echo "${value:-$default}"
}

# Set multiple state values at once (atomic)
# Usage: tcurses_state_set_multi "key1=val1" "key2=val2" ...
tcurses_state_set_multi() {
    [[ "$_TCURSES_STATE_INITIALIZED" != "true" ]] && return 1

    local tmpfile="${TCURSES_STATE_FILE}.tmp.$$"

    # Build new state file
    {
        # Start with existing state
        cat "$TCURSES_STATE_FILE" 2>/dev/null || true

        # Add new pairs (will override existing via later grep)
        for pair in "$@"; do
            echo "$pair"
        done
    } | awk -F= '!seen[$1]++ {print}' | tac | awk -F= '!seen[$1]++ {print}' | tac > "$tmpfile"

    mv "$tmpfile" "$TCURSES_STATE_FILE"
}

# Write full state string (replaces all state)
# Usage: tcurses_state_write "key1=val1 key2=val2 ..."
tcurses_state_write() {
    local state_str="$1"

    [[ "$_TCURSES_STATE_INITIALIZED" != "true" ]] && return 1

    local tmpfile="${TCURSES_STATE_FILE}.tmp.$$"

    # Convert space-separated to newline-separated
    echo "$state_str" | tr ' ' '\n' > "$tmpfile"
    mv "$tmpfile" "$TCURSES_STATE_FILE"
}

# Read all state as associative array (nameref)
# Usage: declare -A mystate; tcurses_state_read_all mystate
tcurses_state_read_all() {
    local -n _state_ref="$1"

    [[ "$_TCURSES_STATE_INITIALIZED" != "true" ]] && return 1

    _state_ref=()
    while IFS='=' read -r key value; do
        [[ -n "$key" ]] && _state_ref["$key"]="$value"
    done < "$TCURSES_STATE_FILE"
}

# Check if state file was modified since last check
# Usage: if tcurses_state_changed; then ... fi
# Note: Call tcurses_state_mark_read after processing
_TCURSES_STATE_LAST_MTIME=0

tcurses_state_changed() {
    [[ "$_TCURSES_STATE_INITIALIZED" != "true" ]] && return 1

    local mtime
    if [[ "$(uname)" == "Darwin" ]]; then
        mtime=$(stat -f %m "$TCURSES_STATE_FILE" 2>/dev/null || echo 0)
    else
        mtime=$(stat -c %Y "$TCURSES_STATE_FILE" 2>/dev/null || echo 0)
    fi

    [[ "$mtime" -gt "$_TCURSES_STATE_LAST_MTIME" ]]
}

tcurses_state_mark_read() {
    if [[ "$(uname)" == "Darwin" ]]; then
        _TCURSES_STATE_LAST_MTIME=$(stat -f %m "$TCURSES_STATE_FILE" 2>/dev/null || echo 0)
    else
        _TCURSES_STATE_LAST_MTIME=$(stat -c %Y "$TCURSES_STATE_FILE" 2>/dev/null || echo 0)
    fi
}

# ============================================================================
# EVENT RING BUFFER
# Circular buffer for events with fixed maximum size
# ============================================================================

_TCURSES_EVENTS_MAX=4
_TCURSES_EVENTS_LAST_MTIME=0

# Set max events in ring buffer
# Usage: tcurses_events_set_max 10
tcurses_events_set_max() {
    _TCURSES_EVENTS_MAX="$1"
}

# Add event to ring buffer
# Usage: tcurses_events_add "Event message here"
tcurses_events_add() {
    local event="$1"

    [[ "$_TCURSES_STATE_INITIALIZED" != "true" ]] && return 1

    local tmpfile="${TCURSES_EVENTS_FILE}.tmp.$$"

    # Append event and keep only last N lines
    {
        cat "$TCURSES_EVENTS_FILE" 2>/dev/null || true
        echo "$event"
    } | tail -"$_TCURSES_EVENTS_MAX" > "$tmpfile"

    mv "$tmpfile" "$TCURSES_EVENTS_FILE"
}

# Read all events
# Usage: mapfile -t events < <(tcurses_events_read)
tcurses_events_read() {
    [[ "$_TCURSES_STATE_INITIALIZED" != "true" ]] && return 1
    cat "$TCURSES_EVENTS_FILE" 2>/dev/null
}

# Clear events
# Usage: tcurses_events_clear
tcurses_events_clear() {
    [[ "$_TCURSES_STATE_INITIALIZED" != "true" ]] && return 1
    : > "$TCURSES_EVENTS_FILE"
}

# Check if events changed
tcurses_events_changed() {
    [[ "$_TCURSES_STATE_INITIALIZED" != "true" ]] && return 1

    local mtime
    if [[ "$(uname)" == "Darwin" ]]; then
        mtime=$(stat -f %m "$TCURSES_EVENTS_FILE" 2>/dev/null || echo 0)
    else
        mtime=$(stat -c %Y "$TCURSES_EVENTS_FILE" 2>/dev/null || echo 0)
    fi

    [[ "$mtime" -gt "$_TCURSES_EVENTS_LAST_MTIME" ]]
}

tcurses_events_mark_read() {
    if [[ "$(uname)" == "Darwin" ]]; then
        _TCURSES_EVENTS_LAST_MTIME=$(stat -f %m "$TCURSES_EVENTS_FILE" 2>/dev/null || echo 0)
    else
        _TCURSES_EVENTS_LAST_MTIME=$(stat -c %Y "$TCURSES_EVENTS_FILE" 2>/dev/null || echo 0)
    fi
}

# ============================================================================
# BACKGROUND REFRESH LOOP
# Polling loop for state/event file changes
# ============================================================================

_TCURSES_REFRESH_PID=""
_TCURSES_REFRESH_INTERVAL=0.1

# Start background refresh loop
# Usage: tcurses_state_start_refresh CALLBACK_FUNCTION [INTERVAL]
# Example: tcurses_state_start_refresh my_render_func 0.1
tcurses_state_start_refresh() {
    local callback="$1"
    local interval="${2:-$_TCURSES_REFRESH_INTERVAL}"

    # Stop existing refresh if running
    tcurses_state_stop_refresh

    # Start background loop
    (
        while true; do
            if tcurses_state_changed || tcurses_events_changed; then
                tcurses_state_mark_read
                tcurses_events_mark_read
                "$callback"
            fi
            sleep "$interval"
        done
    ) &

    _TCURSES_REFRESH_PID=$!
}

# Stop background refresh loop
# Usage: tcurses_state_stop_refresh
tcurses_state_stop_refresh() {
    if [[ -n "$_TCURSES_REFRESH_PID" ]]; then
        kill "$_TCURSES_REFRESH_PID" 2>/dev/null || true
        wait "$_TCURSES_REFRESH_PID" 2>/dev/null || true
        _TCURSES_REFRESH_PID=""
    fi
}

# ============================================================================
# CONVENIENCE FUNCTIONS
# ============================================================================

# Get state file path (for external processes to write to)
# Usage: state_file=$(tcurses_state_get_file)
tcurses_state_get_file() {
    echo "$TCURSES_STATE_FILE"
}

# Get events file path
# Usage: events_file=$(tcurses_state_get_events_file)
tcurses_state_get_events_file() {
    echo "$TCURSES_EVENTS_FILE"
}

# Debug: dump state
tcurses_state_debug() {
    echo "=== TCurses State Debug ==="
    echo "State Dir: $_TCURSES_STATE_DIR"
    echo "Prefix: $_TCURSES_STATE_PREFIX"
    echo "State File: $TCURSES_STATE_FILE"
    echo "Events File: $TCURSES_EVENTS_FILE"
    echo "Initialized: $_TCURSES_STATE_INITIALIZED"
    echo ""
    echo "=== State Contents ==="
    cat "$TCURSES_STATE_FILE" 2>/dev/null || echo "(empty)"
    echo ""
    echo "=== Events Contents ==="
    cat "$TCURSES_EVENTS_FILE" 2>/dev/null || echo "(empty)"
}
