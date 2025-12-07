# TRS - Tetra Record Specification

**Version**: 1.1
**Status**: Specification
**Date**: 2025-11-28

## Overview

The Tetra Record Specification (TRS) defines a context-aware, filesystem-based database pattern for storing and organizing data artifacts across the Tetra ecosystem. TRS uses intelligent naming conventions that leverage directory structure to eliminate redundancy while maintaining queryability and portability.

## Core Principle: Context-Based Naming

TRS employs **implicit naming** within canonical locations and **explicit naming** outside them, ensuring clarity without redundancy.

### Canonical Location

**Path**: `$TETRA_DIR/<module>/db/`
**Format**: `timestamp.type.kind[.kind2...].format`

In canonical location, the module name is **implicit from the directory path** and is NOT included in the filename.

**Example**:
```bash
$TETRA_DIR/vox/db/
├── 1760229927.audio.sally.mp3      # Module "vox" implicit
├── 1760229927.spans.sally.json     # Module "vox" implicit
└── 1760229927.metadata.json        # Module "vox" implicit
```

### Non-Canonical Location

**Path**: Anywhere outside `$TETRA_DIR/<module>/db/`
**Format**: `timestamp.module.type.kind[.kind2...].format`

Outside canonical location, the module name becomes **explicit** (first segment after timestamp) to prevent ambiguity.

**Example**:
```bash
/tmp/tetra/cancelled/pipeline-123/
├── 1760229927.vox.audio.sally.mp3  # Module "vox" explicit
├── 1760229930.rag.evidence.code.md # Module "rag" explicit
└── 1760230000.org.message.sent.json # Module "org" explicit
```

### Org-Scoped Records (v1.1)

For multi-tenant organizations, TRS supports org-scoped canonical locations:

**Path**: `$TETRA_DIR/orgs/<org>/db/`
**Format**: `timestamp.type.kind[.kind2...].format`

The org name is implicit from the directory path, similar to modules.

**Example**:
```bash
$TETRA_DIR/orgs/pixeljam-arcade/db/
├── 1760229927.deploy.staging.toml      # Org "pixeljam-arcade" implicit
├── 1760229930.deploy.prod.toml
└── 1760230000.config.backup.json

$TETRA_DIR/orgs/another-project/db/
├── 1760230100.deploy.dev.toml          # Org "another-project" implicit
```

**Non-canonical org-scoped records** include the org name explicitly:
```bash
/tmp/tetra/removed/1760230000/
└── 1760230000.pixeljam-arcade.deploy.staging.toml  # Org now explicit
```

**Query across all orgs**:
```bash
find "$TETRA_DIR"/orgs/*/db/ -name "*.deploy.*.toml"
```

## Filename Structure

### Anatomy of a TRS Record

```
timestamp.attribute1.attribute2.attribute3.format
└─────┬─────┘└────────────┬────────────┘└──┬──┘
      │                   │                 │
   Primary Key      Attribute Set        Format
```

**Components**:

1. **timestamp**: Unix epoch seconds (primary key, when record created)
2. **attribute set**: Unordered dimensional attributes (module, type, kind, etc.)
3. **format**: File extension (json, md, mp3, jsonl, etc.)

### Attribute Set Semantics

The segments between `timestamp` and `format` form a **set of dimensional attributes**, not a sequence. Order does not affect semantic meaning.

**Semantically Equivalent** (same attribute set):
```bash
1760229927.audio.sally.mp3
1760229927.sally.audio.mp3
```

**Conventional Ordering** (for readability):
```bash
timestamp.[module].type.kind[.kind2...].format
         └──────────attribute set──────────┘
```

**Recommended attribute order**:
- `module` (when explicit)
- `type` (category: audio, check, evidence, prompt, answer)
- `kind` (variant: sally, health, code, oauth)
- Additional attributes as needed

## TRS Naming Rules

### Rule 1: Canonical Location Naming

When writing to `$TETRA_DIR/<module>/db/`:
- Format: `timestamp.type.kind.format`
- Module name: **IMPLICIT** (from directory path)
- Example: `$TETRA_DIR/vox/db/1760229927.audio.sally.mp3`

### Rule 2: Non-Canonical Location Naming

When writing outside `$TETRA_DIR/<module>/db/`:
- Format: `timestamp.module.type.kind.format`
- Module name: **EXPLICIT** (first attribute after timestamp)
- Example: `/tmp/export/1760229927.vox.audio.sally.mp3`

### Rule 3: Module Detection

```bash
# Module determined by:
# 1. If in canonical location → extract from path
# 2. Otherwise → extract from filename (first segment after timestamp)

if [[ "$filepath" =~ $TETRA_DIR/([^/]+)/db/ ]]; then
    module="${BASH_REMATCH[1]}"  # From path
else
    module=$(basename "$filepath" | cut -d. -f2)  # From filename
fi
```

### Rule 4: Attribute Query Independence

Attributes can be queried in any order:
```bash
# Find all audio files (regardless of order in filename):
find "$TETRA_DIR"/*/db/ -name "*.audio.*"
# OR
find "$TETRA_DIR"/*/db/ -name "*audio*" -name "*.mp3"
```

## Common Patterns by Module

### QA Module (Protected Pattern)
```bash
$TETRA_DIR/qa/db/
├── 1758025638.prompt          # Legacy format preserved
├── 1758025638.answer
└── 1758025638.metadata.json
```
**Note**: QA module maintains its original pattern for backward compatibility.

### VOX Module (Audio/TTS)
```bash
$TETRA_DIR/vox/db/
├── 1760229927.audio.sally.mp3     # type=audio, kind=sally
├── 1760229927.audio.alloy.mp3
├── 1760229927.spans.sally.json    # type=spans, kind=sally
└── 1760229927.metadata.json       # type=metadata
```

### MELVIN Module (Code Analysis)
```bash
$TETRA_DIR/melvin/db/
├── 1761397000.check.health.jsonl   # type=check, kind=health
├── 1761397000.check.syntax.jsonl
├── 1761397000.report.health.json  # type=report, kind=health
└── 1761398500.check.security.jsonl
```

### TDOCS Module (Documentation)
```bash
$TETRA_DIR/tdocs/db/
├── 1761234567.doc.meta.json       # type=doc, kind=meta
├── 1761234567.doc.tags            # type=doc, kind=tags
└── 1761235000.index.full.json     # type=index, kind=full
```

### RAG Module
```bash
$TETRA_DIR/rag/db/
├── 1758025640.evidence.code.md    # type=evidence, kind=code
├── 1758025640.evidence.doc.md     # type=evidence, kind=doc
├── 1758025640.flow.state.json     # type=flow, kind=state
└── 1758025640.context.assembled.mdctx  # type=context, kind=assembled
```

### Audit Module (Cross-Module)
```bash
$TETRA_DIR/audit/db/
├── 1760230000.action.send.json    # type=action, kind=send
├── 1760230001.action.query.json
└── 1760230002.pipeline.exec.json  # type=pipeline, kind=exec
```

## TRS API

### Core Functions

#### trs_write()
Write data to canonical location with implicit module naming.

```bash
trs_write() {
    local module="$1"
    local type="$2"
    local kind="$3"
    local format="$4"
    local data="$5"

    local timestamp=$(date +%s)
    local db_dir="$TETRA_DIR/$module/db"
    local filepath="$db_dir/$timestamp.$type.$kind.$format"

    mkdir -p "$db_dir"
    echo "$data" > "$filepath"
    echo "$filepath"
}
```

**Usage**:
```bash
filepath=$(trs_write "vox" "audio" "sally" "mp3" "$audio_data")
# Creates: $TETRA_DIR/vox/db/1760229927.audio.sally.mp3
```

#### trs_export()
Export data from canonical to non-canonical location with explicit module naming.

```bash
trs_export() {
    local source_path="$1"
    local dest_dir="$2"

    # Get module from source path
    local module=$(get_module_from_file "$source_path")
    local filename=$(basename "$source_path")
    local timestamp="${filename%%.*}"
    local rest="${filename#*.}"

    # Make module explicit in exported filename
    local export_name="$timestamp.$module.$rest"

    mkdir -p "$dest_dir"
    cp "$source_path" "$dest_dir/$export_name"
    echo "$dest_dir/$export_name"
}
```

**Usage**:
```bash
trs_export "$TETRA_DIR/vox/db/1760229927.audio.sally.mp3" "/tmp/export"
# Creates: /tmp/export/1760229927.vox.audio.sally.mp3
```

#### get_module_from_file()
Determine module from file path (implicit or explicit).

```bash
get_module_from_file() {
    local filepath="$1"

    # Check if in canonical location
    if [[ "$filepath" =~ $TETRA_DIR/([^/]+)/db/ ]]; then
        echo "${BASH_REMATCH[1]}"  # Module from path
    else
        # Extract from filename (first segment after timestamp)
        local filename=$(basename "$filepath")
        echo "$filename" | cut -d. -f2
    fi
}
```

**Usage**:
```bash
module=$(get_module_from_file "$TETRA_DIR/vox/db/1760229927.audio.sally.mp3")
# Returns: "vox"

module=$(get_module_from_file "/tmp/export/1760229927.vox.audio.sally.mp3")
# Returns: "vox"
```

### Query Functions

#### trs_query_timestamp()
Find all records for a given timestamp across all modules.

```bash
trs_query_timestamp() {
    local timestamp="$1"

    # Search in canonical locations
    find "$TETRA_DIR"/*/db/ -name "${timestamp}.*" 2>/dev/null
}
```

**Usage**:
```bash
trs_query_timestamp 1760229927
# Returns:
# $TETRA_DIR/vox/db/1760229927.audio.sally.mp3
# $TETRA_DIR/vox/db/1760229927.spans.sally.json
# $TETRA_DIR/rag/db/1760229927.evidence.code.md
```

#### trs_query_attribute()
Query records by attribute (type, kind, etc.) within a module or across all modules.

```bash
trs_query_attribute() {
    local attribute="$1"
    local value="$2"
    local module="${3:-*}"  # Optional module filter

    find "$TETRA_DIR/$module/db/" -name "*.$value.*" 2>/dev/null
}
```

**Usage**:
```bash
# Find all audio files across all modules
trs_query_attribute "type" "audio"

# Find all audio files in vox module only
trs_query_attribute "type" "audio" "vox"
```

#### trs_query_module()
Get all records for a specific module.

```bash
trs_query_module() {
    local module="$1"
    local limit="${2:-}"  # Optional limit

    if [[ -n "$limit" ]]; then
        find "$TETRA_DIR/$module/db/" -type f 2>/dev/null | head -n "$limit"
    else
        find "$TETRA_DIR/$module/db/" -type f 2>/dev/null
    fi
}
```

## Migration Guidelines

### Migrating Existing Data to TRS

When migrating a module to TRS compliance:

1. **Identify current pattern**
2. **Check if in canonical location** (`$TETRA_DIR/module/db/`)
3. **Remove redundant module prefix** (if present)
4. **Ensure timestamp is first segment**
5. **Order attributes conventionally**: `type.kind.format`

**Example: VOX Migration**

Before (redundant):
```bash
$TETRA_DIR/vox/db/1760229927.vox.sally.mp3
```

After (TRS-compliant):
```bash
$TETRA_DIR/vox/db/1760229927.audio.sally.mp3
```

**Migration Script**:
```bash
#!/usr/bin/env bash
# migrate_vox_to_trs.sh

for file in "$TETRA_DIR/vox/db/"*.vox.*.mp3; do
    [[ -f "$file" ]] || continue

    filename=$(basename "$file")
    timestamp="${filename%%.*}"
    voice=$(echo "$filename" | cut -d. -f3)
    ext=$(echo "$filename" | cut -d. -f4)

    # New TRS-compliant name
    new_name="$timestamp.audio.$voice.$ext"

    mv "$file" "$TETRA_DIR/vox/db/$new_name"
    echo "Migrated: $filename → $new_name"
done
```

### Preserving Backward Compatibility

Some modules (like QA) maintain their original patterns for compatibility:

```bash
# QA module keeps original pattern - NO CHANGES
$TETRA_DIR/qa/db/
├── 1758025638.prompt
├── 1758025638.answer
└── 1758025638.metadata.json
```

## Integration with TAS

TAS (Tetra Action Specification) actions automatically write TRS-compliant records:

```bash
# Action: /send:message @prod
# Creates in canonical location:
$TETRA_DIR/org/db/1760230000.message.sent.json

# If pipeline cancelled/failed, moves to non-canonical with explicit naming:
/tmp/tetra/cancelled/pipeline-456/1760230000.org.message.sent.json
```

## Non-Canonical Locations

### Standard Non-Canonical Paths

TRS defines standard locations for non-canonical storage:

| Location | Purpose | Naming |
|----------|---------|--------|
| `/tmp/tetra/cancelled/<id>/` | Interrupted pipelines | Explicit module |
| `/tmp/tetra/failed/<id>/` | Failed pipelines | Explicit module |
| `/tmp/tetra/removed/<ts>/` | Soft-deleted items | Explicit module |
| `/tmp/tetra/export/` | Exported data | Explicit module |
| `$TETRA_DIR/archive/` | Archived data | Explicit module |

## Best Practices

### DO:
- ✓ Use implicit naming in canonical location (`$TETRA_DIR/module/db/`)
- ✓ Use explicit naming when exporting or moving data
- ✓ Follow conventional attribute order: `[module].type.kind.format`
- ✓ Use timestamp as primary key (Unix epoch seconds)
- ✓ Query attributes independently (order-agnostic)

### DON'T:
- ✗ Include module name in canonical location filenames
- ✗ Rely on attribute order for semantic meaning
- ✗ Mix canonical and non-canonical conventions
- ✗ Use spaces in filenames (use underscores or hyphens)
- ✗ Include sensitive data in filenames (use metadata files)

## Examples

### Complete Workflow Example

```bash
# 1. Write audio file to canonical location (implicit module)
filepath=$(trs_write "vox" "audio" "sally" "mp3" "$audio_data")
# Creates: $TETRA_DIR/vox/db/1760229927.audio.sally.mp3

# 2. Query all records for this timestamp
records=$(trs_query_timestamp 1760229927)
# Returns all files matching timestamp across modules

# 3. Export for external transmission (explicit module)
export_path=$(trs_export "$filepath" "/tmp/export")
# Creates: /tmp/export/1760229927.vox.audio.sally.mp3

# 4. Query all audio files across all modules
audio_files=$(trs_query_attribute "type" "audio")
```

### Cross-Module Correlation Example

```bash
# Find all artifacts from a specific timestamp
timestamp=1760229927

# Search all modules
for record in $(trs_query_timestamp $timestamp); do
    module=$(get_module_from_file "$record")
    echo "Module: $module, Record: $(basename "$record")"
done

# Output:
# Module: vox, Record: 1760229927.audio.sally.mp3
# Module: vox, Record: 1760229927.spans.sally.json
# Module: rag, Record: 1760229927.evidence.code.md
# Module: audit, Record: 1760229927.action.send.json
```

## See Also

- **TAS Specification** - Tetra Action Specification (actions that create TRS records)
- **TES Specification** - Tetra Endpoint Specification (where actions execute)
- **TETRA_TRINITY.md** - Integration guide for TES/TAS/TRS
- **bash/trs/** - TRS implementation library

---

**Maintained by**: Tetra Core Team
**License**: MIT
**Feedback**: tetra-specs@anthropic.com
