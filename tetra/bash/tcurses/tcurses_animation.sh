#!/usr/bin/env bash

# TCurses Animation Module
# BPM-synchronized animation loop with frame timing

# Include guard
[[ -n "${_TCURSES_ANIMATION_LOADED:-}" ]] && return
declare -g _TCURSES_ANIMATION_LOADED=1

# Animation state
_TCURSES_ANIM_ENABLED=false
_TCURSES_ANIM_PAUSED=false
_TCURSES_ANIM_BPM=120
_TCURSES_ANIM_FPS=30
_TCURSES_ANIM_FRAME_COUNT=0
_TCURSES_ANIM_FRAME_TIME=0.033333  # 30 FPS default

# Timing method detection (prefer bash builtin)
_TCURSES_ANIM_TIMING_METHOD="epochrealtime"  # bash 5.0+ builtin
if [[ -z "$EPOCHREALTIME" ]]; then
    # Fallback to gdate if available (GNU coreutils on macOS)
    if command -v gdate >/dev/null 2>&1; then
        _TCURSES_ANIM_TIMING_METHOD="gdate"
    elif date +%s%N 2>/dev/null | grep -qv 'N$'; then
        _TCURSES_ANIM_TIMING_METHOD="date"
    else
        _TCURSES_ANIM_TIMING_METHOD="seconds"
    fi
fi

# BPM sync
_TCURSES_ANIM_BEAT_INTERVAL=0.5    # Time per beat in seconds (120 BPM = 0.5s)
_TCURSES_ANIM_BEAT_COUNT=0
_TCURSES_ANIM_BEAT_PHASE=0.0       # 0.0 to 1.0

# Performance tracking
declare -a _TCURSES_ANIM_FRAME_TIMES=()
_TCURSES_ANIM_LAST_FRAME_TIME=0
_TCURSES_ANIM_AVG_FPS=0

# Initialize animation system
# Usage: tcurses_animation_init [FPS] [BPM]
tcurses_animation_init() {
    local fps="${1:-30}"
    local bpm="${2:-120}"

    tcurses_animation_set_fps "$fps"
    tcurses_animation_set_bpm "$bpm"

    _TCURSES_ANIM_FRAME_COUNT=0
    _TCURSES_ANIM_BEAT_COUNT=0
    _TCURSES_ANIM_BEAT_PHASE=0.0
    _TCURSES_ANIM_FRAME_TIMES=()
    _TCURSES_ANIM_ENABLED=false
    _TCURSES_ANIM_PAUSED=false
}

# Set frames per second
# Usage: tcurses_animation_set_fps FPS
tcurses_animation_set_fps() {
    local fps="$1"
    _TCURSES_ANIM_FPS="$fps"
    _TCURSES_ANIM_FRAME_TIME=$(awk "BEGIN {printf \"%.6f\", 1.0/$fps}")
}

# Get current FPS setting
# Usage: tcurses_animation_get_fps
tcurses_animation_get_fps() {
    echo "$_TCURSES_ANIM_FPS"
}

# Get frame time (for use as timeout)
# Usage: tcurses_animation_get_frame_time
tcurses_animation_get_frame_time() {
    echo "$_TCURSES_ANIM_FRAME_TIME"
}

# Set BPM for beat-synchronized animations
# Usage: tcurses_animation_set_bpm BPM
tcurses_animation_set_bpm() {
    local bpm="$1"
    _TCURSES_ANIM_BPM="$bpm"
    _TCURSES_ANIM_BEAT_INTERVAL=$(awk "BEGIN {printf \"%.6f\", 60.0/$bpm}")
}

# Get current BPM
# Usage: tcurses_animation_get_bpm
tcurses_animation_get_bpm() {
    echo "$_TCURSES_ANIM_BPM"
}

# Get beat interval in seconds
# Usage: tcurses_animation_get_beat_interval
tcurses_animation_get_beat_interval() {
    echo "$_TCURSES_ANIM_BEAT_INTERVAL"
}

# Get beat phase (0.0 to 1.0)
# Usage: tcurses_animation_get_beat_phase
tcurses_animation_get_beat_phase() {
    printf "%.6f" "$_TCURSES_ANIM_BEAT_PHASE"
}

# Get beat count
# Usage: tcurses_animation_get_beat_count
tcurses_animation_get_beat_count() {
    echo "$_TCURSES_ANIM_BEAT_COUNT"
}

# Get current time in microseconds (works on macOS and Linux)
_tcurses_get_time_us() {
    case "$_TCURSES_ANIM_TIMING_METHOD" in
        epochrealtime)
            # Bash 5.0+ builtin: seconds.microseconds
            # Convert to integer microseconds
            awk -v t="$EPOCHREALTIME" 'BEGIN { printf "%d", t * 1000000 }'
            ;;
        gdate)
            # GNU date (coreutils on macOS)
            local ns=$(gdate +%s%N)
            echo $((ns / 1000))
            ;;
        date)
            # Linux date with nanoseconds
            local ns=$(date +%s%N)
            echo $((ns / 1000))
            ;;
        seconds)
            # Fallback: second precision only
            echo $(($(date +%s) * 1000000))
            ;;
    esac
}

# Enable animation
# Usage: tcurses_animation_enable
tcurses_animation_enable() {
    _TCURSES_ANIM_ENABLED=true
    _TCURSES_ANIM_LAST_FRAME_TIME=$(_tcurses_get_time_us)
}

# Disable animation
# Usage: tcurses_animation_disable
tcurses_animation_disable() {
    _TCURSES_ANIM_ENABLED=false
}

# Toggle animation on/off
# Usage: tcurses_animation_toggle
tcurses_animation_toggle() {
    if [[ "$_TCURSES_ANIM_ENABLED" == "true" ]]; then
        tcurses_animation_disable
    else
        tcurses_animation_enable
    fi
}

# Pause animation
# Usage: tcurses_animation_pause
tcurses_animation_pause() {
    _TCURSES_ANIM_PAUSED=true
}

# Resume animation
# Usage: tcurses_animation_resume
tcurses_animation_resume() {
    _TCURSES_ANIM_PAUSED=false
    _TCURSES_ANIM_LAST_FRAME_TIME=$(_tcurses_get_time_us)
}

# Check if animation should tick
# Usage: tcurses_animation_should_tick
tcurses_animation_should_tick() {
    [[ "$_TCURSES_ANIM_ENABLED" == "true" && "$_TCURSES_ANIM_PAUSED" == "false" ]]
}

# Record a frame (for FPS tracking)
# Usage: tcurses_animation_record_frame
tcurses_animation_record_frame() {
    local now=$(_tcurses_get_time_us)
    local delta=0

    if [[ $_TCURSES_ANIM_LAST_FRAME_TIME -gt 0 ]]; then
        delta=$((now - _TCURSES_ANIM_LAST_FRAME_TIME))

        # Keep last 30 frame times (delta is in microseconds)
        _TCURSES_ANIM_FRAME_TIMES+=("$delta")
        if [[ ${#_TCURSES_ANIM_FRAME_TIMES[@]} -gt 30 ]]; then
            _TCURSES_ANIM_FRAME_TIMES=("${_TCURSES_ANIM_FRAME_TIMES[@]:1}")
        fi

        # Update beat phase (convert microseconds to seconds)
        local delta_sec=$(awk "BEGIN {printf \"%.6f\", $delta / 1000000.0}")
        _TCURSES_ANIM_BEAT_PHASE=$(awk -v phase="$_TCURSES_ANIM_BEAT_PHASE" \
                                        -v delta="$delta_sec" \
                                        -v interval="$_TCURSES_ANIM_BEAT_INTERVAL" \
                                        'BEGIN {
                                            new_phase = phase + (delta / interval)
                                            # Wrap to 0.0-1.0
                                            while (new_phase >= 1.0) {
                                                new_phase -= 1.0
                                            }
                                            printf "%.6f", new_phase
                                        }')

        # Count beats
        if awk -v phase="$_TCURSES_ANIM_BEAT_PHASE" 'BEGIN {exit (phase < 0.1) ? 0 : 1}'; then
            ((_TCURSES_ANIM_BEAT_COUNT++))
        fi
    fi

    _TCURSES_ANIM_LAST_FRAME_TIME="$now"
    ((_TCURSES_ANIM_FRAME_COUNT++))
}

# Get average FPS
# Usage: tcurses_animation_get_avg_fps
tcurses_animation_get_avg_fps() {
    if [[ ${#_TCURSES_ANIM_FRAME_TIMES[@]} -lt 2 ]]; then
        echo "0"
        return
    fi

    local sum=0
    for delta in "${_TCURSES_ANIM_FRAME_TIMES[@]}"; do
        sum=$((sum + delta))
    done

    local avg_delta=$((sum / ${#_TCURSES_ANIM_FRAME_TIMES[@]}))
    # delta is in microseconds, convert to FPS
    local avg_fps=$(awk "BEGIN {printf \"%.1f\", 1000000.0 / $avg_delta}")
    echo "$avg_fps"
}

# Get performance stats string
# Usage: tcurses_animation_get_stats
tcurses_animation_get_stats() {
    local avg_fps=$(tcurses_animation_get_avg_fps)
    local target_fps="$_TCURSES_ANIM_FPS"
    local frames="$_TCURSES_ANIM_FRAME_COUNT"
    local beats="$_TCURSES_ANIM_BEAT_COUNT"
    local phase=$(printf "%.2f" "$_TCURSES_ANIM_BEAT_PHASE")

    echo "FPS: $avg_fps/$target_fps | Frames: $frames | Beats: $beats | Phase: $phase"
}

# Check performance and warn if lagging
# Usage: tcurses_animation_check_performance
tcurses_animation_check_performance() {
    local avg_fps=$(tcurses_animation_get_avg_fps)

    # Warn if we're more than 20% below target
    local threshold=$(awk -v target="$_TCURSES_ANIM_FPS" 'BEGIN {printf "%.1f", target * 0.8}')

    if awk -v fps="$avg_fps" -v thresh="$threshold" 'BEGIN {exit (fps < thresh) ? 0 : 1}'; then
        return 1  # Performance issue
    fi

    return 0  # OK
}

# Get animation status
# Usage: tcurses_animation_get_status
tcurses_animation_get_status() {
    if [[ "$_TCURSES_ANIM_ENABLED" == "true" ]]; then
        if [[ "$_TCURSES_ANIM_PAUSED" == "true" ]]; then
            echo "PAUSED"
        else
            echo "ON"
        fi
    else
        echo "OFF"
    fi
}

# BPM-synchronized oscillator value (sine wave)
# Usage: tcurses_animation_beat_sine
# Output: Value from -1.0 to 1.0
tcurses_animation_beat_sine() {
    awk -v phase="$_TCURSES_ANIM_BEAT_PHASE" \
        'BEGIN {
            pi = 3.141592653589793
            printf "%.6f", sin(phase * 2 * pi)
        }'
}

# BPM-synchronized oscillator value (triangle wave)
# Usage: tcurses_animation_beat_triangle
# Output: Value from -1.0 to 1.0
tcurses_animation_beat_triangle() {
    awk -v phase="$_TCURSES_ANIM_BEAT_PHASE" \
        'BEGIN {
            if (phase < 0.5) {
                printf "%.6f", -1.0 + (4.0 * phase)
            } else {
                printf "%.6f", 3.0 - (4.0 * phase)
            }
        }'
}

# BPM-synchronized oscillator value (square wave)
# Usage: tcurses_animation_beat_square
# Output: -1.0 or 1.0
tcurses_animation_beat_square() {
    awk -v phase="$_TCURSES_ANIM_BEAT_PHASE" \
        'BEGIN {
            printf "%.1f", (phase < 0.5) ? 1.0 : -1.0
        }'
}

# Reset animation state
# Usage: tcurses_animation_reset
tcurses_animation_reset() {
    _TCURSES_ANIM_FRAME_COUNT=0
    _TCURSES_ANIM_BEAT_COUNT=0
    _TCURSES_ANIM_BEAT_PHASE=0.0
    _TCURSES_ANIM_FRAME_TIMES=()
    _TCURSES_ANIM_LAST_FRAME_TIME=$(_tcurses_get_time_us)
}
