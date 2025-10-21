#!/usr/bin/env bash
# state_manager.sh - State management for RAG system

# State directories
TETRA_USER_RAG="${TETRA_DIR:-$HOME/.tetra}/rag"
STATE_DIR="$TETRA_USER_RAG/state"
PROJECTS_DIR="$STATE_DIR/projects"

# Initialize state directories
init_state_dirs() {
    mkdir -p "$STATE_DIR" "$PROJECTS_DIR"

    # Initialize log files if they don't exist
    if [[ ! -f "$STATE_DIR/generations.log" ]]; then
        echo "timestamp|agent|files_count|context_size|status|query_hash" > "$STATE_DIR/generations.log"
    fi

    if [[ ! -f "$STATE_DIR/agent_usage.log" ]]; then
        echo "timestamp|agent|command|success" > "$STATE_DIR/agent_usage.log"
    fi

    if [[ ! -f "$STATE_DIR/user_prefs.conf" ]]; then
        cat > "$STATE_DIR/user_prefs.conf" <<EOF
# User preferences for RAG system
preferred_agent=base
default_ulm_top=20
auto_save_state=true
track_performance=true
EOF
    fi
}

# Log a generation event
log_generation() {
    local agent="$1"
    local files_count="$2"
    local context_size="$3"
    local status="$4"
    local query="${5:-}"

    init_state_dirs

    local timestamp query_hash
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    query_hash=$(echo "$query" | md5sum | cut -d' ' -f1 | head -c 8)

    echo "$timestamp|$agent|$files_count|$context_size|$status|$query_hash" >> "$STATE_DIR/generations.log"
}

# Log agent usage
log_agent_usage() {
    local agent="$1"
    local command="$2"
    local success="$3"

    init_state_dirs

    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    echo "$timestamp|$agent|$command|$success" >> "$STATE_DIR/agent_usage.log"
}

# Track token usage
log_token_usage() {
    local agent="$1"
    local input_tokens="$2"
    local output_tokens="$3"
    local cost_estimate="${4:-0}"

    init_state_dirs

    local timestamp total_tokens
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    total_tokens=$((input_tokens + output_tokens))

    if [[ ! -f "$STATE_DIR/token_usage.log" ]]; then
        echo "timestamp|agent|input_tokens|output_tokens|total_tokens|cost_estimate" > "$STATE_DIR/token_usage.log"
    fi

    echo "$timestamp|$agent|$input_tokens|$output_tokens|$total_tokens|$cost_estimate" >> "$STATE_DIR/token_usage.log"
}

# Save project context
save_project_context() {
    local project_name="$1"
    local file_list="$2"
    local context_hash="$3"

    init_state_dirs

    local project_file="$PROJECTS_DIR/$project_name.ctx"
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    {
        echo "# Project Context: $project_name"
        echo "# Saved: $timestamp"
        echo "# Context Hash: $context_hash"
        echo ""
        echo "FILES:"
        echo "$file_list"
    } > "$project_file"
}

# Get project context
get_project_context() {
    local project_name="$1"
    local project_file="$PROJECTS_DIR/$project_name.ctx"

    if [[ -f "$project_file" ]]; then
        sed -n '/^FILES:/,$ p' "$project_file" | tail -n +2
    fi
}

# Performance analytics
get_agent_performance() {
    local agent="${1:-}"

    init_state_dirs

    if [[ -n "$agent" ]]; then
        grep "|$agent|" "$STATE_DIR/generations.log" 2>/dev/null || echo ""
    else
        cat "$STATE_DIR/generations.log" 2>/dev/null || echo ""
    fi
}

get_success_rate() {
    local agent="${1:-}"

    local total_count success_count
    if [[ -n "$agent" ]]; then
        total_count=$(grep "|$agent|" "$STATE_DIR/generations.log" 2>/dev/null | wc -l)
        success_count=$(grep "|$agent|.*|success|" "$STATE_DIR/generations.log" 2>/dev/null | wc -l)
    else
        total_count=$(tail -n +2 "$STATE_DIR/generations.log" 2>/dev/null | wc -l)
        success_count=$(grep "|success|" "$STATE_DIR/generations.log" 2>/dev/null | wc -l)
    fi

    if [[ $total_count -gt 0 ]]; then
        echo "scale=2; $success_count * 100 / $total_count" | bc
    else
        echo "0"
    fi
}

get_token_stats() {
    local agent="${1:-}"
    local days="${2:-7}"

    init_state_dirs

    # Get date threshold
    local threshold_date
    threshold_date=$(date -d "$days days ago" '+%Y-%m-%d' 2>/dev/null || date -v-${days}d '+%Y-%m-%d')

    local filter_cmd="cat"
    if [[ -n "$agent" ]]; then
        filter_cmd="grep |$agent|"
    fi

    if [[ -f "$STATE_DIR/token_usage.log" ]]; then
        tail -n +2 "$STATE_DIR/token_usage.log" | \
        awk -F'|' -v threshold="$threshold_date" '$1 >= threshold' | \
        $filter_cmd | \
        awk -F'|' '
            BEGIN { total_input=0; total_output=0; total_cost=0; count=0 }
            { total_input+=$3; total_output+=$4; total_cost+=$6; count++ }
            END {
                if (count > 0) {
                    printf "total_input=%d\n", total_input
                    printf "total_output=%d\n", total_output
                    printf "total_tokens=%d\n", total_input + total_output
                    printf "total_cost=%.4f\n", total_cost
                    printf "avg_tokens_per_request=%.0f\n", (total_input + total_output) / count
                    printf "request_count=%d\n", count
                } else {
                    print "total_input=0"
                    print "total_output=0"
                    print "total_tokens=0"
                    print "total_cost=0.0000"
                    print "avg_tokens_per_request=0"
                    print "request_count=0"
                }
            }'
    fi
}

# Cleanup old data
cleanup_old_data() {
    local days="${1:-30}"

    init_state_dirs

    echo "Cleaning up data older than $days days..."

    # Create backup before cleanup
    local backup_dir="$STATE_DIR/backups/$(date '+%Y%m%d_%H%M%S')"
    mkdir -p "$backup_dir"

    for log_file in "$STATE_DIR"/*.log; do
        if [[ -f "$log_file" ]]; then
            cp "$log_file" "$backup_dir/"
        fi
    done

    # Get date threshold
    local threshold_date
    threshold_date=$(date -d "$days days ago" '+%Y-%m-%d' 2>/dev/null || date -v-${days}d '+%Y-%m-%d')

    # Clean log files (keep header + recent data)
    for log_file in "$STATE_DIR"/*.log; do
        if [[ -f "$log_file" ]]; then
            local temp_file
            temp_file=$(mktemp)

            # Keep header
            head -1 "$log_file" > "$temp_file"

            # Keep recent data
            tail -n +2 "$log_file" | \
            awk -F'|' -v threshold="$threshold_date" '$1 >= threshold' >> "$temp_file"

            mv "$temp_file" "$log_file"
        fi
    done

    echo "Cleanup complete. Backup saved to $backup_dir"
}

# Export data for analysis
export_data() {
    local format="${1:-json}"
    local output_file="${2:-}"

    init_state_dirs

    case "$format" in
        "json")
            {
                echo "{"
                echo "  \"generations\": ["
                tail -n +2 "$STATE_DIR/generations.log" 2>/dev/null | while IFS='|' read -r ts agent files context status query; do
                    echo "    {\"timestamp\": \"$ts\", \"agent\": \"$agent\", \"files_count\": $files, \"context_size\": $context, \"status\": \"$status\", \"query_hash\": \"$query\"},"
                done | sed '$ s/,$//'
                echo "  ],"
                echo "  \"token_usage\": ["
                if [[ -f "$STATE_DIR/token_usage.log" ]]; then
                    tail -n +2 "$STATE_DIR/token_usage.log" 2>/dev/null | while IFS='|' read -r ts agent input output total cost; do
                        echo "    {\"timestamp\": \"$ts\", \"agent\": \"$agent\", \"input_tokens\": $input, \"output_tokens\": $output, \"total_tokens\": $total, \"cost\": $cost},"
                    done | sed '$ s/,$//'
                fi
                echo "  ]"
                echo "}"
            }
            ;;
        "csv")
            echo "Generations CSV:"
            cat "$STATE_DIR/generations.log"
            echo
            echo "Token Usage CSV:"
            cat "$STATE_DIR/token_usage.log" 2>/dev/null || echo "No token usage data"
            ;;
        *)
            echo "Unsupported format: $format" >&2
            return 1
            ;;
    esac | if [[ -n "$output_file" ]]; then
        tee "$output_file"
    else
        cat
    fi
}

# --- CLI Interface ---

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    case "${1:-}" in
        "init")
            init_state_dirs
            echo "State directories initialized"
            ;;
        "log-generation")
            log_generation "${2:-base}" "${3:-0}" "${4:-0}" "${5:-unknown}" "${6:-}"
            ;;
        "log-tokens")
            log_token_usage "${2:-base}" "${3:-0}" "${4:-0}" "${5:-0}"
            ;;
        "performance")
            get_agent_performance "${2:-}"
            ;;
        "success-rate")
            echo "$(get_success_rate "${2:-}")%"
            ;;
        "token-stats")
            get_token_stats "${2:-}" "${3:-7}"
            ;;
        "cleanup")
            cleanup_old_data "${2:-30}"
            ;;
        "export")
            export_data "${2:-json}" "${3:-}"
            ;;
        *)
            echo "Usage: state_manager.sh {init|log-generation|log-tokens|performance|success-rate|token-stats|cleanup|export}"
            echo
            echo "Commands:"
            echo "  init                           Initialize state directories"
            echo "  log-generation <agent> <files> <context> <status> [query]"
            echo "  log-tokens <agent> <input> <output> [cost]"
            echo "  performance [agent]            Show performance data"
            echo "  success-rate [agent]           Show success rate percentage"
            echo "  token-stats [agent] [days]     Show token usage statistics"
            echo "  cleanup [days]                 Clean up old data (default: 30 days)"
            echo "  export [json|csv] [file]       Export data for analysis"
            exit 1
            ;;
    esac
fi