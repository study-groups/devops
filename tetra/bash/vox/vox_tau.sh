#!/usr/bin/env bash

# vox_tau.sh - Core tau audio engine integration for vox
# Provides socket communication and audio playback via tau

# Load daemon management
source "${VOX_SRC}/vox_tau_daemon.sh"

# Load latency measurement (optional)
[[ -f "${VOX_SRC}/vox_tau_latency.sh" ]] && source "${VOX_SRC}/vox_tau_latency.sh"

# Load drum synthesis (optional)
[[ -f "${VOX_SRC}/vox_tau_drums.sh" ]] && source "${VOX_SRC}/vox_tau_drums.sh"

#==============================================================================
# SAMPLE SLOT MANAGEMENT
#==============================================================================

# Track slot usage (round-robin through 1-8, reserve 9-16)
declare -g VOX_TAU_SLOT_NEXT=1
declare -g VOX_TAU_SLOT_MAX=8

# Get next available slot
_vox_tau_next_slot() {
    local slot=$VOX_TAU_SLOT_NEXT
    VOX_TAU_SLOT_NEXT=$(( (slot % VOX_TAU_SLOT_MAX) + 1 ))
    echo "$slot"
}

#==============================================================================
# SOCKET COMMUNICATION
#==============================================================================

# Send command to tau-engine, return response
# Usage: vox_tau_send "COMMAND args..."
# Returns: 0 on OK response, 1 on error
vox_tau_send() {
    local cmd="$*"

    if ! _vox_tau_socket_ready; then
        echo "Error: tau socket not ready" >&2
        return 1
    fi

    local response
    response=$(_vox_tau_send "$cmd" 2>&1)
    local rc=$?

    if [[ $rc -ne 0 ]]; then
        echo "Error: tau-send failed: $response" >&2
        return 1
    fi

    # Check for OK response
    if [[ "$response" == OK* ]]; then
        echo "$response"
        return 0
    elif [[ "$response" == ERROR* ]]; then
        echo "tau error: $response" >&2
        return 1
    else
        # Unknown response format, return it
        echo "$response"
        return 0
    fi
}

#==============================================================================
# AUDIO PLAYBACK
#==============================================================================

# Play audio file through tau
# Usage: vox_tau_play_audio <file> [--wait] [--gain N]
vox_tau_play_audio() {
    local file=""
    local wait=false
    local gain="1.0"
    local channel="0"

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --wait|-w) wait=true; shift ;;
            --gain|-g) gain="$2"; shift 2 ;;
            --channel|-c) channel="$2"; shift 2 ;;
            *) file="$1"; shift ;;
        esac
    done

    if [[ -z "$file" ]]; then
        echo "Error: file required" >&2
        return 1
    fi

    if [[ ! -f "$file" ]]; then
        echo "Error: file not found: $file" >&2
        return 1
    fi

    # Ensure tau is running
    vox_tau_ensure_running || return 1

    # Get slot
    local slot=$(_vox_tau_next_slot)

    # Load file
    vox_tau_send "SAMPLE $slot LOAD $file" >/dev/null || return 1

    # Set gain and channel
    vox_tau_send "SAMPLE $slot GAIN $gain" >/dev/null
    vox_tau_send "SAMPLE $slot CHAN $channel" >/dev/null

    # Trigger playback
    vox_tau_send "SAMPLE $slot TRIG" >/dev/null || return 1

    if $wait; then
        # Estimate duration from file and wait
        # TODO: Get actual duration from tau or file metadata
        local duration
        duration=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$file" 2>/dev/null)
        if [[ -n "$duration" ]]; then
            sleep "$duration"
        else
            # Fallback: poll sample status
            while true; do
                local status
                status=$(vox_tau_send "SAMPLE $slot STATUS" 2>/dev/null) || break
                if [[ "$status" != *"PLAYING"* ]]; then
                    break
                fi
                sleep 0.1
            done
        fi
    fi

    return 0
}

# Stop all sample playback
vox_tau_stop_all() {
    vox_tau_ensure_running || return 1

    for slot in $(seq 1 16); do
        vox_tau_send "SAMPLE $slot STOP" >/dev/null 2>&1 || true
    done
}

# Stop specific slot
vox_tau_stop() {
    local slot="${1:-1}"
    vox_tau_send "SAMPLE $slot STOP"
}

#==============================================================================
# MIXER CONTROL
#==============================================================================

# Set master gain
vox_tau_master() {
    local gain="${1:-1.0}"
    vox_tau_send "MASTER $gain"
}

# Set channel gain
vox_tau_channel_gain() {
    local channel="${1:-0}"
    local gain="${2:-1.0}"
    vox_tau_send "CH $channel GAIN $gain"
}

# Set channel pan
vox_tau_channel_pan() {
    local channel="${1:-0}"
    local pan="${2:-0.0}"
    vox_tau_send "CH $channel PAN $pan"
}

#==============================================================================
# VOX COMMAND INTERFACE
#==============================================================================

# Main tau subcommand handler
# Usage: vox tau <subcommand> [args...]
vox_tau_cmd() {
    local cmd="${1:-status}"
    shift || true

    case "$cmd" in
        # Daemon management
        status)
            vox_tau_daemon_status
            ;;
        start)
            vox_tau_daemon_start
            ;;
        stop)
            vox_tau_daemon_stop
            ;;
        restart)
            vox_tau_daemon_restart
            ;;

        # Playback
        play)
            vox_tau_play_audio "$@"
            ;;
        stop-all)
            vox_tau_stop_all
            ;;

        # Mixer
        master)
            vox_tau_master "$@"
            ;;
        channel)
            local ch="$1"
            local subcmd="$2"
            shift 2 || true
            case "$subcmd" in
                gain) vox_tau_channel_gain "$ch" "$@" ;;
                pan) vox_tau_channel_pan "$ch" "$@" ;;
                *) echo "Usage: vox tau channel <n> gain|pan <value>" >&2 ;;
            esac
            ;;

        # Direct commands
        send)
            vox_tau_send "$@"
            ;;
        devices)
            vox_tau_send "DEVICES"
            ;;

        # Latency measurement
        latency)
            if declare -f vox_latency_cmd &>/dev/null; then
                vox_latency_cmd "$@"
            else
                echo "Error: latency module not loaded" >&2
                return 1
            fi
            ;;

        # Drum synthesis
        drum|drums)
            if declare -f vox_tau_drum_cmd &>/dev/null; then
                vox_tau_drum_cmd "$@"
            else
                echo "Error: drum module not loaded" >&2
                return 1
            fi
            ;;

        # Help
        help|--help|-h)
            cat <<'EOF'
vox tau - Tau audio engine integration

DAEMON:
  vox tau status          Check if tau-engine is running
  vox tau start           Start tau-engine daemon
  vox tau stop            Stop tau-engine daemon
  vox tau restart         Restart tau-engine

PLAYBACK:
  vox tau play <file>     Play audio file
    --wait                Wait for playback to complete
    --gain <0-1>          Set gain (default: 1.0)
  vox tau stop-all        Stop all playback

MIXER:
  vox tau master <0-1>    Set master gain
  vox tau channel <n> gain <0-1>
  vox tau channel <n> pan <-1 to 1>

LATENCY:
  vox tau latency quick   Quick socket round-trip test
  vox tau latency simple  Timestamp-based measurement
  vox tau latency loopback Full audio detection test (BlackHole)
  vox tau latency help    More latency options

DRUMS:
  vox tau drum init       Initialize drum voices
  vox tau drum trigger bd Trigger single drum (bd/sd/cp/hh)
  vox tau drum preset house 128  Play preset pattern
  vox tau drum help       More drum options

DIRECT:
  vox tau send <cmd>      Send raw command to tau-engine
  vox tau devices         List audio devices

ENVIRONMENT:
  TAU_SRC                 Tau source directory
  TAU_RUNTIME             Runtime dir (default: ~/tau/runtime)
  TAU_SOCKET              Socket path
EOF
            ;;

        *)
            echo "Unknown tau command: $cmd" >&2
            echo "Run 'vox tau help' for usage" >&2
            return 1
            ;;
    esac
}

#==============================================================================
# EXPORTS
#==============================================================================

export -f vox_tau_send vox_tau_cmd
export -f vox_tau_play_audio vox_tau_stop_all vox_tau_stop
export -f vox_tau_master vox_tau_channel_gain vox_tau_channel_pan
export -f _vox_tau_next_slot
