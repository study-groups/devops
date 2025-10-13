#!/usr/bin/env bash

# vox_sound_pattern.sh - Mini-notation pattern parser
# Inspired by Strudel/TidalCycles mini-notation

# Parse mini-notation pattern into event list
# Returns: time sound duration (one per line)
parse_pattern() {
    local pattern="$1"
    local tempo="${2:-120}"  # BPM
    local cycle_duration="${3:-1.0}"  # seconds per cycle

    # Calculate beat duration
    local beat_duration=$(echo "scale=6; 60 / $tempo" | bc)

    # Remove spaces and parse
    pattern="${pattern// /}"

    # Simple parser: split by spaces (events)
    # Each event gets equal time in the cycle
    local events=($pattern)
    local num_events=${#events[@]}
    local event_duration=$(echo "scale=6; $cycle_duration / $num_events" | bc)

    local time=0
    for event in "${events[@]}"; do
        # Skip rests (~)
        if [[ "$event" != "~" ]]; then
            echo "$time $event $event_duration"
        fi
        time=$(echo "$time + $event_duration" | bc)
    done
}

# Parse simple pattern with explicit spacing
# Input: "bd sd cp hh"
# Output: timeline of events
parse_simple_pattern() {
    local pattern="$1"
    local tempo="${2:-120}"

    # Split into tokens
    local tokens=($pattern)
    local num_tokens=${#tokens[@]}

    # Each token gets 1/4 of a beat (assuming 4/4 time)
    local step_duration=$(echo "scale=6; 60 / $tempo / 4" | bc)

    local time=0
    for token in "${tokens[@]}"; do
        if [[ "$token" != "~" ]]; then
            printf "%s %s %s\n" "$time" "$token" "$step_duration"
        fi
        time=$(echo "scale=6; $time + $step_duration" | bc)
    done
}

# Expand Euclidean rhythm notation: bd(3,8)
# Returns: pattern with 3 events distributed over 8 steps
expand_euclidean() {
    local sound="$1"
    local hits="$2"
    local steps="$3"

    # Bjorklund algorithm (simplified)
    local pattern=""
    local bucket=0

    for ((i=0; i<steps; i++)); do
        bucket=$((bucket + hits))
        if [[ $bucket -ge $steps ]]; then
            pattern="$pattern $sound"
            bucket=$((bucket - steps))
        else
            pattern="$pattern ~"
        fi
    done

    echo "$pattern"
}

# Parse Euclidean notation: "bd(3,8)"
parse_euclidean() {
    local token="$1"

    if [[ "$token" =~ ^([a-z]+)\(([0-9]+),([0-9]+)\)$ ]]; then
        local sound="${BASH_REMATCH[1]}"
        local hits="${BASH_REMATCH[2]}"
        local steps="${BASH_REMATCH[3]}"
        expand_euclidean "$sound" "$hits" "$steps"
    else
        echo "$token"
    fi
}

# Convert note name to frequency
note_to_freq() {
    local note="$1"

    # Simple note mapping (middle octave)
    case "$note" in
        c) echo 261.63 ;;
        d) echo 293.66 ;;
        e) echo 329.63 ;;
        f) echo 349.23 ;;
        g) echo 392.00 ;;
        a) echo 440.00 ;;
        b) echo 493.88 ;;
        *) echo 440.00 ;;  # Default to A
    esac
}

# Map sound name to synthesis function
sound_to_synth_type() {
    local sound="$1"

    case "$sound" in
        bd|kick) echo "kick" ;;
        sd|snare) echo "snare" ;;
        cp|clap) echo "clap" ;;
        hh|hihat) echo "hihat" ;;
        c|d|e|f|g|a|b) echo "sine" ;;  # Musical notes
        *) echo "kick" ;;  # Default
    esac
}
