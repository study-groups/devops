#!/usr/bin/env bash
# Estovox Animation Engine
# Handles animation loop and preset application

estovox_apply_preset() {
    local preset_name=$1
    local rate=${2:-0.3}
    local preset_data=""

    # Try phoneme first
    preset_data=$(estovox_get_phoneme_preset "$preset_name" 2>/dev/null)

    # Try expression if phoneme not found
    if [[ -z "$preset_data" ]]; then
        preset_data=$(estovox_get_expression_preset "$preset_name" 2>/dev/null)
    fi

    if [[ -z "$preset_data" ]]; then
        echo "Unknown preset: $preset_name" >&2
        return 1
    fi

    # Apply each parameter
    while IFS= read -r param_value; do
        if [[ -n "$param_value" ]]; then
            IFS=':' read -r param value <<< "$param_value"
            estovox_set_target "$param" "$value" "$rate"
        fi
    done <<< "$preset_data"

    return 0
}

estovox_play_sequence() {
    local -a sequence=("$@")

    for item in "${sequence[@]}"; do
        IFS=':' read -r phoneme duration <<< "$item"
        estovox_apply_preset "$phoneme" 0.4

        local frames=$((duration / ESTOVOX_FRAME_TIME_MS))
        for ((i=0; i<frames; i++)); do
            estovox_update_frame
            estovox_render_frame
            sleep 0.02
        done
    done
}

# Animation loop (run in background)
estovox_animation_loop() {
    while (( ESTOVOX_RUNNING )); do
        estovox_update_frame
        estovox_render_frame
        sleep $(bc -l <<< "$ESTOVOX_FRAME_TIME_MS / 1000")
    done
}

estovox_start_animation() {
    if [[ -n "$ESTOVOX_ANIMATION_PID" ]] && kill -0 "$ESTOVOX_ANIMATION_PID" 2>/dev/null; then
        return 0
    fi

    ESTOVOX_RUNNING=1
    estovox_animation_loop &
    ESTOVOX_ANIMATION_PID=$!
}

estovox_stop_animation() {
    ESTOVOX_RUNNING=0
    if [[ -n "$ESTOVOX_ANIMATION_PID" ]]; then
        kill "$ESTOVOX_ANIMATION_PID" 2>/dev/null
        wait "$ESTOVOX_ANIMATION_PID" 2>/dev/null
        ESTOVOX_ANIMATION_PID=""
    fi
}
