# TTM - Tetra Transaction Manager

TTM is a simple, file-based transaction manager that implements the TTS (Tetra Transaction Standard). It provides a standardized way to manage stateful operations with clear lifecycle stages, context accumulation, and event logging.

## Quick Start

```bash
# Source TTM
source ~/tetra/bash/ttm/ttm.sh

# Initialize
ttm_init

# Create transaction
txn_id=$(txn_create "deploy to staging" "@staging" "human")

# Add context
txn_add_ctx "build/app.tar.gz" "artifact"

# Transition through stages
txn_transition "SELECT"
txn_transition "ASSEMBLE"

# Resolve target endpoint
txn_resolve_tes

# Execute
txn_transition "EXECUTE"
# ... do work ...

# Validate and commit
txn_transition "VALIDATE"
txn_commit
```

## Architecture

```
~/.tetra/ttm/txns/
├── active -> deploy-api-20251018T000000/
└── deploy-api-20251018T000000/
    ├── state.json           # Current state
    ├── events.ndjson        # Event log
    ├── ctx/                 # Context files
    │   ├── 000_policy.md
    │   ├── 010_request.md
    │   └── 100_artifact.tar.gz
    ├── build/               # Intermediate files
    └── artifacts/           # Final outputs
```

## Transaction Lifecycle (FSM)

```
NEW → SELECT → ASSEMBLE → EXECUTE → VALIDATE → DONE
                                              ↘ FAIL
```

| Stage | Description |
|-------|-------------|
| **NEW** | Transaction created |
| **SELECT** | Gathering context/evidence |
| **ASSEMBLE** | Preparing execution (resolving TES) |
| **EXECUTE** | Running operation |
| **VALIDATE** | Checking results |
| **DONE** | Success |
| **FAIL** | Error |

## Core API

### Transaction Lifecycle

```bash
# Create transaction
txn_create <description> [target] [agent]
# Returns: txn_id

# Get active transaction
txn_active
# Returns: txn_id or empty

# Get transaction directory
txn_dir [txn_id]
# Returns: absolute path

# Get transaction state
txn_state [txn_id]
# Returns: JSON

# Update transaction state
txn_update <txn_id> <updates_json>

# Transition stage
txn_transition <new_stage> [txn_id]

# Commit transaction
txn_commit [txn_id]

# Fail transaction
txn_fail [txn_id] <error_msg>
```

### Context Management

```bash
# Add context/evidence file
txn_add_ctx <source_file> <description> [txn_id]

# List context files
txn_list_ctx [txn_id]

# Initialize evidence variables ($e1, $e2, etc.)
init_evidence_vars [txn_id]

# Get context digest
txn_ctx_digest [txn_id]
```

### Query Functions

```bash
# List all transactions
txn_list [stage_filter]

# Show transaction status
txn_status [txn_id]

# Get transaction events
txn_events [txn_id] [event_filter]
```

### TES Integration

```bash
# Resolve TES endpoint
txn_resolve_tes [txn_id]

# Get connector for target
txn_get_connector <target>
```

## Module Structure

```
bash/ttm/
├── ttm.sh           # Main entry point
├── txn.sh           # Core transaction lifecycle
├── ctx.sh           # Context/evidence management
├── query.sh         # Query functions
├── tes.sh           # TES integration
├── events.sh        # Event publishing
├── examples/        # Example scripts
│   └── deploy.sh    # Deploy example
└── README.md        # This file
```

## Examples

### Example 1: Simple Transaction

```bash
#!/usr/bin/env bash
source ~/tetra/bash/ttm/ttm.sh
ttm_init

# Create and execute transaction
txn_id=$(txn_create "backup database" "@local" "cron")
txn_transition "EXECUTE"

# Do backup work
pg_dump mydb > /tmp/backup.sql

# Add result as context
txn_add_ctx "/tmp/backup.sql" "backup"

# Commit
txn_transition "VALIDATE"
txn_commit

echo "Backup complete: $txn_id"
```

### Example 2: Deploy with Validation

See `examples/deploy.sh` for a complete deployment example.

## Evidence Variables

TTM provides numbered evidence variables for easy access to context files:

```bash
# After adding context files
init_evidence_vars

# Access via $e1, $e2, etc.
cat $e1 $e2 | process_data
echo "Processing $e_count files"
```

Evidence files are numbered:
- 000-099: System files (policy, request)
- 100+: User-added evidence (increments by 10)

## Integration with RAG

RAG can use TTM via `flow_manager_ttm.sh` which provides backward-compatible wrappers:

```bash
# Old RAG API still works
source ~/tetra/bash/rag/core/flow_manager_ttm.sh

flow_create "fix auth bug"
flow_transition "SELECT"
# ... etc
```

## Module-Specific Transactions

Each module can have its own transaction namespace:

```
~/.tetra/
├── rag/txns/       # RAG flows (uses flow_manager_ttm.sh)
├── deploy/txns/    # Deployments
├── tkm/txns/       # Key operations
└── ttm/txns/       # Generic transactions
```

## Related Documents

- **TTS Standard**: `docs/TTS_TETRA_TRANSACTION_STANDARD.md`
- **TES Specification**: `docs/TES_Agent_Extension.md`
- **TTM Plan**: `docs/PROVISIONAL_TTM_PLAN.md`

## Testing

Manual testing verified:
- Transaction creation and lifecycle ✓
- Context management ✓
- Evidence variables ✓
- TES resolution ✓
- Stage transitions ✓
- Event logging ✓
