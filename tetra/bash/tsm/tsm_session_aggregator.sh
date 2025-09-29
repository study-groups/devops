#!/usr/bin/env bash

# TSM Session Aggregator - Analyze tetra logs by user sessions
# Disambiguates user traffic and creates session-based insights
# Uses resource manager to prevent macOS EMFILE issues

# Load resource manager
SCRIPT_DIR="$(dirname "${BASH_SOURCE[0]}")"
source "$SCRIPT_DIR/tsm_resource_manager.sh"

# === SESSION EXTRACTION ===

tsm_extract_sessions() {
    local service_pattern="$1"
    local time_window="${2:-3600}"  # 1 hour default
    local output_format="${3:-summary}"  # summary|detailed|json

    local log_file
    log_file=$(tsm_monitor_resolve_log_file "$service_pattern")
    if [[ -z "$log_file" || ! -f "$log_file" ]]; then
        echo "No log file found for service pattern: $service_pattern"
        return 1
    fi

    echo "👥 Session Traffic Analysis - $service_pattern"
    echo "═══════════════════════════════════════════════════════════"

    local temp_sessions="/tmp/tsm_sessions_$$"
    local temp_events="/tmp/tsm_events_$$"

    # Extract all tetra events with session info
    tail -10000 "$log_file" | grep "TETRA:" | while IFS= read -r line; do
        local timestamp=$(echo "$line" | grep -o '"timestamp":[0-9]*' | cut -d: -f2)
        local token=$(echo "$line" | grep -o 'TETRA:[A-Z_]*:[A-Z_]*')
        local session_id=$(echo "$line" | grep -o '"sessionId":"[^"]*"' | cut -d\" -f4)
        local user_id=$(echo "$line" | grep -o '"userId":"[^"]*"' | cut -d\" -f4)
        local fingerprint=$(echo "$line" | grep -o '"fingerprint":"[^"]*"' | cut -d\" -f4)
        local ip=$(echo "$line" | grep -o '"ip":"[^"]*"' | cut -d\" -f4)
        local user_agent=$(echo "$line" | grep -o '"userAgent":"[^"]*"' | cut -d\" -f4 | head -c 50)

        if [[ -n "$timestamp" && -n "$session_id" ]]; then
            echo "$timestamp|$token|$session_id|$user_id|$fingerprint|$ip|$user_agent"
        fi
    done | sort -n > "$temp_events"

    if [[ ! -s "$temp_events" ]]; then
        echo "No tetra events with session data found"
        rm -f "$temp_events"
        return 1
    fi

    # Aggregate by session
    declare -A sessions
    declare -A session_start
    declare -A session_end
    declare -A session_events
    declare -A session_users
    declare -A session_ips
    declare -A session_agents
    declare -A session_errors
    declare -A session_features

    while IFS='|' read -r timestamp token session_id user_id fingerprint ip user_agent; do
        # Track session boundaries
        if [[ -z "${session_start[$session_id]}" || "$timestamp" -lt "${session_start[$session_id]}" ]]; then
            session_start[$session_id]="$timestamp"
        fi
        if [[ -z "${session_end[$session_id]}" || "$timestamp" -gt "${session_end[$session_id]}" ]]; then
            session_end[$session_id]="$timestamp"
        fi

        # Count events
        session_events[$session_id]=$((${session_events[$session_id]:-0} + 1))

        # Track user info
        if [[ -n "$user_id" && "$user_id" != "null" ]]; then
            session_users[$session_id]="$user_id"
        fi
        if [[ -n "$ip" && "$ip" != "null" ]]; then
            session_ips[$session_id]="$ip"
        fi
        if [[ -n "$user_agent" && "$user_agent" != "null" ]]; then
            session_agents[$session_id]="${user_agent:0:30}..."
        fi

        # Count errors
        if [[ "$token" == *ERROR* ]]; then
            session_errors[$session_id]=$((${session_errors[$session_id]:-0} + 1))
        fi

        # Track unique features
        if [[ "$token" == *FEATURE_USE* ]]; then
            local feature=$(echo "$token" | cut -d: -f3)
            if [[ -z "${session_features[$session_id]}" ]]; then
                session_features[$session_id]="$feature"
            elif [[ "${session_features[$session_id]}" != *"$feature"* ]]; then
                session_features[$session_id]="${session_features[$session_id]},$feature"
            fi
        fi

        sessions[$session_id]=1
    done < "$temp_events"

    # Output results
    case "$output_format" in
        "json")
            tsm_output_sessions_json sessions session_start session_end session_events session_users session_ips session_agents session_errors session_features
            ;;
        "detailed")
            tsm_output_sessions_detailed sessions session_start session_end session_events session_users session_ips session_agents session_errors session_features
            ;;
        *)
            tsm_output_sessions_summary sessions session_start session_end session_events session_users session_ips session_agents session_errors session_features
            ;;
    esac

    rm -f "$temp_events" "$temp_sessions"
}

tsm_output_sessions_summary() {
    local -n sessions=$1
    local -n session_start=$2
    local -n session_end=$3
    local -n session_events=$4
    local -n session_users=$5
    local -n session_ips=$6
    local -n session_agents=$7
    local -n session_errors=$8
    local -n session_features=$9

    local total_sessions=${#sessions[@]}
    local authenticated_sessions=0
    local anonymous_sessions=0
    local total_events=0
    local total_errors=0

    echo "📊 Session Summary:"
    echo ""

    # Calculate totals
    for session_id in "${!sessions[@]}"; do
        total_events=$((total_events + ${session_events[$session_id]:-0}))
        total_errors=$((total_errors + ${session_errors[$session_id]:-0}))

        if [[ -n "${session_users[$session_id]}" && "${session_users[$session_id]}" != "null" ]]; then
            authenticated_sessions=$((authenticated_sessions + 1))
        else
            anonymous_sessions=$((anonymous_sessions + 1))
        fi
    done

    printf "   Total Sessions: %d\n" "$total_sessions"
    printf "   Authenticated: %d\n" "$authenticated_sessions"
    printf "   Anonymous: %d\n" "$anonymous_sessions"
    printf "   Total Events: %d\n" "$total_events"
    printf "   Total Errors: %d\n" "$total_errors"

    if [[ $total_sessions -gt 0 ]]; then
        printf "   Avg Events/Session: %d\n" "$((total_events / total_sessions))"
    fi

    echo ""
    echo "🔍 Session Details:"
    echo ""

    # Sort sessions by start time and show details
    for session_id in $(for s in "${!sessions[@]}"; do echo "${session_start[$s]}|$s"; done | sort -n | cut -d'|' -f2); do
        local start_time="${session_start[$session_id]}"
        local end_time="${session_end[$session_id]}"
        local duration=$(( (end_time - start_time) / 1000 ))
        local events="${session_events[$session_id]:-0}"
        local user="${session_users[$session_id]:-anonymous}"
        local ip="${session_ips[$session_id]:-unknown}"
        local errors="${session_errors[$session_id]:-0}"

        local human_start=$(date -d "@$((start_time / 1000))" '+%H:%M:%S' 2>/dev/null || date -r "$((start_time / 1000))" '+%H:%M:%S')
        local human_duration=""

        if [[ $duration -gt 3600 ]]; then
            human_duration="${duration}s (${duration}s)"
        elif [[ $duration -gt 60 ]]; then
            human_duration="${duration}s ($(( duration / 60 ))m $(( duration % 60 ))s)"
        else
            human_duration="${duration}s"
        fi

        printf "   %s  " "$human_start"
        printf "\e[36m%s\e[0m  " "${session_id:0:12}..."
        printf "\e[32m%s\e[0m  " "$user"
        printf "%d events  " "$events"
        printf "%s  " "$human_duration"
        printf "%s" "${ip:0:15}"

        if [[ $errors -gt 0 ]]; then
            printf "  \e[31m%d errors\e[0m" "$errors"
        fi
        echo ""
    done
}

# === USER TRAFFIC DISAMBIGUATION ===

tsm_disambiguate_users() {
    local service_pattern="$1"
    local time_window="${2:-3600}"

    local log_file
    log_file=$(tsm_monitor_resolve_log_file "$service_pattern")
    if [[ -z "$log_file" || ! -f "$log_file" ]]; then
        echo "No log file found for service pattern: $service_pattern"
        return 1
    fi

    echo "🔍 User Traffic Disambiguation"
    echo "═══════════════════════════════════════════════════════════"

    local temp_users="/tmp/tsm_users_$$"

    # Extract user identification signals
    tail -10000 "$log_file" | grep "TETRA:" | while IFS= read -r line; do
        local timestamp=$(echo "$line" | grep -o '"timestamp":[0-9]*' | cut -d: -f2)
        local session_id=$(echo "$line" | grep -o '"sessionId":"[^"]*"' | cut -d\" -f4)
        local user_id=$(echo "$line" | grep -o '"userId":"[^"]*"' | cut -d\" -f4)
        local fingerprint=$(echo "$line" | grep -o '"fingerprint":"[^"]*"' | cut -d\" -f4)
        local ip=$(echo "$line" | grep -o '"ip":"[^"]*"' | cut -d\" -f4)
        local user_agent=$(echo "$line" | grep -o '"userAgent":"[^"]*"' | cut -d\" -f4)

        if [[ -n "$session_id" ]]; then
            echo "$timestamp|$session_id|$user_id|$fingerprint|$ip|$user_agent"
        fi
    done | sort -n > "$temp_users"

    # Group by identification signals
    declare -A user_sessions
    declare -A user_ips
    declare -A user_agents
    declare -A user_first_seen
    declare -A user_last_seen
    declare -A ip_users
    declare -A fingerprint_users

    while IFS='|' read -r timestamp session_id user_id fingerprint ip user_agent; do
        local identity="$user_id"
        if [[ -z "$identity" || "$identity" == "null" ]]; then
            identity="anon_${fingerprint:0:8}"
        fi

        # Track sessions per identity
        if [[ -z "${user_sessions[$identity]}" ]]; then
            user_sessions[$identity]="$session_id"
        elif [[ "${user_sessions[$identity]}" != *"$session_id"* ]]; then
            user_sessions[$identity]="${user_sessions[$identity]},$session_id"
        fi

        # Track time boundaries
        if [[ -z "${user_first_seen[$identity]}" || "$timestamp" -lt "${user_first_seen[$identity]}" ]]; then
            user_first_seen[$identity]="$timestamp"
        fi
        if [[ -z "${user_last_seen[$identity]}" || "$timestamp" -gt "${user_last_seen[$identity]}" ]]; then
            user_last_seen[$identity]="$timestamp"
        fi

        # Track IP and user agent
        user_ips[$identity]="$ip"
        user_agents[$identity]="${user_agent:0:50}"

        # Reverse mappings for disambiguation
        if [[ -n "$ip" && "$ip" != "null" ]]; then
            if [[ -z "${ip_users[$ip]}" ]]; then
                ip_users[$ip]="$identity"
            elif [[ "${ip_users[$ip]}" != *"$identity"* ]]; then
                ip_users[$ip]="${ip_users[$ip]},$identity"
            fi
        fi

        if [[ -n "$fingerprint" && "$fingerprint" != "null" ]]; then
            if [[ -z "${fingerprint_users[$fingerprint]}" ]]; then
                fingerprint_users[$fingerprint]="$identity"
            elif [[ "${fingerprint_users[$fingerprint]}" != *"$identity"* ]]; then
                fingerprint_users[$fingerprint]="${fingerprint_users[$fingerprint]},$identity"
            fi
        fi
    done < "$temp_users"

    echo "👤 Identified Users:"
    echo ""

    for identity in "${!user_sessions[@]}"; do
        local session_count=$(echo "${user_sessions[$identity]}" | tr ',' '\n' | wc -l)
        local ip="${user_ips[$identity]:-unknown}"
        local first_seen="${user_first_seen[$identity]}"
        local last_seen="${user_last_seen[$identity]}"
        local duration=$(( (last_seen - first_seen) / 1000 ))

        local human_first=$(date -d "@$((first_seen / 1000))" '+%H:%M:%S' 2>/dev/null || date -r "$((first_seen / 1000))" '+%H:%M:%S')
        local human_last=$(date -d "@$((last_seen / 1000))" '+%H:%M:%S' 2>/dev/null || date -r "$((last_seen / 1000))" '+%H:%M:%S')

        printf "   \e[32m%s\e[0m  " "$identity"
        printf "%d sessions  " "$session_count"
        printf "%s-%s  " "$human_first" "$human_last"
        printf "(%ds)  " "$duration"
        printf "%s" "$ip"
        echo ""
    done

    echo ""
    echo "🚨 Potential Issues:"
    echo ""

    # Check for suspicious patterns
    local suspicious_count=0

    # Multiple users from same IP
    for ip in "${!ip_users[@]}"; do
        local user_count=$(echo "${ip_users[$ip]}" | tr ',' '\n' | wc -l)
        if [[ $user_count -gt 1 ]]; then
            suspicious_count=$((suspicious_count + 1))
            printf "   \e[33mShared IP\e[0m: %s has %d users: %s\n" "$ip" "$user_count" "${ip_users[$ip]}"
        fi
    done

    # Multiple users with same fingerprint
    for fingerprint in "${fingerprint_users[@]}"; do
        local user_count=$(echo "$fingerprint" | tr ',' '\n' | wc -l)
        if [[ $user_count -gt 1 ]]; then
            suspicious_count=$((suspicious_count + 1))
            printf "   \e[33mShared Device\e[0m: fingerprint has %d users: %s\n" "$user_count" "$fingerprint"
        fi
    done

    if [[ $suspicious_count -eq 0 ]]; then
        echo "   ✅ No suspicious patterns detected"
    fi

    rm -f "$temp_users"
}

# === BEHAVIORAL PATTERNS ===

tsm_analyze_user_patterns() {
    local service_pattern="$1"
    local user_filter="${2:-}"  # Optional: specific user to analyze

    echo "🎯 User Behavioral Patterns"
    echo "═══════════════════════════════════════════════════════════"

    local temp_behaviors="/tmp/tsm_behaviors_$$"

    # Extract behavioral events
    local log_file
    log_file=$(tsm_monitor_resolve_log_file "$service_pattern")

    local filter_cmd="tail -5000 \"$log_file\" | grep -E '(CLICK|FEATURE_USE|PAGE_VIEW|FORM_INTERACTION)'"
    if [[ -n "$user_filter" ]]; then
        filter_cmd="$filter_cmd | grep \"$user_filter\""
    fi

    eval "$filter_cmd" | while IFS= read -r line; do
        local timestamp=$(echo "$line" | grep -o '"timestamp":[0-9]*' | cut -d: -f2)
        local token=$(echo "$line" | grep -o 'TETRA:[A-Z_]*:[A-Z_]*')
        local user_id=$(echo "$line" | grep -o '"userId":"[^"]*"' | cut -d\" -f4)
        local element=$(echo "$line" | grep -o '"element":"[^"]*"' | cut -d\" -f4)
        local feature=$(echo "$line" | grep -o '"feature":"[^"]*"' | cut -d\" -f4)
        local url=$(echo "$line" | grep -o '"url":"[^"]*"' | cut -d\" -f4)

        if [[ -n "$timestamp" && -n "$user_id" ]]; then
            echo "$timestamp|$token|$user_id|$element|$feature|$url"
        fi
    done | sort -n > "$temp_behaviors"

    # Analyze patterns
    declare -A user_clicks
    declare -A user_features
    declare -A user_pages
    declare -A user_activity_times

    while IFS='|' read -r timestamp token user_id element feature url; do
        case "$token" in
            *CLICK*)
                user_clicks[$user_id]=$((${user_clicks[$user_id]:-0} + 1))
                ;;
            *FEATURE_USE*)
                if [[ -z "${user_features[$user_id]}" ]]; then
                    user_features[$user_id]="$feature"
                elif [[ "${user_features[$user_id]}" != *"$feature"* ]]; then
                    user_features[$user_id]="${user_features[$user_id]},$feature"
                fi
                ;;
            *PAGE_VIEW*)
                user_pages[$user_id]=$((${user_pages[$user_id]:-0} + 1))
                ;;
        esac

        # Track activity time patterns
        local hour=$(date -d "@$((timestamp / 1000))" '+%H' 2>/dev/null || date -r "$((timestamp / 1000))" '+%H')
        user_activity_times[$user_id]="${user_activity_times[$user_id]}$hour,"
    done < "$temp_behaviors"

    echo "📈 User Activity Summary:"
    echo ""

    for user_id in "${!user_clicks[@]}"; do
        local clicks="${user_clicks[$user_id]:-0}"
        local pages="${user_pages[$user_id]:-0}"
        local features_list="${user_features[$user_id]:-}"
        local feature_count=$(echo "$features_list" | tr ',' '\n' | sort | uniq | wc -l)

        printf "   \e[32m%s\e[0m: " "$user_id"
        printf "%d clicks, " "$clicks"
        printf "%d pages, " "$pages"
        printf "%d features" "$feature_count"

        # Show most active hours
        if [[ -n "${user_activity_times[$user_id]}" ]]; then
            local peak_hour=$(echo "${user_activity_times[$user_id]}" | tr ',' '\n' | sort | uniq -c | sort -rn | head -1 | awk '{print $2}')
            printf " (peak: %s:00)" "$peak_hour"
        fi
        echo ""
    done

    rm -f "$temp_behaviors"
}

# === MAIN COMMANDS ===

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    case "${1:-}" in
        "sessions"|"extract")
            tsm_extract_sessions "${@:2}"
            ;;
        "users"|"disambiguate")
            tsm_disambiguate_users "${@:2}"
            ;;
        "patterns"|"behavior")
            tsm_analyze_user_patterns "${@:2}"
            ;;
        *)
            echo "TSM Session Aggregator - User traffic disambiguation"
            echo ""
            echo "Usage: $(basename "$0") <command> [options]"
            echo ""
            echo "Commands:"
            echo "  sessions <service> [window] [format]  Extract and analyze sessions"
            echo "  users <service> [window]              Disambiguate user traffic"
            echo "  patterns <service> [user]             Analyze behavioral patterns"
            echo ""
            echo "Examples:"
            echo "  $0 sessions devpages                  # Show session summary"
            echo "  $0 sessions devpages 1800 detailed   # Detailed 30min analysis"
            echo "  $0 users devpages                     # Identify unique users"
            echo "  $0 patterns devpages admin            # Admin behavior patterns"
            ;;
    esac
fi