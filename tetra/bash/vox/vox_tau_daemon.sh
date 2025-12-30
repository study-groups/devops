#!/usr/bin/env bash

# vox_tau_daemon.sh - Tau audio engine daemon lifecycle management
# Uses TSM (Tetra Service Manager) for process management
# Service definition: ~/tetra/orgs/tetra/tsm/services-available/tau.tsm

#==============================================================================
# CONFIGURATION
#==============================================================================

# TAU module source (tetra module)
: "${TAU_SRC:=${TETRA_SRC:-}/bash/tau}"

# TAU engine source (C engine at ~/src/tau)
: "${TAU_ENGINE_SRC:=$HOME/src/tau}"

# Runtime paths
: "${TAU_RUNTIME:=$HOME/tau/runtime}"
: "${TAU_SOCKET:=$TAU_RUNTIME/tau.sock}"

# Binaries (from engine source, not module)
: "${TAU_ENGINE:=$TAU_ENGINE_SRC/engine/tau-engine}"
: "${TAU_SEND:=$TAU_ENGINE_SRC/engine/tau-send}"

# Engine defaults (used by tau.tsm)
export TAU_SAMPLE_RATE="${TAU_SAMPLE_RATE:-48000}"
export TAU_BUFFER_FRAMES="${TAU_BUFFER_FRAMES:-512}"

#==============================================================================
# INTERNAL HELPERS
#==============================================================================

_vox_tau_socket_ready() {
    [[ -S "$TAU_SOCKET" ]]
}

_vox_tau_is_running() {
    # Check via TSM first
    if declare -f tsm_process_alive &>/dev/null; then
        tsm_process_alive "tau" && return 0
    fi
    # Fallback to pgrep
    pgrep -f "tau-engine.*--socket" &>/dev/null
}

_vox_tau_send() {
    if [[ ! -x "$TAU_SEND" ]]; then
        echo "Error: tau-send not found at $TAU_SEND" >&2
        return 1
    fi
    "$TAU_SEND" "$@"
}

#==============================================================================
# PUBLIC API (wraps TSM)
#==============================================================================

# Start tau-engine via TSM
# Returns: 0 on success, 1 on failure
vox_tau_daemon_start() {
    # Already running?
    if _vox_tau_is_running && _vox_tau_socket_ready; then
        echo "tau-engine already running" >&2
        return 0
    fi

    # Ensure runtime directory
    mkdir -p "$TAU_RUNTIME"

    # Clean stale socket
    [[ -e "$TAU_SOCKET" ]] && rm -f "$TAU_SOCKET"

    # Start via TSM
    if declare -f tsm_start &>/dev/null; then
        tsm_start tau || {
            echo "Error: tsm_start tau failed" >&2
            return 1
        }
    else
        # Fallback: direct start (if TSM not loaded)
        if [[ ! -x "$TAU_ENGINE" ]]; then
            echo "Error: tau-engine not found at $TAU_ENGINE" >&2
            return 1
        fi

        cd "$TAU_ENGINE_SRC/engine" || return 1
        "$TAU_ENGINE" \
            --sr "$TAU_SAMPLE_RATE" \
            --frames "$TAU_BUFFER_FRAMES" \
            --socket "$TAU_SOCKET" \
            >> "$TAU_RUNTIME/tau.log" 2>&1 &
    fi

    # Wait for socket (max 3s)
    local attempts=0
    while [[ $attempts -lt 30 ]]; do
        if _vox_tau_socket_ready; then
            echo "tau-engine started" >&2
            return 0
        fi
        sleep 0.1
        ((attempts++))
    done

    echo "Error: tau-engine socket not ready" >&2
    return 1
}

# Stop tau-engine via TSM
# Returns: 0 on success, 1 if not running
vox_tau_daemon_stop() {
    if ! _vox_tau_is_running; then
        echo "tau-engine not running" >&2
        return 1
    fi

    # Try graceful QUIT command first
    if _vox_tau_socket_ready; then
        _vox_tau_send "QUIT" 2>/dev/null || true
        sleep 0.3
    fi

    # Check if stopped
    if ! _vox_tau_is_running; then
        echo "tau-engine stopped" >&2
        rm -f "$TAU_SOCKET"
        return 0
    fi

    # Use TSM stop
    if declare -f tsm_stop &>/dev/null; then
        tsm_stop tau 2>/dev/null || true
    else
        # Fallback: pkill
        pkill -TERM -f "tau-engine.*--socket" 2>/dev/null || true
        sleep 0.3
        pkill -KILL -f "tau-engine.*--socket" 2>/dev/null || true
    fi

    rm -f "$TAU_SOCKET"
    echo "tau-engine stopped" >&2
    return 0
}

# Check daemon status
# Returns: 0 if running, 1 if not
vox_tau_daemon_status() {
    if _vox_tau_is_running; then
        echo "tau-engine: running" >&2
        echo "  Socket: $TAU_SOCKET" >&2

        if _vox_tau_socket_ready; then
            echo "  Status: ready" >&2
            # Get engine status
            local status
            status=$(_vox_tau_send "STATUS" 2>/dev/null) || true
            [[ -n "$status" ]] && echo "  Engine: $status" >&2
        else
            echo "  Status: socket missing" >&2
        fi
        return 0
    else
        echo "tau-engine: not running" >&2
        return 1
    fi
}

# Ensure daemon is running (idempotent)
vox_tau_ensure_running() {
    if _vox_tau_is_running && _vox_tau_socket_ready; then
        return 0
    fi
    vox_tau_daemon_start
}

# Restart daemon
vox_tau_daemon_restart() {
    vox_tau_daemon_stop 2>/dev/null || true
    sleep 0.2
    vox_tau_daemon_start
}

#==============================================================================
# EXPORTS
#==============================================================================

export TAU_SRC TAU_ENGINE_SRC TAU_ENGINE TAU_RUNTIME TAU_SOCKET TAU_SEND
export -f vox_tau_daemon_start vox_tau_daemon_stop vox_tau_daemon_status
export -f vox_tau_ensure_running vox_tau_daemon_restart
export -f _vox_tau_is_running _vox_tau_socket_ready _vox_tau_send
