# TDOCS + RAG Integration Guide

## Overview

TDOCS (Tetra Document System) and RAG (Retrieval-Augmented Generation) form a synergistic partnership in the Tetra ecosystem. TDOCS provides intelligent document classification and evidence weighting, while RAG uses this intelligence to assemble contextually relevant documentation for LLM queries.

## Architecture

```
┌─────────────────┐         ┌──────────────────┐
│  TDOCS System   │────────▶│   RAG System     │
│                 │         │                  │
│ • Authority     │  Query  │ • Flow Manager   │
│   Levels        │────────▶│ • Evidence       │
│ • Metadata      │         │   Selection      │
│ • Search Index  │ Results │ • Context        │
│ • Evidence      │◀────────│   Assembly       │
│   Weighting     │         │ • QA Submission  │
└─────────────────┘         └──────────────────┘
```

## Authority-Based Evidence Ranking

### The Problem

Traditional documentation systems treat all documents equally. When an LLM needs context, it can't distinguish between:
- A canonical specification (highly reliable)
- A working implementation note (moderately reliable)
- A bug fix investigation (time-sensitive, low authority)

### The Solution

TDOCS uses **authority levels** to grade document reliability:

| Authority    | Weight | Use Case                              | Example                    |
|--------------|--------|---------------------------------------|----------------------------|
| CANONICAL    | 1.0    | System standards, core specs          | TCS_3.0_SPECIFICATION.md   |
| ESTABLISHED  | 0.8    | Module specs, stable patterns         | TUBES_SPECIFICATION.md     |
| WORKING      | 0.5    | Development docs, guides              | REPL_IMPLEMENTATION.md     |
| EPHEMERAL    | 0.2    | Bug fixes, temporal investigations    | BUG_FIX_20251106.md        |

### How Weighting Works

When RAG queries `tdocs evidence "authentication flow"`:

1. TDOCS searches all indexed documents
2. Calculates base score from authority level
3. Boosts score if query matches:
   - Document metadata (+0.3)
   - Document content (+0.2)
4. Returns ranked list with weights

Example output:
```
1.0 /docs/reference/AUTH_SPECIFICATION.md [canonical/spec] ["auth", "security"]
0.8 /bash/auth/docs/AUTH_MODULE_SPEC.md [established/spec] ["auth", "module"]
0.7 /bash/auth/docs/SESSION_GUIDE.md [working/guide] ["auth", "session"]
0.3 /bash/auth/docs/AUTH_BUG_FIX_20251015.md [ephemeral/bug-fix] ["auth", "temporal"]
```

## RAG Integration Points

### 1. Evidence Selection

**RAG Command**: `/select <query>`

**What it does**:
```bash
# Inside rag_cmd_select()
local results=$(tdocs evidence "$query")

# Returns weighted list
# RAG parses and adds top results to evidence bundle
```

**User Experience**:
```
rag> /select "authentication timeout"

Searching documentation...
✓ Found 4 relevant documents

Evidence added:
  [1.0] AUTH_SPECIFICATION.md (canonical)
  [0.8] AUTH_MODULE_SPEC.md (established)
  [0.5] SESSION_TIMEOUT_GUIDE.md (working)
```

### 2. Module-Specific Evidence

**RAG Command**: `/evidence add --module rag`

**Integration**:
```bash
# In evidence_selector.sh
local module_docs=$(tdocs evidence --module "$module" "$query")

# Gets all rag-specific docs matching query
# Weighted by authority level
```

### 3. QA History Retrieval

**RAG Feature**: Historical Q&A becomes evidence

**Flow**:
```bash
rag> /qa search "completion bug"

# QA system searches prior answers
# Adds as evidence for current query
# TDOCS indexes QA history as EPHEMERAL authority
```

**Integration**:
```bash
# qa_retrieval.sh calls tdocs to index answers
tdocs init "$QA_DB_DIR/$qa_id.answer" \
  --authority ephemeral \
  --type qa-response \
  --tags "$flow_tags"
```

## Semantic Flow Improvements

### Before: Binary Classification

```
Documents were either:
  CORE (important) or OTHER (less important)

Problems:
  • Too simplistic
  • Doesn't reflect document lifecycle
  • Hard to grade bug fixes vs implementation notes
```

### After: Authority Gradient

```
Documents exist on a continuous authority scale:
  CANONICAL → ESTABLISHED → WORKING → EPHEMERAL

Benefits:
  • Reflects document evolution (working → established)
  • Natural lifecycle (ephemeral → archived)
  • Better RAG evidence ranking
```

## Practical Workflows

### Workflow 1: Answer Question Using Docs

```bash
# Start a flow
rag> /flow create "How does tab completion work?"

# Let TDOCS find relevant evidence
rag> /select "tab completion repl"

Evidence ranked by authority:
  [1.0] TETRA_COMPLETION_SYSTEM.md (canonical)
  [0.8] REPL_SPECIFICATION.md (established)
  [0.5] TAB_COMPLETION_GUIDE.md (working)

# Assemble context (higher authority docs get priority)
rag> /assemble

# Submit to LLM
rag> /submit @qa

# View answer
rag> /r
```

### Workflow 2: Document a Bug Fix

```bash
# Create fix document
vim bash/rag/docs/COMPLETION_BUG_FIX_20251106.md

# Initialize with TDOCS
tdocs init bash/rag/docs/COMPLETION_BUG_FIX_20251106.md

TDOCS auto-detects:
  • Authority: ephemeral (temporal pattern in filename)
  • Type: bug-fix
  • Tags: 2025-11-06, rag, completion
  • Module: rag (from path)

# Now available as evidence (low weight, but indexed)
rag> /select "completion error"

Results include:
  [0.3] COMPLETION_BUG_FIX_20251106.md (ephemeral, recent!)
```

### Workflow 3: Promote Documentation

As documentation matures, promote it through authority levels:

```bash
# Working implementation notes
tdocs init bash/tubes/TUBES_IMPL_NOTES.md --authority working

# After review, promote to established
tdocs update bash/tubes/TUBES_IMPL_NOTES.md --authority established

# Eventually, promote to canonical
mv bash/tubes/TUBES_IMPL_NOTES.md docs/reference/TUBES_SPECIFICATION.md
tdocs update docs/reference/TUBES_SPECIFICATION.md --authority canonical
```

## RAG Benefits from TDOCS

1. **Smart Context Assembly**: High-authority docs get priority in limited context windows
2. **Temporal Awareness**: Recent bug fixes rank higher than old ones
3. **Module Scoping**: Easy to filter evidence by module
4. **Tag-Based Retrieval**: Semantic tags improve relevance
5. **QA Learning**: Historical answers become evidence for future queries

## TDOCS Benefits from RAG

1. **Usage Analytics**: TDOCS sees which docs are frequently selected as evidence
2. **Tag Suggestions**: RAG queries inform tag recommendations
3. **Authority Calibration**: Document usage patterns validate authority levels
4. **Completeness Tracking**: Gaps in evidence reveal documentation needs

## Color Coding and UX

Both systems use consistent color schemes:

**TDOCS**:
- CANONICAL: Bright blue badge
- ESTABLISHED: Medium blue badge
- WORKING: Cyan badge
- EPHEMERAL: Dim gray badge

**RAG Evidence List**:
- Same color coding
- Weight shown as decimal (1.0, 0.8, 0.5, 0.2)
- Module and type badges for quick scanning

## Configuration

### TDOCS for RAG

```bash
# In tdocs metadata
---
authority: established
evidence_weight: 0.8
module: rag
type: specification
tags: [completion, repl, rag]
---
```

### RAG Using TDOCS

```bash
# In rag_commands.sh
rag_cmd_select() {
    local query="$*"

    # Query TDOCS
    local results=$(tdocs evidence "$query")

    # Add to flow evidence
    flow_init_evidence_vars
}
```

## Future Enhancements

1. **Adaptive Weighting**: Learn from LLM feedback to adjust authority levels
2. **Citation Tracking**: Track which docs actually helped solve problems
3. **Auto-Promotion**: Automatically promote frequently-used working docs
4. **Semantic Search**: Use embeddings for better query matching
5. **Cross-Module Discovery**: Find related docs across modules

## See Also

- `tdocs help` - TDOCS command reference
- `rag help` - RAG workflow guide
- `bash/tdocs/integrations/rag_evidence.sh` - Implementation
- `bash/rag/core/evidence_selector.sh` - Evidence selection logic
