# PROVISIONAL TTM PLAN

**Status**: Provisional - Under Discussion
**Created**: 2025-10-17
**Updated**: 2025-10-17 (Simplified based on TTS)
**Context**: TTM implements TTS (Tetra Transaction Standard)

## Overview

TTM (Tetra Transaction Manager) is a simple, file-based transaction system that implements the **TTS standard** (see `docs/TTS_TETRA_TRANSACTION_STANDARD.md`).

**Pattern source**: `bash/rag/core/flow_manager.sh` - proven to work well, just generalize it.

**Key insight**: RAG flows ARE transactions. The pattern works. Make it standard.

## Architecture

```
┌──────────────────────────────────┐
│  bash/repl (symbol parser)       │  Parse @symbols, dispatch commands
└────────────┬─────────────────────┘
             │
             ↓ ttm_execute "deploy @staging"
┌──────────────────────────────────┐
│  bash/ttm (TTS implementation)   │
│                                   │
│  Transaction Lifecycle:           │
│  - txn_create (NEW)              │
│  - txn_add_ctx (SELECT)          │
│  - txn_resolve_tes (ASSEMBLE)    │
│  - txn_execute (EXECUTE)         │
│  - txn_validate (VALIDATE)       │
│  - txn_commit (DONE)             │
│                                   │
│  State: state.json                │
│  Audit: events.ndjson             │
│  Context: ctx/*.md                │
└────────────┬─────────────────────┘
             │
             ↓ publish("txn.stage_changed")
┌──────────────────────────────────┐
│  bash/tui (pubsub subscribers)   │  Render updates
└──────────────────────────────────┘
```

## Core API (TTS-compliant)

### Transaction Lifecycle

```bash
# Create transaction
txn_create "deploy api" "@staging" "human"
# Returns: deploy-api-20251017T143022
# Creates: ~/.tetra/ttm/txns/{txn_id}/
#   - state.json (stage=NEW)
#   - events.ndjson (txn_start event)
#   - ctx/000_policy.md
#   - ctx/010_request.md
# Sets: ~/.tetra/ttm/txns/active -> {txn_id}

# Add context/evidence (SELECT stage)
txn_add_ctx "$txn_id" "build/api.tar.gz" "artifact"
# Creates: ctx/100_artifact.tar.gz
# Logs: evidence_added event
# Updates: $e1, $e2, $e3... variables

# Resolve TES endpoint (ASSEMBLE stage)
txn_resolve_tes "$txn_id"
# Calls: bash/resolve/resolve.sh
# Logs: tes_resolved events (levels 0-7)
# Updates: state.json with tes_plan

# Execute transaction (EXECUTE stage)
txn_execute "$txn_id" "my_deploy_func"
# Runs: my_deploy_func with access to $e1, $e2, $e3
# Logs: execution events

# Validate results (VALIDATE stage)
txn_validate "$txn_id" "my_health_check"
# Runs: my_health_check
# Returns: 0 (pass) or 1 (fail)

# Commit (DONE stage)
txn_commit "$txn_id"
# Transitions: VALIDATE → DONE
# Logs: txn_commit event with duration

# Or fail (FAIL stage)
txn_fail "$txn_id" "Health check failed"
# Transitions: * → FAIL
# Logs: txn_fail event with error
```

### State Queries

```bash
# Get active transaction
txn_active
# Returns: txn_id or empty

# Get transaction state
txn_state "$txn_id"
# Returns: JSON from state.json

# List transactions
txn_list
# Returns: all txn_ids, sorted by timestamp

# Show transaction status
txn_status "$txn_id"
# Pretty-prints: state, recent events, context files
```

## FSM (Simple 6-Stage)

```
NEW → SELECT → ASSEMBLE → EXECUTE → VALIDATE → DONE
                                               ↘ FAIL
```

| Stage | Description | Functions |
|-------|-------------|-----------|
| **NEW** | Created | `txn_create` |
| **SELECT** | Gathering context | `txn_add_ctx` |
| **ASSEMBLE** | Preparing execution | `txn_resolve_tes` |
| **EXECUTE** | Running operation | `txn_execute` |
| **VALIDATE** | Checking results | `txn_validate` |
| **DONE** | Success | `txn_commit` |
| **FAIL** | Error | `txn_fail` |

## Directory Structure

```
~/.tetra/ttm/
├── txns/
│   ├── active -> deploy-api-20251017T143022/
│   └── deploy-api-20251017T143022/
│       ├── state.json
│       ├── events.ndjson
│       ├── ctx/
│       │   ├── 000_policy.md
│       │   ├── 010_request.md
│       │   ├── 100_artifact.tar.gz
│       │   └── 110_config.yaml
│       ├── build/              # Temp files
│       └── artifacts/          # Final outputs
└── topology.json               # @target → connector mapping
```

## Integration Points

### With bash/repl

```bash
# bash/repl already parses @symbols
# Hook into command_processor.sh:

repl_process_input() {
    local input="$1"

    # If has @symbol, route to TTM
    if repl_has_symbols "$input"; then
        local processed=$(repl_process_symbols "$input")
        ttm_dispatch "$processed"
        return $?
    fi

    # Otherwise, normal processing
    # ...
}
```

### With TES (bash/resolve)

```bash
# TTM calls TES resolver in ASSEMBLE stage
txn_resolve_tes() {
    local txn_id="$1"
    local target=$(jq -r '.target' "$(txn_dir "$txn_id")/state.json")

    # Use existing resolver
    source "$TETRA_SRC/bash/resolve/resolve.sh"
    local plan=$(resolve_symbol "$target")

    # Store in state
    txn_update "$txn_id" "{\"tes_plan\":\"$plan\"}"
}
```

### With pubsub (bash/tui/events)

```bash
# TTM publishes events on state changes
txn_transition() {
    local txn_id="$1"
    local new_stage="$2"

    # Update state.json
    # ...

    # Publish event
    publish "txn.stage_changed" "$txn_id" "$new_stage"
}

# TUI subscribes
subscribe "txn.stage_changed" "tui_on_txn_stage_changed"
```

## Module Structure

```
bash/ttm/
├── ttm.sh                  # Main entry, sources all below
├── txn.sh                  # Core: create, commit, fail, transition
├── ctx.sh                  # Context: add_ctx, list_ctx, evidence vars
├── tes.sh                  # TES integration: resolve_tes
├── query.sh                # Queries: list, status, state
└── events.sh               # Event publishing (wraps pubsub)
```

**Total**: ~300-400 LOC (based on flow_manager.sh ~400 LOC)

## Example: Deploy Transaction

```bash
#!/usr/bin/env bash
# Example: deploy command using TTM

deploy() {
    local target="${1:?target required}"  # @staging
    local artifact="${2:?artifact required}"

    # 1. Create transaction
    local txn_id=$(txn_create "deploy to $target" "$target" "human")

    # 2. Add context (SELECT)
    txn_transition "$txn_id" "SELECT"
    txn_add_ctx "$txn_id" "$artifact" "artifact"
    txn_add_ctx "$txn_id" "deploy/$target.yaml" "config"

    # 3. Assemble (resolve TES)
    txn_transition "$txn_id" "ASSEMBLE"
    txn_resolve_tes "$txn_id"

    # 4. Execute
    txn_transition "$txn_id" "EXECUTE"
    init_evidence_vars "$txn_id"  # Sets $e1, $e2

    local plan=$(txn_state "$txn_id" | jq -r '.tes_plan')
    ssh $plan "cd /opt/app && tar xzf - && systemctl restart app" < "$e1" || {
        txn_fail "$txn_id" "Deploy failed"
        return 1
    }

    # 5. Validate
    txn_transition "$txn_id" "VALIDATE"
    local health_url=$(jq -r '.health_url' "$e2")
    curl -f "$health_url" || {
        txn_fail "$txn_id" "Health check failed"
        return 1
    }

    # 6. Done!
    txn_commit "$txn_id"
    echo "Deployed successfully: $txn_id"
}

# Usage:
# $ deploy @staging build/api-v2.1.0.tar.gz
```

## Implementation Plan

### Phase 1: Core (Week 1)
1. Copy `bash/rag/core/flow_manager.sh` → `bash/ttm/txn.sh`
2. Rename: `flow_*` → `txn_*`, `STAGE_*` constants
3. Simplify FSM: 7 stages → 6 stages (remove FOLD)
4. Add: `bash/ttm/ttm.sh` (main entry point)
5. Test: Create, transition, commit, fail

### Phase 2: Context (Week 1)
6. Extract evidence logic → `bash/ttm/ctx.sh`
7. Keep: numbered files, $e1/$e2 variables
8. Test: Add context, list context, evidence vars

### Phase 3: TES Integration (Week 2)
9. Create `bash/ttm/tes.sh`
10. Bridge to `bash/resolve/resolve.sh`
11. Store resolved plan in state.json
12. Test: Resolve @dev, @staging, @prod

### Phase 4: Events (Week 2)
13. Create `bash/ttm/events.sh`
14. Wrap `bash/tui/events/pubsub.sh`
15. Publish on all state transitions
16. Test: Subscribe, verify events fire

### Phase 5: Queries (Week 2)
17. Create `bash/ttm/query.sh`
18. Implement: list, status, state
19. Add color output (optional)
20. Test: Query transactions, filter by stage

### Phase 6: Demo Integration (Week 3)
21. Create example: `examples/ttm_deploy.sh`
22. Hook into `bash/repl` symbol parser
23. Build demo TUI showing transaction state
24. Document usage

## Key Design Decisions

### Why file-based?
- **Simple**: No database, just mkdir/echo/jq
- **Debuggable**: Cat state.json, tail events.ndjson
- **Portable**: Works anywhere bash runs
- **Recoverable**: Files don't corrupt like DBs

### Why slug-timestamp IDs?
- **Human-readable**: deploy-api-20251017T143022
- **Sortable**: Chronological ls output
- **Unique**: Timestamp collision unlikely
- **No service**: No ID generator needed

### Why numbered context files?
- **Ordered**: ls shows sequence
- **Variables**: $e1, $e2 map directly
- **Gaps**: 100, 110, 120 allows insertion
- **Clear**: 000-099 system, 100+ user

### Why simple FSM?
- **Predictable**: Linear flow, clear transitions
- **Debuggable**: Stage name in state.json
- **Extensible**: Modules can add stages
- **Minimal**: 6 stages covers most cases

## Migration Path

### Existing modules → TTM

1. **RAG**: Already TTS-compliant, just rename functions
2. **Deploy**: Port to TTM, use SELECT for preflight checks
3. **TKM**: Use TTM for key generation transactions
4. **TSM**: Use TTM for service start/stop/restart

Each module keeps its own `~/.tetra/{module}/txns/` directory.

## Related Documents

- **TTS_TETRA_TRANSACTION_STANDARD.md** - The standard TTM implements
- **TES_Agent_Extension.md** - TES specification for endpoint resolution
- **bash/rag/core/flow_manager.sh** - Reference implementation pattern
- **PROVISIONAL_TUI_PLAN.md** - TUI layer that subscribes to TTM events

## Success Criteria

TTM is successful if:
- ✅ RAG can migrate to it with < 50 LOC changes
- ✅ New modules adopt it easily (< 100 LOC to integrate)
- ✅ State is always debuggable (cat/tail/jq work)
- ✅ Recovery is simple (replay events.ndjson)
- ✅ Total implementation < 500 LOC
