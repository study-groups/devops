#!/usr/bin/env bash
# Estovox TUI Modes
# Mode management for command vs interactive control

declare -g ESTOVOX_MODE="command"  # command, interactive, ipa_chart
declare -g ESTOVOX_PREVIOUS_MODE="command"

# Control state for interactive mode
declare -gA ESTOVOX_CONTROLS=(
    [jaw_open]=0
    [jaw_close]=0
    [lip_round]=0
    [lip_spread]=0
    [tongue_up]=0
    [tongue_down]=0
    [tongue_forward]=0
    [tongue_back]=0
)

# === MODE SWITCHING ===

estovox_set_mode() {
    local new_mode=$1
    ESTOVOX_PREVIOUS_MODE="$ESTOVOX_MODE"
    ESTOVOX_MODE="$new_mode"
}

estovox_get_mode() {
    echo "$ESTOVOX_MODE"
}

estovox_is_mode() {
    local mode=$1
    [[ "$ESTOVOX_MODE" == "$mode" ]]
}

# === CONTROL STATE ===

estovox_set_control() {
    local control=$1
    local value=$2
    ESTOVOX_CONTROLS[$control]=$value
}

estovox_get_control() {
    local control=$1
    echo "${ESTOVOX_CONTROLS[$control]}"
}

estovox_clear_controls() {
    for key in "${!ESTOVOX_CONTROLS[@]}"; do
        ESTOVOX_CONTROLS[$key]=0
    done
}
