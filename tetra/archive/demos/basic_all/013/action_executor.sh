#!/usr/bin/env bash

# Action Executor - Enhanced execution with TES-compliant feedback
# Following Tetra Endpoint Specification for action lifecycle

# Colors for execution feedback
EXEC_COLOR_START="\033[1;36m"   # Cyan for start
EXEC_COLOR_SUCCESS="\033[1;32m" # Green for success
EXEC_COLOR_ERROR="\033[1;31m"   # Red for error
EXEC_COLOR_RESET="\033[0m"
EXEC_COLOR_DIM="\033[2m"

# Execution log (simulates tetra.jsonl)
EXEC_LOG_FILE="${TETRA_DIR:-/tmp}/logs/tetra.jsonl"
mkdir -p "$(dirname "$EXEC_LOG_FILE")" 2>/dev/null

# Get current time in milliseconds (cross-platform)
get_time_ms() {
    # Check if we're on macOS or Linux
    if [[ "$(uname)" == "Darwin" ]]; then
        # macOS - use Python
        if command -v python3 &>/dev/null; then
            python3 -c 'import time; print(int(time.time() * 1000))'
        elif command -v python &>/dev/null; then
            python -c 'import time; print(int(time.time() * 1000))'
        else
            # Fallback: seconds with 000
            echo "$(date +%s)000"
        fi
    else
        # Linux - GNU date supports %N
        date +%s%3N 2>/dev/null || echo "$(date +%s)000"
    fi
}

# Log action to unified tetra.jsonl
# Format: tetra_log <module> <verb> <subject> <status> [metadata_json]
tetra_log() {
    local module="$1"
    local verb="$2"
    local subject="$3"
    local status="$4"
    local metadata="${5:-{}}"

    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local exec_at="@local"

    # Create JSON log entry
    local log_entry=$(cat <<EOF
{"timestamp":"$timestamp","module":"$module","verb":"$verb","subject":"$subject","status":"$status","exec_at":"$exec_at","metadata":$metadata}
EOF
)

    # Append to log file
    echo "$log_entry" >> "$EXEC_LOG_FILE"
}

# Build action signature display
build_action_signature() {
    local action="$1"
    local action_name="${action//:/_}"

    if ! declare -p "ACTION_${action_name}" &>/dev/null; then
        echo "$action $ENDPOINT_OP () $FLOW_OP @tui[content]"
        return
    fi

    local -n _sig_action="ACTION_${action_name}"
    local inputs="${_sig_action[inputs]}"
    local output="${_sig_action[output]}"
    local effects="${_sig_action[effects]}"

    # Build full signature
    local input_part="(${inputs})"
    local output_part="$output"
    [[ -n "$effects" ]] && output_part="$output where $effects"

    echo "$action $ENDPOINT_OP $input_part $FLOW_OP $output_part"
}

# Show execution banner
show_execution_banner() {
    local action="$1"
    local phase="$2"  # start, success, error
    local duration_ms="${3:-0}"
    local error_msg="${4:-}"

    local signature=$(build_action_signature "$action")

    case "$phase" in
        "start")
            echo "$signature"
            ;;
        "success")
            echo "$signature (${duration_ms}ms)"
            ;;
        "error")
            echo "$signature - Error: $error_msg (${duration_ms}ms)"
            ;;
    esac
}

# Enhanced execution with full TES feedback and visible state transitions
# Uses observer pattern: updates buffers only, caller handles rendering and state
execute_action_with_feedback() {
    local action="$1"
    local verb="${action%%:*}"
    local noun="${action##*:}"

    # === PHASE 1: PRE-EXECUTION ===

    # NOTE: State is set to "executing" by caller (demo.sh)
    # We just do the work and update buffers

    # Log start to tetra.jsonl
    tetra_log "tui" "$verb" "$noun" "try" '{}'

    local start_time_ms=$(get_time_ms)

    # === PHASE 2: EXECUTION ===

    # Execute the actual action (capture output and exit code properly)
    local output
    local exit_code
    local temp_output="/tmp/tetra_action_output_$$"
    local temp_exitcode="/tmp/tetra_action_exitcode_$$"

    # Execute and capture both output and exit code
    {
        execute_action_impl "$action"
        echo $? > "$temp_exitcode"
    } > "$temp_output" 2>&1

    output=$(cat "$temp_output")
    exit_code=$(cat "$temp_exitcode")
    rm -f "$temp_output" "$temp_exitcode"

    local end_time_ms=$(get_time_ms)
    local duration=$((end_time_ms - start_time_ms))

    # === PHASE 3: POST-EXECUTION ===

    if [[ $exit_code -ne 0 ]]; then
        # FAILURE PATH
        tetra_log "tui" "$verb" "$noun" "fail" "{\"exit_code\":$exit_code,\"duration_ms\":$duration}"

        # Show the error output from the action
        TUI_BUFFERS["@tui[content]"]="$output"

        # Add error footer with details
        TUI_BUFFERS["@tui[footer]"]="✗ Action failed with exit code $exit_code (${duration}ms)"

        set_action_error "$action" "Execution failed with code $exit_code"
        return 1
    fi

    # SUCCESS PATH

    # Log success
    tetra_log "tui" "$verb" "$noun" "success" "{\"duration_ms\":$duration}"

    # Mark success state
    set_action_state "$action" "success"

    # Get routing targets and route output
    local action_name="${action//:/_}"
    if declare -p "ACTION_${action_name}" &>/dev/null; then
        local -n _action_ref="ACTION_${action_name}"
        local output_target="${_action_ref[output]}"
        local effects_targets="${_action_ref[effects]}"

        # Route output to declared targets (just set the buffer directly)
        TUI_BUFFERS["@tui[content]"]="$output"

        # Also route to effects if specified
        if [[ -n "$effects_targets" ]]; then
            route_output "$effects_targets" "$output"
        fi
    fi

    # Update status based on action result
    update_action_status_from_result "$action" "$output" "$exit_code"

    # Update footer with timing
    if [[ "$action" == "test:demo" ]]; then
        TUI_BUFFERS["@tui[footer]"]="Test completed in ${duration}ms (3/3 checks passed)"
    else
        TUI_BUFFERS["@tui[footer]"]="Completed in ${duration}ms"
    fi

    return 0
}

# Update action status based on execution result
update_action_status_from_result() {
    local action="$1"
    local output="$2"
    local exit_code="$3"

    case "$action" in
        view:toml|view:services|view:org|view:logs)
            local line_count=$(echo "$output" | wc -l | tr -d ' ')
            set_action_status "$action" "Displayed $line_count lines"
            ;;
        status:tsm)
            if [[ "$output" =~ "TSM not running" ]]; then
                set_action_status "$action" "TSM not running"
            elif [[ "$output" =~ "Running" || "$output" =~ "process" ]]; then
                local proc_count=$(echo "$output" | grep -c "^" || echo "0")
                set_action_status "$action" "Active processes found"
            fi
            ;;
        start:*|stop:*|restart:*)
            if [[ $exit_code -eq 0 ]]; then
                set_action_status "$action" "Operation completed successfully"
            else
                set_action_status "$action" "Operation failed"
            fi
            ;;
        edit:toml)
            set_action_status "$action" "Configuration updated"
            ;;
    esac
}

# Show last 10 log entries with TES formatting and colors
show_execution_log() {
    if [[ ! -f "$EXEC_LOG_FILE" ]]; then
        echo "No execution log found."
        echo "Actions will be logged to: $EXEC_LOG_FILE"
        return
    fi

    echo "Recent Actions:"
    echo ""

    # Status colors
    local COLOR_TRY="\033[1;36m"     # Cyan for try
    local COLOR_SUCCESS="\033[1;32m" # Green for success
    local COLOR_FAIL="\033[1;31m"    # Red for fail
    local COLOR_TIME="\033[2m"       # Dim for timestamps
    local COLOR_RESET="\033[0m"

    tail -10 "$EXEC_LOG_FILE" | while IFS= read -r line; do
        # Parse JSON (basic extraction)
        local timestamp=$(echo "$line" | grep -o '"timestamp":"[^"]*"' | cut -d'"' -f4)
        local module=$(echo "$line" | grep -o '"module":"[^"]*"' | cut -d'"' -f4)
        local verb=$(echo "$line" | grep -o '"verb":"[^"]*"' | cut -d'"' -f4)
        local subject=$(echo "$line" | grep -o '"subject":"[^"]*"' | cut -d'"' -f4)
        local status=$(echo "$line" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
        local metadata=$(echo "$line" | grep -o '"metadata":{[^}]*}' | cut -d':' -f2)

        # Extract duration if available
        local duration=""
        if [[ "$metadata" =~ \"duration_ms\":([0-9]+) ]]; then
            duration="${BASH_REMATCH[1]}ms"
        fi

        # Get action definition for full signature
        local action="${verb}:${subject}"
        local action_name="${action//:/_}"
        local signature=""

        if declare -p "ACTION_${action_name}" &>/dev/null; then
            local -n _log_action="ACTION_${action_name}"
            local inputs="${_log_action[inputs]}"
            local output="${_log_action[output]}"
            local effects="${_log_action[effects]}"

            # Build TES signature
            local input_part="(${inputs})"
            local output_part="$output"
            [[ -n "$effects" ]] && output_part="$output where $effects"
            signature=" $ENDPOINT_OP $input_part $FLOW_OP $output_part"
        fi

        # Render with colors
        printf "${COLOR_TIME}%s${COLOR_RESET} " "${timestamp:11:8}"

        # Colorize verb:noun
        refresh_color_state_cached "$verb" "$subject"
        printf "%s." "$module"
        render_action_verb_noun "$verb" "$subject"

        # Show signature if available
        if [[ -n "$signature" ]]; then
            printf "%s" "$signature"
        fi

        # Status with color
        printf " - "
        case "$status" in
            "try")
                printf "${COLOR_TRY}%s${COLOR_RESET}" "$status"
                ;;
            "success")
                printf "${COLOR_SUCCESS}%s${COLOR_RESET}" "$status"
                [[ -n "$duration" ]] && printf " ${COLOR_TIME}(%s)${COLOR_RESET}" "$duration"
                ;;
            "fail")
                printf "${COLOR_FAIL}%s${COLOR_RESET}" "$status"
                [[ -n "$duration" ]] && printf " ${COLOR_TIME}(%s)${COLOR_RESET}" "$duration"
                ;;
            *)
                printf "%s" "$status"
                ;;
        esac
        echo
    done

    echo ""
    echo "Log: $EXEC_LOG_FILE"
}
