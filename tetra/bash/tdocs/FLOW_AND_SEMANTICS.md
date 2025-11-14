# TDOCS Flow and Semantics - Design Philosophy

## Core Philosophy: Documents Have Authority, Not Binary Importance

### The Old Way: Binary Classification
```
document.md ∈ {CORE, OTHER}
```

**Problems**:
- Oversimplified
- No room for nuance
- Doesn't reflect document lifecycle
- Hard to prioritize for RAG

### The New Way: Authority Gradient
```
document.md → authority_level ∈ [0.0, 1.0]

CANONICAL    = 1.0
ESTABLISHED  = 0.8
WORKING      = 0.5
EPHEMERAL    = 0.2
```

**Benefits**:
- Reflects reality (documents mature)
- Natural lifecycle (temporal → working → established → canonical)
- Perfect for RAG weighting
- Supports document promotion

## Semantic Flow: Task-Oriented, Not Category-Oriented

### User Mental Model

Users think:
1. "I want to **see** my docs" → `ls`, `view`
2. "I want to **find** something" → `search`, `evidence`
3. "I want to **organize** things" → `init`, `tag`, `discover`
4. "I want **module info**" → `module`, `spec`, `audit-specs`

Users don't think:
- "I need a viewing command from the viewing category"
- "Let me consult the taxonomy to find the right operation"

### Help Organization

```
Core Operations          ← What you do 80% of the time
  ls, view, search, evidence

Document Management      ← Occasional housekeeping
  init, tag, discover, audit

Module Intelligence      ← Power features
  module, spec, audit-specs

Quick Start              ← Onboarding
  demo, browse
```

This mirrors **frequency of use**, not **conceptual categories**.

## Flow Semantics: Retrieval-Augmented Generation FOR Documents

### Traditional RAG
```
User Query → Retrieve Code/Docs → Generate Answer
```

### TDOCS-Enhanced RAG
```
User Query → Retrieve WEIGHTED Docs → Generate Answer
              ↑
              Authority-based ranking
              Temporal boosting
              Module scoping
```

### The Feedback Loop
```
1. Document created       → [ephemeral]
2. Used in RAG query      → Usage tracked
3. Proves useful          → Promoted to [working]
4. Pattern stabilizes     → Promoted to [established]
5. Becomes reference      → Promoted to [canonical]
6. High authority doc     → Preferred by RAG
```

**This is self-reinforcing**: Good docs get used more, usage promotes them, promoted docs get even more use.

## Color Semantics: Subtle Hierarchy

### Visual Weight = Semantic Weight

```
Bold Bright    → Most important (section headers, commands)
Normal         → Standard info (command syntax)
Dim            → Supporting info (descriptions, comments)
Gray           → Metadata (paths, tags)
```

### Color Families

**Blue Family** (Structure):
- Bold Blue: Main sections
- Dim Blue: Subsections
- Creates visual rhythm

**Cyan Family** (Actions):
- Bright Cyan: Commands
- Dim Cyan: Options/flags
- Eye goes straight to commands

**Green Family** (Examples):
- Bright Green: Example commands
- Dim Green: Example comments
- Clear "this is how you do it"

**Gray** (Context):
- Descriptions
- Paths
- Metadata
- Recedes visually

### Anti-Pattern: Rainbow Help

**Don't do this**:
```
RED section
YELLOW subsection
GREEN command
BLUE description
PURPLE example
ORANGE note
```

**Why**: Too many colors = visual chaos, nothing stands out.

**Do this instead**:
```
BLUE section
  dim blue subsection
  CYAN command  gray description
  CYAN command  gray description

  dim green # Example comment
  GREEN example command
```

**Why**: Limited palette with intensity variations creates natural hierarchy.

## Naming Semantics: Plural for Systems, Singular for Operations

### Module Name: `tdocs` (plural)

**Rationale**: It's a **system** that manages **multiple documents**.

Compare:
- `git` - manages repositories (plural concept)
- `docker` - manages containers (plural concept)
- `tdocs` - manages documents (plural concept)

### Command Name: `tdocs` (consistent)

**Not**:
- `tdoc <command>` - sounds like you're operating on one doc
- `tdocs <command>` - clear you're using the system

### Function Names: `tdoc_*` (singular, internal)

**Why**: Internal functions often operate on **one document at a time**.

```bash
tdoc_init_doc()      # Initialize ONE document
tdoc_view_doc()      # View ONE document
tdocs_ls_docs()      # List MANY documents (wrapper calls tdoc_list_docs)
```

**Pattern**: User-facing = `tdocs`, internal = `tdoc_` when singular operation.

## Authority Semantics: Not About Power, About Trust

### "Authority" in TDOCS

**Means**: "How much can we trust this as a canonical source?"

**Not**: "Who has authority over this document?"

**Analogy**:
- Scientific paper: High authority (peer-reviewed, cited)
- Blog post: Medium authority (expert opinion)
- Twitter thread: Low authority (ephemeral, unverified)

### Alternative Terms (if "authority" feels wrong)

Could use:
- **Reliability**: canonical=100% reliable, ephemeral=20% reliable
- **Trust level**: verified, established, draft, experimental
- **Maturity**: mature, proven, active, exploratory
- **Confidence**: high-confidence, medium-confidence, low-confidence

But **authority** is standard in information science:
- "Authoritative source"
- "Authority file" (library science)
- "Certificate authority" (PKI)

So it's appropriate technical jargon.

## Temporal Semantics: Time Matters

### The Temporal Document

**Characteristics**:
- Created to solve specific problem
- References specific timeframe (bug fix, investigation)
- Loses relevance over time
- Should be archived, not deleted

**Patterns**:
- `BUG_FIX_YYYYMMDD.md`
- `INVESTIGATION_YYYYMMDD.md`
- `REFACTOR_PLAN_YYYYMMDD.md`

**Auto-detection**: Filename contains date → ephemeral authority

**Lifecycle**:
```
Day 1:   Created → ephemeral (0.2)
Week 1:  Useful → stays ephemeral
Month 1: Pattern emerges → extract to working (0.5)
Month 6: Proven → promote to established (0.8)
Year 1:  Reference → promote to canonical (1.0)
```

### RAG Temporal Boosting

Recent temporal docs get boost:
```
doc_age_days = (now - created) / 86400
if doc_age_days < 30 and authority == ephemeral:
    score += 0.1  # Recent fix might be relevant
```

This helps with "how did we solve this last time?" queries.

## Module Semantics: Scoping Intelligence

### Module as Scope

**Not just organization**, but **semantic context**:

```bash
# Find all auth-related docs
tdocs ls --module auth

# Get RAG evidence scoped to auth
tdocs evidence --module auth "session timeout"

# Audit auth module completeness
tdocs module auth
```

### Module Completeness

**L0-L4 Scale**:
- L0: No docs (bad)
- L1: Basic README (minimal)
- L2: Functional docs (working)
- L3: Complete docs (established)
- L4: Exemplar (canonical specs + examples)

**Use in RAG**:
- L4 module docs → High authority evidence
- L1 module docs → Low authority, use with caution

### Cross-Module Discovery

Future enhancement:
```bash
# Find related docs across modules
tdocs evidence --related-modules "completion system"

# Might find:
- bash/repl/COMPLETION_SPEC.md
- bash/tcurses/READLINE_INTEGRATION.md
- bash/tree/TREE_COMPLETION.md
```

## Tag Semantics: Free-Form But Conventional

### Tag Types

**Temporal**: `YYYY-MM-DD` format
- Auto-detected from filenames
- Used for temporal boosting
- Example: `2025-11-06`

**Purpose**: What kind of doc?
- `bug-fix`, `refactor`, `investigation`
- `spec`, `guide`, `reference`
- Example: `bug-fix`

**Scope**: What domain?
- Module names: `rag`, `tdocs`, `auth`
- Features: `completion`, `repl`, `osc`
- Example: `completion`

**Custom**: Whatever makes sense
- `todo`, `urgent`, `review-needed`
- `performance`, `security`, `ux`

### Tag Strategy

**Keep it simple**:
- 3-5 tags per doc
- Use established tags when possible
- Create new tags sparingly

**Consistency helps**:
- `bug-fix` not `bugfix` or `bug_fix`
- `2025-11-06` not `Nov 6 2025` or `20251106`
- `rag` not `RAG` or `Rag`

**Tags enable discovery**:
```bash
tdocs ls --tags bug-fix,completion
tdocs evidence --tags temporal,rag "recent fixes"
```

## Integration Semantics: TDOCS as Evidence Provider

### RAG's Perspective

**TDOCS is an evidence oracle**:

```
RAG: "I need evidence about X"
TDOCS: "Here are docs about X, weighted by authority"
RAG: "Thanks, I'll prioritize high-authority docs"
```

**Not just a file list**, but an **intelligent recommendation engine**.

### TDOCS's Perspective

**RAG is a usage tracker**:

```
TDOCS: "This doc is [working] authority"
RAG: "I used it 10 times this month, always helpful"
TDOCS: "Promoting to [established]"
```

**Not just passive storage**, but **adaptive learning system**.

### Symbiotic Relationship

```
TDOCS provides:          RAG provides:
- Authority grading      - Usage analytics
- Semantic tags          - Query patterns
- Module scoping         - Citation tracking
- Temporal awareness     - Effectiveness feedback
```

**Result**: Documentation system that **learns from use**.

## Summary: Design Principles

1. **Authority, not binary importance**
   - Documents exist on a trust spectrum
   - Reflects reality of document maturity

2. **Task-oriented, not category-oriented**
   - Organize by what users want to do
   - Mirror frequency of use

3. **Subtle hierarchy, not rainbow chaos**
   - Limited color palette
   - Intensity variations
   - Visual weight = semantic weight

4. **Temporal awareness**
   - Recent docs get boosted
   - Old temporal docs get archived
   - Document lifecycle tracked

5. **RAG integration**
   - TDOCS = evidence provider
   - RAG = usage tracker
   - Symbiotic feedback loop

6. **Semantic tags**
   - Free-form but conventional
   - Enable discovery
   - Support cross-module queries

7. **Module intelligence**
   - Completeness tracking
   - Scoped evidence
   - Cross-module discovery

**Overall Goal**: Make documentation **discoverable, trustworthy, and useful** for both humans and LLMs.
