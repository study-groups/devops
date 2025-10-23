# Instructions: Create docs/CORE_SPECIFICATION.md

**Copy this entire file into a new Claude Code chat to create the fourth and final core document.**

---

## Context

You are creating `docs/CORE_SPECIFICATION.md` - the technical reference for Tetra Core Specification (TCS 4.0). This is THE TECHNICAL REFERENCE document for Tetra architects and core contributors.

## Key Insight: TCS is the Technical Foundation

TCS 4.0 is the technical specification that defines:
- **Operators**: The symbols that compose Tetra's command language (`.`, `:`, `::`, `→`, `@`, `×`)
- **Environment × Mode**: The context algebra that determines which actions are available
- **Type Contracts**: How actions declare their inputs, outputs, and effects
- **Logging Standard**: Unified JSON logging across all modules
- **Transaction System**: State management with TTS (Tetra Transaction Standard)
- **Symbol Taxonomy**: Complete taxonomy of Tetra's symbol systems

This is a **technical specification**, not a user guide. Target audience: Contributors, architects, and module developers who need the precise technical details.

## Background

**TCS = Tetra Core Specification**
- The technical foundation for all of Tetra
- Defines operators, semantics, and contracts
- Version 4.0 represents the current standard
- All modules MUST comply with TCS 4.0

**Key Relationships**:
- TES (Tetra Endpoint Specification) builds ON TCS (uses the operators defined here)
- Module Actions use TCS operators to declare their contracts
- TDS (Tetra Display System) uses TCS context algebra for rendering

**Integration**:
```bash
# TCS defines the operators
module.action :: Input → Output       # Type contract operator (::)
Environment × Mode → Actions          # Context algebra (×)

# TES uses TCS operators to define endpoints
@staging → Connector → Plan           # Flow operator (→) and route operator (@)

# Actions declared with TCS type contracts
org push:config :: (@endpoint, file:path) → Result
  where Effect[ssh, log, audit]
```

## Key Files to Reference

**Core Specifications**:
- `docs/TCS_4.0_LOGGING_STANDARD.md` - Complete logging spec (merge into this doc)
- `docs/TTS_TETRA_TRANSACTION_STANDARD.md` - Transaction system (merge into this doc)
- `docs/Tetra_Core_Specification.md` - Current TCS 3.0 (upgrade to 4.0)
- `docs/theory/symbols.md` - Symbol system analysis

**Example Implementations**:
- `bash/boot/boot_modules.sh` - See all 40+ modules
- `bash/tsm/actions.sh` - Example action declarations
- `bash/org/actions.sh` - Example TES integration
- `bash/utils/unified_log.sh` - Logging implementation

**Related Docs**:
- `docs/TES_SSH_Extension.md` - Shows how TES extends TCS
- `bash/tsm/TSM_SPECIFICATION.md` - Example of module-specific spec

## Document Requirements

**File**: `docs/CORE_SPECIFICATION.md`

**Audience**: Tetra architects, core contributors, module developers

**Length**: ~600-800 lines (comprehensive technical reference)

**Sections**:

### 1. Header & Overview (30-50 lines)
```markdown
# Tetra Core Specification (TCS) 4.0

**Version**: 4.0
**Status**: Technical Reference
**Date**: 2025-10-23

## Overview

TCS 4.0 defines the foundational technical concepts for the Tetra ecosystem. This specification serves as the single source of truth for:
- Operator semantics
- Environment × Mode context algebra
- Type contract system
- Unified logging standard (JSON)
- Transaction system (TTS)
- Symbol taxonomy
```

Explain:
- What TCS 4.0 is (technical foundation)
- Who it's for (architects, contributors)
- What it covers (operators through transactions)

### 2. Version History & Changelog (30-40 lines)

Show the evolution:
- **4.0** (2025-10-23): Consolidated logging, TTS, operator semantics
  - Merged TCS 4.0 Logging Standard
  - Merged TTS (Tetra Transaction Standard)
  - Elevated `::` operator to central position
  - Formalized Environment × Mode algebra
  - Added symbol taxonomy from theory/symbols.md

- **3.0** (2025-10-13): Initial consolidation
  - Module database pattern
  - Progressive resolution framework
  - TQL (Tetra Query Language)

- **2.x**: TES SSH Extension era
- **1.x**: Early prototypes

### 3. Operator Hierarchy & Semantics (120-150 lines)

This is the CORE of TCS. Define each operator precisely:

#### 3.1 The Six Core Operators

**Module Namespace (`.`)**
- Syntax: `module.verb`
- Semantics: Verb extracted from module namespace
- Examples: `tsm.start`, `org.compile`, `vox.play`
- Technical: Fully qualified action name

**Verb-Noun Pairing (`:`)**
- Syntax: `verb:noun`
- Semantics: Action paired with target
- Examples: `push:config`, `start:service`, `rekey:keys`
- Technical: Colon separates action verb from target noun

**Type Contract (`::`)**
- Syntax: `action :: Input* → Output+ where Effect*`
- Semantics: Type signature with effects
- Examples:
  ```bash
  tsm.start :: (command:string, port:int?) → Process[pid]
    where Effect[fork, log]

  org.push:config :: (@endpoint, file:path) → Result
    where Effect[ssh, log, audit]
  ```
- Technical: Haskell-inspired type annotation

**Data Flow (`→`)**
- Syntax: `source → target`
- Semantics: Data movement direction
- Examples: `@local → @dev`, `stdin → @file`, `Connector → Plan`
- Technical: Represents transformation or transmission

**Resource Addressing (`@`)**
- Syntax: `@symbol:key.variant`
- Semantics: Address a resource by symbol
- Examples: `@local`, `@staging`, `@vox:1760229927.sally`
- Technical: Route operator for TES resolution

**Context Composition (`×`)**
- Syntax: `Environment × Mode`
- Semantics: Cartesian product of context dimensions
- Examples: `Local × [tsm, org]`, `Staging × [deploy]`
- Technical: Context algebra for action filtering

#### 3.2 Operator Precedence

Define how operators compose:
```
Highest precedence:
  @symbol (resource addressing)
  module.verb (namespace qualification)

Medium precedence:
  verb:noun (pairing)
  :: (type contract)

Lowest precedence:
  → (flow)
  × (composition)
```

#### 3.3 Operator Composition

Show how operators combine:
```bash
# Full composition
Environment × Mode → Set[module.verb :: Input → Output]

# Example
Local × [tsm] → {tsm.start :: (cmd:string) → Process}
```

### 4. Environment × Mode Context System (100-120 lines)

#### 4.1 The Five Environments (Immutable)

Define each precisely:

| Environment | Symbol | Purpose | Characteristics |
|-------------|--------|---------|----------------|
| **HELP** | N/A | Meta-environment | Documentation, tutorials, no execution |
| **Local** | `@local` | Developer machine | Offline, full access, no remote deps |
| **Dev** | `@dev` | Development server | Full access, testing, experimentation |
| **Staging** | `@staging` | Pre-production | Read-heavy, controlled writes, validation |
| **Production** | `@prod` | Live systems | Read-only default, all writes audited |

**Key Principle**: These five are **immutable**. They define the Tetra worldview.

#### 4.2 Mode as Module List

**Definition**: Mode is NOT an enum. Mode = List[Module] (active modules).

```bash
Mode = List[Module]

Examples:
  Mode = [tsm, org]              # Process management + org tools
  Mode = [deploy, tkm]           # Deployment + key management
  Mode = [vox, qa, rag]          # Audio + Q&A + context
```

#### 4.3 Context Algebra

**Definition**: `Context = Environment × Mode`

**Functor**: `F: (Environment, Mode) ↦ Set[FullyQualifiedAction]`

```bash
# Examples of the functor:
F(Local, [tsm]) = {
  tsm.start, tsm.stop, tsm.list, tsm.logs, tsm.repl
}

F(Dev, [org]) = {
  org.compile:toml, org.push:config, org.pull:config
}

F(Staging, [deploy]) = {
  deploy.status, deploy.rollback  # Note: deploy.push filtered out
}

F(Production, [deploy]) = {
  deploy.status  # Only read-only actions
}
```

**Context Filtering**: Actions are filtered by Environment × Mode context. Each action declares which contexts it's valid in.

#### 4.4 Environment Properties

For each environment, document:
- Network access (yes/no/conditional)
- Write permissions (full/controlled/read-only)
- Audit requirements (none/log/approval)
- Rollback capabilities (automatic/manual/none)

### 5. Type Contract System (100-130 lines)

#### 5.1 Contract Syntax

Every action MUST declare its contract:

```bash
module.verb :: Input* → Output+ where Effect*
```

**Components**:
- **Input***: Zero or more typed inputs
- **Output+**: One or more outputs with routing
- **Effect***: Zero or more side effects

#### 5.2 Type Syntax Reference

**Primitive Types**:
- `string`, `int`, `number`, `boolean`
- `path`, `host`, `port`, `semver`
- `seconds`, `milliseconds`

**Optional Parameters**:
```bash
parameter:type?          # Question mark = optional
[parameter:type]         # Square brackets = optional
```

**Output Routing**:
```bash
@channel:tag             # Output destination with semantic tag
Type[channel]            # Typed output to channel
[@resource]              # Array of resources
{key: value}             # Object/map
```

**Effects**:
```bash
where Effect[effect1, effect2, ...]
```

Effect types:
- `read`: Read-only operation
- `write`: Modifies state
- `fork`: Creates child process
- `ssh`: Remote execution
- `sudo`: Requires elevated privileges
- `api_call`: External API request
- `cache`: Uses cache
- `log`: Writes to log
- `audit`: Requires audit trail
- `network`: Network operation

#### 5.3 Complete Examples

Provide 10-15 realistic examples from different modules:

**TSM (Process Manager)**:
```bash
tsm.start :: (command:string, port:int?, name:string?) → Process[pid]
  where Effect[fork, log, write]

tsm.stop :: (name:string) → Result
  where Effect[kill, log, write]

tsm.logs :: (name:string, follow:boolean?) → Text[stdout]
  where Effect[read]
```

**Org (Organization Management)**:
```bash
org.compile:toml :: (org:string) → @file:toml
  where Effect[read, write, log]

org.push:config :: (@endpoint, file:path) → Result
  where Effect[ssh, write, log, audit]

org.pull:config :: (@endpoint, file:path) → @file:local
  where Effect[ssh, read, log]
```

**VOX (Audio)**:
```bash
vox.play :: (@qa:timestamp, voice:string) → Audio[stdout]
  where Effect[cache, read]

vox.generate :: (voice:string, text:stdin) → @vox:timestamp.voice.mp3
  where Effect[api_call, cache, write, log]
```

### 6. Unified Logging Standard (TCS 4.0) (120-150 lines)

**Merge content from `docs/TCS_4.0_LOGGING_STANDARD.md`**

#### 6.1 Core Principles

1. **Single Source of Truth**: All modules log to `$TETRA_DIR/logs/tetra.jsonl`
2. **Structured Data**: JSON format enables programmatic analysis
3. **Log Levels**: DEBUG, INFO, WARN, ERROR for filtering
4. **Console Integration**: Optional colored console output
5. **Backward Compatible**: Existing logs preserved during migration

#### 6.2 Log Entry Structure

```json
{
  "timestamp": "2025-10-23T12:34:56Z",
  "module": "tsm",
  "verb": "start",
  "subject": "devpages-3000",
  "status": "success",
  "level": "INFO",
  "exec_at": "@local",
  "metadata": {"pid": 1234, "port": 3000}
}
```

**Required Fields**:
- `timestamp`: ISO 8601 UTC timestamp
- `module`: Module name (lowercase)
- `verb`: Action being performed
- `subject`: Target of the action
- `status`: Outcome (`try`, `success`, `fail`, `event`, `warn`, `error`, `debug`)
- `level`: Log level (`DEBUG`, `INFO`, `WARN`, `ERROR`)
- `exec_at`: Execution location (`@local`, `@remote`, hostname)
- `metadata`: Additional context (JSON object)

#### 6.3 API Functions

```bash
# Core logging function
tetra_log_event <module> <verb> <subject> <status> [metadata_json] [level]

# Convenience functions
tetra_log_try <module> <verb> <subject> [metadata]
tetra_log_success <module> <verb> <subject> [metadata]
tetra_log_fail <module> <verb> <subject> [metadata]
```

#### 6.4 Module Integration Pattern

Show the standard pattern:
1. Create `<module>/<module>_log.sh` wrapper
2. Source wrapper in module
3. Add logging calls to all operations
4. Use try/success/fail pattern

#### 6.5 Query Functions

Document all query functions:
- `tetra_log_query_module <module>`
- `tetra_log_query_status <status>`
- `tetra_log_query_errors`
- `tetra_log_stats`

### 7. Transaction System (TTS) (100-120 lines)

**Merge content from `docs/TTS_TETRA_TRANSACTION_STANDARD.md`**

#### 7.1 Overview

TTS is a file-based transaction standard for stateful operations:
- **Flat file structure** (no database)
- **Human-readable state** (JSON + NDJSON)
- **Slug-based IDs** (descriptive + timestamp)
- **Active symlink pattern** (one active transaction)
- **Simple FSM** (clear stage transitions)

#### 7.2 Transaction Directory Structure

```
~/.tetra/{module}/txns/
├── active -> {txn_id}/           # Symlink to active transaction
├── {txn_id}/                     # Transaction directory
│   ├── state.json               # Current state (FSM stage, metadata)
│   ├── events.ndjson            # Append-only event log
│   ├── ctx/                     # Context/evidence (numbered files)
│   │   ├── 000_policy.md       # Default policy/constraints
│   │   ├── 010_request.md      # Original request
│   │   └── 100_evidence1.md    # Added evidence
│   ├── build/                   # Intermediate build artifacts
│   └── artifacts/               # Final output artifacts
```

#### 7.3 Transaction ID Format

```bash
# Format: {slug}-{timestamp}
# Example: deploy-to-staging-20251023T143022
```

#### 7.4 Transaction Lifecycle (FSM)

```
NEW → SELECT → ASSEMBLE → EXECUTE → VALIDATE → DONE
                                              ↘ FAIL
```

Define each stage precisely.

#### 7.5 Core API Functions

```bash
txn_create(description, target, agent)      # Create transaction
txn_transition(txn_id, new_stage)           # Transition stage
txn_commit(txn_id)                          # Mark complete
txn_fail(txn_id, error_msg)                 # Mark failed
```

#### 7.6 Integration with TES

Show how TTS uses TES resolution in ASSEMBLE stage:

```bash
txn_resolve_tes() {
    local txn_id="$1"
    local target=$(jq -r '.target' "$(txn_dir "$txn_id")/state.json")

    # Resolve via TES
    local plan=$(tes_resolve "$target" "plan")

    # Store in state
    txn_update "$txn_id" "{\"tes_plan\":\"$plan\"}"
}
```

### 8. Symbol Taxonomy (80-100 lines)

**Merge content from `docs/theory/symbols.md`**

Provide complete taxonomy of Tetra symbols:

#### 8.1 Three-Context Symbol Framework

**Context 1: Environment-Module Instantiation**
- `:` = "environment contains module" (`prod:deploy`)
- `/` = "verb extracted from module" (`deploy/rollback`)
- `×` = "cartesian product" (`Environment × Mode`)

**Context 2: Runtime Parameter Resolution**
- `#` = "runtime hash lookup" (`#gateway`)
- `$` = "variable substitution" (`$timeout`)
- `?` = "to be answered at runtime" (`?retries`)

**Context 3: Response Classification and Routing**
- `@` = "at this output destination" (`@out`)
- `:` = "tagged as/classified as" (`:health`)
- `/` = "routed to filesystem path" (`/backup`)

#### 8.2 Complete Symbol Mapping Table

Provide the comprehensive table from symbols.md showing all symbols across all three contexts.

#### 8.3 Recommended Syntax

Show the canonical syntax choices:
```bash
# Environment:Module/Verb pattern
prod:deploy/rollback version:semver $target:env → @file:backup/daily

# Parameter resolution
deploy/start #version $replicas=3

# Output specification
@out:health/status
@file:config/prod
```

### 9. Module Database Pattern (60-80 lines)

Every module MUST follow this:

#### 9.1 Standard Directory Structure

```
$TETRA_SRC/bash/<module>/
├── <module>.sh           # Core entry point
├── <module>_paths.sh     # Path construction
├── <module>_core.sh      # Business logic
├── actions.sh            # Action declarations
├── includes.sh           # Module loader
└── README.md             # Module documentation

$TETRA_DIR/<module>/
├── db/                   # Primary key database (REQUIRED)
│   └── {timestamp}.ext   # Timestamp-based files
├── config/               # Module configuration
├── logs/                 # Module-specific logs
└── cache/                # Optional cache
```

#### 9.2 Primary Key Convention

**Rule**: Unix timestamp as primary key (1-second resolution)

Format: `{timestamp}.{extension}`

Examples:
```bash
1760229927.answer        # QA module
1760229927.vox.sally.mp3 # VOX module
1760229927.chunk         # RAG module
```

#### 9.3 Required Path Functions

Every module MUST implement:
```bash
mod_get_db_dir()
mod_generate_timestamp()
mod_get_db_path(timestamp, extension)
```

### 10. Extension Model (40-60 lines)

#### 10.1 Core vs Extensions

**TCS 4.0** (this document) defines:
- Core operators
- Environment × Mode
- Type contracts
- Logging
- Transactions

**Extensions** build on TCS:
- TES (Tetra Endpoint Specification) - foundational nouns
- TES SSH Extension - SSH deployment
- TES Storage Extension - cloud storage
- Future: TES Kubernetes Extension, etc.

#### 10.2 Extension Requirements

Any extension MUST:
1. Reference TCS 4.0 explicitly
2. Use TCS operators consistently
3. Follow module database pattern
4. Declare type contracts with `::`
5. Use unified logging

### 11. Compliance Checklist (30-40 lines)

A module is TCS 4.0 compliant when:

✅ **Structure**: Follows `$TETRA_DIR/<module>/db/` pattern
✅ **Primary Keys**: Uses timestamp-based filenames
✅ **Path Functions**: Implements required path functions
✅ **Type Contracts**: Declares all actions with `::` operator
✅ **Logging**: Uses `tetra_log_*()` for all operations
✅ **Operators**: Uses TCS operators correctly
✅ **Documentation**: Has README.md referencing TCS 4.0

### 12. Reference Tables (40-60 lines)

#### 12.1 Operator Quick Reference

```
.  = module namespace (tsm.start)
:  = verb-noun pair (push:config)
:: = type contract (ACTION :: Input → Output)
→  = data flow (@local → @dev)
@  = resource address (@staging)
×  = context composition (Environment × Mode)
```

#### 12.2 Environments

```
HELP, Local, Dev, Staging, Production (immutable)
@local, @dev, @staging, @prod
```

#### 12.3 Status Values

```
try     - Operation starting
success - Operation succeeded
fail    - Operation failed
event   - Informational event
```

#### 12.4 Log Levels

```
DEBUG (0) - Detailed debugging
INFO (1)  - Normal operations
WARN (2)  - Warning conditions
ERROR (3) - Error conditions
```

### 13. Appendix: Migration Guide (40-50 lines)

Guide for upgrading from TCS 3.0 to TCS 4.0:

**What Changed**:
- Consolidated logging standard (was separate doc)
- Added TTS transaction system
- Formalized symbol taxonomy
- Enhanced type contract syntax
- Clarified Environment × Mode algebra

**Migration Steps**:
1. Review new logging API (unified functions)
2. Adopt TTS for stateful operations (optional)
3. Update type contracts to include effects
4. Follow symbol taxonomy for new features
5. Update module README to reference TCS 4.0

## Writing Guidelines

1. **Be precise**: This is a specification - accuracy matters
2. **Be technical**: Target audience is contributors/architects
3. **Show examples**: Provide realistic code samples
4. **Cross-reference**: Link to TES.md, DEVELOPER_GUIDE.md
5. **Be complete**: Cover all aspects of TCS 4.0
6. **Use tables**: For quick reference
7. **Include diagrams**: ASCII art for FSMs, flows

## Tone

- Technical and authoritative (this is THE spec)
- Precise and unambiguous (legal document style)
- Practical with examples (show don't just tell)
- Comprehensive (cover all details)

## Create the File

Create `docs/CORE_SPECIFICATION.md` as the complete technical reference for TCS 4.0. This document should be THE reference for Tetra architects and core contributors.

**After completion**: This becomes the technical foundation - all other docs reference this.
