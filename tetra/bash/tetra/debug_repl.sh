#!/usr/bin/env bash
# REPL Debug Logger - Shared FIFO for development

REPL_DEBUG_FIFO="/tmp/tetra_repl_debug"

# Create FIFO if it doesn't exist
[[ -p "$REPL_DEBUG_FIFO" ]] || mkfifo "$REPL_DEBUG_FIFO"

# Debug log function
repl_debug() {
    local msg="$1"
    local timestamp=$(date '+%H:%M:%S.%3N')
    echo "[$timestamp] $msg" >> "$REPL_DEBUG_FIFO" 2>/dev/null &
}

# Log with context
repl_debug_key() {
    local key="$1"
    local hex=$(echo -n "$key" | od -An -tx1 | tr -d ' \n')
    repl_debug "KEY: raw='$key' hex=$hex"
}

repl_debug_state() {
    local state="$1"
    repl_debug "STATE: $state"
}

repl_debug_action() {
    local action="$1"
    local detail="${2:-}"
    repl_debug "ACTION: $action${detail:+ - $detail}"
}

# Watch FIFO helper (for user terminal)
repl_debug_watch() {
    echo "Watching REPL debug output at $REPL_DEBUG_FIFO"
    echo "Press Ctrl-C to stop"
    echo "─────────────────────────────────────────────"
    tail -f "$REPL_DEBUG_FIFO"
}

# Export functions
export -f repl_debug
export -f repl_debug_key
export -f repl_debug_state
export -f repl_debug_action
export -f repl_debug_watch
export REPL_DEBUG_FIFO
