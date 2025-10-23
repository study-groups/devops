#!/usr/bin/env bash
# EstoVox Core State Management
# Part of the Tetra Framework
# Manages facial muscle state variables and animation targets

ESTOVOX_VERSION="0.1.0"

# === STATE VARIABLES (normalized 0.0-1.0) ===

# Eyebrow state
declare -g ESTOVOX_EYEBROW_L_HEIGHT=0.5
declare -g ESTOVOX_EYEBROW_R_HEIGHT=0.5
declare -g ESTOVOX_EYEBROW_L_ARCH=0.5
declare -g ESTOVOX_EYEBROW_R_ARCH=0.5
declare -g ESTOVOX_EYEBROW_L_ANGLE=0.5
declare -g ESTOVOX_EYEBROW_R_ANGLE=0.5
declare -g ESTOVOX_EYEBROW_SYMMETRY=1.0

# Eye state
declare -g ESTOVOX_EYE_OPENNESS=1.0
declare -g ESTOVOX_EYE_L_OPENNESS=1.0
declare -g ESTOVOX_EYE_R_OPENNESS=1.0
declare -g ESTOVOX_GAZE_H=0.5
declare -g ESTOVOX_GAZE_V=0.5

# Mouth/articulator state (IPA-based)
declare -g ESTOVOX_JAW_OPENNESS=0.0
declare -g ESTOVOX_JAW_FORWARD=0.0
declare -g ESTOVOX_LIP_ROUNDING=0.0
declare -g ESTOVOX_LIP_COMPRESSION=0.0
declare -g ESTOVOX_LIP_PROTRUSION=0.0
declare -g ESTOVOX_LIP_CORNER_HEIGHT=0.5
declare -g ESTOVOX_TONGUE_HEIGHT=0.5
declare -g ESTOVOX_TONGUE_FRONTNESS=0.5
declare -g ESTOVOX_TONGUE_GROOVED=0.0
declare -g ESTOVOX_VELUM_LOWERED=0.0

# Animation configuration
declare -g ESTOVOX_FRAME_TIME_MS=20
declare -g ESTOVOX_RUNNING=0
declare -g ESTOVOX_ANIMATION_PID=""

# Target system (for tweening)
declare -gA ESTOVOX_TARGETS=()
declare -gA ESTOVOX_RATES=()

# All animatable parameters
declare -ga ESTOVOX_PARAMS=(
    ESTOVOX_EYEBROW_L_HEIGHT ESTOVOX_EYEBROW_R_HEIGHT
    ESTOVOX_EYEBROW_L_ARCH ESTOVOX_EYEBROW_R_ARCH
    ESTOVOX_EYEBROW_L_ANGLE ESTOVOX_EYEBROW_R_ANGLE
    ESTOVOX_EYEBROW_SYMMETRY
    ESTOVOX_EYE_OPENNESS ESTOVOX_EYE_L_OPENNESS ESTOVOX_EYE_R_OPENNESS
    ESTOVOX_GAZE_H ESTOVOX_GAZE_V
    ESTOVOX_JAW_OPENNESS ESTOVOX_JAW_FORWARD
    ESTOVOX_LIP_ROUNDING ESTOVOX_LIP_COMPRESSION ESTOVOX_LIP_PROTRUSION
    ESTOVOX_LIP_CORNER_HEIGHT
    ESTOVOX_TONGUE_HEIGHT ESTOVOX_TONGUE_FRONTNESS ESTOVOX_TONGUE_GROOVED
    ESTOVOX_VELUM_LOWERED
)

# === MATH UTILITIES ===

estovox_lerp() {
    local current=$1
    local target=$2
    local rate=$3
    bc -l <<< "$current + ($target - $current) * $rate"
}

estovox_clamp() {
    local value=$1
    local min=${2:-0.0}
    local max=${3:-1.0}

    if (( $(bc -l <<< "$value < $min") )); then
        echo "$min"
    elif (( $(bc -l <<< "$value > $max") )); then
        echo "$max"
    else
        echo "$value"
    fi
}

# === STATE GETTERS/SETTERS ===

estovox_get_param() {
    local param=$1
    echo "${!param}"
}

estovox_set_param() {
    local param=$1
    local value=$2
    value=$(estovox_clamp "$value")
    eval "$param='$value'"
}

estovox_set_target() {
    local param=$1
    local value=$2
    local rate=${3:-0.2}

    ESTOVOX_TARGETS["$param"]=$value
    ESTOVOX_RATES["$param"]=$rate
}

estovox_clear_target() {
    local param=$1
    unset "ESTOVOX_TARGETS[$param]"
    unset "ESTOVOX_RATES[$param]"
}

estovox_has_target() {
    local param=$1
    [[ -n "${ESTOVOX_TARGETS[$param]}" ]]
}

# === SYMMETRY ENFORCEMENT ===

estovox_apply_symmetry() {
    if (( $(bc -l <<< "$ESTOVOX_EYEBROW_SYMMETRY > 0.5") )); then
        local avg_height=$(bc -l <<< "($ESTOVOX_EYEBROW_L_HEIGHT + $ESTOVOX_EYEBROW_R_HEIGHT) / 2")
        local avg_arch=$(bc -l <<< "($ESTOVOX_EYEBROW_L_ARCH + $ESTOVOX_EYEBROW_R_ARCH) / 2")

        ESTOVOX_EYEBROW_L_HEIGHT=$(estovox_lerp "$ESTOVOX_EYEBROW_L_HEIGHT" "$avg_height" "$ESTOVOX_EYEBROW_SYMMETRY")
        ESTOVOX_EYEBROW_R_HEIGHT=$(estovox_lerp "$ESTOVOX_EYEBROW_R_HEIGHT" "$avg_height" "$ESTOVOX_EYEBROW_SYMMETRY")
        ESTOVOX_EYEBROW_L_ARCH=$(estovox_lerp "$ESTOVOX_EYEBROW_L_ARCH" "$avg_arch" "$ESTOVOX_EYEBROW_SYMMETRY")
        ESTOVOX_EYEBROW_R_ARCH=$(estovox_lerp "$ESTOVOX_EYEBROW_R_ARCH" "$avg_arch" "$ESTOVOX_EYEBROW_SYMMETRY")
    fi
}

# === FRAME UPDATE ===

estovox_update_frame() {
    for param in "${ESTOVOX_PARAMS[@]}"; do
        if estovox_has_target "$param"; then
            local current=$(estovox_get_param "$param")
            local target="${ESTOVOX_TARGETS[$param]}"
            local rate="${ESTOVOX_RATES[$param]}"

            local new_value=$(estovox_lerp "$current" "$target" "$rate")
            new_value=$(estovox_clamp "$new_value")
            estovox_set_param "$param" "$new_value"

            # Clear target if close enough
            local diff=$(bc -l <<< "($new_value - $target)" | tr -d '-')
            if (( $(bc -l <<< "$diff < 0.01") )); then
                estovox_clear_target "$param"
            fi
        fi
    done

    estovox_apply_symmetry
}

# === STATE RESET ===

estovox_reset_state() {
    ESTOVOX_EYEBROW_L_HEIGHT=0.5
    ESTOVOX_EYEBROW_R_HEIGHT=0.5
    ESTOVOX_EYEBROW_L_ARCH=0.5
    ESTOVOX_EYEBROW_R_ARCH=0.5
    ESTOVOX_EYEBROW_L_ANGLE=0.5
    ESTOVOX_EYEBROW_R_ANGLE=0.5
    ESTOVOX_EYEBROW_SYMMETRY=1.0

    ESTOVOX_EYE_OPENNESS=1.0
    ESTOVOX_EYE_L_OPENNESS=1.0
    ESTOVOX_EYE_R_OPENNESS=1.0
    ESTOVOX_GAZE_H=0.5
    ESTOVOX_GAZE_V=0.5

    ESTOVOX_JAW_OPENNESS=0.0
    ESTOVOX_JAW_FORWARD=0.0
    ESTOVOX_LIP_ROUNDING=0.0
    ESTOVOX_LIP_COMPRESSION=0.0
    ESTOVOX_LIP_PROTRUSION=0.0
    ESTOVOX_LIP_CORNER_HEIGHT=0.5
    ESTOVOX_TONGUE_HEIGHT=0.5
    ESTOVOX_TONGUE_FRONTNESS=0.5
    ESTOVOX_TONGUE_GROOVED=0.0
    ESTOVOX_VELUM_LOWERED=0.0

    ESTOVOX_TARGETS=()
    ESTOVOX_RATES=()
}

# === INITIALIZATION ===

estovox_init_state() {
    estovox_reset_state
    return 0
}
