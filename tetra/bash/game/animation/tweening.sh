#!/usr/bin/env bash

# Animation Tweening System
# Easing functions and smooth animation utilities

# Linear interpolation
# Args: start, end, t (0.0-1.0)
# Returns: interpolated value
tween_linear() {
    local start="$1"
    local end="$2"
    local t="$3"

    awk "BEGIN {print $start + ($end - $start) * $t}"
}

# Ease in (quadratic)
# Args: t (0.0-1.0)
# Returns: eased t
tween_ease_in() {
    local t="$1"
    awk "BEGIN {print $t * $t}"
}

# Ease out (quadratic)
# Args: t (0.0-1.0)
# Returns: eased t
tween_ease_out() {
    local t="$1"
    awk "BEGIN {print $t * (2 - $t)}"
}

# Ease in-out (quadratic)
# Args: t (0.0-1.0)
# Returns: eased t
tween_ease_in_out() {
    local t="$1"
    awk "BEGIN {
        if ($t < 0.5)
            print 2 * $t * $t
        else {
            t = $t * 2 - 1
            print 1 - 2 * t * t
        }
    }"
}

# Sine wave oscillation
# Args: t (0.0-1.0)
# Returns: sin value (-1.0 to 1.0)
tween_sine() {
    local t="$1"
    awk "BEGIN {print sin($t * 6.283185)}"  # 2*PI
}

# Sine wave (0 to 1 range)
# Args: t (0.0-1.0)
# Returns: sin value (0.0 to 1.0)
tween_sine_01() {
    local t="$1"
    awk "BEGIN {print (sin($t * 6.283185) + 1) / 2}"
}

# Bounce effect
# Args: t (0.0-1.0)
# Returns: bounced value
tween_bounce() {
    local t="$1"
    awk "BEGIN {
        t = $t
        if (t < 0.36363636) {
            print 7.5625 * t * t
        } else if (t < 0.72727273) {
            t = t - 0.54545455
            print 7.5625 * t * t + 0.75
        } else if (t < 0.90909091) {
            t = t - 0.81818182
            print 7.5625 * t * t + 0.9375
        } else {
            t = t - 0.95454545
            print 7.5625 * t * t + 0.984375
        }
    }"
}

# Pulse (expands and contracts)
# Args: t (0.0-1.0)
# Returns: pulse value (0.0 to 1.0)
tween_pulse() {
    local t="$1"
    awk "BEGIN {
        s = sin($t * 3.141593)
        print s * s
    }"
}

# Create animation state
# Args: duration_ms
# Returns: state string "start_time|duration"
tween_state_create() {
    local duration="$1"
    local start_time=$(game_time_ms)
    echo "${start_time}|${duration}"
}

# Get progress from animation state
# Args: state_string
# Returns: t value (0.0-1.0), or >1.0 if finished
tween_state_progress() {
    local state="$1"
    local start_time="${state%%|*}"
    local duration="${state##*|}"
    local current_time=$(game_time_ms)
    local elapsed=$((current_time - start_time))

    awk "BEGIN {print $elapsed / $duration}"
}

# Check if animation is complete
# Args: state_string
# Returns: 0 if complete, 1 if running
tween_state_is_complete() {
    local progress=$(tween_state_progress "$1")
    awk "BEGIN {exit ($progress >= 1.0 ? 0 : 1)}"
}

# Restart animation state
# Args: old_state_string
# Returns: new state string with reset start time
tween_state_restart() {
    local state="$1"
    local duration="${state##*|}"
    tween_state_create "$duration"
}

# Export tweening functions
export -f tween_linear
export -f tween_ease_in
export -f tween_ease_out
export -f tween_ease_in_out
export -f tween_sine
export -f tween_sine_01
export -f tween_bounce
export -f tween_pulse
export -f tween_state_create
export -f tween_state_progress
export -f tween_state_is_complete
export -f tween_state_restart
