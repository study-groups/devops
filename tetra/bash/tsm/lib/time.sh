#!/usr/bin/env bash
# TSM Time - timestamp formatting and delta calculations
# Requires: bash 5.2+, optionally gdate (coreutils) on macOS for milliseconds

# === TIMESTAMP GENERATION ===

# Cache for date command with nanosecond support
declare -g _TSM_DATE_CMD=""

# Detect date command with nanosecond support
_tsm_detect_date_cmd() {
    [[ -n "$_TSM_DATE_CMD" ]] && return 0

    # Try GNU date first (gdate on macOS, date on Linux)
    if command -v gdate >/dev/null 2>&1; then
        if gdate +%N >/dev/null 2>&1; then
            _TSM_DATE_CMD="gdate"
            return 0
        fi
    fi

    # Try system date
    if date +%N 2>/dev/null | grep -qE '^[0-9]+$'; then
        _TSM_DATE_CMD="date"
        return 0
    fi

    # Fallback - no nanosecond support
    _TSM_DATE_CMD="date-fallback"
    return 1
}

# Generate compact ISO 8601 timestamp with millisecond precision
# Format: YYYYMMDDTHHMMSS.mmmZ
# Example: 20260113T143245.123Z
tsm_timestamp() {
    _tsm_detect_date_cmd

    if [[ "$_TSM_DATE_CMD" == "gdate" ]]; then
        gdate -u +"%Y%m%dT%H%M%S.%3NZ"
    elif [[ "$_TSM_DATE_CMD" == "date" ]]; then
        date -u +"%Y%m%dT%H%M%S.%3NZ"
    else
        # Fallback: seconds only, fake milliseconds
        date -u +"%Y%m%dT%H%M%S.000Z"
    fi
}

# Get current time as epoch milliseconds
tsm_epoch_ms() {
    _tsm_detect_date_cmd

    if [[ "$_TSM_DATE_CMD" == "gdate" ]]; then
        echo "$(gdate +%s%3N)"
    elif [[ "$_TSM_DATE_CMD" == "date" ]]; then
        echo "$(date +%s%3N)"
    else
        # Fallback: seconds * 1000
        echo "$(($(date +%s) * 1000))"
    fi
}

# === TIMESTAMP PARSING ===

# Parse compact ISO timestamp to epoch milliseconds
# Input: 20260113T143245.123Z
# Output: epoch milliseconds (e.g., 1768423965123)
tsm_parse_timestamp() {
    local ts="$1"

    # Validate format
    if [[ ! "$ts" =~ ^[0-9]{8}T[0-9]{6}\.[0-9]{3}Z$ ]]; then
        echo "0"
        return 1
    fi

    # Extract components
    local year="${ts:0:4}"
    local month="${ts:4:2}"
    local day="${ts:6:2}"
    local hour="${ts:9:2}"
    local min="${ts:11:2}"
    local sec="${ts:13:2}"
    local ms="${ts:16:3}"

    # Convert to epoch using date
    local epoch_sec
    if [[ "$_TSM_DATE_CMD" == "gdate" ]]; then
        epoch_sec=$(gdate -u -d "${year}-${month}-${day} ${hour}:${min}:${sec}" +%s 2>/dev/null)
    else
        # BSD date format
        epoch_sec=$(date -u -j -f "%Y-%m-%d %H:%M:%S" "${year}-${month}-${day} ${hour}:${min}:${sec}" +%s 2>/dev/null)
    fi

    [[ -z "$epoch_sec" ]] && { echo "0"; return 1; }

    # Remove leading zeros from ms to avoid octal interpretation
    ms="${ms#0}"
    ms="${ms#0}"
    ms="${ms:-0}"

    echo "$((epoch_sec * 1000 + ms))"
}

# === DELTA CALCULATIONS ===

# Calculate delta between two epoch millisecond values
# Output: +SS.mmm format (always seconds, as per design decision)
# Example: +3723.456 for ~1 hour gap
tsm_delta() {
    local prev_ms="$1"
    local curr_ms="$2"

    [[ -z "$prev_ms" || -z "$curr_ms" ]] && { echo "+0.000"; return; }

    local diff_ms=$((curr_ms - prev_ms))

    # Handle negative (shouldn't happen, but be safe)
    local sign="+"
    if [[ $diff_ms -lt 0 ]]; then
        sign="-"
        diff_ms=$((-diff_ms))
    fi

    local sec=$((diff_ms / 1000))
    local ms=$((diff_ms % 1000))

    printf "%s%d.%03d" "$sign" "$sec" "$ms"
}

# Format delta for display with fixed width
# Pads to align columns nicely
tsm_delta_padded() {
    local delta="$1"
    local width="${2:-10}"
    printf "%${width}s" "$delta"
}

# === DURATION PARSING ===

# Parse human duration strings to milliseconds
# Supports: 5s, 30s, 5m, 1h, 1d, or epoch ms, or compact ISO
# Returns: milliseconds
tsm_parse_duration() {
    local input="$1"

    # Already milliseconds
    if [[ "$input" =~ ^[0-9]+$ ]]; then
        echo "$input"
        return 0
    fi

    # Compact ISO timestamp
    if [[ "$input" =~ ^[0-9]{8}T[0-9]{6}\.[0-9]{3}Z$ ]]; then
        tsm_parse_timestamp "$input"
        return $?
    fi

    # Duration format: Ns, Nm, Nh, Nd
    local num unit
    if [[ "$input" =~ ^([0-9]+)([smhd])$ ]]; then
        num="${BASH_REMATCH[1]}"
        unit="${BASH_REMATCH[2]}"

        case "$unit" in
            s) echo "$((num * 1000))" ;;
            m) echo "$((num * 60 * 1000))" ;;
            h) echo "$((num * 3600 * 1000))" ;;
            d) echo "$((num * 86400 * 1000))" ;;
        esac
        return 0
    fi

    echo "0"
    return 1
}

# Calculate "since" threshold: now - duration
# Usage: tsm_since_threshold "5m"
# Returns: epoch milliseconds for the cutoff point
tsm_since_threshold() {
    local duration="$1"
    local duration_ms

    duration_ms=$(tsm_parse_duration "$duration")
    [[ $? -ne 0 || "$duration_ms" == "0" ]] && return 1

    local now_ms
    now_ms=$(tsm_epoch_ms)

    echo "$((now_ms - duration_ms))"
}

# === EXPORTS ===

