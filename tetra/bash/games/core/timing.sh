#!/usr/bin/env bash

# Game Timing System
# Frame delta calculation and FPS control

# Jitter tracking arrays
declare -a GAME_JITTER_SAMPLES=()
GAME_JITTER_MAX_SAMPLES=60  # Track last 60 frames

# Get current time in milliseconds
game_time_ms() {
    if [[ -n "$EPOCHREALTIME" ]]; then
        # Bash 5.0+ builtin: seconds.microseconds (e.g., "1234567.890123")
        # Extract seconds and microseconds, convert to milliseconds
        local sec="${EPOCHREALTIME%.*}"
        local frac="${EPOCHREALTIME#*.}"
        # Get first 3 digits of fraction for milliseconds
        local ms="${frac:0:3}"
        echo "$((sec * 1000 + 10#$ms))"
    elif command -v gdate >/dev/null 2>&1; then
        # GNU date (install with: brew install coreutils)
        gdate +%s%3N
    elif date +%s%N 2>/dev/null | grep -qv 'N$'; then
        # Linux date with nanoseconds
        date +%s%N | awk '{print int($1/1000000)}'
    else
        # Fallback: second precision only (will cause issues!)
        echo $(($(date +%s) * 1000))
    fi
}

# Get current time in microseconds
game_time_us() {
    date +%s%N | awk '{print int($1/1000)}'
}

# Calculate frame delta time
# Args: last_frame_time (ms)
# Returns: delta_ms
game_delta_time() {
    local last_time="$1"
    local current_time=$(game_time_ms)
    local delta=$((current_time - last_time))
    echo "$delta"
}

# Sleep for remaining frame time to maintain target FPS
# Args: target_fps, frame_start_time_ms
game_sleep_frame() {
    local target_fps="$1"
    local frame_start="$2"

    local frame_duration=$((1000 / target_fps))  # ms per frame
    local current_time=$(game_time_ms)
    local elapsed=$((current_time - frame_start))
    local sleep_time=$((frame_duration - elapsed))

    if [[ $sleep_time -gt 0 ]]; then
        # Convert ms to seconds for sleep
        local sleep_seconds=$(awk "BEGIN {print $sleep_time / 1000}")
        sleep "$sleep_seconds" 2>/dev/null || sleep 0.001
    fi
}

# Get frames per second from delta time
# Args: delta_ms
# Returns: fps (integer)
game_fps_from_delta() {
    local delta="$1"
    if [[ $delta -gt 0 ]]; then
        echo $((1000 / delta))
    else
        echo "0"
    fi
}

# Record frame jitter (deviation from target frame time)
# Args: target_fps, actual_delta_ms
game_record_jitter() {
    local target_fps="$1"
    local actual_delta="$2"

    local target_frame_time=$((1000 / target_fps))  # ms
    local jitter=$((actual_delta - target_frame_time))

    # Add to samples array
    GAME_JITTER_SAMPLES+=("$jitter")

    # Keep only last N samples
    if [[ ${#GAME_JITTER_SAMPLES[@]} -gt $GAME_JITTER_MAX_SAMPLES ]]; then
        GAME_JITTER_SAMPLES=("${GAME_JITTER_SAMPLES[@]:1}")
    fi
}

# Calculate average jitter
# Returns: average jitter in ms (can be negative)
game_jitter_avg() {
    if [[ ${#GAME_JITTER_SAMPLES[@]} -eq 0 ]]; then
        echo "0"
        return
    fi

    local sum=0
    for jitter in "${GAME_JITTER_SAMPLES[@]}"; do
        sum=$((sum + jitter))
    done

    awk "BEGIN {printf \"%.2f\", $sum / ${#GAME_JITTER_SAMPLES[@]}}"
}

# Calculate standard deviation of jitter
# Returns: standard deviation in ms
game_jitter_std() {
    if [[ ${#GAME_JITTER_SAMPLES[@]} -eq 0 ]]; then
        echo "0"
        return
    fi

    local avg=$(game_jitter_avg)
    local sum_sq=0

    for jitter in "${GAME_JITTER_SAMPLES[@]}"; do
        local diff=$(awk "BEGIN {print $jitter - $avg}")
        local sq=$(awk "BEGIN {print $diff * $diff}")
        sum_sq=$(awk "BEGIN {print $sum_sq + $sq}")
    done

    local variance=$(awk "BEGIN {print $sum_sq / ${#GAME_JITTER_SAMPLES[@]}}")
    awk "BEGIN {printf \"%.2f\", sqrt($variance)}"
}

# Get actual FPS from jitter samples
# Returns: actual average FPS
game_jitter_actual_fps() {
    if [[ ${#GAME_JITTER_SAMPLES[@]} -eq 0 ]]; then
        echo "0"
        return
    fi

    # Calculate average actual frame time from samples
    local sum_delta=0
    local target_fps="${GAME_LOOP_TARGET_FPS:-30}"
    local target_frame_time=$((1000 / target_fps))

    for jitter in "${GAME_JITTER_SAMPLES[@]}"; do
        local actual_frame_time=$((target_frame_time + jitter))
        sum_delta=$((sum_delta + actual_frame_time))
    done

    local avg_frame_time=$(awk "BEGIN {print $sum_delta / ${#GAME_JITTER_SAMPLES[@]}}")

    if (( $(awk "BEGIN {print ($avg_frame_time > 0)}") )); then
        awk "BEGIN {printf \"%.1f\", 1000 / $avg_frame_time}"
    else
        echo "0"
    fi
}

# Clear jitter samples
game_jitter_clear() {
    GAME_JITTER_SAMPLES=()
}

# Export timing functions
export -f game_time_ms
export -f game_time_us
export -f game_delta_time
export -f game_sleep_frame
export -f game_fps_from_delta
export -f game_record_jitter
export -f game_jitter_avg
export -f game_jitter_std
export -f game_jitter_actual_fps
export -f game_jitter_clear
