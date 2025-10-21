# TTM Quick Start

## 5-Minute Guide

### Setup

```bash
# Source TTM (add to your script or bashrc)
source ~/tetra/bash/ttm/ttm.sh
ttm_init
```

### Basic Usage

```bash
# Create transaction
txn_id=$(txn_create "my task" "@local" "human")

# Add files
txn_add_ctx "input.txt" "data"

# Execute
txn_transition "EXECUTE"
# ... do your work ...

# Commit
txn_commit
```

### Complete Example

```bash
#!/usr/bin/env bash
source ~/tetra/bash/ttm/ttm.sh
ttm_init

# 1. Create
txn_id=$(txn_create "backup database" "@local" "cron")

# 2. Execute
txn_transition "EXECUTE"
pg_dump mydb > /tmp/backup.sql

# 3. Add result
txn_add_ctx "/tmp/backup.sql" "backup-file"

# 4. Validate
txn_transition "VALIDATE"
if [[ -f /tmp/backup.sql ]]; then
    txn_commit
else
    txn_fail "$txn_id" "Backup file not created"
fi
```

## Common Patterns

### Pattern 1: Simple Task

```bash
txn_id=$(txn_create "run tests")
txn_transition "EXECUTE"
npm test || txn_fail "$txn_id" "Tests failed"
txn_commit
```

### Pattern 2: With Evidence

```bash
txn_id=$(txn_create "process data")
txn_add_ctx "input.csv" "source"
txn_transition "EXECUTE"

# Use evidence variables
init_evidence_vars
cat $e1 | process.sh > output.csv

txn_add_ctx "output.csv" "result"
txn_commit
```

### Pattern 3: With Target Resolution

```bash
txn_id=$(txn_create "deploy app" "@staging")
txn_add_ctx "build/app.tar.gz" "artifact"

# Resolve where to deploy
txn_transition "ASSEMBLE"
txn_resolve_tes

# Get the resolved endpoint
plan=$(txn_state | jq -r '.tes_plan')

# Execute deployment
txn_transition "EXECUTE"
init_evidence_vars
scp $e1 "$plan:/opt/app/"

txn_commit
```

## CLI Commands

```bash
# Create
ttm create "description" [@target] [agent]

# Manage
ttm transition <stage>
ttm add <file> <description>
ttm commit
ttm fail "<error message>"

# Query
ttm active                 # Show active transaction
ttm status                 # Show status
ttm list                   # List all
ttm list EXECUTE          # Filter by stage
```

## Transaction Stages

```
NEW       → Created, ready for context
SELECT    → Gathering inputs
ASSEMBLE  → Preparing execution
EXECUTE   → Running operation
VALIDATE  → Checking results
DONE      → Success
FAIL      → Error
```

## File Locations

```
~/.tetra/ttm/txns/
├── active              # -> current transaction
└── {txn-id}/
    ├── state.json      # Current state
    ├── events.ndjson   # Event log
    ├── ctx/            # Context files
    │   ├── 000_policy.md
    │   ├── 010_request.md
    │   └── 100_*.*
    ├── build/          # Temp files
    └── artifacts/      # Outputs
```

## Debugging

```bash
# View state
cat $(txn_dir)/state.json | jq

# View events
tail -f $(txn_dir)/events.ndjson

# List context
ls -l $(txn_dir)/ctx/

# Check all transactions
ttm list
```

## Next Steps

- Read: `bash/ttm/README.md` for full API
- See: `bash/ttm/examples/deploy.sh` for complete example
- Docs: `docs/TTS_TETRA_TRANSACTION_STANDARD.md` for standard
