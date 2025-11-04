# TAS - Tetra Action Specification

**Version**: 1.0
**Status**: Specification
**Date**: 2025-11-02

## Overview

The Tetra Action Specification (TAS) defines a semantic, LLM-friendly syntax for invoking operations across the Tetra ecosystem. TAS emphasizes human readability, semantic contracts, and composition through pipelines, moving beyond strict type systems toward semantic computing for the LLM era.

## Design Philosophy

**Semantic Computing**: In the age of LLMs, strict function signatures focused on syntax give way to semantic contracts focused on meaning. TAS embraces this shift by providing:

- **Semantic clarity** over syntactic precision
- **Human-readable** contracts that LLMs can parse and validate
- **Flexible composition** through pipeline operators
- **Context-aware** module resolution
- **Progressive enhancement** (works with or without advanced features)

## Core Syntax

### Basic Action

```bash
/action:noun @endpoint
```

**Components**:
- `/` - Action sigil (distinguishes from paths and commands)
- `action` - Operation to perform
- `:` - Application sigil (binds action to noun)
- `noun` - Target entity
- `@endpoint` - TES endpoint (optional, see TES Specification)

**Examples**:
```bash
/send:message @prod
/query:user @local
/list:files
```

### Action with Contract

```bash
/action::contract:noun @endpoint
```

**Components**:
- `::` - Contract operator (double colon)
- `contract` - Semantic constraint or guarantee

**Examples**:
```bash
/send::authenticated:message @prod
/delete::confirmed:files
/query::cached:data @staging
```

### Module-Qualified Action

```bash
/module.action:noun @endpoint
```

**Explicit module** when context doesn't provide it:
```bash
/org.deploy:config @prod
/rag.query:code @local
/vox.speak:text
```

### Plural/Singular Semantics

**Singular** noun implies single value:
```bash
/send:message         # Sends one message, returns one result
/query:user           # Queries one user
```

**Plural** noun implies array processing:
```bash
/send:messages        # Iterates over array, may return array or aggregate
/query:users          # Queries multiple users
/transform:files      # Processes each file
```

**Important**: Return value format (array vs aggregate) is determined by the action implementation, not enforced by syntax.

## Contract Operator `::`

The contract operator specifies semantic expectations, not type constraints. Contracts convey guarantees, requirements, or behavioral modifiers.

### Standard Contracts

#### `::authenticated`
Requires authentication context.

```bash
/query::authenticated:data @prod
```

**Behavior**:
- Checks for `$AUTH_TOKEN` or auth context
- Fails with clear error if not authenticated
- LLM can explain why auth is needed

#### `::confirmed`
Requires user confirmation before execution.

```bash
/delete::confirmed:database @prod
```

**Behavior**:
- Prompts: "This will delete database @prod. Type 'yes' to confirm:"
- Only proceeds on explicit 'yes'
- Prevents accidental destructive operations

#### `::dryrun`
Preview mode - shows what would happen without executing.

```bash
/deploy::dryrun:config @prod
```

**Behavior**:
- Executes validation and planning
- Does NOT write, deploy, or modify
- Returns preview of changes

#### `::idempotent`
Marks action as safe to retry.

```bash
/sync::idempotent:files @staging
```

**Behavior**:
- Action can be called multiple times with same result
- Safe for automatic retry on failure
- Enables optimistic execution

#### `::cached`
May return stale data from cache.

```bash
/query::cached:metrics @monitoring
```

**Behavior**:
- Checks cache before expensive operation
- May skip live query if cache valid
- Faster but potentially stale

### Custom Contracts

Modules can define custom contracts:

```bash
/deploy::validated::logged:config @prod
```

Contract chaining with multiple `::`:
- `::validated` - Schema validation passed
- `::logged` - Audit log created

## Pipeline Composition

Pipe actions together with `|`:

```bash
/action:noun | /action:noun | /action:noun
```

**Data Flow**:
- Each stage receives output from previous stage
- Text streams (default), JSON, or NDJSON format
- First error stops pipeline (fail-fast)

### Pipeline Examples

**Simple pipeline**:
```bash
/query:users | /filter::active | /map:emails
```

**With endpoints**:
```bash
/fetch:config @dev | /validate | /deploy @staging
```

**With contracts**:
```bash
/list:files | /filter::large | /delete::confirmed
```

**Complex workflow**:
```bash
/query::authenticated:users @prod | \
  /filter::active | \
  /map:emails | \
  /send::confirmed:notification
```

### Pipeline Execution Model

1. **Parse**: Split on `|`, parse each stage
2. **Validate**: Check contracts before execution
3. **Execute**: Run each stage sequentially
4. **Fail-fast**: Stop on first error
5. **Atomic cleanup**: On interrupt or error, move ALL artifacts to `/tmp/tetra/cancelled` or `/tmp/tetra/failed`

### Pipeline Artifact Tracking

Each pipeline execution:
- Gets unique ID: `pipeline-<timestamp>-<hash>`
- Tracks artifacts in manifest
- Writes audit log for each stage
- Provides atomic rollback on failure

## Alias System

Common actions can have short aliases:

| Alias | Full Action | Example |
|-------|-------------|---------|
| `/q` | `/query` | `/q:users` |
| `/s` | `/send` | `/s:message` |
| `/ls` | `/list` | `/ls:files` |
| `/rm` | `/delete` | `/rm::confirmed:files` |
| `/cp` | `/copy` | `/cp:config` |
| `/mv` | `/move` | `/mv:files` |

**User-defined aliases**:
```bash
# In $TETRA_DIR/actions.aliases:
/d=/deploy
/r=/restart
/m=/monitor
```

## Module Resolution

### Explicit Module

```bash
/org.deploy:config @prod
```

Module is specified before the action: `org.deploy`.

### Implicit Module (Context-Aware)

```bash
# In org REPL:
[org] > /deploy:config @prod

# Module "org" inferred from REPL context
```

### Resolution Algorithm

```bash
resolve_module() {
    local action="$1"

    if [[ "$action" == *.* ]]; then
        # Explicit: /module.action
        echo "${action%%.*}"
    elif [[ -n "$REPL_MODULE" ]]; then
        # From REPL context
        echo "$REPL_MODULE"
    else
        # Search action registry
        action_registry_lookup "$action"
    fi
}
```

## Integration with TES (Endpoints)

TAS actions execute AT TES endpoints:

```bash
/deploy:config @prod
     │           │
   TAS          TES
```

**Endpoint Types** (from TES Specification):
- `@local` - Your machine
- `@dev` - Development server
- `@staging` - Staging server
- `@prod` - Production server
- `@tube:name` - Terminal endpoint via tubes

**Progressive Resolution**:
TES handles resolving `@prod` → SSH connection → executable plan.

## Integration with TRS (Records)

TAS actions write TRS-compliant records:

```bash
/send:message @prod
```

**Creates** (in canonical location):
```bash
$TETRA_DIR/org/db/1760230000.message.sent.json
```

**Format**: `timestamp.type.kind.format` (module "org" implicit from path)

**If pipeline cancelled**, moves to non-canonical:
```bash
/tmp/tetra/cancelled/pipeline-456/1760230000.org.message.sent.json
```

**Format**: `timestamp.module.type.kind.format` (module now explicit)

## Action Registry

Actions are registered in `$TETRA_DIR/actions.registry`:

```
module.action:description:params:tes_capable
```

**Example**:
```
org.deploy.config:Deploy configuration to endpoint:<config-file>:yes
rag.query.ulm:Search codebase using ULM:<query> [path]:no
vox.speak.text:Convert text to speech:<text> [voice]:no
```

**Fields**:
- `module.action` - Fully qualified action name
- `description` - Human-readable description
- `params` - Parameter signature: `<required>` or `[optional]`
- `tes_capable` - `yes` if requires `@endpoint`, `no` otherwise

### Registering Actions

In module's `includes.sh`:

```bash
if [[ -f "$TETRA_SRC/bash/actions/registry.sh" ]]; then
    source "$TETRA_SRC/bash/actions/registry.sh"

    action_register "mymodule" "deploy.config" \
        "Deploy configuration to endpoint" \
        "<config-file>" \
        "yes"  # TES-capable

    action_register "mymodule" "validate" \
        "Validate module configuration" \
        "[--strict]" \
        "no"   # Local only
fi
```

## Action Implementation

### Naming Convention

Actions implement functions named: `module_action_impl` or `module_action`

```bash
# Handler for org.deploy.config
org_deploy_config_impl() {
    local endpoint="$1"      # @prod, @dev, etc.
    local config_file="$2"

    # Implementation here
    echo "Deploying $config_file to $endpoint..."

    # Write TRS-compliant artifact
    local result_path=$(trs_write "org" "deploy" "config" "json" "$result_data")

    echo "$result_path"
}
```

### Contract Validation

Actions can check contracts:

```bash
org_delete_database_impl() {
    local endpoint="$1"
    local database="$2"

    # Check if confirmed contract was validated
    if [[ "$CONFIRMED" != "true" ]]; then
        echo "Error: This action requires ::confirmed contract" >&2
        return 1
    fi

    # Proceed with deletion
    ...
}
```

Contracts are validated by the executor before calling the implementation.

## Audit Logging

Every TAS action automatically logs to `$TETRA_DIR/audit/db/`:

```bash
timestamp.action.log.json
```

**Log Format**:
```json
{
  "timestamp": 1760230000,
  "action": "/send:message",
  "endpoint": "@prod",
  "contracts": ["authenticated"],
  "user": "mricos",
  "module": "org",
  "pipeline_id": "pipeline-1760230000-abc123",
  "stage": 3,
  "result": "success",
  "artifacts": [
    "$TETRA_DIR/org/db/1760230000.message.sent.json"
  ],
  "duration_ms": 1234,
  "error": null
}
```

## Error Handling

### Fail-Fast Pipeline

```bash
/query:users | /filter::active | /send:message
```

**If stage 2 fails**:
1. Stop pipeline immediately
2. Move ALL artifacts (from stage 1 and 2) to `/tmp/tetra/failed/<pipeline-id>/`
3. Create `FAILED.json` manifest
4. Log error in audit trail
5. Return non-zero exit code

### Interrupt Handling (Ctrl-C)

**If user presses Ctrl-C during pipeline**:
1. Trap SIGINT/SIGTERM
2. Kill all background processes
3. Rollback open TTS transactions
4. Move ALL artifacts to `/tmp/tetra/cancelled/<pipeline-id>/`
5. Create `CANCELLED.json` manifest
6. Clean exit with code 130

### Atomic Cleanup

Pipelines are treated as **atomic operations**:
- Complete success: All artifacts stay in canonical locations
- Any failure/interrupt: ALL artifacts moved to non-canonical trash

## Soft Delete Pattern

Destructive actions never actually delete - they move to trash:

```bash
/delete:file
/rm:database
```

**Behavior**:
1. Move to `/tmp/tetra/removed/<timestamp>/`
2. Create `REMOVED.json` manifest with original path
3. Manual restoration available

**Example**:
```bash
/delete:old-config

# Creates:
/tmp/tetra/removed/1760230000/
├── 1760230000.org.config.old.json
└── REMOVED.json
```

**REMOVED.json**:
```json
{
  "original_path": "$TETRA_DIR/org/db/1760230000.config.old.json",
  "removed_at": "2025-11-02T10:30:00Z",
  "removed_by": "mricos",
  "action": "/delete:old-config",
  "can_restore": true
}
```

## REPL Integration

### TAS Detection

REPLs detect TAS syntax by `/` prefix:

```bash
# In bash/repl/core/loop.sh
if [[ "$input" == /* ]]; then
    if [[ "$input" == *\|* ]]; then
        # Pipeline
        pipeline_exec "$input"
    else
        # Single action
        tas_exec "$input"
    fi
fi
```

### Tab Completion

TAS provides rich tab completion:

```bash
[org] > /dep<TAB>
/deploy

[org] > /deploy:<TAB>
config  service  template

[org] > /deploy:config @<TAB>
@local  @dev  @staging  @prod

[org] > /send::<TAB>
::authenticated  ::confirmed  ::dryrun  ::logged
```

### Colored Output

TAS integrates with TDS (Tetra Design System) for semantic coloring:

- Module name: **Green** (nouns)
- Action name: **Red/Orange** (verbs)
- Contract: **Yellow** (modifiers)
- Endpoint prefix `@`: **Orange** (action marker)
- Endpoint name: **Magenta** (target location)
- Parameters: **Blue** (configuration)

## Examples

### Basic Usage

```bash
# Simple action
/list:files

# With endpoint
/deploy:config @staging

# With contract
/delete::confirmed:old-data

# Module-qualified
/org.validate:toml
```

### Pipeline Examples

```bash
# User management pipeline
/query:users | /filter::active | /map:emails | /send::authenticated:message @prod

# Data processing
/fetch:data @api | /transform | /validate | /store @database

# Deployment workflow
/build:app | /test::thorough | /package | /deploy::confirmed @prod

# Monitoring
/query::cached:metrics @monitoring | /filter::anomalies | /alert:team
```

### Contract Chaining

```bash
# Multiple contracts (processed left-to-right)
/deploy::validated::confirmed::logged:config @prod
```

**Execution order**:
1. Validate `::validated` - Check schema
2. Validate `::confirmed` - Prompt user
3. Validate `::logged` - Ensure audit enabled
4. Execute action
5. Write audit log

### Real-World Scenario

**Deploying configuration with full safety**:
```bash
# 1. Validate locally
/validate:config

# 2. Test on development
/deploy::dryrun:config @dev

# 3. Deploy to development
/deploy:config @dev

# 4. Deploy to production with confirmation
/deploy::confirmed::logged:config @prod
```

**Pipeline version**:
```bash
/validate:config | \
  /deploy::dryrun @dev | \
  /deploy @dev | \
  /deploy::confirmed::logged @prod
```

## Best Practices

### DO:
- ✓ Use contracts for safety (`::confirmed` for destructive ops)
- ✓ Use singular/plural nouns appropriately
- ✓ Chain contracts in logical order
- ✓ Use aliases for common operations
- ✓ Write TRS-compliant artifacts
- ✓ Log all significant actions

### DON'T:
- ✗ Mix TAS syntax with bash commands (stay semantic)
- ✗ Skip contracts on destructive operations
- ✗ Assume pipeline continues after error (fail-fast model)
- ✗ Delete files directly (use soft delete via `/rm`)
- ✗ Hard-code endpoints (use TES resolution)

## Future Extensions

### Potential Additions

**Conditional execution**:
```bash
/query:status ? /restart:service : /log:healthy
```

**Parallel execution**:
```bash
/deploy:frontend @prod & /deploy:backend @prod
```

**Variables**:
```bash
$users = /query:users
/send:message $users
```

**Async actions**:
```bash
/deploy::async:largefile @cdn
```

These are explorations, not part of v1.0 specification.

## See Also

- **TRS Specification** - Tetra Record Specification (how actions persist data)
- **TES Specification** - Tetra Endpoint Specification (where actions execute)
- **TETRA_TRINITY.md** - Integration guide for TES/TAS/TRS
- **bash/actions/** - TAS implementation
- **TDS Tokens** - Tetra Design System (semantic colors)

---

**Maintained by**: Tetra Core Team
**License**: MIT
**Feedback**: tetra-specs@anthropic.com
