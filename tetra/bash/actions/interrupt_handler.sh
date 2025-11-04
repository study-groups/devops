#!/usr/bin/env bash
# TAS Interrupt Handler
# Provides atomic cleanup for pipelines on interrupt or failure

# Source dependencies
if [[ -f "$TETRA_SRC/bash/trs/trs.sh" ]]; then
    source "$TETRA_SRC/bash/trs/trs.sh"
fi

# Global state for current pipeline
PIPELINE_ID=""
PIPELINE_ARTIFACTS=()
PIPELINE_STAGE=0
PIPELINE_TOTAL_STAGES=0
PIPELINE_START_TIME=""
PIPELINE_BACKGROUND_PIDS=()

# Initialize pipeline tracking
# Usage: pipeline_init pipeline_id total_stages
pipeline_init() {
    local pipeline_id="$1"
    local total_stages="$2"

    PIPELINE_ID="$pipeline_id"
    PIPELINE_ARTIFACTS=()
    PIPELINE_STAGE=0
    PIPELINE_TOTAL_STAGES="$total_stages"
    PIPELINE_START_TIME=$(date +%s)
    PIPELINE_BACKGROUND_PIDS=()

    # Create manifest file
    local manifest_dir="/tmp/tetra/pipelines/${PIPELINE_ID}"
    mkdir -p "$manifest_dir"
    echo "# Pipeline Manifest: $PIPELINE_ID" > "$manifest_dir/manifest.txt"
    echo "# Started: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$manifest_dir/manifest.txt"
    echo "# Stages: $PIPELINE_TOTAL_STAGES" >> "$manifest_dir/manifest.txt"

    # Set up interrupt handler
    trap 'pipeline_interrupt_handler' SIGINT SIGTERM
}

# Track an artifact created during pipeline
# Usage: pipeline_track_artifact filepath
pipeline_track_artifact() {
    local filepath="$1"

    if [[ -z "$filepath" ]]; then
        return 0
    fi

    if [[ ! -f "$filepath" ]]; then
        echo "Warning: Artifact not found: $filepath" >&2
        return 0
    fi

    # Add to tracking array
    PIPELINE_ARTIFACTS+=("$filepath")

    # Append to manifest
    if [[ -n "$PIPELINE_ID" ]]; then
        local manifest_dir="/tmp/tetra/pipelines/${PIPELINE_ID}"
        echo "$filepath" >> "$manifest_dir/manifest.txt"
    fi
}

# Track a background process
# Usage: pipeline_track_pid pid
pipeline_track_pid() {
    local pid="$1"

    if [[ -z "$pid" ]]; then
        return 0
    fi

    PIPELINE_BACKGROUND_PIDS+=("$pid")
}

# Update current stage
# Usage: pipeline_set_stage stage_number
pipeline_set_stage() {
    local stage="$1"
    PIPELINE_STAGE="$stage"
}

# Interrupt handler (Ctrl-C)
pipeline_interrupt_handler() {
    echo "" >&2
    echo "Pipeline interrupted at stage $PIPELINE_STAGE of $PIPELINE_TOTAL_STAGES" >&2

    # Kill background processes
    if [[ ${#PIPELINE_BACKGROUND_PIDS[@]} -gt 0 ]]; then
        echo "Killing ${#PIPELINE_BACKGROUND_PIDS[@]} background processes..." >&2
        for pid in "${PIPELINE_BACKGROUND_PIDS[@]}"; do
            kill -9 "$pid" 2>/dev/null || true
        done
    fi

    # Rollback TTS transactions if available
    if type txn_rollback_pipeline &>/dev/null; then
        echo "Rolling back open transactions..." >&2
        txn_rollback_pipeline "$PIPELINE_ID" 2>/dev/null || true
    fi

    # Move all artifacts to cancelled
    if [[ ${#PIPELINE_ARTIFACTS[@]} -gt 0 ]]; then
        echo "Moving ${#PIPELINE_ARTIFACTS[@]} artifacts to cancelled..." >&2
        move_artifacts_to_cancelled "$PIPELINE_ID" "user_interrupt"
    fi

    # Log the interrupt
    log_pipeline_event "$PIPELINE_ID" "interrupted" "stage_$PIPELINE_STAGE" "User pressed Ctrl-C"

    echo "Pipeline cancelled. Artifacts moved to: /tmp/tetra/cancelled/$PIPELINE_ID" >&2

    # Clean exit
    exit 130  # Standard exit code for SIGINT
}

# Failure handler (error during pipeline)
pipeline_failure_handler() {
    local stage="$1"
    local error_msg="$2"
    local exit_code="${3:-1}"

    echo "Pipeline failed at stage $stage" >&2
    echo "Error: $error_msg" >&2

    # Kill background processes
    if [[ ${#PIPELINE_BACKGROUND_PIDS[@]} -gt 0 ]]; then
        for pid in "${PIPELINE_BACKGROUND_PIDS[@]}"; do
            kill -9 "$pid" 2>/dev/null || true
        done
    fi

    # Rollback transactions
    if type txn_rollback_pipeline &>/dev/null; then
        txn_rollback_pipeline "$PIPELINE_ID" 2>/dev/null || true
    fi

    # Move all artifacts to failed
    if [[ ${#PIPELINE_ARTIFACTS[@]} -gt 0 ]]; then
        echo "Moving ${#PIPELINE_ARTIFACTS[@]} artifacts to failed..." >&2
        move_artifacts_to_failed "$PIPELINE_ID" "stage_$stage" "$error_msg" "$exit_code"
    fi

    # Log the failure
    log_pipeline_event "$PIPELINE_ID" "failed" "stage_$stage" "$error_msg"

    echo "Pipeline failed. Artifacts moved to: /tmp/tetra/failed/$PIPELINE_ID" >&2

    return "$exit_code"
}

# Move artifacts to cancelled directory
move_artifacts_to_cancelled() {
    local pipeline_id="$1"
    local reason="${2:-unknown}"

    local cancelled_dir="/tmp/tetra/cancelled/${pipeline_id}"
    mkdir -p "$cancelled_dir"

    # Move each artifact
    local moved_count=0
    for artifact in "${PIPELINE_ARTIFACTS[@]}"; do
        if [[ -f "$artifact" ]]; then
            # Use trs_move to handle module naming
            local new_path=$(trs_move "$artifact" "$cancelled_dir" 2>/dev/null)
            if [[ $? -eq 0 ]]; then
                ((moved_count++))
            fi
        fi
    done

    # Create CANCELLED.json manifest
    create_cancelled_manifest "$cancelled_dir" "$reason" "$moved_count"

    echo "Moved $moved_count artifacts to: $cancelled_dir" >&2
}

# Move artifacts to failed directory
move_artifacts_to_failed() {
    local pipeline_id="$1"
    local stage="$2"
    local error_msg="$3"
    local exit_code="$4"

    local failed_dir="/tmp/tetra/failed/${pipeline_id}"
    mkdir -p "$failed_dir"

    # Move each artifact
    local moved_count=0
    for artifact in "${PIPELINE_ARTIFACTS[@]}"; do
        if [[ -f "$artifact" ]]; then
            local new_path=$(trs_move "$artifact" "$failed_dir" 2>/dev/null)
            if [[ $? -eq 0 ]]; then
                ((moved_count++))
            fi
        fi
    done

    # Create FAILED.json manifest
    create_failed_manifest "$failed_dir" "$stage" "$error_msg" "$exit_code" "$moved_count"

    echo "Moved $moved_count artifacts to: $failed_dir" >&2
}

# Create CANCELLED.json manifest
create_cancelled_manifest() {
    local dest_dir="$1"
    local reason="$2"
    local artifact_count="$3"

    local end_time=$(date +%s)
    local duration=$((end_time - PIPELINE_START_TIME))

    cat > "$dest_dir/CANCELLED.json" <<EOF
{
    "pipeline_id": "$PIPELINE_ID",
    "status": "cancelled",
    "reason": "$reason",
    "cancelled_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "cancelled_at_timestamp": $end_time,
    "started_at": "$(date -u -r "$PIPELINE_START_TIME" +%Y-%m-%dT%H:%M:%SZ)",
    "started_at_timestamp": $PIPELINE_START_TIME,
    "duration_seconds": $duration,
    "stage": $PIPELINE_STAGE,
    "total_stages": $PIPELINE_TOTAL_STAGES,
    "artifacts_moved": $artifact_count,
    "user": "$USER",
    "can_review": true
}
EOF

    echo "Created cancellation manifest: $dest_dir/CANCELLED.json" >&2
}

# Create FAILED.json manifest
create_failed_manifest() {
    local dest_dir="$1"
    local stage="$2"
    local error_msg="$3"
    local exit_code="$4"
    local artifact_count="$5"

    local end_time=$(date +%s)
    local duration=$((end_time - PIPELINE_START_TIME))

    # Escape error message for JSON
    local escaped_error=$(echo "$error_msg" | sed 's/"/\\"/g' | tr '\n' ' ')

    cat > "$dest_dir/FAILED.json" <<EOF
{
    "pipeline_id": "$PIPELINE_ID",
    "status": "failed",
    "failed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "failed_at_timestamp": $end_time,
    "started_at": "$(date -u -r "$PIPELINE_START_TIME" +%Y-%m-%dT%H:%M:%SZ)",
    "started_at_timestamp": $PIPELINE_START_TIME,
    "duration_seconds": $duration,
    "stage": "$stage",
    "total_stages": $PIPELINE_TOTAL_STAGES,
    "error_message": "$escaped_error",
    "exit_code": $exit_code,
    "artifacts_moved": $artifact_count,
    "user": "$USER",
    "can_retry": true
}
EOF

    echo "Created failure manifest: $dest_dir/FAILED.json" >&2
}

# Log pipeline event (for audit trail)
log_pipeline_event() {
    local pipeline_id="$1"
    local event_type="$2"
    local stage="$3"
    local message="$4"

    local timestamp=$(date +%s)

    # If audit module available, use it
    if type audit_log &>/dev/null; then
        audit_log "pipeline" "$event_type" "$pipeline_id" "$stage" "$message"
    else
        # Fallback: write to temp log
        local log_file="/tmp/tetra/pipeline.log"
        echo "[$timestamp] $pipeline_id $event_type $stage: $message" >> "$log_file"
    fi
}

# Clean up pipeline tracking (on success)
# Usage: pipeline_cleanup
pipeline_cleanup() {
    # Remove trap
    trap - SIGINT SIGTERM

    # Clear manifest (pipeline succeeded, artifacts stay in place)
    if [[ -n "$PIPELINE_ID" ]]; then
        local manifest_dir="/tmp/tetra/pipelines/${PIPELINE_ID}"
        if [[ -d "$manifest_dir" ]]; then
            rm -rf "$manifest_dir"
        fi
    fi

    # Reset state
    PIPELINE_ID=""
    PIPELINE_ARTIFACTS=()
    PIPELINE_STAGE=0
    PIPELINE_TOTAL_STAGES=0
    PIPELINE_START_TIME=""
    PIPELINE_BACKGROUND_PIDS=()
}

# Check if running in pipeline
# Usage: is_in_pipeline
# Returns: 0 if in pipeline, 1 if not
is_in_pipeline() {
    [[ -n "$PIPELINE_ID" ]]
}

# Get current pipeline ID
# Usage: get_pipeline_id
# Returns: Pipeline ID or empty string
get_pipeline_id() {
    echo "$PIPELINE_ID"
}

# Export functions
export -f pipeline_init
export -f pipeline_track_artifact
export -f pipeline_track_pid
export -f pipeline_set_stage
export -f pipeline_interrupt_handler
export -f pipeline_failure_handler
export -f move_artifacts_to_cancelled
export -f move_artifacts_to_failed
export -f create_cancelled_manifest
export -f create_failed_manifest
export -f log_pipeline_event
export -f pipeline_cleanup
export -f is_in_pipeline
export -f get_pipeline_id
