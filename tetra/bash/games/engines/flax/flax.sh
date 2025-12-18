#!/usr/bin/env bash

# Flax Engine - Fast Buffer-Based Terminal Game Engine
# "Dumb and fast" - direct string accumulation, single flush
#
# Supports two backends:
#   native      - Pure bash (default)
#   accelerated - C co-processor (if bin/flaxd exists)
#
# Usage:
#   source "$GAMES_SRC/engines/flax/flax.sh"
#
#   my_render() {
#       flax_draw_text 1 1 "Hello Flax!" 46
#       flax_draw_rect 3 1 20 5
#   }
#
#   my_update() {
#       local key="$1"
#       # Handle input, update game state
#   }
#
#   flax_run my_render my_update 30

# Version
FLAX_VERSION="1.1.0"

# Locate engine source
if [[ -z "$FLAX_SRC" ]]; then
    FLAX_SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi
export FLAX_SRC

# Backend detection
declare -g FLAX_BACKEND="native"
declare -g FLAX_FIFO=""
declare -g FLAX_DAEMON_PID=""

# Check for C accelerator
if [[ -x "$FLAX_SRC/bin/flaxd" ]]; then
    FLAX_BACKEND="accelerated"
fi

# Force backend via environment
[[ -n "$FLAX_FORCE_BACKEND" ]] && FLAX_BACKEND="$FLAX_FORCE_BACKEND"

# Source components (native implementation)
source "$FLAX_SRC/buffer.sh"
source "$FLAX_SRC/draw.sh"
source "$FLAX_SRC/loop.sh"
source "$FLAX_SRC/sprites.sh"

# =============================================================================
# SESSION MANAGEMENT
# =============================================================================

# Get unique session ID (TTY-based)
flax_session_id() {
    local tty
    tty=$(tty 2>/dev/null) || tty="/dev/pts/unknown"
    echo "${tty##*/}"
}

# Get FIFO path for current session
flax_fifo_path() {
    echo "/tmp/flaxd_$(flax_session_id)"
}

# Check if flaxd is running for this session
flax_is_running() {
    local fifo=$(flax_fifo_path)
    [[ -p "$fifo" ]] && pgrep -f "flaxd" >/dev/null 2>&1
}

# =============================================================================
# TSM INTEGRATION
# =============================================================================

# Start flaxd via TSM (if available) or directly
flax_ensure_daemon() {
    [[ "$FLAX_BACKEND" != "accelerated" ]] && return 1

    # Already running?
    if flax_is_running; then
        FLAX_FIFO=$(flax_fifo_path)
        exec 3>"$FLAX_FIFO"
        return 0
    fi

    # Try TSM first
    if declare -f tsm >/dev/null 2>&1; then
        FLAX_SESSION_ID=$(flax_session_id)
        export FLAX_SESSION_ID
        tsm start flaxd 2>/dev/null
        sleep 0.1  # Give daemon time to start
        if flax_is_running; then
            FLAX_FIFO=$(flax_fifo_path)
            exec 3>"$FLAX_FIFO"
            FLAX_MANAGED_BY="tsm"
            return 0
        fi
    fi

    # Fall back to direct start
    flax_accel_start
}

# Stop flaxd (TSM-aware)
flax_release_daemon() {
    if [[ "$FLAX_MANAGED_BY" == "tsm" ]]; then
        # TSM manages lifecycle, just disconnect
        exec 3>&- 2>/dev/null
        FLAX_FIFO=""
    else
        # We own it, stop it
        flax_accel_stop
    fi
}

# =============================================================================
# ACCELERATED BACKEND (Direct Mode)
# =============================================================================

# Start the C daemon directly (not via TSM)
flax_accel_start() {
    [[ "$FLAX_BACKEND" != "accelerated" ]] && return 1

    # Create FIFO for commands
    FLAX_FIFO=$(flax_fifo_path)
    [[ -p "$FLAX_FIFO" ]] || mkfifo "$FLAX_FIFO" 2>/dev/null || return 1

    # Start daemon
    "$FLAX_SRC/bin/flaxd" < "$FLAX_FIFO" &
    FLAX_DAEMON_PID=$!

    # Open FIFO for writing
    exec 3>"$FLAX_FIFO"
    FLAX_MANAGED_BY="direct"

    return 0
}

# Stop the C daemon (direct mode only)
flax_accel_stop() {
    [[ -z "$FLAX_DAEMON_PID" ]] && return

    # Send quit command
    echo "QUIT" >&3 2>/dev/null

    # Close FIFO
    exec 3>&- 2>/dev/null

    # Cleanup
    rm -f "$FLAX_FIFO"
    wait "$FLAX_DAEMON_PID" 2>/dev/null

    FLAX_DAEMON_PID=""
    FLAX_FIFO=""
    FLAX_MANAGED_BY=""
}

# Send command to daemon
flax_accel_cmd() {
    echo "$*" >&3
}

# Read response from daemon
flax_accel_response() {
    # TODO: implement response reading via separate response FIFO
    :
}

# =============================================================================
# ENGINE INFO
# =============================================================================

flax_version() {
    echo "flax v$FLAX_VERSION"
}

flax_info() {
    cat << EOF
Flax Engine v$FLAX_VERSION
==========================
Fast buffer-based terminal game engine with sprite compositing.

Source:  $FLAX_SRC
Backend: $FLAX_BACKEND
Session: $(flax_session_id)
FIFO:    $(flax_fifo_path)

Backends:
  native       Pure bash (always available)
  accelerated  C co-processor (if bin/flaxd exists)

Core Functions:
  Buffer:  flax_clear, flax_add, flax_flush, flax_goto
  Draw:    flax_draw_text, flax_draw_rect, flax_draw_char
  Loop:    flax_loop, flax_run, flax_set_fps
  Input:   flax_read_key, flax_key_is
  Sprites: flax_sprite_create, flax_sprite_text, flax_sprites_render

Session Management:
  flax_ensure_daemon   Start/connect to flaxd (TSM or direct)
  flax_release_daemon  Disconnect (TSM) or stop (direct)
  flax_is_running      Check if flaxd is running for session

Built-in Keys:
  Q (Shift)  Quit
  P          Pause/unpause
  D          Toggle debug overlay

Config Variables:
  FLAX_FORCE_BACKEND   Force "native" or "accelerated"
  FLAX_BUILTIN_KEYS=0  Disable built-in key handling
  FLAX_DEBUG=1         Enable debug overlay

TSM Integration:
  tsm start flaxd      Start flaxd for current session
  tsm stop flaxd       Stop flaxd for current session
  tsm ps               List running flaxd instances

Quick Start:
  flax_run render_fn update_fn [fps]

Example:
  my_render() { flax_draw_text 1 1 "Hello!" 46; }
  my_update() { [[ "\$1" == "q" ]] && flax_stop; }
  flax_run my_render my_update 30
EOF
}

# =============================================================================
# EXPORTS
# =============================================================================

export FLAX_VERSION FLAX_BACKEND FLAX_FIFO FLAX_MANAGED_BY
export -f flax_version flax_info
export -f flax_session_id flax_fifo_path flax_is_running
export -f flax_ensure_daemon flax_release_daemon
export -f flax_accel_start flax_accel_stop flax_accel_cmd

echo "Flax engine v$FLAX_VERSION ($FLAX_BACKEND)" >&2
