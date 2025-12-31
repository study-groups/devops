# TDOCS Semantic Model: TDS Token Mapping

## Core Principle: Semantic Consistency Across Tetra

The Tetra Design System (TDS) defines four semantic dimensions that map naturally to document taxonomy:

```
TDS Palette      TDOCS Field        Meaning
─────────────────────────────────────────────────────────────────────
PRIMARY       →  tags (system)   →  System/infrastructure tags
SECONDARY     →  tags (modules)  →  Module/component tags
SEMANTIC      →  kind field      →  Action/purpose of document
SURFACE       →  type field      →  Document class/category
```

## Detailed Mapping

### Nouns → Type (Document Class)

**TDS Palette**: `SURFACE[0-7]`

**Maps to**: `doc_type` field in database

**Values**:
- `specification` - Formal spec (authoritative)
- `standard` - Standard/protocol definition
- `reference` - Reference material (lookup)
- `guide` - How-to guide (instructional)
- `example` - Example/sample code
- `integration` - Integration guide
- `plan` - Plan/roadmap
- `investigation` - Investigation/analysis
- `bug-fix` - Bug fix documentation
- `refactor` - Refactoring documentation
- `summary` - Summary/overview
- `scratch` - Scratch/temporary notes

**Semantics**: What **kind of artifact** is this document?

### Verbs → Kind (Document Purpose)

**TDS Palette**: `SEMANTIC[0-7]`

**Maps to**: New `kind` field (to be added)

**Values**:
- `define` - Defines concepts, APIs, interfaces
- `explain` - Explains how things work
- `instruct` - Step-by-step instructions
- `analyze` - Analysis and insights
- `document` - Records decisions, events
- `propose` - Proposes changes, features
- `review` - Reviews code, design
- `track` - Tracks progress, issues

**Semantics**: What **action does this document perform**?

### Modules → Tags (Module Context)

**TDS Palette**: `SECONDARY[0-7]`

**Maps to**: `tags` array (module-scoped tags)

**Values**:
- Module names: `rag`, `tdocs`, `repl`, `tubes`, `midi`, etc.
- Features: `completion`, `search`, `ranking`, `evidence`
- Components: `database`, `ui`, `core`, `actions`

**Semantics**: What **module or feature domain** does this document cover?

### Env → Tags (System Context)

**TDS Palette**: `PRIMARY[0-7]`

**Maps to**: `tags` array (system-scoped tags)

**Values**:
- System-level: `boot`, `init`, `config`, `env`
- Infrastructure: `database`, `cache`, `index`
- Lifecycle: `temporal`, `stale`, `archived`
- Quality: `tested`, `reviewed`, `validated`

**Semantics**: What **system-level context** applies to this document?

## Implementation Strategy

### Phase 1: Add `kind` Field (Current)

```bash
# Database schema addition
{
  ...
  "type": "specification",      # Noun: what it IS
  "kind": "define",             # Verb: what it DOES
  "tags": [                     # Env + Module context
    "boot",                     # Env tag (system)
    "repl",                     # Module tag
    "completion"                # Feature tag
  ],
  ...
}
```

### Phase 2: Semantic Validation

Validate that combinations make sense:

```bash
# Good combinations
type=guide         kind=instruct   ✓
type=specification kind=define     ✓
type=investigation kind=analyze    ✓

# Questionable combinations (warnings)
type=guide         kind=define     ⚠️
type=specification kind=instruct   ⚠️
```

### Phase 3: Color Rendering

Use TDS token palettes for consistent coloring:

```bash
# Type uses SURFACE palette
tds_text_color "tdocs.type.${type}"  # Maps to SURFACE

# Kind uses SEMANTIC palette
tds_text_color "tdocs.kind.${kind}"  # Maps to SEMANTIC

# Module tags use SECONDARY palette
tds_text_color "tdocs.tag.module.${module}"  # Maps to SECONDARY

# Env tags use PRIMARY palette
tds_text_color "tdocs.tag.env.${env_tag}"    # Maps to PRIMARY
```

## Examples

### Example 1: REPL Specification

```yaml
---
type: specification      # NOUN: It's a spec document
kind: define             # VERB: It defines the REPL system
authority: canonical     # Authority level
tags:
  - repl                 # MODULE tag
  - completion           # MODULE tag (feature)
  - boot                 # ENV tag (system context)
  - tested               # ENV tag (quality)
---
```

**Display**:
```
specification define repl,completion [boot,tested]
```

### Example 2: Bug Fix Documentation

```yaml
---
type: bug-fix           # NOUN: It's a fix record
kind: document          # VERB: It documents what happened
authority: working      # Working document
temporal: 2025-11-07    # Temporal marker
tags:
  - tdocs               # MODULE tag
  - search              # MODULE tag (feature)
  - temporal            # ENV tag (lifecycle)
---
```

**Display**:
```
bug-fix document tdocs,search [temporal] 2025-11-07
```

### Example 3: Integration Guide

```yaml
---
type: guide             # NOUN: It's a guide
kind: instruct          # VERB: It instructs how to integrate
authority: stable       # Stable document
tags:
  - rag                 # MODULE tag
  - tdocs               # MODULE tag
  - integration         # MODULE tag (feature)
  - database            # ENV tag (infrastructure)
---
```

**Display**:
```
guide instruct rag,tdocs,integration [database]
```

## Benefits

### 1. Semantic Clarity
- **Type** answers: "What is this?"
- **Kind** answers: "What does it do?"
- **Module tags** answer: "What domain?"
- **Env tags** answer: "What context?"

### 2. Query Power

```bash
# Find all specs that define interfaces
tdocs ls --type specification --kind define

# Find all guides that instruct about repl
tdocs ls --type guide --kind instruct --tags repl

# Find all temporal documents (env tag)
tdocs ls --tags temporal

# Find all boot-related docs (env tag)
tdocs ls --tags boot
```

### 3. Visual Consistency

Using TDS palettes ensures:
- Nouns always use same color family
- Verbs always use same color family
- Module tags use same color family
- Env tags use same color family

This creates **visual grammar** - users learn to recognize semantic meaning by color.

### 4. RAG Intelligence

```bash
# Evidence query with semantic filtering
tdocs evidence "boot sequence" --type specification --kind define

# Weighted by both type authority and kind specificity
# specification+define = most authoritative "this is how it is"
# guide+instruct = good "this is how to do it"
# investigation+analyze = useful "this is what we learned"
```

## Migration Path

### Step 1: Add `kind` field to database schema ✓
### Step 2: Auto-detect `kind` from existing `type`
```bash
type=specification → kind=define (default)
type=guide → kind=instruct (default)
type=investigation → kind=analyze (default)
```

### Step 3: Update UI to show kind
```bash
# Old format
filename                     type        module

# New format
filename                     type kind   module tags:[...]
```

### Step 4: Add kind to filters
```bash
tdocs ls --kind define
tdocs ls --kind instruct --tags repl
```

### Step 5: Semantic validation warnings
```bash
# When saving metadata
tdocs init myspec.md --type guide --kind define
# Warning: type=guide typically pairs with kind=instruct, not kind=define
# Continue? [y/N]
```

## Summary

This semantic model provides:

1. **Four-dimensional classification**: Type, Kind, Module, Env
2. **TDS token alignment**: Consistent with overall Tetra design
3. **Visual consistency**: Color families map to semantic dimensions
4. **Query power**: Rich filtering and evidence gathering
5. **RAG intelligence**: Better context for LLM queries

The mapping is:
- **Noun → Type**: What it IS
- **Verb → Kind**: What it DOES
- **Module → Tags**: Where it BELONGS
- **Env → Tags**: When/How it APPLIES
