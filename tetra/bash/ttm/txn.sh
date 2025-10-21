#!/usr/bin/env bash
# txn.sh - Core transaction lifecycle management
# Implements TTS (Tetra Transaction Standard)

: "${TTM_DIR:=$TETRA_DIR/ttm}"
: "${TTM_TXNS_DIR:=$TTM_DIR/txns}"

# Transaction stage constants (only declare if not already set)
if [[ -z "${STAGE_NEW:-}" ]]; then
    declare -r STAGE_NEW="NEW"
    declare -r STAGE_SELECT="SELECT"
    declare -r STAGE_ASSEMBLE="ASSEMBLE"
    declare -r STAGE_EXECUTE="EXECUTE"
    declare -r STAGE_VALIDATE="VALIDATE"
    declare -r STAGE_DONE="DONE"
    declare -r STAGE_FAIL="FAIL"
fi

# Generate transaction ID
# Format: {slug}-{timestamp}
generate_txn_id() {
    local description="$1"
    local slug=$(echo "$description" | tr '[:upper:]' '[:lower:]' | \
                 sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | \
                 cut -c1-30 | sed 's/-$//')
    local timestamp=$(date '+%Y%m%dT%H%M%S')
    echo "${slug}-${timestamp}"
}

# Get transaction directory
# Args: [txn_id] - if empty, uses active transaction
txn_dir() {
    local txn_id="${1:-}"

    if [[ -z "$txn_id" ]]; then
        txn_id=$(txn_active)
    fi

    if [[ -z "$txn_id" ]]; then
        echo "Error: No transaction ID provided and no active transaction" >&2
        return 1
    fi

    echo "$TTM_TXNS_DIR/$txn_id"
}

# Get active transaction ID
txn_active() {
    if [[ -L "$TTM_TXNS_DIR/active" ]]; then
        basename "$(readlink -f "$TTM_TXNS_DIR/active" 2>/dev/null || readlink "$TTM_TXNS_DIR/active")"
    fi
}

# Create new transaction
# Args: description [target] [agent]
txn_create() {
    local description="${1:?Description required}"
    local target="${2:-@local}"
    local agent="${3:-human}"

    local txn_id="$(generate_txn_id "$description")"
    local txn_path="$TTM_TXNS_DIR/$txn_id"

    # Create directory structure
    mkdir -p "$txn_path"/{ctx,build,artifacts}

    # Create default policy file
    cat > "$txn_path/ctx/000_policy.md" <<'EOF'
# Constraints

- Preserve existing behavior
- Do not modify without clear justification
- Maintain validation and testing

# Output Contract

Emit results in standard format:
- `plan.json` - Ordered list of operations
- `output.log` - Execution log
- `notes.md` - Explanation of results
EOF

    # Create default request file
    cat > "$txn_path/ctx/010_request.md" <<EOF
# Request

$description

## Target

$target

## Acceptance Criteria

- Operation completes without errors
- Results are validated
EOF

    # Create state.json
    cat > "$txn_path/state.json" <<EOF
{
  "txn_id": "$txn_id",
  "description": "$description",
  "stage": "$STAGE_NEW",
  "target": "$target",
  "iteration": 1,
  "agent": "$agent",
  "ctx_digest": null,
  "last_checkpoint": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "last_error": null
}
EOF

    # Initialize events.ndjson
    echo "{\"ts\":\"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\",\"event\":\"txn_start\",\"txn_id\":\"$txn_id\",\"description\":\"$description\"}" \
        > "$txn_path/events.ndjson"

    # Set as active transaction
    ln -sf "$txn_path" "$TTM_TXNS_DIR/active"

    # Publish event
    ttm_publish "txn.created" "$txn_id" "$STAGE_NEW"

    echo "$txn_id"
}

# Get transaction state
# Args: [txn_id]
txn_state() {
    local txn_id="${1:-}"
    local dir="$(txn_dir "$txn_id")" || return 1

    if [[ ! -f "$dir/state.json" ]]; then
        echo "Error: state.json not found" >&2
        return 1
    fi

    cat "$dir/state.json"
}

# Update transaction state
# Args: txn_id updates_json
txn_update() {
    local txn_id="${1:?Transaction ID required}"
    local updates="${2:?Updates JSON required}"

    local dir="$(txn_dir "$txn_id")" || return 1
    local state_file="$dir/state.json"
    local temp_file=$(mktemp)

    # Update state using jq
    if command -v jq >/dev/null 2>&1; then
        jq --argjson updates "$updates" \
           --arg ts "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
           '. + $updates + {last_checkpoint: $ts}' \
           "$state_file" > "$temp_file"
        mv "$temp_file" "$state_file"
    else
        echo "Error: jq required for state updates" >&2
        rm -f "$temp_file"
        return 1
    fi
}

# Transition to new stage
# Args: new_stage [txn_id]
txn_transition() {
    local new_stage="${1:?Stage required}"
    local txn_id="${2:-}"

    local dir="$(txn_dir "$txn_id")" || return 1

    # Get current stage
    local current_stage=$(jq -r '.stage' "$dir/state.json")

    # Log transition event
    echo "{\"ts\":\"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\",\"event\":\"stage_transition\",\"from\":\"$current_stage\",\"to\":\"$new_stage\"}" \
        >> "$dir/events.ndjson"

    # Update state
    txn_update "$(basename "$dir")" "{\"stage\":\"$new_stage\"}"

    # Publish event
    ttm_publish "txn.stage_changed" "$(basename "$dir")" "$new_stage"

    echo "Transaction transitioned: $current_stage → $new_stage"
}

# Commit transaction (transition to DONE)
# Args: [txn_id]
txn_commit() {
    local txn_id="${1:-}"
    local dir="$(txn_dir "$txn_id")" || return 1

    txn_id=$(basename "$dir")

    # Calculate duration
    local start_ts=$(head -1 "$dir/events.ndjson" | jq -r '.ts')
    local start_sec=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$start_ts" "+%s" 2>/dev/null || echo 0)
    local end_sec=$(date "+%s")
    local duration_ms=$(( (end_sec - start_sec) * 1000 ))

    # Log commit event
    echo "{\"ts\":\"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\",\"event\":\"txn_commit\",\"duration_ms\":$duration_ms}" \
        >> "$dir/events.ndjson"

    # Transition to DONE
    txn_transition "$STAGE_DONE" "$txn_id"

    echo "Transaction committed: $txn_id"
}

# Fail transaction (transition to FAIL)
# Args: [txn_id] [error_msg]
txn_fail() {
    local txn_id="${1:-}"
    local error_msg="${2:-Unknown error}"

    local dir="$(txn_dir "$txn_id")" || return 1
    txn_id=$(basename "$dir")

    # Log fail event
    echo "{\"ts\":\"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\",\"event\":\"txn_fail\",\"error\":\"$error_msg\"}" \
        >> "$dir/events.ndjson"

    # Update state with error
    txn_update "$txn_id" "{\"last_error\":\"$error_msg\"}"

    # Transition to FAIL
    txn_transition "$STAGE_FAIL" "$txn_id"

    echo "Transaction failed: $txn_id - $error_msg" >&2
}

# Export functions
export -f generate_txn_id
export -f txn_dir
export -f txn_active
export -f txn_create
export -f txn_state
export -f txn_update
export -f txn_transition
export -f txn_commit
export -f txn_fail
