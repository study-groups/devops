#!/usr/bin/env bash

# Oscillator - Animation timing and beat control
# Provides consistent timing for UI animations

# Oscillator state
declare -g OSC_BEAT=0
declare -g OSC_BPM=60
declare -g OSC_RUNNING=false
declare -g OSC_DIRECTION=1  # 1 = forward, -1 = backward
declare -g OSC_MIN=0
declare -g OSC_MAX=100
declare -g OSC_POSITION=50  # Current position (0-100)

# Timing state
declare -g OSC_LAST_TICK=0
declare -g OSC_TICK_DELTA=0

# Initialize oscillator
osc_init() {
    OSC_BEAT=0
    OSC_RUNNING=false
    OSC_POSITION=50
    OSC_DIRECTION=1
    OSC_LAST_TICK=$(date +%s%N)
    OSC_TICK_DELTA=0
}

# Start oscillator
osc_start() {
    OSC_RUNNING=true
}

# Stop oscillator
osc_stop() {
    OSC_RUNNING=false
}

# Tick the oscillator (call this in your main loop)
osc_tick() {
    [[ "$OSC_RUNNING" != "true" ]] && return

    ((OSC_BEAT++))

    # Update position based on direction
    OSC_POSITION=$((OSC_POSITION + OSC_DIRECTION))

    # Bounce at boundaries
    if [[ $OSC_POSITION -ge $OSC_MAX ]]; then
        OSC_POSITION=$OSC_MAX
        OSC_DIRECTION=-1
    elif [[ $OSC_POSITION -le $OSC_MIN ]]; then
        OSC_POSITION=$OSC_MIN
        OSC_DIRECTION=1
    fi
}

# Get current beat
osc_get_beat() {
    echo "$OSC_BEAT"
}

# Get current position (0-100)
osc_get_position() {
    echo "$OSC_POSITION"
}

# Get normalized position (0.0-1.0)
osc_get_normalized() {
    local range=$((OSC_MAX - OSC_MIN))
    local pos=$((OSC_POSITION - OSC_MIN))
    bc <<< "scale=2; $pos / $range"
}

# Set oscillator range
osc_set_range() {
    local min="${1:-0}"
    local max="${2:-100}"
    OSC_MIN=$min
    OSC_MAX=$max
}

# Set BPM (beats per minute)
osc_set_bpm() {
    OSC_BPM="${1:-60}"
}

# Get sleep duration for current BPM
osc_get_sleep() {
    bc <<< "scale=3; 60 / $OSC_BPM"
}

# Reset oscillator to center
osc_reset() {
    OSC_BEAT=0
    OSC_POSITION=$(( (OSC_MAX + OSC_MIN) / 2 ))
    OSC_DIRECTION=1
}

# Toggle oscillator direction
osc_reverse() {
    OSC_DIRECTION=$((OSC_DIRECTION * -1))
}

# Set position directly
osc_set_position() {
    local pos="${1:-50}"
    [[ $pos -lt $OSC_MIN ]] && pos=$OSC_MIN
    [[ $pos -gt $OSC_MAX ]] && pos=$OSC_MAX
    OSC_POSITION=$pos
}

# Enhanced tick with timing measurement
osc_tick_timed() {
    [[ "$OSC_RUNNING" != "true" ]] && return

    local now=$(date +%s%N)
    OSC_TICK_DELTA=$((now - OSC_LAST_TICK))
    OSC_LAST_TICK=$now

    ((OSC_BEAT++))

    # Update position based on direction
    OSC_POSITION=$((OSC_POSITION + OSC_DIRECTION))

    # Bounce at boundaries
    if [[ $OSC_POSITION -ge $OSC_MAX ]]; then
        OSC_POSITION=$OSC_MAX
        OSC_DIRECTION=-1
    elif [[ $OSC_POSITION -le $OSC_MIN ]]; then
        OSC_POSITION=$OSC_MIN
        OSC_DIRECTION=1
    fi
}

# Get last tick delta in milliseconds
osc_get_tick_delta_ms() {
    echo $((OSC_TICK_DELTA / 1000000))
}
