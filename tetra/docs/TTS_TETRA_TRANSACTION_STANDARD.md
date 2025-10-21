# TTS - Tetra Transaction Standard

**Version**: 1.0
**Status**: Provisional
**Based on**: bash/rag flow patterns
**Created**: 2025-10-17

## Overview

TTS is a simple, file-based transaction standard inspired by RAG's flow_manager.sh. It emphasizes:
- **Flat file structure** (no database)
- **Human-readable state** (JSON + NDJSON)
- **Slug-based IDs** (descriptive + timestamp)
- **Active symlink pattern** (one active transaction)
- **Simple FSM** (clear stage transitions)
- **Evidence/context accumulation** (like RAG evidence)

## Core Concepts

### Transaction Directory Structure

```
~/.tetra/{module}/txns/
├── active -> {txn_id}/           # Symlink to active transaction
├── {txn_id}/                     # Transaction directory
│   ├── state.json               # Current state (FSM stage, metadata)
│   ├── events.ndjson            # Append-only event log
│   ├── ctx/                     # Context/evidence (numbered files)
│   │   ├── 000_policy.md       # Default policy/constraints
│   │   ├── 010_request.md      # Original request
│   │   ├── 100_evidence1.md    # Added evidence
│   │   └── 110_evidence2.md    # Added evidence
│   ├── build/                   # Intermediate build artifacts
│   └── artifacts/               # Final output artifacts
```

### Transaction ID Format

```bash
# Format: {slug}-{timestamp}
# Example: deploy-to-staging-20251017T143022

generate_txn_id() {
    local description="$1"
    local slug=$(echo "$description" | tr '[:upper:]' '[:lower:]' | \
                 sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | \
                 cut -c1-30 | sed 's/-$//')
    local timestamp=$(date '+%Y%m%dT%H%M%S')
    echo "${slug}-${timestamp}"
}
```

**Why**: Human-readable, sortable, unique, no external ID service needed.

### State File (state.json)

```json
{
  "txn_id": "deploy-to-staging-20251017T143022",
  "description": "Deploy to staging",
  "stage": "NEW",
  "target": "@staging",
  "iteration": 1,
  "agent": "human",
  "ctx_digest": null,
  "last_checkpoint": "2025-10-17T14:30:22Z",
  "last_error": null
}
```

**Fields**:
- `txn_id`: Transaction identifier
- `description`: Human-readable description
- `stage`: Current FSM stage (see below)
- `target`: TES endpoint (`@local`, `@dev`, `@staging`, `@prod`)
- `iteration`: Retry counter
- `agent`: Who/what initiated (human, cron, webhook)
- `ctx_digest`: Hash of context directory (for idempotency)
- `last_checkpoint`: ISO8601 timestamp of last state change
- `last_error`: Error message if failed

### Event Log (events.ndjson)

```jsonl
{"ts":"2025-10-17T14:30:22Z","event":"txn_start","txn_id":"deploy-to-staging-20251017T143022","description":"Deploy to staging"}
{"ts":"2025-10-17T14:30:23Z","event":"stage_transition","from":"NEW","to":"SELECT"}
{"ts":"2025-10-17T14:30:45Z","event":"evidence_added","file":"100_manifest.yaml"}
{"ts":"2025-10-17T14:31:02Z","event":"stage_transition","from":"SELECT","to":"ASSEMBLE"}
{"ts":"2025-10-17T14:31:15Z","event":"txn_commit","duration_ms":53000}
```

**Why NDJSON**: Append-only, grep-able, jq-able, no schema overhead.

## Transaction Lifecycle (FSM)

```
NEW → SELECT → ASSEMBLE → EXECUTE → VALIDATE → DONE
                                              ↘ FAIL
```

| Stage | Meaning | Actions |
|-------|---------|---------|
| **NEW** | Transaction created | Add context/evidence |
| **SELECT** | Gathering inputs | Add more context, validate inputs |
| **ASSEMBLE** | Building execution plan | Resolve TES, prepare artifacts |
| **EXECUTE** | Running operation | Execute steps, log progress |
| **VALIDATE** | Checking results | Run tests, verify state |
| **DONE** | Success | Archive, publish artifacts |
| **FAIL** | Error | Log error, preserve state |

### Stage Transitions

```bash
txn_transition() {
    local txn_id="$1"
    local new_stage="$2"
    local txn_dir="$TTM_DIR/txns/$txn_id"

    # Get current stage
    local current_stage=$(jq -r '.stage' "$txn_dir/state.json")

    # Log transition
    echo "{\"ts\":\"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\",\"event\":\"stage_transition\",\"from\":\"$current_stage\",\"to\":\"$new_stage\"}" \
        >> "$txn_dir/events.ndjson"

    # Update state
    jq --arg stage "$new_stage" --arg ts "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
       '.stage = $stage | .last_checkpoint = $ts' \
       "$txn_dir/state.json" > "$txn_dir/state.json.tmp"
    mv "$txn_dir/state.json.tmp" "$txn_dir/state.json"
}
```

## Context/Evidence Pattern (from RAG)

### Numbered Context Files

```
ctx/
├── 000_policy.md       # Always first: constraints, output contract
├── 010_request.md      # Original request with metadata
├── 100_file1.md        # Evidence 1 ($e1)
├── 110_file2.md        # Evidence 2 ($e2)
├── 120_config.yaml     # Evidence 3 ($e3)
```

**Numbering**: `{seq}_description.ext` where seq is 000, 010, 100, 110, 120...
- 000-099: System/policy files
- 100+: User-added evidence, increment by 10

### Evidence Variables

```bash
init_evidence_vars() {
    local txn_dir="$1"
    local ctx_dir="$txn_dir/ctx"

    # Clear previous
    unset e1 e2 e3 e4 e5 e6 e7 e8 e9
    local e_count=0

    # Assign $e1, $e2, etc. to evidence files (100+)
    local files=($(ls "$ctx_dir" | grep -E '^[1-9][0-9]{2}_' | sort -n))
    for i in "${!files[@]}"; do
        local var_num=$((i + 1))
        eval "e$var_num=\"$ctx_dir/${files[$i]}\""
        ((e_count++))
    done

    export e_count
}

# Usage in transaction:
# init_evidence_vars "$txn_dir"
# cat $e1 $e2 | some_command
```

## Core API Functions

### Transaction Lifecycle

```bash
# Create transaction
txn_create(description, target, agent)
# Returns: txn_id
# Creates directory structure, state.json, events.ndjson
# Sets as active via symlink

# Get active transaction
txn_active()
# Returns: txn_id or empty if none

# Get transaction directory
txn_dir(txn_id?)
# Returns: absolute path to txn directory
# If txn_id empty, uses active

# Get transaction state
txn_state(txn_id?)
# Returns: JSON state object

# Update transaction state
txn_update(txn_id, updates_json)
# Merges updates into state.json
# Updates last_checkpoint

# Transition stage
txn_transition(txn_id, new_stage)
# Validates transition, logs event, updates state

# Commit transaction
txn_commit(txn_id)
# Transitions to DONE
# Logs final event with duration

# Fail transaction
txn_fail(txn_id, error_msg)
# Transitions to FAIL
# Logs error in state and events
```

### Context/Evidence Management

```bash
# Add evidence/context file
txn_add_ctx(txn_id, source_file, description)
# Copies file to ctx/ with next sequence number
# Logs evidence_added event
# Re-initializes evidence variables

# List context files
txn_list_ctx(txn_id?)
# Lists ctx/ files with sequence numbers

# Get context digest
txn_ctx_digest(txn_id)
# Returns: sha256 hash of ctx/ directory contents
# Used for idempotency checks
```

### Transaction Query

```bash
# List all transactions
txn_list(filter?)
# Lists all txn_ids, optionally filtered by stage

# Show transaction status
txn_status(txn_id?)
# Pretty-prints state, recent events, context files

# Get transaction events
txn_events(txn_id?, filter?)
# Returns events.ndjson, optionally filtered by event type
```

## Integration with TES

### TES Resolution in ASSEMBLE Stage

```bash
txn_resolve_tes() {
    local txn_id="$1"
    local target=$(jq -r '.target' "$(txn_dir "$txn_id")/state.json")

    # Use bash/resolve for progressive resolution
    source "$TETRA_SRC/bash/resolve/resolve.sh"

    # Resolve to plan (level 7)
    local plan=$(resolve_symbol "$target")

    # Store in state
    txn_update "$txn_id" "{\"tes_plan\":\"$plan\"}"

    # Log event
    echo "{\"ts\":\"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\",\"event\":\"tes_resolved\",\"target\":\"$target\",\"plan\":\"$plan\"}" \
        >> "$(txn_dir "$txn_id")/events.ndjson"
}
```

## Example: Deploy Transaction

```bash
# 1. Create transaction
txn_id=$(txn_create "deploy api v2.1.0" "@staging" "human")
# Returns: deploy-api-v2-1-0-20251017T143022

# 2. Add evidence/context
txn_add_ctx "$txn_id" "build/api-v2.1.0.tar.gz" "artifact"
txn_add_ctx "$txn_id" "deploy/staging.yaml" "config"
txn_add_ctx "$txn_id" "CHANGELOG.md" "changes"

# 3. Transition: NEW → SELECT
txn_transition "$txn_id" "SELECT"

# 4. Transition: SELECT → ASSEMBLE
txn_transition "$txn_id" "ASSEMBLE"

# 5. Resolve TES endpoint
txn_resolve_tes "$txn_id"

# 6. Transition: ASSEMBLE → EXECUTE
txn_transition "$txn_id" "EXECUTE"

# 7. Execute deployment steps
init_evidence_vars "$txn_id"
ssh $(jq -r '.tes_plan' "$(txn_dir "$txn_id")/state.json") \
    "cd /opt/app && tar xzf - && systemctl restart app" < "$e1"

# 8. Transition: EXECUTE → VALIDATE
txn_transition "$txn_id" "VALIDATE"

# 9. Run health check
curl -f "https://staging.example.com/health" || {
    txn_fail "$txn_id" "Health check failed"
    exit 1
}

# 10. Success!
txn_commit "$txn_id"
```

## Comparison to Complex Transaction Systems

| Feature | TTS (Simple) | Traditional (Complex) |
|---------|--------------|----------------------|
| State storage | JSON file | Database |
| Event log | NDJSON file | Event store / Kafka |
| Transaction ID | slug-timestamp | UUID / auto-increment |
| Isolation | File locks | MVCC / pessimistic locks |
| Recovery | Replay events.ndjson | WAL / redo logs |
| Idempotency | ctx_digest hash | Idempotency keys table |
| Distributed | No (single-node) | Yes (2PC / Saga) |
| Complexity | ~200 LOC | ~2000+ LOC |

**Philosophy**: Start simple. File-based works for 99% of cases. Upgrade to DB when you have >10k txns/day.

## File Organization Convention

### Module-specific Transaction Directories

```
~/.tetra/
├── rag/txns/          # RAG module transactions
├── deploy/txns/       # Deploy module transactions
├── tkm/txns/          # Key manager transactions
├── tsm/txns/          # Service manager transactions
└── ttm/txns/          # Generic TTM transactions
```

Each module gets its own transaction namespace. Modules can define custom FSM stages.

## TTS Compliance Checklist

A module is **TTS-compliant** if it:

- ✅ Uses `~/.tetra/{module}/txns/{txn_id}/` structure
- ✅ Maintains `state.json` with required fields
- ✅ Appends to `events.ndjson` for all state changes
- ✅ Uses `active` symlink for current transaction
- ✅ Implements clear FSM with stage transitions
- ✅ Uses slug-timestamp transaction IDs
- ✅ Stores context in numbered `ctx/` files
- ✅ Provides `txn_create`, `txn_commit`, `txn_fail` functions

## Future Extensions

### Optional TTS Extensions

- **TTS-TES**: Integration with TES progressive resolution (this doc includes it)
- **TTS-Saga**: Compensation-based rollback (add `compensations.list`)
- **TTS-Lock**: Fine-grained locking (add `locks/` directory)
- **TTS-Remote**: Remote execution via connectors (add `topology.json`)
- **TTS-Audit**: Extended audit fields (add `audit/` directory)

Extensions are **opt-in**. Base TTS is minimal.

## Reference Implementation

See: `bash/rag/core/flow_manager.sh` for the canonical pattern.

**Key insight**: RAG flows ARE transactions. They just happen to be focused on LLM context assembly. The pattern generalizes to any stateful operation.

## Related Standards

- **TES** (Tetra Endpoint Specification): Target resolution
- **TCS** (Tetra Contract Specification): Type contracts (future)
- **TMS** (Tetra Module Specification): Module structure

TTS is the **transaction layer** that sits between REPL (input) and TES (execution).
