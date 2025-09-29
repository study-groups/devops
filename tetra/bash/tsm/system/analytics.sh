#!/usr/bin/env bash

# TSM Analytics - Time analysis and event correlation for tetra tokens
# Uses resource manager to prevent macOS EMFILE issues

# Load resource manager
# Cross-module dependencies handled by include.sh loading order
# resource_manager.sh functions are available after include.sh completes

# === CLICK EVENT ANALYSIS ===

tsm_analyze_click_timing() {
    local service_pattern="$1"
    local time_window="${2:-300}"  # 5 minutes default

    local log_file
    log_file=$(tsm_monitor_resolve_log_file "$service_pattern")
    if [[ -z "$log_file" || ! -f "$log_file" ]]; then
        echo "No log file found for service pattern: $service_pattern"
        return 1
    fi

    echo "🖱️  Click Timing Analysis - $service_pattern (last ${time_window}s)"
    echo "═══════════════════════════════════════════════════════════"

    # Extract click events with timestamps
    local temp_file="/tmp/tsm_clicks_$$"
    tail -1000 "$log_file" | \
        grep "TETRA:INTERACTION:CLICK" | \
        while IFS= read -r line; do
            # Extract timestamp from the tetra token data
            local timestamp=$(echo "$line" | grep -o '"timestamp":[0-9]*' | cut -d: -f2)
            local element=$(echo "$line" | grep -o '"element":"[^"]*"' | cut -d\" -f4)
            local coords=$(echo "$line" | grep -o '"coords":{[^}]*}' | cut -d: -f2-)

            if [[ -n "$timestamp" ]]; then
                echo "$timestamp|$element|$coords"
            fi
        done | sort -n > "$temp_file"

    if [[ ! -s "$temp_file" ]]; then
        echo "No click events found in recent logs"
        rm -f "$temp_file"
        return 1
    fi

    echo "📊 Click Event Timeline:"
    echo ""

    local prev_timestamp=""
    local prev_element=""
    local click_count=0
    local total_gaps=0
    local gap_sum=0

    while IFS='|' read -r timestamp element coords; do
        click_count=$((click_count + 1))
        local human_time=$(date -d "@$((timestamp / 1000))" '+%H:%M:%S' 2>/dev/null || date -r "$((timestamp / 1000))" '+%H:%M:%S')

        printf "  %s  %s" "$human_time" "$element"

        if [[ -n "$prev_timestamp" ]]; then
            local gap=$(( (timestamp - prev_timestamp) / 1000 ))  # Convert to seconds
            gap_sum=$((gap_sum + gap))
            total_gaps=$((total_gaps + 1))

            if [[ $gap -lt 60 ]]; then
                printf " \e[32m(+%ds)\e[0m" "$gap"  # Green for quick succession
            elif [[ $gap -lt 300 ]]; then
                printf " \e[33m(+%ds)\e[0m" "$gap"  # Yellow for medium gap
            else
                printf " \e[90m(+%ds)\e[0m" "$gap"  # Gray for long gap
            fi

            # Detect rapid clicking (< 2 seconds)
            if [[ $gap -lt 2 ]]; then
                printf " \e[31m[RAPID]\e[0m"
            fi
        fi
        echo ""

        prev_timestamp="$timestamp"
        prev_element="$element"
    done < "$temp_file"

    echo ""
    echo "📈 Click Statistics:"
    printf "   Total Clicks: %d\n" "$click_count"

    if [[ $total_gaps -gt 0 ]]; then
        local avg_gap=$((gap_sum / total_gaps))
        printf "   Average Time Between Clicks: %ds\n" "$avg_gap"

        # Find click patterns
        echo ""
        echo "🔍 Click Patterns:"

        # Most clicked elements
        cut -d'|' -f2 "$temp_file" | sort | uniq -c | sort -rn | head -5 | while read count element; do
            printf "   %s: %d clicks\n" "$element" "$count"
        done

        echo ""
        echo "⚡ Rapid Click Sequences (< 2s apart):"

        local prev_ts=""
        while IFS='|' read -r timestamp element coords; do
            if [[ -n "$prev_ts" ]]; then
                local gap=$(( (timestamp - prev_ts) / 1000 ))
                if [[ $gap -lt 2 ]]; then
                    local time1=$(date -d "@$((prev_ts / 1000))" '+%H:%M:%S' 2>/dev/null || date -r "$((prev_ts / 1000))" '+%H:%M:%S')
                    local time2=$(date -d "@$((timestamp / 1000))" '+%H:%M:%S' 2>/dev/null || date -r "$((timestamp / 1000))" '+%H:%M:%S')
                    printf "   %s → %s (%ds): %s → %s\n" "$time1" "$time2" "$gap" "$prev_element" "$element"
                fi
            fi
            prev_ts="$timestamp"
            prev_element="$element"
        done < "$temp_file"
    fi

    rm -f "$temp_file"
}

# === USER JOURNEY ANALYSIS ===

tsm_analyze_user_journey() {
    local service_pattern="$1"
    local session_id="${2:-}"
    local time_window="${3:-600}"  # 10 minutes default

    local log_file
    log_file=$(tsm_monitor_resolve_log_file "$service_pattern")
    if [[ -z "$log_file" || ! -f "$log_file" ]]; then
        echo "No log file found for service pattern: $service_pattern"
        return 1
    fi

    echo "🗺️  User Journey Analysis - $service_pattern"
    if [[ -n "$session_id" ]]; then
        echo "Session: $session_id"
    fi
    echo "═══════════════════════════════════════════════════════════"

    local temp_events="/tmp/tsm_journey_$$"

    # Extract all tetra events for the timeframe
    local filter_cmd="tail -2000 \"$log_file\" | grep 'TETRA:'"
    if [[ -n "$session_id" ]]; then
        filter_cmd="$filter_cmd | grep \"$session_id\""
    fi

    eval "$filter_cmd" | while IFS= read -r line; do
        local timestamp=$(echo "$line" | grep -o '"timestamp":[0-9]*' | cut -d: -f2)
        local token=$(echo "$line" | grep -o 'TETRA:[A-Z_]*:[A-Z_]*')
        local session=$(echo "$line" | grep -o '"sessionId":"[^"]*"' | cut -d\" -f4)
        local element=$(echo "$line" | grep -o '"element":"[^"]*"' | cut -d\" -f4)
        local feature=$(echo "$line" | grep -o '"feature":"[^"]*"' | cut -d\" -f4)
        local url=$(echo "$line" | grep -o '"url":"[^"]*"' | cut -d\" -f4)

        if [[ -n "$timestamp" && -n "$token" ]]; then
            echo "$timestamp|$token|$session|$element|$feature|$url"
        fi
    done | sort -n > "$temp_events"

    if [[ ! -s "$temp_events" ]]; then
        echo "No tetra events found"
        rm -f "$temp_events"
        return 1
    fi

    echo "🕒 Event Timeline:"
    echo ""

    local prev_timestamp=""
    local session_start=""
    local event_count=0

    while IFS='|' read -r timestamp token session element feature url; do
        event_count=$((event_count + 1))
        local human_time=$(date -d "@$((timestamp / 1000))" '+%H:%M:%S' 2>/dev/null || date -r "$((timestamp / 1000))" '+%H:%M:%S')

        # Track session start
        if [[ "$token" == "TETRA:AUTH:SESSION_START" || "$token" == "TETRA:USER:SESSION_START" ]]; then
            session_start="$timestamp"
            echo "🟢 $human_time SESSION_START ($session)"
        else
            printf "   %s " "$human_time"

            # Color code by event type
            case "$token" in
                *CLICK*) printf "\e[32m%s\e[0m" "$token" ;;          # Green
                *PAGE_VIEW*) printf "\e[34m%s\e[0m" "$token" ;;      # Blue
                *FEATURE_USE*) printf "\e[35m%s\e[0m" "$token" ;;    # Magenta
                *API_CALL*) printf "\e[33m%s\e[0m" "$token" ;;       # Yellow
                *ERROR*) printf "\e[31m%s\e[0m" "$token" ;;          # Red
                *) printf "%s" "$token" ;;
            esac

            # Show relevant context
            if [[ -n "$element" ]]; then
                printf " %s" "$element"
            elif [[ -n "$feature" ]]; then
                printf " %s" "$feature"
            elif [[ -n "$url" ]]; then
                printf " %s" "$(basename "$url")"
            fi

            # Show time since session start
            if [[ -n "$session_start" ]]; then
                local session_time=$(( (timestamp - session_start) / 1000 ))
                printf " \e[90m[+%ds]\e[0m" "$session_time"
            fi

            # Show time since previous event
            if [[ -n "$prev_timestamp" ]]; then
                local gap=$(( (timestamp - prev_timestamp) / 1000 ))
                if [[ $gap -gt 10 ]]; then
                    printf " \e[90m(gap:%ds)\e[0m" "$gap"
                fi
            fi
        fi
        echo ""

        prev_timestamp="$timestamp"
    done < "$temp_events"

    echo ""
    echo "📊 Journey Summary:"
    printf "   Total Events: %d\n" "$event_count"

    if [[ -n "$session_start" && -n "$prev_timestamp" ]]; then
        local total_time=$(( (prev_timestamp - session_start) / 1000 ))
        printf "   Session Duration: %ds (%dm %ds)\n" "$total_time" "$((total_time / 60))" "$((total_time % 60))"
    fi

    echo ""
    echo "🎯 Event Breakdown:"
    cut -d'|' -f2 "$temp_events" | sort | uniq -c | sort -rn | while read count token; do
        printf "   %s: %d\n" "$token" "$count"
    done

    rm -f "$temp_events"
}

# === PERFORMANCE CORRELATION ===

tsm_analyze_click_performance() {
    local service_pattern="$1"
    local time_window="${2:-300}"

    local log_file
    log_file=$(tsm_monitor_resolve_log_file "$service_pattern")
    if [[ -z "$log_file" || ! -f "$log_file" ]]; then
        echo "No log file found for service pattern: $service_pattern"
        return 1
    fi

    echo "🚀 Click → Performance Correlation Analysis"
    echo "═══════════════════════════════════════════════════════════"

    local temp_clicks="/tmp/tsm_click_perf_$$"

    # Extract clicks followed by API calls within 5 seconds
    tail -2000 "$log_file" | grep -E "(TETRA:INTERACTION:CLICK|TETRA:PERFORMANCE:API_CALL)" | \
    while IFS= read -r line; do
        local timestamp=$(echo "$line" | grep -o '"timestamp":[0-9]*' | cut -d: -f2)
        local token=$(echo "$line" | grep -o 'TETRA:[A-Z_]*:[A-Z_]*')
        local element=$(echo "$line" | grep -o '"element":"[^"]*"' | cut -d\" -f4)
        local endpoint=$(echo "$line" | grep -o '"endpoint":"[^"]*"' | cut -d\" -f4)
        local response_time=$(echo "$line" | grep -o '"responseTime":[0-9]*' | cut -d: -f2)

        if [[ -n "$timestamp" ]]; then
            echo "$timestamp|$token|$element|$endpoint|$response_time"
        fi
    done | sort -n > "$temp_clicks"

    echo "⚡ Click → API Response Correlations:"
    echo ""

    local prev_timestamp=""
    local prev_token=""
    local prev_element=""
    local correlation_count=0

    while IFS='|' read -r timestamp token element endpoint response_time; do
        if [[ -n "$prev_timestamp" && "$prev_token" == "TETRA:INTERACTION:CLICK" && "$token" == "TETRA:PERFORMANCE:API_CALL" ]]; then
            local gap=$(( (timestamp - prev_timestamp) / 1000 ))

            # If API call happened within 5 seconds of click, it's likely related
            if [[ $gap -le 5 ]]; then
                correlation_count=$((correlation_count + 1))
                local human_time=$(date -d "@$((prev_timestamp / 1000))" '+%H:%M:%S' 2>/dev/null || date -r "$((prev_timestamp / 1000))" '+%H:%M:%S')

                printf "  %s  \e[32m%s\e[0m" "$human_time" "$prev_element"
                printf " → \e[33m%s\e[0m" "$endpoint"
                printf " \e[36m(%sms)\e[0m" "$response_time"
                printf " \e[90m[+%ds]\e[0m\n" "$gap"

                # Flag slow responses after clicks
                if [[ $response_time -gt 1000 ]]; then
                    printf "    \e[31m⚠️  Slow response after click\e[0m\n"
                fi
            fi
        fi

        prev_timestamp="$timestamp"
        prev_token="$token"
        prev_element="$element"
    done < "$temp_clicks"

    echo ""
    printf "📈 Found %d click → API correlations\n" "$correlation_count"

    rm -f "$temp_clicks"
}

# === MAIN COMMAND INTERFACE ===

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    case "${1:-}" in
        "clicks"|"click-timing")
            tsm_analyze_click_timing "${@:2}"
            ;;
        "journey"|"user-journey")
            tsm_analyze_user_journey "${@:2}"
            ;;
        "performance"|"click-perf")
            tsm_analyze_click_performance "${@:2}"
            ;;
        *)
            echo "TSM Analytics - Advanced tetra token analysis"
            echo ""
            echo "Usage: $(basename "$0") <command> [options]"
            echo ""
            echo "Commands:"
            echo "  clicks <service> [window]     Analyze click timing and patterns"
            echo "  journey <service> [session]  Trace user journey through events"
            echo "  performance <service>        Correlate clicks with API performance"
            echo ""
            echo "Examples:"
            echo "  $0 clicks devpages           # Analyze click patterns"
            echo "  $0 journey devpages          # Show user event timeline"
            echo "  $0 performance devpages      # Click → API correlation"
            ;;
    esac
fi