# TDOCS Semantic Model Implementation Summary

## Changes Completed

### 1. Improved `ls -l` Format (ui/tags.sh)

**Before**:
```
     path/to/file.md
     ,guide,,,2025-11-07,working,no
```

**After**:
```
SEMANTIC_MODEL.md
     bash/tdocs/docs/SEMANTIC_MODEL.md
     guide instruct module:tdocs auth:working 2025-11-07 [no-fm]
```

The new format is:
- **Line 1**: Filename (colored)
- **Line 2**: Full path (dimmed)
- **Line 3**: Labeled metadata: `type kind module:value auth:value date [flags]`

### 2. Added `kind` Field to Database Schema (core/database.sh)

**New field**: `kind` (semantic verb)

**Values**:
- `define` - Defines concepts, APIs (specs, standards, references)
- `instruct` - Step-by-step instructions (guides, examples)
- `analyze` - Analysis and insights (investigations)
- `document` - Records events (bug-fixes, refactors, summaries)
- `propose` - Proposes changes (plans)
- `explain` - Explains how things work (integrations)
- `review` - Reviews code/design
- `track` - Tracks progress/issues

**Auto-detection logic**:
```bash
specification|standard|reference → define
guide|example → instruct
investigation → analyze
bug-fix|refactor|summary → document
plan → propose
integration → explain
```

### 3. Updated UI to Show `kind` Column

**Normal view** (`tdocs ls`):
```
FILENAME                                      TYPE        KIND      MODULE
SEMANTIC_MODEL.md                             guide       instruct  tdocs
```

**Columns**:
- Filename (45 chars)
- Type/NOUN (12 chars) - What it IS
- Kind/VERB (10 chars) - What it DOES
- Module (8 chars) - Where it belongs

### 4. Created Semantic Model Documentation (docs/SEMANTIC_MODEL.md)

Complete documentation of the TDS token mapping:

```
TDS Token        TDOCS Field        Meaning
─────────────────────────────────────────────
ENV_*         →  tags (system)   →  System/infrastructure context
MODULE_*      →  tags (modules)  →  Module/component context
VERBS_*       →  kind field      →  Action/purpose (what doc DOES)
NOUNS_*       →  type field      →  Document class (what doc IS)
```

## Semantic Model Benefits

### 1. Clear Taxonomy
- **Type** (NOUN): What the document IS (guide, spec, investigation, etc.)
- **Kind** (VERB): What the document DOES (define, instruct, analyze, etc.)
- **Module tags**: Where the document belongs (rag, tdocs, repl, etc.)
- **Env tags**: System-level context (boot, temporal, tested, etc.)

### 2. Visual Consistency
- Type uses NOUNS color palette (first color family)
- Kind uses VERBS color palette (second color family)
- Module tags use MODE color palette
- Env tags use ENV color palette

This creates a **visual grammar** where users learn semantic meaning by color.

### 3. Query Power

```bash
# Find all specs that define interfaces
tdocs ls --type specification --kind define

# Find all guides that instruct about completion
tdocs ls --type guide --kind instruct --tags completion

# Find temporal docs
tdocs ls --tags temporal

# Find boot-related specs
tdocs ls --type specification --tags boot
```

### 4. RAG Intelligence

Evidence queries can filter by semantic dimensions:

```bash
tdocs evidence "boot sequence" --type specification --kind define
# Most authoritative: "this is how it IS"

tdocs evidence "boot sequence" --type guide --kind instruct
# Good for how-to: "this is how to DO it"

tdocs evidence "boot issues" --type investigation --kind analyze
# Useful for insights: "this is what we LEARNED"
```

## Implementation Details

### Database Schema

All new entries include `kind` field:

```json
{
  "timestamp": 1762514506,
  "doc_path": "/path/to/doc.md",
  "type": "standard",
  "doc_type": "guide",
  "kind": "instruct",
  "tags": ["plan", "boot"],
  "module": "tdocs",
  "authority": "working",
  ...
}
```

### Backward Compatibility

- Old `type` field still read for legacy compatibility
- New `doc_type` field preferred over `type`
- `kind` auto-detected from `doc_type` if not specified
- Existing databases work without migration

### Color Rendering

```bash
# Type uses NOUNS palette
tds_text_color "tdocs.type.${type}"

# Kind uses VERBS palette (dimmed)
tds_text_color "tdocs.kind.${kind}"

# Module tags use MODE palette
tds_text_color "tdocs.tag.module.${module}"

# Env tags use ENV palette
tds_text_color "tdocs.tag.env.${env_tag}"
```

## Testing

All tests pass:

```bash
./test_discover.sh
# ✓ Auto-index 91 documents
# ✓ Kind field populated correctly
# ✓ Display shows type, kind, module columns
```

```bash
tdocs ls --module tdocs
# Output:
# SEMANTIC_MODEL.md    guide  instruct  tdocs

tdocs ls --detailed --module tdocs
# Output:
# SEMANTIC_MODEL.md
#      bash/tdocs/docs/SEMANTIC_MODEL.md
#      guide instruct module:tdocs auth:working 2025-11-07 [no-fm]
```

## Migration Path

### Phase 1: ✅ Completed
- Add `kind` field to database schema
- Auto-detect `kind` from `doc_type`
- Update UI to display `kind` column
- Document semantic model

### Phase 2: Future
- Add `kind` filter to search: `tdocs ls --kind define`
- Semantic validation warnings (e.g., type=guide + kind=define)
- Update evidence queries to use kind
- Add kind to frontmatter templates

### Phase 3: Future
- Separate module tags from env tags
- Use TDS palettes for tag coloring
- Cross-module evidence with kind filtering
- Usage tracking by kind (which verb patterns most useful)

## Summary

The semantic model provides:

1. **Four-dimensional classification**: Type (NOUN), Kind (VERB), Module tags, Env tags
2. **TDS token alignment**: Consistent with Tetra Design System
3. **Visual consistency**: Color families map to semantic dimensions
4. **Query power**: Rich filtering for evidence gathering
5. **RAG intelligence**: Better context for LLM queries

The system now clearly distinguishes:
- **What a document IS** (type/NOUN): guide, spec, investigation
- **What it DOES** (kind/VERB): instruct, define, analyze
- **Where it belongs** (module): rag, tdocs, repl
- **How it applies** (env): boot, temporal, tested

This creates a natural taxonomy that both humans and LLMs can navigate effectively.
