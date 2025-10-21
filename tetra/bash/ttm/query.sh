#!/usr/bin/env bash
# query.sh - Transaction query and status functions

: "${TTM_DIR:=$TETRA_DIR/ttm}"
: "${TTM_TXNS_DIR:=$TTM_DIR/txns}"

# List all transactions
# Args: [stage_filter]
txn_list() {
    local stage_filter="${1:-}"
    local txns_dir="$TTM_TXNS_DIR"

    if [[ ! -d "$txns_dir" ]]; then
        echo "No transactions found"
        return 0
    fi

    echo "Transactions:"
    echo "────────────────────────────────────────────────────────"

    local active_txn
    if [[ -L "$txns_dir/active" ]]; then
        active_txn=$(basename "$(readlink -f "$txns_dir/active" 2>/dev/null || readlink "$txns_dir/active")")
    fi

    for txn_dir in "$txns_dir"/*; do
        [[ -d "$txn_dir" ]] || continue
        [[ "$(basename "$txn_dir")" == "active" ]] && continue

        local txn_id=$(basename "$txn_dir")
        local state_file="$txn_dir/state.json"

        if [[ -f "$state_file" ]]; then
            if command -v jq >/dev/null 2>&1; then
                local stage=$(jq -r '.stage' "$state_file")
                local description=$(jq -r '.description' "$state_file")

                # Apply stage filter if provided
                if [[ -n "$stage_filter" ]] && [[ "$stage" != "$stage_filter" ]]; then
                    continue
                fi

                local marker=" "
                [[ "$txn_id" == "$active_txn" ]] && marker="→"
                printf "%s %-40s  %-10s  %s\n" "$marker" "$txn_id" "$stage" "${description:0:40}"
            else
                local marker=" "
                [[ "$txn_id" == "$active_txn" ]] && marker="→"
                echo "$marker $txn_id"
            fi
        fi
    done
}

# Show transaction status
# Args: [txn_id]
txn_status() {
    local txn_id="${1:-}"
    local dir="$(txn_dir "$txn_id")" || return 1

    txn_id=$(basename "$dir")

    local state_file="$dir/state.json"
    if [[ ! -f "$state_file" ]]; then
        echo "Error: state.json not found" >&2
        return 1
    fi

    # Parse state
    if command -v jq >/dev/null 2>&1; then
        local description=$(jq -r '.description' "$state_file")
        local stage=$(jq -r '.stage' "$state_file")
        local target=$(jq -r '.target // "none"' "$state_file")
        local iteration=$(jq -r '.iteration' "$state_file")
        local agent=$(jq -r '.agent' "$state_file")
        local ctx_digest=$(jq -r '.ctx_digest // "none"' "$state_file")
        local last_checkpoint=$(jq -r '.last_checkpoint' "$state_file")
        local last_error=$(jq -r '.last_error // "none"' "$state_file")

        echo "Transaction: $txn_id"
        echo "Description: $description"
        echo "Stage: $stage"
        echo "Target: $target"
        echo "Iteration: $iteration"
        echo "Agent: $agent"
        echo "Context digest: ${ctx_digest:0:16}..."
        echo "Last updated: $last_checkpoint"
        if [[ "$last_error" != "none" ]]; then
            echo "Last error: $last_error"
        fi
        echo ""

        # Show recent events
        if [[ -f "$dir/events.ndjson" ]]; then
            echo "Recent events:"
            tail -5 "$dir/events.ndjson" | while IFS= read -r line; do
                local ts=$(echo "$line" | jq -r '.ts')
                local event=$(echo "$line" | jq -r '.event')
                echo "  [$ts] $event"
            done
            echo ""
        fi

        # Show context files
        echo "Context files:"
        if [[ -d "$dir/ctx" ]]; then
            ls -1 "$dir/ctx" | while read -r file; do
                echo "  $file"
            done
        else
            echo "  (none)"
        fi
    else
        echo "Transaction status:"
        cat "$state_file"
    fi
}

# Get transaction events
# Args: [txn_id] [event_filter]
txn_events() {
    local txn_id="${1:-}"
    local event_filter="${2:-}"

    local dir="$(txn_dir "$txn_id")" || return 1

    if [[ ! -f "$dir/events.ndjson" ]]; then
        echo "No events found"
        return 0
    fi

    if [[ -n "$event_filter" ]]; then
        grep "\"event\":\"$event_filter\"" "$dir/events.ndjson"
    else
        cat "$dir/events.ndjson"
    fi
}

# Export functions
export -f txn_list
export -f txn_status
export -f txn_events
