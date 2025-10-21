#!/usr/bin/env bash
# flow_manager_ttm.sh - RAG Flow management using pure TTM
# Thin wrapper around TTM that maintains RAG's flow API
# Uses project-local .rag/flows/ directory (like Claude Code)

: "${TETRA_SRC:=~/tetra}"
: "${RAG_SRC:=$TETRA_SRC/bash/rag}"
: "${TETRA_DIR:=$HOME/.tetra}"

# Source TTM
source "$TETRA_SRC/bash/ttm/ttm.sh"

# Get RAG directory (project-local by default, global if --global flag)
get_rag_dir() {
    local scope="${1:-local}"

    if [[ "$scope" == "global" ]]; then
        echo "$TETRA_DIR/rag"
    else
        # Project-local (like Claude Code's .claude/)
        echo "$PWD/.rag"
    fi
}

# Get flows directory based on scope
get_flows_dir() {
    local scope="${1:-local}"
    echo "$(get_rag_dir "$scope")/flows"
}

# Override TTM_DIR to use project-local .rag directory by default
# This can be overridden by setting RAG_SCOPE=global
: "${RAG_SCOPE:=local}"
export TTM_DIR="$(get_rag_dir "$RAG_SCOPE")"
export TTM_TXNS_DIR="$TTM_DIR/flows"

# Ensure TTM is initialized for RAG (creates .rag/flows/ or $TETRA_DIR/rag/flows/)
mkdir -p "$TTM_TXNS_DIR" "$TTM_DIR/config" "$TTM_DIR/logs"

# Flow stage constants (RAG naming)
# Map RAG stages to TTM stages:
# RAG: NEW → SELECT → ASSEMBLE → SUBMIT → APPLY → VALIDATE → FOLD → DONE/FAIL
# TTM: NEW → SELECT → ASSEMBLE → EXECUTE → VALIDATE → DONE/FAIL
#
# Mapping: SUBMIT+APPLY+FOLD → EXECUTE
if [[ -z "${STAGE_NEW:-}" ]]; then
    declare -r STAGE_NEW="NEW"
    declare -r STAGE_SELECT="SELECT"
    declare -r STAGE_ASSEMBLE="ASSEMBLE"
    declare -r STAGE_SUBMIT="SUBMIT"       # Maps to EXECUTE
    declare -r STAGE_APPLY="APPLY"         # Maps to EXECUTE
    declare -r STAGE_VALIDATE="VALIDATE"
    declare -r STAGE_FOLD="FOLD"           # Maps to EXECUTE (retry)
    declare -r STAGE_DONE="DONE"
    declare -r STAGE_FAIL="FAIL"
fi

# Map RAG stage to TTM stage
_map_rag_to_ttm_stage() {
    local rag_stage="$1"
    case "$rag_stage" in
        SUBMIT|APPLY|FOLD) echo "EXECUTE" ;;
        *) echo "$rag_stage" ;;
    esac
}

# Get active flow ID (wraps txn_active)
flow_active() {
    txn_active
}

# Get active flow directory
get_active_flow_dir() {
    local txn_id=$(txn_active)
    [[ -n "$txn_id" ]] && txn_dir "$txn_id"
}

# Generate flow ID (wraps generate_txn_id)
generate_flow_id() {
    generate_txn_id "$@"
}

# Create flow - pure TTM delegation with RAG-specific policy
flow_create() {
    local description="${1:?Description required}"
    local agent="${2:-base}"
    local project_dir="${3:-.}"

    # Create transaction via TTM
    local flow_id=$(txn_create "$description" "@local" "$agent")

    if [[ -z "$flow_id" ]]; then
        echo "Error: Failed to create flow" >&2
        return 1
    fi

    local flow_dir=$(txn_dir "$flow_id")

    # Override default policy with RAG-specific policy
    cat > "$flow_dir/ctx/000_policy.md" <<'EOF'
# Constraints

- Preserve existing behavior
- Do not modify code without clear justification
- Maintain test coverage

# Output Contract

Emit MULTICAT format with:
- `plan.json` - Ordered list of changes
- `patch.diff` - Unified diff format
- `notes.md` - Explanation of changes
EOF

    # Create user prompt file - description becomes the actual prompt
    cat > "$flow_dir/ctx/010_prompt.user.md" <<EOF
<!-- rs:intent=edit; rs:scope=code; rs:id=$flow_id -->

$description
EOF

    # Create evidence subdirectory for RAG pattern
    mkdir -p "$flow_dir/ctx/evidence"

    echo "Flow created: $flow_id"
    echo "Prompt: $description"
    echo "Directory: $flow_dir"
    echo ""
    echo "Next steps:"
    echo "  1. Add evidence: /e add <file>"
    echo "  2. (Optional) Refine prompt: /p or /p \"better question\""
    echo "  3. Assemble: /assemble"
    echo "  4. Submit: /submit @qa"

    # Initialize evidence variables for the new flow
    flow_init_evidence_vars "$flow_id"

    echo "$flow_id"
}

# Get flow state (wraps txn_state)
flow_get_state() {
    local flow_id="${1:-}"

    if [[ -z "$flow_id" ]]; then
        flow_id=$(flow_active)
    fi

    if [[ -z "$flow_id" ]]; then
        echo "Error: No active flow" >&2
        return 1
    fi

    txn_state "$flow_id"
}

# Update flow state (wraps txn_update)
flow_update_state() {
    local flow_id="${1:?Flow ID required}"
    local updates="${2:?Updates JSON required}"

    txn_update "$flow_id" "$updates"
}

# Transition to new stage (wraps txn_transition with RAG stage mapping)
flow_transition() {
    local new_stage="${1:?Stage required}"
    local flow_id="${2:-}"

    if [[ -z "$flow_id" ]]; then
        flow_id=$(flow_active)
    fi

    if [[ -z "$flow_id" ]]; then
        echo "Error: No active flow" >&2
        return 1
    fi

    # Map RAG stage to TTM stage for internal storage
    local ttm_stage=$(_map_rag_to_ttm_stage "$new_stage")

    # Log RAG stage in events for backward compat
    local flow_dir=$(txn_dir "$flow_id")
    echo "{\"ts\":\"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\",\"event\":\"rag_stage\",\"rag_stage\":\"$new_stage\",\"ttm_stage\":\"$ttm_stage\"}" \
        >> "$flow_dir/events.ndjson"

    # Transition via TTM
    txn_transition "$ttm_stage" "$flow_id"
}

# Show flow status (wraps txn_state with pretty printing)
flow_status() {
    local flow_id="${1:-}"

    if [[ -z "$flow_id" ]]; then
        flow_id=$(flow_active)
    fi

    if [[ -z "$flow_id" ]]; then
        echo "No active flow"
        return 0
    fi

    local state=$(txn_state "$flow_id")

    if command -v jq >/dev/null 2>&1; then
        local description=$(echo "$state" | jq -r '.description')
        local stage=$(echo "$state" | jq -r '.stage')
        local iteration=$(echo "$state" | jq -r '.iteration')
        local agent=$(echo "$state" | jq -r '.agent')
        local target=$(echo "$state" | jq -r '.target')
        local ctx_digest=$(echo "$state" | jq -r '.ctx_digest // "none"')
        local last_checkpoint=$(echo "$state" | jq -r '.last_checkpoint')

        echo "Flow: $flow_id (active)"
        echo "Description: $description"
        echo "Stage: $stage"
        echo "Iteration: $iteration"
        echo "Agent: $agent"
        echo "Target: $target"
        echo "Context digest: ${ctx_digest:0:16}..."
        echo "Last updated: $last_checkpoint"
        echo ""
        echo "Directories:"
        echo "  RAG_DIR=$TTM_DIR"
        echo "  TXNS_DIR=$TTM_TXNS_DIR"
        echo "  flow=$flow_id"
    else
        echo "Flow status:"
        echo "$state"
    fi
}

# List all flows (wraps TTM query functions)
flow_list() {
    local filter_stage="${1:-}"

    if [[ ! -d "$TTM_TXNS_DIR" ]]; then
        echo "No flows found"
        return 0
    fi

    echo "Flows:"
    echo "────────────────────────────────────────────────────────"

    local active_flow=$(txn_active)
    local index=0

    # Build array of flows for indexed access
    local flow_dirs=()
    for flow_dir in "$TTM_TXNS_DIR"/*; do
        [[ -d "$flow_dir" ]] || continue
        local flow_id=$(basename "$flow_dir")
        [[ "$flow_id" == "active" ]] && continue
        flow_dirs+=("$flow_dir")
    done

    # Display flows with index
    for flow_dir in "${flow_dirs[@]}"; do
        local flow_id=$(basename "$flow_dir")
        local state_file="$flow_dir/state.json"
        ((index++))

        if [[ -f "$state_file" ]]; then
            if command -v jq >/dev/null 2>&1; then
                local stage=$(jq -r '.stage' "$state_file")

                # Apply filter if specified
                if [[ -n "$filter_stage" ]] && [[ "$stage" != "$filter_stage" ]]; then
                    ((index--))
                    continue
                fi

                local description=$(jq -r '.description' "$state_file")
                local marker=" "
                [[ "$flow_id" == "$active_flow" ]] && marker="→"
                printf "%s%2d. %-38s  %-10s  %s\n" "$marker" "$index" "$flow_id" "$stage" "${description:0:40}"
            else
                local marker=" "
                [[ "$flow_id" == "$active_flow" ]] && marker="→"
                printf "%s%2d. %s\n" "$marker" "$index" "$flow_id"
            fi
        fi
    done

    echo ""
    echo "Tip: Use '/flow resume <number>' to resume by index"
}

# Resume flow from checkpoint (accepts index number or flow ID)
flow_resume() {
    local input="${1:?Flow ID or index required}"
    local flow_id=""

    # Check if input is a number (index)
    if [[ "$input" =~ ^[0-9]+$ ]]; then
        # Convert index to flow_id
        local index=0
        for flow_dir in "$TTM_TXNS_DIR"/*; do
            [[ -d "$flow_dir" ]] || continue
            local fid=$(basename "$flow_dir")
            [[ "$fid" == "active" ]] && continue
            ((index++))
            if [[ $index -eq $input ]]; then
                flow_id="$fid"
                break
            fi
        done

        if [[ -z "$flow_id" ]]; then
            echo "Error: No flow at index $input" >&2
            echo "Use '/flow list' to see available flows" >&2
            return 1
        fi
    else
        # Use input as flow_id directly
        flow_id="$input"
    fi

    if [[ ! -d "$TTM_TXNS_DIR/$flow_id" ]]; then
        echo "Error: Flow not found: $flow_id" >&2
        return 1
    fi

    # Set as active
    ln -sf "$TTM_TXNS_DIR/$flow_id" "$TTM_TXNS_DIR/active"

    local state=$(txn_state "$flow_id")

    if command -v jq >/dev/null 2>&1; then
        local stage=$(echo "$state" | jq -r '.stage')

        echo "Resuming flow: $flow_id"
        echo "Current stage: $stage"
        echo ""

        case "$stage" in
            "NEW")
                echo "Next: rag select \"<query>\" to gather evidence"
                ;;
            "SELECT")
                echo "Next: rag assemble to build context"
                ;;
            "ASSEMBLE")
                echo "Next: rag submit to send to agent"
                ;;
            "EXECUTE")
                echo "Next: Check execution status"
                echo "      rag validate to run tests"
                ;;
            "VALIDATE")
                echo "Check validation results in artifacts/validate.json"
                echo "If failed: rag fold to iterate"
                echo "If passed: flow complete!"
                ;;
            "DONE")
                echo "Flow complete!"
                ;;
            "FAIL")
                local error=$(echo "$state" | jq -r '.last_error // "Unknown"')
                echo "Flow failed: $error"
                ;;
        esac
    else
        echo "Resumed flow: $flow_id"
    fi

    # Initialize evidence variables for the resumed flow
    flow_init_evidence_vars "$flow_id"
}

# Checkpoint current state
flow_checkpoint() {
    local stage="${1:?Stage required}"
    local metadata="${2:-{}}"
    local flow_id="${3:-}"

    if [[ -z "$flow_id" ]]; then
        flow_id=$(flow_active)
    fi

    if [[ -z "$flow_id" ]]; then
        return 0
    fi

    local flow_dir=$(txn_dir "$flow_id")

    # Log checkpoint event
    echo "{\"ts\":\"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\",\"event\":\"checkpoint\",\"stage\":\"$stage\",\"metadata\":$metadata}" \
        >> "$flow_dir/events.ndjson"

    flow_transition "$stage" "$flow_id"
}

# Add evidence to flow (wraps txn_add_ctx)
flow_add_evidence() {
    local source_file="${1:?Source file required}"
    local description="${2:?Description required}"
    local flow_id="${3:-}"

    if [[ -z "$flow_id" ]]; then
        flow_id=$(flow_active)
    fi

    if [[ -z "$flow_id" ]]; then
        echo "Error: No active flow" >&2
        return 1
    fi

    txn_add_ctx "$source_file" "$description" "$flow_id"
}

# List flow evidence (wraps txn_list_ctx)
flow_list_evidence() {
    local flow_id="${1:-}"

    if [[ -z "$flow_id" ]]; then
        flow_id=$(flow_active)
    fi

    if [[ -z "$flow_id" ]]; then
        echo "Error: No active flow" >&2
        return 1
    fi

    txn_list_ctx "$flow_id"
}

# Initialize evidence variables (wraps init_evidence_vars)
flow_init_evidence_vars() {
    local flow_id="${1:-}"

    if [[ -z "$flow_id" ]]; then
        flow_id=$(flow_active)
    fi

    if [[ -z "$flow_id" ]]; then
        echo "Error: No active flow" >&2
        return 1
    fi

    # Convert flow_id to flow_dir
    local flow_dir=$(txn_dir "$flow_id")

    if [[ -z "$flow_dir" ]]; then
        echo "Error: Could not get flow directory for $flow_id" >&2
        return 1
    fi

    init_evidence_vars "$flow_dir"
}

# Promote a flow from local to global
flow_promote() {
    local flow_id="${1:-}"

    if [[ -z "$flow_id" ]]; then
        flow_id=$(flow_active)
    fi

    if [[ -z "$flow_id" ]]; then
        echo "Error: No flow ID provided and no active flow" >&2
        return 1
    fi

    local local_flows="$(get_flows_dir local)"
    local global_flows="$(get_flows_dir global)"
    local local_flow="$local_flows/$flow_id"
    local global_flow="$global_flows/$flow_id"

    # Check if flow exists locally
    if [[ ! -d "$local_flow" ]]; then
        echo "Error: Flow not found in local: $flow_id" >&2
        return 1
    fi

    # Check if already exists globally
    if [[ -d "$global_flow" ]]; then
        echo "Error: Flow already exists in global: $flow_id" >&2
        return 1
    fi

    # Create global flows directory if needed
    mkdir -p "$global_flows"

    # Copy flow to global
    cp -R "$local_flow" "$global_flow"
    echo "✓ Promoted flow to global: $flow_id"
    echo "  From: $local_flow"
    echo "  To:   $global_flow"
    echo ""
    echo "Local copy remains at: $local_flow"
    echo "To use global flow: RAG_SCOPE=global rag flow list"
}

# Export functions
export -f flow_active
export -f get_active_flow_dir
export -f generate_flow_id
export -f flow_create
export -f flow_get_state
export -f flow_update_state
export -f flow_transition
export -f flow_status
export -f flow_list
export -f flow_resume
export -f flow_checkpoint
export -f flow_add_evidence
export -f flow_list_evidence
export -f flow_init_evidence_vars
export -f flow_promote
export -f get_rag_dir
export -f get_flows_dir
