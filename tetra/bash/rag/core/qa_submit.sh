#!/usr/bin/env bash
# qa_submit.sh - Submit assembled RAG context to QA module
# Simple integration: rag submit @qa

: "${RAG_SRC:=$TETRA_SRC/bash/rag}"
: "${QA_DIR:=$TETRA_DIR/qa}"

# Source dependencies
if [[ -f "$RAG_SRC/core/flow_manager_ttm.sh" ]]; then
    source "$RAG_SRC/core/flow_manager_ttm.sh"
elif [[ -f "$RAG_SRC/core/flow_manager.sh" ]]; then
    source "$RAG_SRC/core/flow_manager.sh"
fi

# Submit assembled context to QA (uses QA's current engine/model defaults)
submit_to_qa() {
    local flow_dir="${1:-}"

    if [[ -z "$flow_dir" ]]; then
        flow_dir="$(get_active_flow_dir)"
    fi

    if [[ -z "$flow_dir" ]] || [[ ! -d "$flow_dir" ]]; then
        echo "Error: No active flow" >&2
        return 1
    fi

    local build_dir="$flow_dir/build"
    local prompt_file="$build_dir/prompt.mdctx"
    local answer_file="$build_dir/answer.md"

    # Check if context is assembled
    if [[ ! -f "$prompt_file" ]]; then
        echo "Error: Context not assembled. Run: rag assemble" >&2
        return 1
    fi

    # Check QA availability (after flow and context checks)
    if ! command -v qa_query >/dev/null 2>&1; then
        echo "Error: QA module not loaded. Run: tmod load qa" >&2
        return 1
    fi

    # Get flow info
    local flow_id=$(basename "$flow_dir")

    # Transition to EXECUTE stage
    if command -v jq >/dev/null 2>&1 && [[ -f "$flow_dir/state.json" ]]; then
        local state_file="$flow_dir/state.json"
        local temp_file=$(mktemp)
        jq --arg ts "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
           '.stage = "EXECUTE" | .last_checkpoint = $ts' \
           "$state_file" > "$temp_file"
        mv "$temp_file" "$state_file"
    fi

    echo "Submitting to QA..."
    echo "Flow: $flow_id"
    echo "Stage: EXECUTE"
    echo ""

    # Submit to QA and capture both answer and QA_ID
    local qa_answer
    local qa_id=""
    local stderr_file=$(mktemp)

    # Set metadata for QA to create bidirectional link
    export QA_FLOW_ID="$flow_id"
    export QA_SOURCE="rag"

    # Capture stderr to extract QA_ID
    if qa_answer=$(cat "$prompt_file" | qa_query 2>"$stderr_file"); then
        # Clear metadata environment variables
        unset QA_FLOW_ID QA_SOURCE
        # Extract QA_ID from stderr
        qa_id=$(grep "^QA_ID=" "$stderr_file" | cut -d'=' -f2)
        rm -f "$stderr_file"

        # Save answer
        echo "$qa_answer" > "$answer_file"
        echo "✓ Answer saved: $answer_file"
        [[ -n "$qa_id" ]] && echo "✓ QA ID: $qa_id"

        # Log success with actual QA ID
        if [[ -f "$flow_dir/events.ndjson" ]]; then
            echo "{\"ts\":\"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\",\"event\":\"qa_submit\",\"target\":\"@qa\",\"qa_id\":\"$qa_id\"}" \
                >> "$flow_dir/events.ndjson"
        fi

        # Transition to DONE stage and store QA ID
        if command -v jq >/dev/null 2>&1 && [[ -f "$flow_dir/state.json" ]]; then
            local state_file="$flow_dir/state.json"
            local temp_file=$(mktemp)
            jq --arg ts "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
               --arg qa_id "$qa_id" \
               '.stage = "DONE" | .last_checkpoint = $ts | .qa_id = $qa_id' \
               "$state_file" > "$temp_file"
            mv "$temp_file" "$state_file"
        fi

        echo ""
        echo "Stage: DONE"
        echo ""
        echo "View answer: /r (or cat $answer_file)"
        echo "QA history: a 0"
        return 0
    else
        # Clear metadata environment variables
        unset QA_FLOW_ID QA_SOURCE
        rm -f "$stderr_file"
        echo "Error: QA submission failed" >&2

        # Transition to FAIL stage
        if command -v jq >/dev/null 2>&1 && [[ -f "$flow_dir/state.json" ]]; then
            local state_file="$flow_dir/state.json"
            local temp_file=$(mktemp)
            jq --arg ts "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
               '.stage = "FAIL" | .last_checkpoint = $ts' \
               "$state_file" > "$temp_file"
            mv "$temp_file" "$state_file"
        fi

        if [[ -f "$flow_dir/events.ndjson" ]]; then
            echo "{\"ts\":\"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\",\"event\":\"qa_submit_failed\",\"target\":\"@qa\"}" \
                >> "$flow_dir/events.ndjson"
        fi
        return 1
    fi
}

# Async version - runs in background and notifies when done
submit_to_qa_async() {
    local flow_dir="${1:-}"

    if [[ -z "$flow_dir" ]]; then
        flow_dir="$(get_active_flow_dir)"
    fi

    if [[ -z "$flow_dir" ]] || [[ ! -d "$flow_dir" ]]; then
        echo "Error: No active flow" >&2
        return 1
    fi

    local flow_id=$(basename "$flow_dir")
    local log_file="$flow_dir/build/submit.log"

    echo "Submitting to QA in background..."
    echo "Flow: $flow_id → EXECUTE"
    echo ""
    echo "Continue working - prompt will update when done"
    echo "(View progress: tail -f $log_file)"

    # Run in background
    (
        submit_to_qa "$flow_dir" > "$log_file" 2>&1
        local exit_code=$?

        # Notify completion via terminal bell and temp marker
        local stage="DONE"
        if [[ $exit_code -ne 0 ]]; then
            stage="FAIL"
        fi

        # Create completion marker
        echo "COMPLETE:$stage:$(date)" > "$flow_dir/build/.submit_complete"

        # Send notification (bell)
        echo -e "\a" >&2

    ) &

    local bg_pid=$!
    echo "Background PID: $bg_pid"
    echo ""

    # Save PID for tracking
    echo "$bg_pid" > "$flow_dir/build/.submit_pid"
}

export -f submit_to_qa
export -f submit_to_qa_async
