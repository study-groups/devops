# Tetra Core Specification (TCS)

**Version:** 3.0
**Date:** 2025-10-13
**Status:** Canonical Reference

---

## Related Documentation
- [TES SSH Extension](TES_SSH_Extension.md) - SSH deployment specifics
- [TES Storage Extension](TES_Storage_Extension.md) - Cloud storage integration
- [Module Convention](Tetra_Module_Convention.md) - Module integration patterns
- [Theory: Symbols](theory/symbols.md) - Symbol system details
- [Theory: Types](theory/types.md) - Type signature system

---

## Abstract

The Tetra Core Specification defines the foundational concepts, operators, and patterns that all tetra modules must follow. This specification serves as the single source of truth for:
- Operator semantics
- Environment and Mode definitions
- Symbol taxonomy
- Module database patterns
- Type contracts
- Unified logging

---

## 1. Operator Hierarchy

### 1.1 Core Operators

| Symbol | Name        | Purpose              | Example                        |
|--------|-------------|----------------------|--------------------------------|
| `.`    | DOT_SEP     | Module namespace     | `tkm.rekey`, `vox.play`        |
| `:`    | PAIR_SEP    | Verb-noun pairing    | `rekey:keys`, `play:audio`     |
| `::`   | ENDPOINT_OP | Type contract        | `ACTION :: Input → Output`     |
| `→`    | FLOW_OP     | Data flow            | `@local → @dev`                |
| `@`    | ROUTE_OP    | Resource addressing  | `@vox:1760229927.sally`        |
| `×`    | CROSS_OP    | Context composition  | `Environment × Mode`           |

### 1.2 Operator Semantics

**Module Namespace (`.`)**
```bash
module.verb          # Fully qualified action name
vox.play            # play verb from vox module
qa.query            # query verb from qa module
```

**Verb-Noun Pairing (`:`)**
```bash
verb:noun           # Action with specific target
play:audio          # play action on audio noun
rekey:keys          # rekey action on keys noun
```

**Type Contract (`::`)**
```bash
action :: Input* → Output+ where Effect*

vox.play :: (@qa:timestamp, voice:string) → Audio[stdout]
  where Effect[cache, log]
```

**Data Flow (`→`)**
```bash
source → target     # Data movement direction
@local → @dev       # Local file to dev environment
stdin → @file       # Standard input to file
```

**Resource Addressing (`@`)**
```bash
@symbol:key.variant         # Module resource
@vox:1760229927.sally       # Specific vox audio file
@qa:0                       # Latest QA answer (relative)
@spaces:bucket:path         # Cloud storage resource
```

**Context Composition (`×`)**
```bash
Environment × Mode → Set[Action]

Local × [vox, qa] = {vox.play, vox.list, qa.query, qa.answer}
```

---

## 2. Environment Definition

### 2.1 The Five Environments (Immutable)

| Environment | Purpose | Characteristics |
|-------------|---------|----------------|
| **HELP** | Meta-environment | Documentation, tutorials, explanations |
| **Local** | Developer machine | Offline operations, no network required |
| **Dev** | Development server | Full access, testing, experimentation |
| **Staging** | Pre-production | Read-heavy, controlled writes |
| **Production** | Live systems | Read-only (except emergency), audit all writes |

**Key Principle**: These five environments are **immutable** - they define the tetra worldview and cannot be changed.

### 2.2 Environment Symbols

```bash
@local       # Local development machine
@dev         # Development server
@staging     # Staging/QA environment
@prod        # Production environment
@{context}   # Dynamic substitution to current environment
```

---

## 3. Mode Definition

### 3.1 Mode as Module List

**Definition**: Mode is a **list of active modules** in the current context, NOT an enum.

```bash
Mode = List[Module]

Examples:
  Mode = [vox, qa]              # Audio and Q&A tools active
  Mode = [deploy, tkm]          # Deployment and key management
  Mode = [watchdog]             # Monitoring only
  Mode = [vox, qa, rag, deploy] # Full development suite
```

### 3.2 Context Algebra

```bash
Context = Environment × Mode
        = Environment × List[Module]
```

### 3.3 Functor: Context → Actions

```bash
F: (Environment, Mode) ↦ Set[FullyQualifiedAction]

# Examples:
F(Local, [vox, qa]) = {
  qa.query, qa.answer, qa.search,
  vox.play, vox.generate, vox.list
}

F(Dev, [deploy]) = {
  deploy.push, deploy.status, deploy.rollback
}

F(Staging, [watchdog]) = {
  watchdog.monitor, watchdog.trace
}
```

**Key Insight**: The functor maps each (Environment, Mode) pair to the set of actions that make sense in that context.

---

## 4. Symbol Taxonomy

### 4.1 Environment Symbols

```bash
@local, @dev, @staging, @prod       # Fixed environments
@{context}                          # Resolves to current environment
```

### 4.2 Module Symbols

```bash
# Pattern: @module:primary_key.variant
@module:key.variant

# Examples:
@vox:1760229927.sally      # VOX audio file (timestamp.voice)
@qa:1760229927             # QA answer by timestamp
@qa:0                      # QA answer by relative index (latest)
@rag:1760229927.chunk      # RAG chunk by timestamp
```

### 4.3 Storage Symbols

```bash
# Pattern: @storage:bucket:path
@spaces:pja-games:games/
@s3:backups:db/2025-10/
```

### 4.4 Symbol Resolution

**Module Symbol Resolution**:
```
@vox:1760229927.sally
  ↓
module = vox
primary_key = 1760229927
variant = sally
  ↓
Locator = $VOX_DIR/db/1760229927.vox.sally.mp3
  ↓
Handle = file exists, readable ✓
  ↓
Binding = read(Locator) + metadata
```

---

## 5. Module Database Pattern

### 5.1 Standard Directory Structure

Every tetra module MUST follow this structure:

```
$TETRA_SRC/bash/<module>/
├── <module>.sh           # Core entry point
├── <module>_paths.sh     # Path construction functions
├── <module>_core.sh      # Business logic
├── includes.sh           # Module loader
└── README.md             # Module documentation

$TETRA_DIR/<module>/
├── db/                   # Primary key database (REQUIRED)
│   └── {timestamp}.ext   # Timestamp-based files
├── config/               # Module configuration
├── logs/                 # Module-specific logs
└── cache/                # Optional content-addressed cache
```

### 5.2 Primary Key Convention

**Rule**: All database files use Unix timestamp as primary key (1-second resolution).

**Format**: `{timestamp}.{extension}`

**Examples**:
```bash
# QA module
1760229927.answer
1760229927.prompt
1760229927.response

# VOX module
1760229927.vox.sally.mp3
1760229927.vox.sally.meta
1760229927.vox.sally.spans

# RAG module
1760229927.chunk
1760229927.index
```

**Guarantee**: No collisions - operations never start faster than 1-second intervals.

### 5.3 Required Path Functions

Every module MUST implement these functions:

```bash
# Module source (strong global)
: "${MOD_SRC:=$TETRA_SRC/bash/<module>}"

# Module runtime directory
: "${MOD_DIR:=$TETRA_DIR/<module>}"

# Database directory
mod_get_db_dir() {
    echo "$MOD_DIR/db"
}

# Timestamp generation
mod_generate_timestamp() {
    date +%s
}

# Timestamped path construction
mod_get_db_path() {
    local timestamp="$1"
    local extension="$2"
    echo "$(mod_get_db_dir)/${timestamp}.${extension}"
}
```

**Example Implementation (VOX)**:
```bash
: "${VOX_SRC:=$TETRA_SRC/bash/vox}"
: "${VOX_DIR:=$TETRA_DIR/vox}"

vox_get_db_dir() {
    echo "$VOX_DIR/db"
}

vox_get_db_audio_path() {
    local timestamp="$1"
    local voice="$2"
    echo "$(vox_get_db_dir)/${timestamp}.vox.${voice}.mp3"
}

vox_generate_timestamp() {
    date +%s
}
```

---

## 6. Type Contracts with `::`

### 6.1 Contract Syntax

Every action MUST declare its type contract using the `::` operator:

```bash
module.verb :: Input* → Output+ where Effect*
```

**Components**:
- **Input***: Zero or more typed inputs
- **Output+**: One or more outputs with routing
- **Effect***: Zero or more side effects

### 6.2 Examples

**VOX Module**:
```bash
vox.play :: (@qa:timestamp, voice:string) → Audio[stdout]
  where Effect[cache, log]

vox.generate :: (voice:string, text:stdin) → @vox:timestamp.voice.mp3
  where Effect[cache, log, metadata]

vox.list :: ([filter:string]) → Text[stdout]
  where Effect[read]

vox.sync :: (@vox:*.mp3 → @spaces:vox-audio/*.mp3)
  where Effect[network, log]
```

**QA Module**:
```bash
qa.query :: (question:string) → @qa:timestamp.answer
  where Effect[api_call, log, cache]

qa.answer :: (index:int) → Text[stdout]
  where Effect[read]

qa.search :: (term:string) → [@qa:timestamp]
  where Effect[read, cache]
```

**Deploy Module**:
```bash
deploy.push :: (@local:src/* → @{env}:/var/www/*)
  where Effect[ssh, sudo, log, audit]

deploy.rollback :: (steps:int) → @file:backup
  where Effect[ssh, sudo, log]

deploy.status :: () → @out:info
  where Effect[ssh, read]
```

### 6.3 Type Syntax

**Primitive Types**:
- `string`, `int`, `number`, `boolean`
- `path`, `host`, `port`, `semver`
- `seconds`, `milliseconds`

**Optional Parameters**:
```bash
[parameter:type]        # Square brackets = optional
```

**Output Routing**:
```bash
@channel:tag            # Output destination with semantic tag
Audio[stdout]           # Typed output to stdout
@file:backup            # File output with tag
[@resource]             # Array of resources
```

**Effects**:
```bash
where Effect[read]              # Read-only operation
where Effect[write, log]        # Write with logging
where Effect[api_call, cache]   # External API with caching
where Effect[ssh, sudo, audit]  # Remote privileged with audit
```

---

## 7. Unified Logging

### 7.1 Single Log File

**Location**: `$TETRA_DIR/logs/tetra.jsonl`

**Format**: JSON Lines (one action per line)

```json
{
  "timestamp": "2025-10-13T14:23:45Z",
  "module": "vox",
  "verb": "play",
  "subject": "qa:1760229927",
  "status": "success",
  "exec_at": "@local",
  "metadata": {"duration_ms": 234, "voice": "sally"}
}
```

### 7.2 Logging Function

All modules MUST use this function:

```bash
tetra_log <module> <verb> <subject> <status> [metadata_json]

# Examples:
tetra_log vox play "qa:1760229927" try '{}'
tetra_log vox play "qa:1760229927" success '{"duration_ms":234,"voice":"sally"}'
tetra_log qa query "what is bash" success '{"chars":1024,"cost":0.015}'
tetra_log deploy push "staging" fail '{"error":"SSH timeout"}'
```

### 7.3 Status Types

| Status | Meaning | Use |
|--------|---------|-----|
| `try` | Action initiated | Start of operation |
| `success` | Completed successfully | Operation finished |
| `fail` | Operation failed | Error occurred |
| `event` | Non-try/fail event | Health checks, metrics |

---

## 8. Cross-Module Integration

### 8.1 Module References

Modules can reference each other's databases using symbol syntax:

```bash
# VOX can process QA answers
qa a 0 | vox play sally

# Equivalent with symbols:
vox play @qa:0 sally

# But audio gets stored in VOX_DIR/db with QA timestamp
# → Generates: $VOX_DIR/db/1760229927.vox.sally.mp3
```

### 8.2 Timestamp Preservation

**Rule**: When processing content from another module, preserve the original timestamp as primary key.

```bash
# QA generates answer
qa.query "question"
# → Creates: $QA_DIR/db/1760229927.answer

# VOX processes QA answer
vox play @qa:1760229927 sally
# → Creates: $VOX_DIR/db/1760229927.vox.sally.mp3
#            (same timestamp!)

# RAG processes VOX audio
rag chunk @vox:1760229927.sally
# → Creates: $RAG_DIR/db/1760229927.chunk
#            (same timestamp preserved!)
```

**Benefit**: Enables correlation across modules by timestamp.

### 8.3 Multi-Module Queries

```bash
# Find all resources related to timestamp 1760229927
find $TETRA_DIR -name "1760229927.*"

# Output:
# ~/tetra/qa/db/1760229927.answer
# ~/tetra/vox/db/1760229927.vox.sally.mp3
# ~/tetra/vox/db/1760229927.vox.sally.meta
# ~/tetra/rag/db/1760229927.chunk
```

---

## 9. Tetra Query Language (TQL)

### 9.1 Overview

TQL provides a Prometheus-inspired query language for searching and filtering resources across module databases. It supports two query syntaxes:

1. **Collection Queries** - Get all files for a module/id combination
2. **Filtered Queries** - Apply rich filters with label matchers

### 9.2 Collection Query Syntax

**Pattern**: `[@env]:module:id`

**Purpose**: Return all file types for a specific module and ID.

```bash
# Get all QA files for timestamp
@dev:qa:1760229927

# Returns:
1760229927.qa.answer
1760229927.qa.prompt
1760229927.qa.metadata

# Get all VOX files for timestamp (local implied)
vox:1760229927

# Returns:
1760229927.vox.sally.mp3
1760229927.vox.sally.meta
1760229927.vox.sally.spans
```

### 9.3 Filtered Query Syntax

**Pattern**: `[@env].module.{filter}.type`

**Purpose**: Apply complex filtering with wildcards or label matchers.

```bash
# Pattern-based filter (wildcards)
vox.176022*.sally

# Label-based filter (Prometheus-style)
@dev.vox.{ts>1760229000,voice="sally"}.mp3

# Complex filter (multiple conditions)
@local.qa.{ts>1760229000,ts<1760230000,text_len>1000}.answer
```

### 9.4 Filter Operators

TQL supports Prometheus-inspired label matchers:

| Operator | Meaning | Example |
|----------|---------|---------|
| `=` | Exact match | `{voice="sally"}` |
| `!=` | Not equal | `{voice!="echo"}` |
| `=~` | Regex match | `{voice=~"sal.*"}` |
| `!~` | Regex not match | `{voice!~"echo\|fable"}` |
| `>` | Greater than | `{ts>1760229000}` |
| `<` | Less than | `{duration<5000}` |
| `>=` | Greater or equal | `{size>=50000}` |
| `<=` | Less or equal | `{ts<=1760230000}` |

### 9.5 Label Types

**Built-in Labels** (from filename):
```bash
ts        # Unix timestamp
module    # Module name (vox, qa, rag, etc.)
variant   # Variant/voice name
ext       # File extension
```

**Filesystem Labels**:
```bash
size      # File size in bytes
mtime     # Modification time (Unix timestamp)
```

**Metadata Labels** (from .meta JSON):
```bash
duration  # Duration in milliseconds
voice     # Voice name
model     # AI model used
hash      # Content hash
created   # Creation timestamp
text_len  # Text length
[custom]  # Any top-level JSON field
```

### 9.6 Query Examples

**Time-Range Queries**:
```bash
# All VOX audio from last hour
@local.vox.{ts>$(($(date +%s) - 3600))}.*.mp3

# QA answers in timestamp range
@dev.qa.{ts>1760229000,ts<1760230000}.answer
```

**Size and Duration Filters**:
```bash
# Large audio files
@local.vox.{size>50000}.sally.mp3

# Long audio clips
@local.vox.{duration>5000}.*.mp3
```

**Voice and Model Filters**:
```bash
# Specific voice
@local.vox.{voice="sally"}.mp3

# Specific AI model
@local.vox.{model="tts-1-hd"}.*.mp3

# Multiple voices (regex)
@local.vox.{voice=~"sally|nova"}.mp3
```

**Cross-Module Correlation**:
```bash
# Find all modules with this timestamp
@local:*:1760229927

# Returns files from all modules:
1760229927.qa.answer
1760229927.vox.sally.mp3
1760229927.rag.chunk
```

### 9.7 Implementation

TQL is implemented via four bash modules:

```bash
$TETRA_SRC/bash/
├── tetra_query_parser.sh      # Parse TQL syntax
├── tetra_query_compiler.sh    # Compile filters to bash tests
├── tetra_query_labels.sh      # Extract labels from files
└── tetra_query_exec.sh        # Execute queries
```

**Usage**:
```bash
# Execute query
tetra_query_exec.sh query "@dev.vox.{ts>1760229000}.sally.mp3"

# Count results
tetra_query_exec.sh count "vox:*"

# Format output
tetra_query_exec.sh format "vox.176022*.sally" table
```

### 9.8 Type Contracts with TQL

Actions can use TQL syntax in their signatures:

```bash
# Query action
tetra.query :: (tql_query:string) → [@resource]
  where Effect[read]

# VOX play with TQL
vox.play :: (tql_query:string) → Audio[stdout]
  where Effect[read, cache]

# Examples:
tetra query "@local:qa:1760229927"
vox play "@local.vox.{voice=\"sally\",duration>3000}.mp3"
```

### 9.9 Query Composition

TQL queries can be composed and reused:

```bash
# Define query aliases in config
[query.aliases]
recent = "{ts>-1h}"
large = "{size>50000}"
sally = "{voice=\"sally\"}"

# Use aliases in queries
vox.*.recent.sally.mp3
# Expands to: vox.{ts>-1h,voice="sally"}.mp3
```

---

## 10. Extension Model

### 9.1 Core vs Extensions

**TCS 3.0** (this document) defines:
- Core operators
- Environment and Mode
- Module database pattern
- Type contracts
- Unified logging

**Extensions** build on TCS:
- [TES SSH Extension](TES_SSH_Extension.md) - SSH deployment
- [TES Storage Extension](TES_Storage_Extension.md) - Cloud storage
- Future: TES Kubernetes Extension, TES Database Extension, etc.

### 9.2 Extension Requirements

Any extension MUST:
1. Reference TCS 3.0 explicitly
2. Use TCS operators consistently
3. Follow module database pattern
4. Declare type contracts with `::`
5. Use unified logging

### 9.3 Extension Template

```markdown
# TES [Extension Name]

**Version:** X.Y.Z
**TCS Version:** 3.0
**Date:** YYYY-MM-DD

## References
- [Tetra Core Specification](Tetra_Core_Specification.md)

## Extension-Specific Concepts
[... extension details ...]

## Type Contracts
[... actions with :: syntax ...]

## Integration with TCS
[... how this extends core concepts ...]
```

---

## 10. Success Criteria

A module is TCS 3.0 compliant when:

✅ **Structure**: Follows `$TETRA_DIR/<module>/db/` pattern
✅ **Primary Keys**: Uses timestamp-based filenames
✅ **Path Functions**: Implements required path functions
✅ **Symbols**: Provides `@module:key.variant` resolution
✅ **Contracts**: Declares all actions with `::` operator
✅ **Logging**: Uses `tetra_log()` for all operations
✅ **Documentation**: Has README.md referencing TCS 3.0

---

## 11. Version History

- **3.0.1** (2025-10-13) - Added TQL (Tetra Query Language)
  - Prometheus-inspired query language for module databases
  - Collection queries (`@env:module:id`)
  - Filtered queries with label matchers (`@env.module.{filter}.type`)
  - Four-module implementation (parser, compiler, labels, executor)
- **3.0** (2025-10-13) - Initial TCS specification
  - Consolidated concepts from TES 2.1, Module Convention, theory docs
  - Elevated `::` operator to central position
  - Defined Module database pattern
  - Clarified Environment × Mode algebra

---

## Appendix A: Quick Reference

### Operators
```
.  = module namespace (tkm.rekey)
:  = verb-noun pair (rekey:keys)
:: = type contract (ACTION :: Input → Output)
→  = data flow (@local → @dev)
@  = resource address (@vox:1760229927.sally)
×  = context composition (Environment × Mode)
```

### Environments
```
HELP, Local, Dev, Staging, Production (immutable)
```

### Mode
```
List[Module] (e.g., [vox, qa, deploy])
```

### Symbols
```
@local, @dev, @staging, @prod        # Environments
@vox:1760229927.sally                # Module resources
@spaces:bucket:path                  # Storage
@{context}                           # Dynamic substitution
```

### Database Pattern
```
$TETRA_DIR/<module>/db/{timestamp}.ext
```

### Type Contract
```
module.verb :: Input* → Output+ where Effect*
```

### TQL (Tetra Query Language)
```
# Collection query
[@env]:module:id                    # All files for module/id
vox:1760229927                      # Local implied

# Filtered query
[@env].module.{filter}.type         # Rich filtering
vox.176022*.sally                   # Pattern filter
@dev.vox.{ts>1760229000}.mp3        # Label filter

# Operators
=   exact match
!=  not equal
=~  regex match
!~  regex not match
>   greater than
<   less than
>=  greater or equal
<=  less or equal

# Labels
ts, module, variant, ext            # Built-in
size, mtime                         # Filesystem
duration, voice, model, hash        # Metadata
```

---

**End of Tetra Core Specification 3.0.1**
