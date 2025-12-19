#!/usr/bin/env bash
# tetra_temporal.sh - Temporal Expression Parser for TQL
# Parses time expressions into Unix timestamps for filtering

# Duration unit multipliers (in seconds)
declare -A TQL_TIME_UNITS=(
    [s]=1
    [m]=60
    [h]=3600
    [d]=86400
    [w]=604800
    [M]=2592000   # ~30 days
    [y]=31536000  # 365 days
)

# Day name mappings (lowercase)
declare -A TQL_DAY_NAMES=(
    [sunday]=0    [sun]=0
    [monday]=1    [mon]=1
    [tuesday]=2   [tue]=2
    [wednesday]=3 [wed]=3
    [thursday]=4  [thu]=4
    [friday]=5    [fri]=5
    [saturday]=6  [sat]=6
)

# Parse duration string to seconds
# Usage: tql_parse_duration "7d" → 604800
#        tql_parse_duration "2h30m" → 9000
tql_parse_duration() {
    local duration="$1"
    local total_seconds=0
    local remaining="$duration"

    # Handle compound durations: 2h30m, 1d12h
    while [[ -n "$remaining" ]]; do
        if [[ "$remaining" =~ ^([0-9]+)([smhdwMy]) ]]; then
            local value="${BASH_REMATCH[1]}"
            local unit="${BASH_REMATCH[2]}"
            local multiplier="${TQL_TIME_UNITS[$unit]}"

            if [[ -n "$multiplier" ]]; then
                total_seconds=$((total_seconds + value * multiplier))
            fi

            # Remove matched part
            remaining="${remaining#${BASH_REMATCH[0]}}"
        else
            # Invalid format
            echo "0"
            return 1
        fi
    done

    echo "$total_seconds"
}

# Parse relative day to timestamp (start of that day)
# Usage: tql_parse_relative_day "monday" → timestamp of last Monday 00:00
#        tql_parse_relative_day "yesterday" → timestamp of yesterday 00:00
tql_parse_relative_day() {
    local day="$1"
    local now
    now=$(date +%s)

    # Get current day info
    local today_dow today_start
    today_dow=$(date +%u)  # 1=Monday, 7=Sunday
    today_start=$(date -d "today 00:00" +%s 2>/dev/null || date -j -f "%Y-%m-%d %H:%M:%S" "$(date +%Y-%m-%d) 00:00:00" +%s 2>/dev/null)

    case "${day,,}" in
        today)
            echo "$today_start"
            ;;
        yesterday)
            echo "$((today_start - 86400))"
            ;;
        *)
            # Check day name
            local target_dow="${TQL_DAY_NAMES[${day,,}]}"
            if [[ -n "$target_dow" ]]; then
                # Convert to 1-7 format (Mon=1, Sun=7)
                [[ "$target_dow" -eq 0 ]] && target_dow=7

                # Calculate days ago
                local days_ago=$((today_dow - target_dow))
                [[ $days_ago -le 0 ]] && days_ago=$((days_ago + 7))

                echo "$((today_start - days_ago * 86400))"
            else
                # Unknown relative day
                echo "0"
                return 1
            fi
            ;;
    esac
}

# Parse date string to timestamp
# Supports: 2025-01-15, 2025-01, 2025
# Returns start of that time period
tql_parse_date() {
    local date_str="$1"
    local ts

    # Full date: 2025-01-15
    if [[ "$date_str" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
        ts=$(date -d "$date_str" +%s 2>/dev/null || \
             date -j -f "%Y-%m-%d" "$date_str" +%s 2>/dev/null)
        echo "${ts:-0}"
        return
    fi

    # Year-month: 2025-01
    if [[ "$date_str" =~ ^[0-9]{4}-[0-9]{2}$ ]]; then
        ts=$(date -d "${date_str}-01" +%s 2>/dev/null || \
             date -j -f "%Y-%m-%d" "${date_str}-01" +%s 2>/dev/null)
        echo "${ts:-0}"
        return
    fi

    # Year only: 2025
    if [[ "$date_str" =~ ^[0-9]{4}$ ]]; then
        ts=$(date -d "${date_str}-01-01" +%s 2>/dev/null || \
             date -j -f "%Y-%m-%d" "${date_str}-01-01" +%s 2>/dev/null)
        echo "${ts:-0}"
        return
    fi

    echo "0"
    return 1
}

# Parse temporal expression and return comparison parameters
# Usage: tql_parse_temporal "last:7d" → ">=:1734567890"
#        tql_parse_temporal "since:monday" → ">=:1734480000"
#        tql_parse_temporal "before:2025-01" → "<:1735689600"
#        tql_parse_temporal "between:1d:1w" → "range:1734654290:1735086290"
#        tql_parse_temporal "older:1h" → "<:1734651890"
tql_parse_temporal() {
    local expr="$1"
    local now
    now=$(date +%s)

    # Parse modifier:value format
    if [[ ! "$expr" =~ ^([a-z]+):(.+)$ ]]; then
        echo "error:invalid temporal format"
        return 1
    fi

    local modifier="${BASH_REMATCH[1]}"
    local value="${BASH_REMATCH[2]}"

    case "$modifier" in
        last)
            # last:7d → timestamps >= (now - 7 days)
            local seconds
            seconds=$(tql_parse_duration "$value")
            if [[ "$seconds" -gt 0 ]]; then
                echo ">=:$((now - seconds))"
            else
                echo "error:invalid duration: $value"
                return 1
            fi
            ;;

        since)
            # since:monday → timestamps >= last monday
            # since:2025-01-01 → timestamps >= that date
            local ts

            # Try as day name first
            ts=$(tql_parse_relative_day "$value")
            if [[ "$ts" -gt 0 ]]; then
                echo ">=:$ts"
                return
            fi

            # Try as date
            ts=$(tql_parse_date "$value")
            if [[ "$ts" -gt 0 ]]; then
                echo ">=:$ts"
                return
            fi

            echo "error:invalid since value: $value"
            return 1
            ;;

        before)
            # before:2025-01 → timestamps < start of January 2025
            # before:yesterday → timestamps < start of yesterday
            local ts

            # Try as day name first
            ts=$(tql_parse_relative_day "$value")
            if [[ "$ts" -gt 0 ]]; then
                echo "<:$ts"
                return
            fi

            # Try as date
            ts=$(tql_parse_date "$value")
            if [[ "$ts" -gt 0 ]]; then
                echo "<:$ts"
                return
            fi

            echo "error:invalid before value: $value"
            return 1
            ;;

        after)
            # after:2025-01-01 → timestamps > that date
            local ts

            ts=$(tql_parse_relative_day "$value")
            if [[ "$ts" -gt 0 ]]; then
                echo ">:$ts"
                return
            fi

            ts=$(tql_parse_date "$value")
            if [[ "$ts" -gt 0 ]]; then
                echo ">:$ts"
                return
            fi

            echo "error:invalid after value: $value"
            return 1
            ;;

        older)
            # older:1h → timestamps < (now - 1 hour)
            local seconds
            seconds=$(tql_parse_duration "$value")
            if [[ "$seconds" -gt 0 ]]; then
                echo "<:$((now - seconds))"
            else
                echo "error:invalid duration: $value"
                return 1
            fi
            ;;

        newer)
            # newer:1h → timestamps >= (now - 1 hour) [alias for last]
            local seconds
            seconds=$(tql_parse_duration "$value")
            if [[ "$seconds" -gt 0 ]]; then
                echo ">=:$((now - seconds))"
            else
                echo "error:invalid duration: $value"
                return 1
            fi
            ;;

        between)
            # between:1d:1w → timestamps between (now - 1 week) and (now - 1 day)
            if [[ ! "$value" =~ ^([^:]+):(.+)$ ]]; then
                echo "error:between requires two values: between:START:END"
                return 1
            fi

            local start_val="${BASH_REMATCH[1]}"
            local end_val="${BASH_REMATCH[2]}"

            local start_secs end_secs
            start_secs=$(tql_parse_duration "$start_val")
            end_secs=$(tql_parse_duration "$end_val")

            if [[ "$start_secs" -gt 0 && "$end_secs" -gt 0 ]]; then
                local ts_start=$((now - end_secs))    # end_secs ago is the START of range
                local ts_end=$((now - start_secs))    # start_secs ago is the END of range
                echo "range:$ts_start:$ts_end"
            else
                echo "error:invalid between durations"
                return 1
            fi
            ;;

        *)
            echo "error:unknown temporal modifier: $modifier"
            return 1
            ;;
    esac
}

# Check if a timestamp matches a temporal constraint
# Usage: tql_temporal_match 1734567890 ">=:1734480000" → 0 (match) or 1 (no match)
tql_temporal_match() {
    local timestamp="$1"
    local constraint="$2"

    if [[ "$constraint" =~ ^([<>=!]+):([0-9]+)$ ]]; then
        local op="${BASH_REMATCH[1]}"
        local target="${BASH_REMATCH[2]}"

        case "$op" in
            ">=") [[ "$timestamp" -ge "$target" ]] ;;
            ">")  [[ "$timestamp" -gt "$target" ]] ;;
            "<=") [[ "$timestamp" -le "$target" ]] ;;
            "<")  [[ "$timestamp" -lt "$target" ]] ;;
            "=")  [[ "$timestamp" -eq "$target" ]] ;;
            "!=") [[ "$timestamp" -ne "$target" ]] ;;
            *)    return 1 ;;
        esac
    elif [[ "$constraint" =~ ^range:([0-9]+):([0-9]+)$ ]]; then
        local ts_start="${BASH_REMATCH[1]}"
        local ts_end="${BASH_REMATCH[2]}"
        [[ "$timestamp" -ge "$ts_start" && "$timestamp" -le "$ts_end" ]]
    else
        return 1
    fi
}

# Format timestamp for human display
# Usage: tql_format_time 1734567890 → "2024-12-18 15:31"
tql_format_time() {
    local timestamp="$1"
    local format="${2:-%Y-%m-%d %H:%M}"

    if command -v gdate >/dev/null 2>&1; then
        gdate -d "@$timestamp" +"$format"
    else
        date -r "$timestamp" +"$format" 2>/dev/null || \
        date -d "@$timestamp" +"$format" 2>/dev/null
    fi
}

# Format duration for human display
# Usage: tql_format_duration 90061 → "1d1h1m1s"
tql_format_duration() {
    local seconds="$1"
    local result=""

    if [[ $seconds -ge 86400 ]]; then
        result+="$((seconds / 86400))d"
        seconds=$((seconds % 86400))
    fi

    if [[ $seconds -ge 3600 ]]; then
        result+="$((seconds / 3600))h"
        seconds=$((seconds % 3600))
    fi

    if [[ $seconds -ge 60 ]]; then
        result+="$((seconds / 60))m"
        seconds=$((seconds % 60))
    fi

    if [[ $seconds -gt 0 || -z "$result" ]]; then
        result+="${seconds}s"
    fi

    echo "$result"
}

# Export functions
export -f tql_parse_duration
export -f tql_parse_relative_day
export -f tql_parse_date
export -f tql_parse_temporal
export -f tql_temporal_match
export -f tql_format_time
export -f tql_format_duration

# CLI interface
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    case "${1:-}" in
        duration)
            tql_parse_duration "$2"
            ;;
        day)
            tql_parse_relative_day "$2"
            ;;
        date)
            tql_parse_date "$2"
            ;;
        parse)
            tql_parse_temporal "$2"
            ;;
        match)
            tql_temporal_match "$2" "$3"
            echo $?
            ;;
        format)
            tql_format_time "$2" "${3:-}"
            ;;
        help|*)
            cat <<EOF
Usage: tetra_temporal.sh <command> <args>

Commands:
  duration <dur>       Parse duration to seconds (7d → 604800)
  day <name>           Parse relative day to timestamp (monday, yesterday)
  date <date>          Parse date string to timestamp (2025-01-15, 2025-01)
  parse <expr>         Parse temporal expression (last:7d, since:monday)
  match <ts> <expr>    Check if timestamp matches constraint
  format <ts> [fmt]    Format timestamp for display

Temporal Expressions:
  last:7d              Items from the last 7 days
  last:2h30m           Items from the last 2.5 hours
  since:monday         Items since last Monday
  since:2025-01-01     Items since January 1, 2025
  before:yesterday     Items before yesterday
  before:2025-01       Items before January 2025
  after:2025-01-01     Items after January 1, 2025
  older:1h             Items older than 1 hour
  newer:30m            Items newer than 30 minutes
  between:1d:1w        Items between 1 day and 1 week ago

Duration Units:
  s = seconds, m = minutes, h = hours
  d = days, w = weeks, M = months, y = years

Examples:
  tetra_temporal.sh duration 7d
  tetra_temporal.sh parse "last:7d"
  tetra_temporal.sh parse "since:monday"
  tetra_temporal.sh match 1734567890 ">=:1734480000"
EOF
            ;;
    esac
fi
