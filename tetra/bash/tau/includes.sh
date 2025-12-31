#!/usr/bin/env bash

# tau/includes.sh - TAU Audio Engine Module Bootstrap
#
# TAU is a real-time audio engine providing:
#   - 8 synth voices (sine/pulse with LIF modulation)
#   - 16 sample slots (MP3/WAV/FLAC playback)
#   - 4 mixer channels (gain/pan/SVF filters)
#   - Unix socket control protocol
#
# Usage:
#   source $TETRA_SRC/bash/tau/includes.sh

#==============================================================================
# BASH VERSION CHECK
#==============================================================================

if [[ ${BASH_VERSINFO[0]} -lt 5 || (${BASH_VERSINFO[0]} -eq 5 && ${BASH_VERSINFO[1]} -lt 2) ]]; then
    echo "tau: requires bash 5.2+, found ${BASH_VERSION}" >&2
    return 1
fi

#==============================================================================
# LOAD GUARD
#==============================================================================

[[ -n "$_TAU_LOADED" ]] && return 0
declare -g _TAU_LOADED=1

#==============================================================================
# MODULE INIT
#==============================================================================

: "${TETRA_SRC:?TETRA_SRC must be set}"
: "${TETRA_DIR:=$HOME/tetra}"

# TAU source and runtime directories
declare -g TAU_SRC="${TETRA_SRC}/bash/tau"
declare -g TAU_DIR="${TAU_DIR:-$HOME/tau}"
declare -g TAU_RUNTIME="${TAU_DIR}/runtime"

# TAU engine location (C engine at ~/src/tau)
declare -g TAU_ENGINE_SRC="${TAU_ENGINE_SRC:-$HOME/src/tau}"
declare -g TAU_ENGINE="${TAU_ENGINE_SRC}/engine/tau-engine"
declare -g TAU_SEND="${TAU_ENGINE_SRC}/engine/tau-send"

# Socket path
declare -g TAU_SOCKET="${TAU_RUNTIME}/tau.sock"

# Ensure runtime directory exists
mkdir -p "$TAU_RUNTIME"

#==============================================================================
# DEPENDENCY CHECK
#==============================================================================

_tau_check_engine() {
    if [[ ! -x "$TAU_ENGINE" ]]; then
        echo "tau: engine not found at $TAU_ENGINE" >&2
        echo "  Set TAU_ENGINE_SRC to tau source directory (default: ~/src/tau)" >&2
        return 1
    fi

    if [[ ! -x "$TAU_SEND" ]]; then
        echo "tau: tau-send not found at $TAU_SEND" >&2
        return 1
    fi

    return 0
}

#==============================================================================
# VERSION & INFO
#==============================================================================

declare -g TAU_VERSION="1.0.0"

tau_version() {
    echo "TAU $TAU_VERSION"
    echo "Module: $TAU_SRC"
    echo "Engine: $TAU_ENGINE"
    echo "Runtime: $TAU_RUNTIME"
}

tau_info() {
    echo "TAU - Real-time Audio Engine"
    echo ""
    tau_version
    echo ""
    echo "Status:"
    if [[ -x "$TAU_ENGINE" ]]; then
        printf "  %-12s %s\n" "Engine" "found"
    else
        printf "  %-12s %s\n" "Engine" "NOT FOUND"
    fi
    if [[ -x "$TAU_SEND" ]]; then
        printf "  %-12s %s\n" "tau-send" "found"
    else
        printf "  %-12s %s\n" "tau-send" "NOT FOUND"
    fi
    if [[ -S "$TAU_SOCKET" ]]; then
        printf "  %-12s %s\n" "Socket" "active"
    else
        printf "  %-12s %s\n" "Socket" "inactive"
    fi
}

#==============================================================================
# MODULE LOADING
#==============================================================================

# Check engine (warning only)
_tau_check_engine 2>/dev/null || true

# Source main tau module
[[ -f "$TAU_SRC/tau.sh" ]] && source "$TAU_SRC/tau.sh"

#==============================================================================
# EXPORTS
#==============================================================================

export TAU_SRC TAU_DIR TAU_RUNTIME TAU_VERSION
export TAU_ENGINE_SRC TAU_ENGINE TAU_SEND TAU_SOCKET
export -f tau_version tau_info _tau_check_engine
