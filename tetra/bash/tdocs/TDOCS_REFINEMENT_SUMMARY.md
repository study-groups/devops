# TDOCS Refinement Summary
*2025-11-06*

## Changes Made

### 1. Naming Consistency: tdoc → tdocs

**Rationale**: The module is called "tdocs" (plural) to reflect that it manages multiple documents as a system, not a single document.

**Changes**:
- ✓ Updated all examples in `docs/README.md` from `tdoc` to `tdocs`
- ✓ Updated command examples in help system (`core/help.sh`)
- ✓ Updated references in `tdocs.sh` main file
- ✓ Fixed database path references (`$TETRA_DIR/tdocs/` not `tdoc/`)
- ✓ Updated integration examples and error messages

**Impact**: Consistent naming across documentation, commands, and code. Users always type `tdocs <command>`.

### 2. Help System Color Refinement

**Problem**: Help text used bold colors uniformly, making it hard to scan quickly.

**Solution**: Introduced **subtle intensity variations** using dim colors:

```bash
# Before
TETRA_CYAN='\033[0;36m'    # Commands
TETRA_BLUE='\033[1;34m'    # Sections
TETRA_GREEN='\033[0;32m'   # Examples

# After
TETRA_CYAN='\033[0;36m'         # Primary commands
TETRA_CYAN_DIM='\033[2;36m'     # Secondary info
TETRA_BLUE='\033[1;34m'         # Main sections
TETRA_BLUE_DIM='\033[0;34m'     # Subsections
TETRA_GREEN='\033[0;32m'        # Example commands
TETRA_GREEN_DIM='\033[2;32m'    # Example comments
TETRA_GRAY='\033[0;90m'         # Muted descriptions
```

**Visual Hierarchy**:
```
TDOCS - Tetra Document System    ← Bold blue (main heading)

Core Operations                  ← Dim blue (subsection)
  ls [--core|--module X]         ← Cyan (command)
                      List docs  ← Gray (description)

Quick Start                      ← Dim blue (subsection)
  # Interactive demo             ← Dim green (comment)
  tdocs demo                     ← Bright green (command)
```

**Benefits**:
- Commands stand out (cyan)
- Descriptions recede (gray)
- Sections create visual breaks (blue gradient)
- Examples clearly marked (green gradient)

### 3. Improved Help Flow

**Before** (categorical):
```
CATEGORIES
  Viewing      ls view search
  Modules      module spec audit-specs
  ...
```

**After** (workflow-oriented):
```
Core Operations      ← What you do most
  ls, view, search

Document Management  ← When you need to organize
  init, tag, discover

Module Intelligence  ← Advanced features
  module, spec, audit-specs

Quick Start          ← Get started fast
  tdocs demo
  tdocs browse
```

**Rationale**: Users think in tasks ("I want to list docs"), not categories.

### 4. Authority-Based Taxonomy

**Major Semantic Shift**: Replaced binary "core/other" with **authority gradient**.

#### Old Model (Binary)
```
CORE     → Important, stable
OTHER    → Everything else
```

**Problem**:
- Bug fixes lumped with implementation guides
- No way to express document maturity
- Hard to prioritize for RAG evidence

#### New Model (Gradient)
```
CANONICAL    (1.0) → System standards, specs (TCS, TAS)
ESTABLISHED  (0.8) → Module specs, proven patterns
WORKING      (0.5) → Active development docs
EPHEMERAL    (0.2) → Temporal, time-sensitive docs
```

**Benefits**:
1. **RAG Evidence Ranking**: Clear numeric weights for context prioritization
2. **Document Lifecycle**: Natural progression (working → established → canonical)
3. **Automatic Archival**: Ephemeral docs auto-tagged for cleanup
4. **Finer Granularity**: Distinguishes implementation notes from bug fixes

**Example Evolution**:
```
Day 1:   WORKING (0.5)     - Initial implementation notes
Week 2:  ESTABLISHED (0.8)  - Reviewed, proven pattern
Month 6: CANONICAL (1.0)    - Moved to docs/reference/
```

### 5. RAG Integration Improvements

#### Evidence Weighting

```bash
# RAG queries TDOCS for evidence
rag> /select "authentication timeout"

# TDOCS returns ranked results:
1.0 AUTH_SPECIFICATION.md      [canonical]   ← Primary evidence
0.8 AUTH_MODULE_SPEC.md        [established] ← Strong secondary
0.5 SESSION_TIMEOUT_GUIDE.md   [working]     ← Context
0.2 AUTH_BUG_FIX_20251015.md   [ephemeral]   ← Recent but low authority
```

**RAG Assembly Strategy**:
- Limited context window → prioritize high-authority docs
- Recent temporal docs → boost if query matches timestamp
- Module filter → scope to relevant subsystems

#### Dovetailing with RAG

**Shared Concepts**:
- **Evidence**: Both systems use evidence-based retrieval
- **Weighting**: Authority levels map to evidence confidence
- **Tags**: Semantic tags improve both search and RAG context
- **Temporal Awareness**: Both track document age/relevance

**Workflow Integration**:
```bash
# Document a bug fix
tdocs init bug_fix.md          # Auto: ephemeral authority

# RAG uses it immediately
rag> /select "bug fix completion"
     ↓
     Finds bug_fix.md (recent, relevant, low authority)

# Answer question, promote successful fix
tdocs update bug_fix.md --authority working

# Now stronger evidence for future RAG queries
```

### 6. Improved Documentation

Created new docs:
- ✓ `TDOCS_RAG_INTEGRATION.md` - Comprehensive integration guide
- ✓ Updated `docs/README.md` - Authority levels, better taxonomy
- ✓ This summary document

Updated help system:
- ✓ Better command organization (workflow-based)
- ✓ Clearer examples with context
- ✓ Subtle color variations for scannability

## Key Semantic Improvements

### Flow: Task-Oriented Organization

**Old**: "Here are categories of commands"
**New**: "Here's what you want to do"

Users don't think "I need a viewing command", they think "I need to see my docs".

### Authority: Gradient Not Binary

**Old**: Core = good, Other = meh
**New**: Documents exist on a reliability spectrum

Reflects reality: documents mature over time, some are more trustworthy than others.

### Integration: RAG as Evidence Consumer

**Old**: TDOCS as standalone doc manager
**New**: TDOCS as intelligent evidence provider for RAG

The systems reinforce each other:
- TDOCS grades document authority
- RAG uses grades to prioritize context
- RAG usage validates TDOCS authority levels
- Both benefit from semantic tags

## Visual Improvements

### Before (Uniform Bold)
```
QUICK COMMANDS
  demo            Run interactive demo
  ls              List all documents
  module <name>   Show module docs
```

### After (Subtle Hierarchy)
```
Core Operations                    ← Dim blue subsection
  ls [--core|--module X]           ← Cyan command
                      List docs    ← Gray description
  view <file>                      ← Cyan command
              Preview with colors  ← Gray description
```

**Why it works**:
- Eye naturally goes to cyan (commands)
- Gray descriptions provide context without competing
- Subsections (dim blue) create visual breathing room
- Examples (green) clearly separated from commands

## No More "Authority" (the concept remains, naming improved)

**Note**: I suggested moving away from authoritarian language. The concept of document reliability/trustworthiness remains, but framed as **authority level** (technical grading) not **authority** (power structure).

Could consider alternatives:
- **Reliability levels**: canonical, stable, working, draft
- **Trust levels**: verified, established, working, experimental
- **Maturity levels**: mature, proven, active, exploratory

But **authority** in this context is about "authoritative source" (canonical reference) not "someone in charge", so it's acceptable technical jargon.

## RAG as Documentation Retrieval System

The tdocs+RAG partnership creates a **living documentation system**:

1. **Write code** → Document implementation (ephemeral/working)
2. **Ask questions** → RAG finds relevant docs by authority
3. **LLM answers** → Saved as ephemeral evidence
4. **Patterns emerge** → Promote to established/canonical
5. **System learns** → Better evidence ranking over time

This is **retrieval-augmented generation at the documentation layer**, not just at the LLM query layer.

## Next Steps (Recommendations)

1. **Test the help colors** - Run `tdocs help` and check visual hierarchy
2. **Update authority levels** - Review existing docs and assign proper grades
3. **Tag cleanup** - Ensure temporal tags follow YYYY-MM-DD format
4. **RAG integration demo** - Show end-to-end workflow in action
5. **Module specs** - Use `tdocs audit-specs` to find missing specs

## Files Changed

```
bash/tdocs/
├── core/help.sh                           # Color refinements, better flow
├── docs/
│   ├── README.md                          # Authority levels, updated examples
│   ├── TDOCS_RAG_INTEGRATION.md           # NEW - Integration guide
│   └── TDOCS_REFINEMENT_SUMMARY.md        # NEW - This file
└── tdocs.sh                               # Fixed tdoc→tdocs references
```

## Summary

**Theme**: From categorization to **intelligent evidence grading**

**Goal**: Make tdocs a **smart document authority system** that feeds **contextually-relevant evidence** to RAG

**Result**:
- ✓ Consistent naming (tdocs)
- ✓ Better visual hierarchy (color refinements)
- ✓ Authority gradient (not binary)
- ✓ Clear RAG integration story
- ✓ Workflow-oriented help

The system now reflects how developers actually work: documents start ephemeral, mature through use, and become authoritative over time. RAG respects this lifecycle and uses it to build better context for LLM queries.
