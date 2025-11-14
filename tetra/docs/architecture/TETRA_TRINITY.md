# The Tetra Trinity: TES, TAS, TRS

**Version**: 1.0
**Date**: 2025-11-02
**Status**: Foundational Architecture

## Overview

The Tetra ecosystem is built on three complementary specifications that work together to provide a complete substrate for distributed computing with semantic clarity:

- **TES** (Tetra Endpoint Specification) = **WHERE** actions execute
- **TAS** (Tetra Action Specification) = **WHAT** actions to perform
- **TRS** (Tetra Record Specification) = **HOW** data persists

Together, these three specifications form "The Tetra Trinity" - a coherent foundation for semantic computing in the age of LLMs.

## The Trinity in Action

```bash
/deploy::confirmed:config @prod
    │         │        │      │
    │         │        │      └─ TES: WHERE (prod endpoint)
    │         │        └─ TAS: WHAT (deploy config)
    │         └─ TAS: HOW (with confirmation)
    └─ TAS: ACTION (deploy operation)

# Creates TRS record:
$TETRA_DIR/org/db/1760230000.deploy.config.json
                  └──────┬──────┘
                    TRS: Persistent artifact
```

## TES: WHERE (Endpoints)

**Purpose**: Define and resolve addressable locations for actions.

**Core Concept**: Progressive resolution from symbolic names to executable plans.

### Seven Levels of Resolution

```
Level 0: Symbol      →  @prod
Level 1: Address     →  24.199.72.22
Level 2: Channel     →  deploy@24.199.72.22
Level 3: Connector   →  root:deploy@24.199.72.22 -i ~/.ssh/key
Level 4: Handle      →  [Validated Connector ✓]
Level 5: Locator     →  deploy@24.199.72.22:~/app/config.toml
Level 6: Binding     →  write(deploy@24.199.72.22:~/app/config.toml)
Level 7: Plan        →  ssh root@24.199.72.22 -i key 'su - deploy -c "cat > config.toml"'
```

### Common Endpoints

- `@local` - Your machine
- `@dev` - Development server
- `@staging` - Staging environment
- `@prod` - Production environment
- `@tube:name` - Terminal endpoint via tubes

**See**: `docs/TES_SPECIFICATION.md` (from existing documentation)

## TAS: WHAT (Actions)

**Purpose**: Define semantic actions with contracts and composition.

**Core Concept**: Human-readable, LLM-friendly action syntax that emphasizes meaning over strict types.

### Syntax Components

```
/module.action::contract:noun(s) @endpoint
   │       │        │       │        │
   │       │        │       │        └─ WHERE (TES)
   │       │        │       └─ Target entity
   │       │        └─ Semantic constraint
   │       └─ Operation
   └─ Namespace
```

### Key Features

**Contracts** (Semantic guarantees):
- `::authenticated` - Auth required
- `::confirmed` - User confirmation needed
- `::dryrun` - Preview only
- `::idempotent` - Safe to retry
- `::cached` - May use stale data

**Composition** (Pipelines):
```bash
/query:users | /filter::active | /map:emails | /send::authenticated:notification @prod
```

**Plural Semantics**:
- `noun` (singular) = Single value
- `nouns` (plural) = Array processing

**See**: `docs/TAS_SPECIFICATION.md`

## TRS: HOW (Records)

**Purpose**: Define persistent, queryable, correlatable data artifacts.

**Core Concept**: Context-based naming that eliminates redundancy while maintaining queryability.

### Naming Convention

**In canonical location** (`$TETRA_DIR/module/db/`):
```
timestamp.type.kind.format
```
Module is **implicit** from directory path.

**In non-canonical location** (exports, trash, etc.):
```
timestamp.module.type.kind.format
```
Module becomes **explicit** for portability.

### Set-Based Attributes

Segments between timestamp and format form an unordered SET:
```bash
# Semantically equivalent:
1760229927.audio.sally.mp3
1760229927.sally.audio.mp3

# Convention: timestamp.type.kind.format
```

### Cross-Module Correlation

**By timestamp**:
```bash
trs_query_timestamp 1760229927
# Returns all records from that moment across all modules
```

**By tag**:
```bash
trs_query_by_tag "oauth"
# Returns all records tagged with "oauth"
```

**By relationship**:
```bash
trs_timeline "flow-123"
# Returns chronological view of all records in flow
```

**See**: `docs/TRS_SPECIFICATION.md`

## How They Work Together

### Example 1: Simple Deployment

**Input**:
```bash
/deploy:config @prod
```

**TAS** parses:
- Action: `deploy`
- Noun: `config`
- Endpoint: `@prod` (TES reference)

**TES** resolves `@prod`:
- Symbol → Address → Connector → Plan

**Execution**:
- Action runs at resolved endpoint

**TRS** records:
```bash
$TETRA_DIR/org/db/1760230000.deploy.config.json
```

### Example 2: Safe Deletion

**Input**:
```bash
/rm::confirmed:old-database @prod
```

**TAS** components:
- Action: `rm` (alias for `delete`)
- Contract: `::confirmed`
- Noun: `old-database`
- Endpoint: `@prod`

**Contract validation**:
```
CONFIRMATION REQUIRED
Action: /delete:old-database
Endpoint: @prod
Type 'yes' to proceed: _
```

**On confirmation**:
- TES resolves `@prod`
- Action moves (not deletes) to trash
- TRS creates soft-delete record

**TRS artifacts**:
```bash
/tmp/tetra/removed/1760230000/
├── 1760230000.org.database.old.sql  # Module explicit (non-canonical)
└── REMOVED.json                      # Restoration metadata
```

### Example 3: Data Pipeline

**Input**:
```bash
/query::authenticated:users @prod | /filter::active | /map:emails | /send:notification
```

**TAS pipeline**:
1. Stage 1: `/query::authenticated:users @prod`
2. Stage 2: `/filter::active`
3. Stage 3: `/map:emails`
4. Stage 4: `/send:notification`

**Execution flow**:
1. **Validate contracts** (authentication for stage 1)
2. **TES resolution** (only for stage 1 with `@prod`)
3. **Execute stages sequentially**
4. **Fail-fast** on any error
5. **Atomic cleanup** on interrupt (Ctrl-C)

**TRS tracking**:
```bash
# Pipeline manifest
/tmp/tetra/pipelines/pipeline-1760230000-abc123/manifest.txt

# If successful, artifacts in canonical locations:
$TETRA_DIR/org/db/1760230100.query.users.json
$TETRA_DIR/org/db/1760230101.filter.active.json
$TETRA_DIR/org/db/1760230102.map.emails.json
$TETRA_DIR/org/db/1760230103.send.notification.json

# If failed/cancelled, ALL moved to:
/tmp/tetra/cancelled/pipeline-1760230000-abc123/
├── 1760230100.org.query.users.json    # Module now explicit
├── 1760230101.org.filter.active.json
├── 1760230102.org.map.emails.json
└── CANCELLED.json                      # Metadata
```

**Audit trail**:
```bash
$TETRA_DIR/audit/db/1760230000.pipeline.start.json
$TETRA_DIR/audit/db/1760230105.pipeline.cancelled.json
```

### Example 4: Cross-Module Correlation

**Scenario**: A RAG flow creates evidence, queries QA, generates audio

**TRS records created**:
```bash
# RAG module (flow state)
$TETRA_DIR/rag/db/1760230000.flow.state.json
$TETRA_DIR/rag/db/1760230000.evidence.code.md

# QA module (question/answer)
$TETRA_DIR/qa/db/1760230001.prompt
$TETRA_DIR/qa/db/1760230001.answer

# VOX module (TTS audio)
$TETRA_DIR/vox/db/1760230002.audio.sally.mp3
$TETRA_DIR/vox/db/1760230002.spans.sally.json

# Audit module (action log)
$TETRA_DIR/audit/db/1760230000.action.log.json
```

**Correlation by timestamp**:
```bash
trs_query_timestamp 1760230000
# Returns all records from that moment
```

**Correlation by flow**:
```bash
trs_timeline "flow-abc123"
# Returns chronological view of entire flow
```

**Metadata linking**:
```json
{
  "timestamp": 1760230002,
  "module": "vox",
  "type": "audio",
  "kind": "sally",
  "relationships": {
    "flow_id": "flow-abc123",
    "parent_id": "1760230001",
    "related_ids": ["1760230000"]
  }
}
```

## Design Principles

### 1. Semantic Over Syntactic

**LLM-Friendly**: Contracts like `::authenticated` convey *meaning*, not strict types. LLMs can understand and validate them.

**Human-Readable**: `/query::cached:data @prod` reads like English.

### 2. Context-Aware Intelligence

**TRS**: Module name implicit in canonical location (`$TETRA_DIR/module/db/`)

**TAS**: Module resolved from REPL context or action registry

**TES**: Endpoint aliases resolve progressively

### 3. Fail-Safe Defaults

**Soft delete**: Never actually delete, move to trash

**Atomic pipelines**: Ctrl-C moves ALL artifacts to cancelled

**Contract validation**: `::confirmed` prevents accidents

### 4. Progressive Enhancement

All systems work independently:
- **TAS** without **TES** (local actions only)
- **TRS** without **TAS** (direct file writes)
- **TES** without **TAS** (manual SSH/connection)

But together they're more powerful.

### 5. Queryable Everything

**Cross-module queries**:
- By timestamp: All data from a moment
- By tag: All resources tagged "oauth"
- By relationship: All artifacts in a flow
- By attribute: All audio files, all health checks

## Integration Points

### REPL Integration

**Detection**:
```bash
# In REPL, input starting with / and containing :
/query:users
```

**Routing**:
1. Check if TAS syntax (`/action:noun`)
2. Parse and validate
3. Resolve module from REPL context
4. Execute via TAS dispatcher

**Tab completion**:
- Actions: `/que<TAB>` → `/query`
- Contracts: `/send::<TAB>` → `::authenticated`, `::confirmed`
- Endpoints: `@<TAB>` → `@local`, `@dev`, `@prod`

### Action Registry

**Registration**:
```bash
action_register "module" "action" "Description" "<params>" "tes_capable"
```

**Lookup**:
```bash
action_exists "module.action"    # Check if registered
action_info "module.action"       # Get details
action_list                       # List all
```

### Audit Logging

Every TAS action automatically logs:
```json
{
  "timestamp": 1760230000,
  "event_type": "tas_action",
  "module": "org",
  "action": "deploy",
  "endpoint": "@prod",
  "result": "success",
  "duration_ms": 1234
}
```

Stored as TRS record: `$TETRA_DIR/audit/db/timestamp.action.log.json`

### Trash Management

All destructive operations use soft delete:
- `/delete:file` → `/tmp/tetra/removed/<timestamp>/`
- Pipeline interrupt → `/tmp/tetra/cancelled/<pipeline-id>/`
- Pipeline failure → `/tmp/tetra/failed/<pipeline-id>/`

Manual cleanup only (no auto-expiry).

## Common Patterns

### 1. Verified Deployment

```bash
# Dry run first
/deploy::dryrun:config @staging

# If looks good, deploy for real
/deploy::confirmed:config @staging

# Promote to production
/deploy::confirmed::logged:config @prod
```

### 2. Safe Data Migration

```bash
# Query with authentication
/query::authenticated:users @prod | \
  /transform | \
  /validate | \
  /upload::confirmed @new-database
```

### 3. Monitored Workflow

```bash
# All stages logged automatically
/fetch:data @api | \
  /process | \
  /validate | \
  /store @database

# Check audit trail
audit_show_pipeline pipeline-1760230000-abc123
```

### 4. Cross-Module Discovery

```bash
# Find everything related to OAuth implementation
trs_query_by_tag "oauth"

# Timeline of a specific flow
trs_timeline "fix-auth-issue-123"

# All artifacts from a specific moment
trs_query_timestamp 1760230000
```

## Extending the Trinity

### Custom Contracts

```bash
# Define validator
my_contract_validator() {
    # Check conditions
    ...
}

# Register
contract_register "my_contract" "my_contract_validator"

# Use
/action::my_contract:data
```

### Custom Endpoints

Add to TES registry with resolution rules (see TES docs).

### Custom Actions

```bash
# Implement handler
mymodule_myaction_impl() {
    local endpoint="$1"
    local data="$2"
    # Implementation
}

# Register
action_register "mymodule" "myaction" "Description" "<data>" "yes"

# Use
/myaction:data @endpoint
```

## Philosophical Foundation

The Tetra Trinity embodies a shift from **syntactic computing** to **semantic computing**:

**Traditional approach**:
- Strict types
- Compile-time validation
- Syntax-focused

**Tetra approach**:
- Semantic contracts
- Runtime validation with meaning
- Human and LLM readable

This shift is designed for the LLM era, where:
- AI can parse and validate semantic contracts
- Humans can read and understand intentions
- Systems communicate meaning, not just structure

## Summary

| Specification | Purpose | Key Feature | Example |
|---------------|---------|-------------|---------|
| **TES** | WHERE actions execute | Progressive resolution | `@prod` → SSH plan |
| **TAS** | WHAT actions to perform | Semantic contracts | `::confirmed` |
| **TRS** | HOW data persists | Context-based naming | `timestamp.type.kind.format` |

Together, they provide:
- ✓ Semantic clarity
- ✓ LLM-friendly syntax
- ✓ Cross-module correlation
- ✓ Queryable artifacts
- ✓ Fail-safe defaults
- ✓ Composition through pipelines
- ✓ Audit trail
- ✓ Progressive enhancement

---

**Further Reading**:
- `docs/TES_SPECIFICATION.md` - Complete TES documentation
- `docs/TAS_SPECIFICATION.md` - Complete TAS documentation
- `docs/TRS_SPECIFICATION.md` - Complete TRS documentation
- `bash/actions/README.md` - Action system implementation
- `bash/trs/README.md` - TRS library guide

**Maintained by**: Tetra Core Team
**License**: MIT
**Feedback**: tetra-specs@anthropic.com
