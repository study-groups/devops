#!/usr/bin/env bash

# TSM Monitor - Enhanced log monitoring with tetra token support
# Monitors application logs for tetra tokens and triggers actions

# === CONFIGURATION ===

TSM_MONITOR_CONFIG_DIR="${TSM_DIR}/config"
TSM_MONITOR_TRIGGERS_FILE="${TSM_MONITOR_CONFIG_DIR}/triggers.conf"
TSM_MONITOR_LOG_FILE="${TSM_LOGS_DIR}/tsm-monitor.log"

# Default tetra token patterns
declare -A DEFAULT_TETRA_PATTERNS=(
    ["ADMIN_LOGIN"]="TETRA:(AUTH|USER):LOGIN.*admin"
    ["API_ERROR"]="TETRA:(ERROR|PERFORMANCE):.*status\":[45][0-9][0-9]"
    ["HIGH_RESPONSE_TIME"]="TETRA:PERFORMANCE:API_CALL.*responseTime\":[0-9]{4,}"
    ["BATCH_FLUSH"]="TETRA:BATCH_FLUSH"
    ["SESSION_START"]="TETRA:(AUTH|USER):SESSION_START"
    ["FORM_INTERACTION"]="TETRA:INTERACTION:FORM_INTERACTION"
    ["CLICK_TRACKING"]="TETRA:INTERACTION:CLICK"
    ["SEARCH_ACTIVITY"]="TETRA:BEHAVIOR:SEARCH"
)

# === UTILITY FUNCTIONS ===

tsm_monitor_log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$TSM_MONITOR_LOG_FILE"
}

tsm_monitor_init() {
    # Ensure directories exist
    mkdir -p "$TSM_MONITOR_CONFIG_DIR"
    mkdir -p "$(dirname "$TSM_MONITOR_LOG_FILE")"

    # Create default triggers file if it doesn't exist
    if [[ ! -f "$TSM_MONITOR_TRIGGERS_FILE" ]]; then
        cat > "$TSM_MONITOR_TRIGGERS_FILE" << 'EOF'
# TSM Monitor Triggers Configuration
# Format: PATTERN_NAME|COMMAND|DESCRIPTION|ENABLED
# Use {TOKEN}, {DATA}, {TIMESTAMP} as placeholders in commands

ADMIN_LOGIN|echo "Admin login detected: {DATA}" >> /tmp/admin-alerts.log|Alert on admin login|true
API_ERROR|echo "API error: {TOKEN} {DATA}" | logger -t tsm-monitor|Log API errors to syslog|true
HIGH_RESPONSE_TIME|echo "Slow API: {DATA}" >> /tmp/performance-alerts.log|Track slow API responses|true
BATCH_FLUSH|echo "Analytics batch: {DATA}" >> /tmp/analytics.log|Log analytics batches|false
SESSION_START|echo "New session: {DATA}" >> /tmp/sessions.log|Track new sessions|false
EOF
        tsm_monitor_log "INFO" "Created default triggers configuration"
    fi
}

# === MONITORING FUNCTIONS ===

tsm_monitor_service() {
    local service_pattern="$1"
    local duration="${2:-0}"  # 0 = infinite
    local follow_mode="${3:-true}"

    if [[ -z "$service_pattern" ]]; then
        echo "Usage: tsm monitor <service|process|id> [duration_seconds] [follow_mode]"
        echo "Examples:"
        echo "  tsm monitor devpages              # Monitor devpages service indefinitely"
        echo "  tsm monitor 0 300                # Monitor process ID 0 for 5 minutes"
        echo "  tsm monitor server-3000 0 false  # Monitor server-3000 with buffered output"
        return 64
    fi

    tsm_monitor_init

    # Resolve service pattern to log file
    local log_file
    log_file=$(tsm_monitor_resolve_log_file "$service_pattern")
    if [[ -z "$log_file" || ! -f "$log_file" ]]; then
        echo "No log file found for service pattern: $service_pattern"
        return 1
    fi

    tsm_monitor_log "INFO" "Starting monitor for $service_pattern (log: $log_file)"
    echo "Monitoring $service_pattern for tetra tokens..."
    echo "Press Ctrl+C to stop"
    echo "─" | head -c 50
    echo ""

    # Load triggers
    local -A triggers
    tsm_monitor_load_triggers triggers

    # Set up monitoring
    local start_time=$(date +%s)
    local line_count=0
    local token_count=0

    # Monitor function
    monitor_logs() {
        while IFS= read -r line; do
            line_count=$((line_count + 1))

            # Check for tetra tokens
            if [[ "$line" =~ TETRA:[A-Z_]+:[A-Z_]+ ]]; then
                token_count=$((token_count + 1))
                local token="${BASH_REMATCH[0]}"

                # Extract token parts
                local category=$(echo "$token" | cut -d: -f2)
                local event=$(echo "$token" | cut -d: -f3)
                local data=""

                # Try to extract JSON data after the token
                if [[ "$line" =~ \{.*\} ]]; then
                    data="${BASH_REMATCH[0]}"
                fi

                # Display the token
                printf "\e[32m[%s]\e[0m %s\n" "$(date '+%H:%M:%S')" "$token"
                if [[ -n "$data" ]]; then
                    echo "  Data: $data" | head -c 200  # Truncate long data
                    echo ""
                fi

                # Check triggers
                tsm_monitor_check_triggers triggers "$token" "$data" "$line"
            fi

            # Show progress every 100 lines
            if (( line_count % 100 == 0 )); then
                printf "\r\e[2K\e[90mProcessed %d lines, found %d tokens\e[0m" "$line_count" "$token_count"
            fi
        done
    }

    # Start monitoring
    if [[ "$follow_mode" == "true" ]]; then
        tail -f "$log_file" | monitor_logs
    else
        cat "$log_file" | monitor_logs
    fi

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    echo ""
    echo "─" | head -c 50
    printf "Monitoring complete: %d lines processed, %d tokens found in %ds\n" "$line_count" "$token_count" "$duration"
}

tsm_monitor_resolve_log_file() {
    local pattern="$1"

    # If it's a number, treat as TSM ID
    if [[ "$pattern" =~ ^[0-9]+$ ]]; then
        local tsm_id="$pattern"
        local name=$(tsm list 2>/dev/null | grep "TSM ID: $tsm_id" | head -1 | sed 's/.*Name: \([^,]*\).*/\1/')
        if [[ -n "$name" ]]; then
            echo "$TSM_LOGS_DIR/$name.out"
            return 0
        fi
    fi

    # Check if it's a direct log file path
    if [[ -f "$pattern" ]]; then
        echo "$pattern"
        return 0
    fi

    # Look for service log file
    if [[ -f "$TSM_LOGS_DIR/$pattern.out" ]]; then
        echo "$TSM_LOGS_DIR/$pattern.out"
        return 0
    fi

    # Try to find by service name pattern
    local found_log=$(find "$TSM_LOGS_DIR" -name "*$pattern*.out" | head -1)
    if [[ -n "$found_log" ]]; then
        echo "$found_log"
        return 0
    fi

    return 1
}

# === TRIGGER SYSTEM ===

tsm_monitor_load_triggers() {
    local -n trigger_array=$1

    if [[ ! -f "$TSM_MONITOR_TRIGGERS_FILE" ]]; then
        return 0
    fi

    while IFS='|' read -r pattern_name command description enabled; do
        # Skip comments and empty lines
        [[ "$pattern_name" =~ ^#.*$ || -z "$pattern_name" ]] && continue

        if [[ "$enabled" == "true" ]]; then
            # Get the regex pattern for this trigger
            local regex_pattern="${DEFAULT_TETRA_PATTERNS[$pattern_name]}"
            if [[ -n "$regex_pattern" ]]; then
                trigger_array["$pattern_name"]="$command"
            fi
        fi
    done < "$TSM_MONITOR_TRIGGERS_FILE"
}

tsm_monitor_check_triggers() {
    local -n trigger_array=$1
    local token="$2"
    local data="$3"
    local full_line="$4"

    for pattern_name in "${!trigger_array[@]}"; do
        local regex_pattern="${DEFAULT_TETRA_PATTERNS[$pattern_name]}"

        if [[ "$full_line" =~ $regex_pattern ]]; then
            local command="${trigger_array[$pattern_name]}"

            # Replace placeholders
            command="${command//\{TOKEN\}/$token}"
            command="${command//\{DATA\}/$data}"
            command="${command//\{TIMESTAMP\}/$(date '+%Y-%m-%d %H:%M:%S')}"

            tsm_monitor_log "TRIGGER" "Executing trigger '$pattern_name': $command"

            # Execute the command in the background
            bash -c "$command" &
        fi
    done
}

# === STREAMING/DEVELOPER MODE ===

tsm_monitor_stream() {
    local service_pattern="$1"
    local filter="${2:-}"

    if [[ -z "$service_pattern" ]]; then
        echo "Usage: tsm stream <service> [filter]"
        echo "Examples:"
        echo "  tsm stream devpages              # Stream all tetra tokens"
        echo "  tsm stream devpages PERFORMANCE  # Stream only performance tokens"
        echo "  tsm stream devpages API_CALL     # Stream only API call tokens"
        return 64
    fi

    local log_file
    log_file=$(tsm_monitor_resolve_log_file "$service_pattern")
    if [[ -z "$log_file" || ! -f "$log_file" ]]; then
        echo "No log file found for service pattern: $service_pattern"
        return 1
    fi

    echo "🔄 Streaming tetra tokens from $service_pattern"
    if [[ -n "$filter" ]]; then
        echo "📋 Filter: $filter"
    fi
    echo "📁 Log: $log_file"
    echo "Press Ctrl+C to stop"
    echo "════════════════════════════════════════════════════════════"

    # Create filter pattern
    local filter_pattern="TETRA:[A-Z_]+:[A-Z_]+"
    if [[ -n "$filter" ]]; then
        filter_pattern="TETRA:[^:]*$filter[^:]*:[A-Z_]+"
    fi

    tail -f "$log_file" | while IFS= read -r line; do
        if [[ "$line" =~ $filter_pattern ]]; then
            local timestamp=$(date '+%H:%M:%S')
            local token="${BASH_REMATCH[0]}"

            # Color-code by category
            local color="\e[36m"  # cyan default
            case "$token" in
                *ERROR*) color="\e[31m" ;;     # red
                *PERFORMANCE*) color="\e[33m" ;; # yellow
                *AUTH*) color="\e[35m" ;;      # magenta
                *INTERACTION*) color="\e[32m" ;; # green
                *BEHAVIOR*) color="\e[34m" ;;  # blue
            esac

            printf "${color}[%s]${color} %s\e[0m\n" "$timestamp" "$token"

            # Extract and display data
            if [[ "$line" =~ \{.*\} ]]; then
                local data="${BASH_REMATCH[0]}"
                echo "   $(echo "$data" | jq -C . 2>/dev/null || echo "$data")"
            fi
            echo ""
        fi
    done
}

# === ANALYTICS DASHBOARD ===

tsm_monitor_dashboard() {
    local service_pattern="$1"
    local time_window="${2:-300}"  # 5 minutes default

    local log_file
    log_file=$(tsm_monitor_resolve_log_file "$service_pattern")
    if [[ -z "$log_file" || ! -f "$log_file" ]]; then
        echo "No log file found for service pattern: $service_pattern"
        return 1
    fi

    echo "📊 Tetra Analytics Dashboard - $service_pattern (last ${time_window}s)"
    echo "══════════════════════════════════════════════════════════════"

    # Get recent log entries
    local since_time=$(date -d "${time_window} seconds ago" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || date -v-${time_window}S '+%Y-%m-%d %H:%M:%S')
    local recent_logs=$(tail -1000 "$log_file" | awk -v since="$since_time" '$0 > since')

    # Count token categories
    echo "🏷️  Token Categories:"
    echo "$recent_logs" | grep -o 'TETRA:[^:]*' | sort | uniq -c | sort -rn | head -10 | while read count category; do
        printf "   %s: %d\n" "$category" "$count"
    done

    echo ""
    echo "📈 Top Events:"
    echo "$recent_logs" | grep -o 'TETRA:[A-Z_]*:[A-Z_]*' | sort | uniq -c | sort -rn | head -10 | while read count event; do
        printf "   %s: %d\n" "$event" "$count"
    done

    echo ""
    echo "⚡ Performance Summary:"
    # Extract API response times
    local avg_response_time=$(echo "$recent_logs" | grep 'TETRA:PERFORMANCE:API_CALL' | grep -o '"responseTime":[0-9]*' | cut -d: -f2 | awk '{sum+=$1; count++} END {if(count>0) print int(sum/count); else print "N/A"}')
    local error_count=$(echo "$recent_logs" | grep -c 'TETRA:ERROR')
    local session_count=$(echo "$recent_logs" | grep -c 'TETRA:.*:SESSION_START')

    printf "   Average API Response Time: %s ms\n" "$avg_response_time"
    printf "   Error Count: %d\n" "$error_count"
    printf "   New Sessions: %d\n" "$session_count"

    echo ""
    echo "🔄 Real-time Stream: tsm stream $service_pattern"
    echo "📋 Full Monitor: tsm monitor $service_pattern"
}

# === CONFIGURATION MANAGEMENT ===

tsm_monitor_config() {
    local action="${1:-show}"

    case "$action" in
        "show"|"list")
            echo "📋 TSM Monitor Configuration:"
            echo "Config Dir: $TSM_MONITOR_CONFIG_DIR"
            echo "Log File: $TSM_MONITOR_LOG_FILE"
            echo "Triggers File: $TSM_MONITOR_TRIGGERS_FILE"
            echo ""

            if [[ -f "$TSM_MONITOR_TRIGGERS_FILE" ]]; then
                echo "🎯 Active Triggers:"
                grep -v '^#' "$TSM_MONITOR_TRIGGERS_FILE" | grep '|true$' | while IFS='|' read -r name cmd desc enabled; do
                    printf "   %s: %s\n" "$name" "$desc"
                done
            fi
            ;;
        "edit")
            ${EDITOR:-nano} "$TSM_MONITOR_TRIGGERS_FILE"
            ;;
        "test")
            echo "🧪 Testing trigger patterns..."
            tsm_monitor_test_patterns
            ;;
        *)
            echo "Usage: tsm monitor config [show|edit|test]"
            return 64
            ;;
    esac
}

tsm_monitor_test_patterns() {
    echo "Testing tetra token patterns against sample data..."

    local test_lines=(
        "TETRA:AUTH:LOGIN {\"userId\":\"admin\",\"method\":\"password\",\"success\":true}"
        "TETRA:PERFORMANCE:API_CALL {\"endpoint\":\"/api/users\",\"responseTime\":2500,\"status\":200}"
        "TETRA:ERROR:ERROR {\"message\":\"Database connection failed\",\"stack\":\"...\"}"
        "TETRA:BATCH_FLUSH {\"eventCount\":50,\"sessionId\":\"tetra_123\"}"
    )

    for line in "${test_lines[@]}"; do
        echo ""
        echo "Testing: $line"

        for pattern_name in "${!DEFAULT_TETRA_PATTERNS[@]}"; do
            local regex="${DEFAULT_TETRA_PATTERNS[$pattern_name]}"
            if [[ "$line" =~ $regex ]]; then
                echo "  ✅ Matches trigger: $pattern_name"
            fi
        done
    done
}

# === MAIN COMMANDS ===

# Export functions for TSM integration
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    # Script is being run directly
    case "${1:-}" in
        "monitor"|"watch")
            tsm_monitor_service "${@:2}"
            ;;
        "stream")
            tsm_monitor_stream "${@:2}"
            ;;
        "dashboard"|"stats")
            tsm_monitor_dashboard "${@:2}"
            ;;
        "config")
            tsm_monitor_config "${@:2}"
            ;;
        *)
            echo "TSM Monitor - Enhanced log monitoring for tetra tokens"
            echo ""
            echo "Usage: $(basename "$0") <command> [options]"
            echo ""
            echo "Commands:"
            echo "  monitor <service> [duration]  Monitor service logs for tetra tokens"
            echo "  stream <service> [filter]     Stream tetra tokens in real-time"
            echo "  dashboard <service> [window]  Show analytics dashboard"
            echo "  config [show|edit|test]       Manage monitoring configuration"
            echo ""
            echo "Examples:"
            echo "  $0 monitor devpages           # Monitor devpages service"
            echo "  $0 stream devpages PERFORMANCE # Stream performance tokens"
            echo "  $0 dashboard devpages 600     # Show 10-minute dashboard"
            echo "  $0 config edit                # Edit trigger configuration"
            ;;
    esac
fi