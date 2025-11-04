#!/usr/bin/env bash

# Animation Controller - Central animation lifecycle and FPS tracking
# Provides unified control over all TUI animations with performance monitoring

# Animation state
declare -g ANIM_ENABLED=false
declare -g ANIM_PAUSED=false
declare -g ANIM_FPS_TARGET=30
declare -g ANIM_FPS_ACTUAL=0

# FPS tracking
declare -g ANIM_FRAME_COUNT=0
declare -g ANIM_LAST_FPS_CHECK=0
declare -g ANIM_FRAME_TIMES=()
declare -g ANIM_FRAME_HISTORY_SIZE=60

# Performance metrics
declare -g ANIM_FRAME_DROPS=0
declare -g ANIM_RENDER_TIME_MS=0

# Get current time in nanoseconds (portable for macOS and Linux)
_anim_get_time_ns() {
    if date +%s%N 2>/dev/null | grep -q 'N$'; then
        # macOS - use microseconds and convert
        echo $(($(gdate +%s%N 2>/dev/null || perl -MTime::HiRes=time -e 'printf "%.0f", time * 1000000000')))
    else
        # Linux - native nanosecond support
        date +%s%N
    fi
}

# Initialize animation controller
anim_init() {
    ANIM_ENABLED=false
    ANIM_PAUSED=false
    ANIM_FPS_TARGET=30
    ANIM_FRAME_COUNT=0
    ANIM_FRAME_DROPS=0
    ANIM_LAST_FPS_CHECK=$(_anim_get_time_ns)
    ANIM_FRAME_TIMES=()
}

# Toggle animation on/off
anim_toggle() {
    if [[ "$ANIM_ENABLED" == "true" ]]; then
        anim_stop
    else
        anim_start
    fi
}

# Start animation engine
anim_start() {
    ANIM_ENABLED=true
    ANIM_PAUSED=false
    osc_start
    ANIM_LAST_FPS_CHECK=$(_anim_get_time_ns)
    ANIM_FRAME_COUNT=0
}

# Stop animation engine
anim_stop() {
    ANIM_ENABLED=false
    osc_stop
}

# Pause (keep state but don't update)
anim_pause() {
    ANIM_PAUSED=true
}

# Resume from pause
anim_resume() {
    [[ "$ANIM_ENABLED" == "true" ]] && ANIM_PAUSED=false
}

# Check if animation should tick
anim_should_tick() {
    [[ "$ANIM_ENABLED" == "true" && "$ANIM_PAUSED" == "false" ]]
}

# Get target frame time in seconds
anim_get_frame_time() {
    awk "BEGIN {printf \"%.6f\", 1.0 / $ANIM_FPS_TARGET}"
}

# Record frame timing
anim_record_frame() {
    local now=$(_anim_get_time_ns)
    local frame_time_ns=$((now - ANIM_LAST_FPS_CHECK))

    ((ANIM_FRAME_COUNT++))

    # Store frame time (convert ns to ms)
    local frame_time_ms=$((frame_time_ns / 1000000))
    ANIM_FRAME_TIMES+=($frame_time_ms)

    # Keep only recent history
    if [[ ${#ANIM_FRAME_TIMES[@]} -gt $ANIM_FRAME_HISTORY_SIZE ]]; then
        ANIM_FRAME_TIMES=("${ANIM_FRAME_TIMES[@]:1}")
    fi

    # Calculate FPS every second (avoid bc, use awk)
    local elapsed_sec=$(awk "BEGIN {printf \"%.3f\", $frame_time_ns / 1000000000}")
    if awk "BEGIN {exit !($elapsed_sec >= 1.0)}"; then
        ANIM_FPS_ACTUAL=$ANIM_FRAME_COUNT
        ANIM_FRAME_COUNT=0
        ANIM_LAST_FPS_CHECK=$now
    fi
}

# Get current FPS
anim_get_fps() {
    echo "$ANIM_FPS_ACTUAL"
}

# Get average frame time from recent history
anim_get_avg_frame_time() {
    if [[ ${#ANIM_FRAME_TIMES[@]} -eq 0 ]]; then
        echo "0"
        return
    fi

    local sum=0
    for t in "${ANIM_FRAME_TIMES[@]}"; do
        sum=$((sum + t))
    done
    echo $((sum / ${#ANIM_FRAME_TIMES[@]}))
}

# Detect if we're dropping frames
anim_check_performance() {
    local target_ms=$(awk "BEGIN {printf \"%.0f\", 1000 / $ANIM_FPS_TARGET}")
    local avg_ms=$(anim_get_avg_frame_time)

    if [[ $avg_ms -gt $target_ms ]]; then
        ((ANIM_FRAME_DROPS++))
        return 1
    fi
    return 0
}

# Get performance stats as string
anim_get_stats() {
    local avg_ft=$(anim_get_avg_frame_time)
    echo "FPS: ${ANIM_FPS_ACTUAL}/${ANIM_FPS_TARGET} | Avg Frame: ${avg_ft}ms | Drops: ${ANIM_FRAME_DROPS}"
}

# Set target FPS
anim_set_fps() {
    local fps="${1:-30}"
    [[ $fps -lt 1 ]] && fps=1
    [[ $fps -gt 120 ]] && fps=120
    ANIM_FPS_TARGET=$fps
}

# Get animation status string
anim_get_status() {
    if [[ "$ANIM_ENABLED" == "true" ]]; then
        [[ "$ANIM_PAUSED" == "true" ]] && echo "PAUSED" || echo "ON"
    else
        echo "OFF"
    fi
}
