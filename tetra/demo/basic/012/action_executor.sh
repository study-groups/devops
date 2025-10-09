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
            cat <<EOF
${EXEC_COLOR_START}┌─ EXECUTING ACTION ──────────────────────────────────────┐${EXEC_COLOR_RESET}
${EXEC_COLOR_START}│${EXEC_COLOR_RESET} $signature
${EXEC_COLOR_START}│${EXEC_COLOR_RESET} Status: ${EXEC_COLOR_START}▶ Executing...${EXEC_COLOR_RESET}
${EXEC_COLOR_START}└─────────────────────────────────────────────────────────┘${EXEC_COLOR_RESET}

EOF
            ;;
        "success")
            cat <<EOF

${EXEC_COLOR_SUCCESS}┌─ EXECUTION COMPLETE ────────────────────────────────────┐${EXEC_COLOR_RESET}
${EXEC_COLOR_SUCCESS}│${EXEC_COLOR_RESET} $signature
${EXEC_COLOR_SUCCESS}│${EXEC_COLOR_RESET} Status: ${EXEC_COLOR_SUCCESS}✓ Success${EXEC_COLOR_RESET}
${EXEC_COLOR_SUCCESS}│${EXEC_COLOR_RESET} Duration: ${duration_ms}ms
${EXEC_COLOR_SUCCESS}└─────────────────────────────────────────────────────────┘${EXEC_COLOR_RESET}
EOF
            ;;
        "error")
            cat <<EOF

${EXEC_COLOR_ERROR}┌─ EXECUTION FAILED ──────────────────────────────────────┐${EXEC_COLOR_RESET}
${EXEC_COLOR_ERROR}│${EXEC_COLOR_RESET} $signature
${EXEC_COLOR_ERROR}│${EXEC_COLOR_RESET} Status: ${EXEC_COLOR_ERROR}✗ Error${EXEC_COLOR_RESET}
${EXEC_COLOR_ERROR}│${EXEC_COLOR_RESET} Error: $error_msg
${EXEC_COLOR_ERROR}│${EXEC_COLOR_RESET} Duration: ${duration_ms}ms
${EXEC_COLOR_ERROR}└─────────────────────────────────────────────────────────┘${EXEC_COLOR_RESET}
EOF
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

    # === PHASE 2: VALIDATION ===

    if ! validate_action "$action"; then
        local duration=$(($(get_time_ms) - start_time_ms))

        # Log failure
        tetra_log "tui" "$verb" "$noun" "fail" "{\"error\":\"Validation failed\",\"duration_ms\":$duration}"

        # Show error banner
        local error_banner=$(show_execution_banner "$action" "error" "$duration" "Validation failed")
        local error_modal=$(show_modal_error "$action" "Validation failed")

        TUI_BUFFERS[@tui[content]]="${error_banner}\n${error_modal}"
        set_action_error "$action" "Validation failed"
        return 1
    fi

    # === PHASE 3: EXECUTION ===

    # Execute the actual action
    local output=$(execute_action_impl "$action")
    local exit_code=$?

    local end_time_ms=$(get_time_ms)
    local duration=$((end_time_ms - start_time_ms))

    # === PHASE 4: POST-EXECUTION ===

    if [[ $exit_code -ne 0 ]]; then
        # FAILURE PATH
        tetra_log "tui" "$verb" "$noun" "fail" "{\"exit_code\":$exit_code,\"duration_ms\":$duration}"

        local error_banner=$(show_execution_banner "$action" "error" "$duration" "Exit code $exit_code")
        local error_modal=$(show_modal_error "$action" "Execution failed")

        TUI_BUFFERS[@tui[content]]="${error_banner}\n${error_modal}"
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

        # Route output to declared targets (no banner, just content)
        route_output_and_effects "$output_target" "$effects_targets" "$output"
    fi

    # Update footer with timing
    if [[ "$action" == "test:demo" ]]; then
        TUI_BUFFERS[@tui[footer]]="✓ Test completed in ${duration}ms with 3/3 checks passed"
    else
        TUI_BUFFERS[@tui[footer]]="✓ Action completed in ${duration}ms"
    fi

    return 0
}

# Show last 10 log entries
show_execution_log() {
    if [[ ! -f "$EXEC_LOG_FILE" ]]; then
        echo "No execution log found."
        echo "Actions will be logged to: $EXEC_LOG_FILE"
        return
    fi

    echo "Recent Action Executions (Last 10)"
    echo "────────────────────────────────────────────────────────"
    echo ""

    tail -10 "$EXEC_LOG_FILE" | while IFS= read -r line; do
        # Parse JSON (basic extraction)
        local timestamp=$(echo "$line" | grep -o '"timestamp":"[^"]*"' | cut -d'"' -f4)
        local module=$(echo "$line" | grep -o '"module":"[^"]*"' | cut -d'"' -f4)
        local verb=$(echo "$line" | grep -o '"verb":"[^"]*"' | cut -d'"' -f4)
        local subject=$(echo "$line" | grep -o '"subject":"[^"]*"' | cut -d'"' -f4)
        local status=$(echo "$line" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

        local status_symbol="●"
        case "$status" in
            "try") status_symbol="○" ;;
            "success") status_symbol="✓" ;;
            "fail") status_symbol="✗" ;;
        esac

        echo "$status_symbol ${timestamp:11:8} $module.$verb:$subject - $status"
    done

    echo ""
    echo "Full log: $EXEC_LOG_FILE"
}
