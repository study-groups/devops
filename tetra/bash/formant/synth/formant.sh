#!/usr/bin/env bash
# Formant Synthesis Engine - Bash Wrapper
#
# Provides bash integration for the formant C engine

# Module configuration
FORMANT_MOD_NAME="formant"
FORMANT_MOD_DIR="${BASH_SOURCE[0]%/*}"
FORMANT_BIN="$FORMANT_MOD_DIR/bin/formant"

# Global state
FORMANT_PID=""
FORMANT_FIFO=""
FORMANT_FD=""

# ============================================================================
# Module initialization
# ============================================================================

formant_module_init() {
    # Check if binary exists
    if [[ ! -x "$FORMANT_BIN" ]]; then
        echo "ERROR: Formant binary not found. Run 'make' to build it." >&2
        return 1
    fi

    return 0
}

# ============================================================================
# Engine control
# ============================================================================

formant_start() {
    local sample_rate=${1:-48000}
    local buffer_size=${2:-512}

    # Create named pipe for IPC
    FORMANT_FIFO="/tmp/formant_ipc_$$"
    mkfifo "$FORMANT_FIFO" || return 1

    # Start formant engine
    "$FORMANT_BIN" --input "$FORMANT_FIFO" \
                   --sample-rate "$sample_rate" \
                   --buffer-size "$buffer_size" &
    FORMANT_PID=$!

    # Open FIFO for writing
    exec 3>"$FORMANT_FIFO"
    FORMANT_FD=3

    echo "Formant engine started (PID: $FORMANT_PID, FIFO: $FORMANT_FIFO)"
    echo "Sample rate: $sample_rate Hz, Buffer: $buffer_size samples"

    return 0
}

formant_stop() {
    if [[ -n "$FORMANT_PID" ]]; then
        # Send STOP command
        formant_send "STOP"
        sleep 0.2

        # Kill process if still running
        if kill -0 "$FORMANT_PID" 2>/dev/null; then
            kill "$FORMANT_PID"
        fi

        # Close FD and remove FIFO
        if [[ -n "$FORMANT_FD" ]]; then
            eval "exec ${FORMANT_FD}>&-"
        fi

        if [[ -e "$FORMANT_FIFO" ]]; then
            rm -f "$FORMANT_FIFO"
        fi

        echo "Formant engine stopped"
        FORMANT_PID=""
        FORMANT_FIFO=""
        FORMANT_FD=""
    fi
}

formant_send() {
    if [[ -z "$FORMANT_FD" ]]; then
        echo "ERROR: Formant engine not running" >&2
        return 1
    fi

    echo "$*" >&"$FORMANT_FD"
}

# ============================================================================
# High-level command functions
# ============================================================================

formant_phoneme() {
    local ipa=$1
    local duration=${2:-100}
    local pitch=${3:-120}
    local intensity=${4:-0.7}
    local rate=${5:-0.3}

    formant_send "PH $ipa $duration $pitch $intensity $rate"
}

formant_formant() {
    local f1=$1 f2=$2 f3=$3
    local bw1=${4:-50} bw2=${5:-100} bw3=${6:-150}
    local duration=${7:-100}

    formant_send "FM $f1 $f2 $f3 $bw1 $bw2 $bw3 $duration"
}

formant_prosody() {
    local param=$1
    local value=$2

    formant_send "PR $param $value"
}

formant_emotion() {
    local emotion=$1
    local intensity=${2:-0.7}

    formant_send "EM $emotion $intensity"
}

formant_reset() {
    formant_send "RESET"
}

# ============================================================================
# Sequence playback
# ============================================================================

formant_sequence() {
    # Play a sequence of phonemes
    # Usage: formant_sequence "h:80:120" "e:180:130" "l:100:125" "o:250:120"

    for spec in "$@"; do
        # Parse phoneme:duration:pitch
        IFS=':' read -r phoneme duration pitch <<< "$spec"

        duration=${duration:-100}
        pitch=${pitch:-120}

        formant_phoneme "$phoneme" "$duration" "$pitch"

        # Wait for duration (in milliseconds)
        sleep "$(bc -l <<< "scale=3; $duration / 1000")"
    done
}

# ============================================================================
# Integration helpers
# ============================================================================

formant_from_ui() {
    # Convert UI phoneme command to formant synthesis command
    local phoneme=$1
    local rate=${2:-0.3}
    local duration=${3:-100}

    # Map UI articulation to formant synthesis
    formant_phoneme "$phoneme" "$duration" 120 0.7 "$rate"
}

# ============================================================================
# Module cleanup
# ============================================================================

formant_module_cleanup() {
    formant_stop
}

# Auto-initialize if sourced
if [[ "${BASH_SOURCE[0]}" != "${0}" ]]; then
    formant_module_init
fi
