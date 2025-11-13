# TDOCS Refactoring Session Summary
*2025-11-07*

## What We Accomplished

### 1. Semantic Shift: Authority → Type-Based Ranking

**Problem**: "Authority" felt hierarchical and power-based. Didn't reflect natural document lifecycle.

**Solution**: Type-based ranking with **inverted recency boost**
- `type: reference` (base 1.0) - specs, standards, contracts
- `type: guide` (base 0.6) - patterns, how-tos, proven solutions
- `type: notes` (base 0.3) - fixes, investigations, fresh thinking

**Key innovation**: Fresh notes get **boosted** (+0.05), not penalized
- Positive framing: "this is fresh context!" vs "this is being punished"
- Exponential decay over 14 days (2-week sprint cadence)
- Timeless flag prevents decay for stable docs

### 2. Implemented Core Ranking System

**Created**: `core/ranking.sh`

**Formula**:
```
rank = base + bonuses + recency_boost

base:           1.0 (reference), 0.6 (guide), 0.3 (notes)
bonuses:        +0.01-0.02 (length), +0.01 (metadata)
recency_boost:  +0.05 * exp(-days/14) for temporal docs
timeless:       disables recency boost
```

**Functions**:
- `tdoc_calculate_rank()` - Main ranking calculator
- `tdoc_show_rank_breakdown()` - Explain formula to user
- `tdoc_get_base_rank()` - Type → base rank mapping

### 3. New Commands

**`tdocs add <file>`** - Fast metadata editing (preferred over `init`)
- User's dev rhythm: `tdocs scan` → finds new files → `tdocs add` to refine metadata
- Will implement fast defaults (press enter to accept all)

**`tdocs scan`** - Manual discovery
- Scans `tetra/bash/` and `tetra/docs/`
- User calls frequently as part of dev workflow
- Shows new files, indexed count, missing metadata

**`tdocs rank <file>`** - Show ranking breakdown
- Explains formula with actual numbers
- Shows: base, length bonus, metadata bonus, recency boost
- Helps users understand/tune the system

**`tdocs promote <file>`** - Interactive type upgrade
- notes → guide → reference
- Optional rename during promotion
- Optional timeless flag
- Recalculates rank automatically

### 4. Minimal Zen Help System

**Refactored**: `core/help.sh` and `tdocs.sh`

**Before** (categorical, verbose):
```
CATEGORIES
  Core         init view tag ls
  Discovery    discover audit index
  ...
```

**After** (minimal, color intensity):
```
tdocs - type-based doc ranking

  ls              list (with ranks)      ← Normal cyan (primary)
  view <n>        show doc #n           ← Normal cyan
  search <q>      find text             ← Normal cyan
  rank <file>     explain ranking       ← Dim cyan (secondary)

  add <file>      edit metadata         ← Normal cyan
  promote <file>  notes→guide→ref       ← Dim cyan
  scan            refresh index         ← Dim cyan

Types: reference 1.0 • guide 0.6 • notes 0.3  ← Dim grey (hints)
```

**Color hierarchy**:
- Bright cyan: Title
- Normal cyan: Primary commands (what you use most)
- Dim cyan: Secondary/power commands
- Grey: Descriptions
- Dim grey: Hints/metadata

**Topic help added**:
- `help rank` - Formula breakdown
- `help types` - Type descriptions with examples
- `help filter` - Filter syntax (updated for ref/guide/notes)

### 5. Documentation

**Created comprehensive guides**:
- `FLOW_AND_SEMANTICS.md` - Design philosophy and rationale
- `TDOCS_RAG_INTEGRATION.md` - How tdocs + RAG work together
- `TDOCS_REFINEMENT_SUMMARY.md` - Before/after comparison
- `SESSION_SUMMARY.md` - This file
- `IMPLEMENTATION_PROGRESS.md` - Technical progress tracker

**Updated**:
- `docs/README.md` - Replaced authority taxonomy with type-based
- All examples changed from `tdoc` → `tdocs`
- Database paths fixed (`$TETRA_DIR/tdocs/` not `tdoc/`)

## Key Design Decisions

### 1. Inverted Boost (Not Penalty)
**Why**: Positive framing. Fresh notes are special, not punished.
```
Day 0:   0.3 + 0.05 = 0.35  (boosted!)
Week 2:  0.3 + 0.02 = 0.32  (fading)
Month 2: 0.3 + 0.0  = 0.30  (settled at base)
```

### 2. `add` Not `init`
**Why**: Lighter weight. Files already auto-discovered, you're just editing metadata.
- `init` sounds heavy ("initializing a system")
- `add` sounds light ("adding metadata to known file")

### 3. Manual Scan (Not Auto)
**Why**: User control. Part of dev rhythm.
- User calls `tdocs scan` frequently during development
- Explicit, predictable, not magical
- Respects user's workflow

### 4. Visible Ranks (In Grey)
**Why**: Transparency. User should know the bookkeeping exists.
- Shows rank but doesn't dominate (grey = metadata)
- Builds trust (not a black box)
- Helps user learn what makes docs rank higher

### 5. Minimal Zen Help
**Why**: Get out of the way. Every line actionable.
- Under 30 lines
- No categories, just verbs
- Color intensity creates hierarchy
- Task-oriented (not conceptual)

### 6. Type (Not Authority)
**Why**: Less hierarchical, more descriptive.
- "authority" = power structure, someone in charge
- "type" = what kind of document is this
- Natural progression: notes mature into guides, guides into references

## File Changes

### New Files Created
```
bash/tdocs/
├── core/
│   ├── ranking.sh                    # NEW - Ranking calculator
│   └── scan.sh                       # NEW - Manual discovery + promote
├── docs/
│   ├── FLOW_AND_SEMANTICS.md         # NEW - Design philosophy
│   ├── TDOCS_RAG_INTEGRATION.md      # NEW - Integration guide
│   ├── TDOCS_REFINEMENT_SUMMARY.md   # NEW - Before/after
│   └── SESSION_SUMMARY.md            # NEW - This file
└── IMPLEMENTATION_PROGRESS.md        # NEW - Technical tracker
```

### Modified Files
```
bash/tdocs/
├── core/
│   └── help.sh              # Minimal zen help + new topics
├── docs/
│   └── README.md            # Type-based taxonomy, updated examples
└── tdocs.sh                 # Wire up new commands (add, scan, rank, promote)
```

## Implementation Status: ~65% Complete

### ✅ Completed (Core Logic)
- [x] Ranking system with inverted boost
- [x] Type-to-rank mapping
- [x] Scan command (manual discovery)
- [x] Rank command (show breakdown)
- [x] Promote command (interactive upgrade)
- [x] Minimal zen help
- [x] Help topics (rank, types)
- [x] Main help with color intensity
- [x] Add command (alias for init)
- [x] Comprehensive documentation

### 🚧 In Progress (UI Layer)
- [ ] Display ranks in `ls` output (grey, right-aligned)
- [ ] Group by type (reference/guide/notes/unranked)
- [ ] Display ranks in `search` output
- [ ] REPL prompt refactoring (`[module | type:counts] total >`)
- [ ] Fast defaults for `tdocs add` (press enter to accept)
- [ ] Update RAG evidence display with ranks
- [ ] Filter command short forms (ref, guide, notes)

### 📋 Remaining (Polish)
- [ ] Color intensity by type (bright/normal/dim cyan for docs)
- [ ] Fresh hints (<7 days) in listings
- [ ] Unranked file grouping
- [ ] Update completion for new commands
- [ ] Calculate and cache ranks in .meta files
- [ ] Test end-to-end workflows

## Next Session TODO

### High Priority (Must Do)

#### 1. Display Ranks in `ls` Output
**File**: `ui/preview.sh`

**Current**:
```
bash/rag/docs/completion_patterns.md
bash/rag/docs/bug_fix_20251106.md
```

**Target**:
```
reference (3)
  REPL_SPECIFICATION.md                1.05
  AUTH_SPECIFICATION.md                1.04

guide (12)
  completion_patterns.md               0.63
  flow_manager_guide.md                0.61

notes (5)
  investigation_20251106.md            0.35  fresh
  bug_fix_20251015.md                  0.31

unranked (9)
  new_feature.md
```

**Tasks**:
- [ ] Group documents by type (reference/guide/notes/unranked)
- [ ] Right-align ranks in dim grey `\033[2;37m`
- [ ] Add "fresh" hint for notes <7 days old
- [ ] Show unranked files at bottom
- [ ] Update `tdoc_list_docs()` function
- [ ] Update `tdoc_render_list_with_preview()` if needed

#### 2. REPL Prompt Refactoring
**File**: `tdocs_repl.sh`

**Current**:
```
[rag × canonical spec → 3] find >
```

**Target**:
```
[rag | ref:3 guide:12 notes:5] 20 >
```

**Tasks**:
- [ ] Update `_tdocs_repl_build_prompt()` function
- [ ] Change from `modules × filters → count` to `module | type:counts total`
- [ ] Calculate type counts (how many ref, guide, notes)
- [ ] Use pipe `|` separator instead of `×`
- [ ] Show breakdown instead of filter names
- [ ] Update colors (cyan intensity by type)

#### 3. Fast Defaults for `tdocs add`
**File**: `core/metadata.sh` or create new handler

**Current**:
```
$ tdocs add file.md
  Type: [prompt for input]
  Timeless: [prompt for input]
  Tags: [prompt for input]
```

**Target**:
```
$ tdocs add file.md

  file.md

  type: bug-fix ✓
  timeless: no ✓
  tags: completion,rag,2025-11-06 ✓

  [enter to accept, or field name to edit]
  > [just press enter]

  ✓ indexed  rank: 0.35
```

**Tasks**:
- [ ] Auto-detect defaults (type, tags, timeless)
- [ ] Display all defaults with ✓ checkmarks
- [ ] Single prompt: enter to accept all
- [ ] If user types field name, edit that field only
- [ ] Show final rank after metadata saved
- [ ] Update `tdoc_init_doc()` or create `tdoc_add_doc()`

### Medium Priority (Should Do)

#### 4. Display Ranks in `search` Output
**File**: `core/search.sh`

**Target**:
```
1.05  reference  REPL_SPECIFICATION.md
0.63  guide      completion_patterns.md
0.35  notes      completion_fix.md  fresh
```

**Tasks**:
- [ ] Show rank first (dim grey)
- [ ] Show type second (dim grey)
- [ ] Show document name (cyan, intensity by type)
- [ ] Add fresh hint for <7 day notes

#### 5. Filter Short Forms
**File**: `tdocs_commands.sh`, `tdocs_repl.sh`

**Support short forms**:
- `filter type ref` → reference types
- `filter type guide` → guide types
- `filter type notes` → notes types

**Tasks**:
- [ ] Update filter parser to accept short forms
- [ ] Map short → long (ref→reference, etc.)
- [ ] Update tab completion
- [ ] Update help text

#### 6. Calculate and Store Ranks in `.meta`
**File**: `core/database.sh`

**Tasks**:
- [ ] Call `tdoc_calculate_rank()` when creating/updating metadata
- [ ] Store `rank` and `rank_factors` in `.meta` file
- [ ] Cache rank (only recalculate on metadata change)
- [ ] Add `timeless` field to frontmatter parsing

### Low Priority (Nice to Have)

#### 7. Color Intensity by Document Type
**All display code**

**Target**:
```
reference docs:  bright cyan  \033[1;36m
guide docs:      normal cyan  \033[0;36m
notes docs:      dim cyan     \033[2;36m
unranked docs:   dim grey     \033[2;37m
```

#### 8. Update RAG Evidence Display
**File**: `integrations/rag_evidence.sh`

**Show ranks when RAG selects evidence**:
```
rag> select "completion hang"

  Searching...

  1.05  reference  REPL_SPECIFICATION.md
  0.63  guide      completion_patterns.md
  0.35  notes      completion_fix.md  fresh

  Added 3 docs
```

#### 9. Tab Completion Updates
**File**: `tdocs_completion.sh`, `tdocs_repl.sh`

**Add completion for**:
- `tdocs add <tab>` → suggest files
- `tdocs rank <tab>` → suggest files
- `tdocs promote <tab>` → suggest files
- `filter type <tab>` → ref, guide, notes

## Testing Checklist for Next Session

When implementation is complete, test:

- [ ] `tdocs scan` discovers all markdown files
- [ ] `tdocs add <file>` shows fast defaults, press enter works
- [ ] `tdocs rank <file>` shows breakdown with correct math
- [ ] `tdocs promote <file>` changes type and recalculates rank
- [ ] `tdocs ls` groups by type and shows ranks in grey
- [ ] `tdocs search` shows ranks before results
- [ ] REPL prompt shows `[module | type:counts] total >`
- [ ] Fresh notes (<7 days) show "fresh" hint
- [ ] Unranked files appear at bottom of ls
- [ ] Timeless docs don't decay over time
- [ ] Recency boost formula works (0.05 at day 0, ~0.0 at 60 days)
- [ ] Help system shows minimal zen style
- [ ] Colors use subtle intensity (not rainbow)

## Quick Start for Next Session

```bash
# 1. Test what we've built so far
cd /Users/mricos/src/devops/tetra/bash/tdocs
tdocs help              # Should show minimal zen help
tdocs help rank         # Should show formula
tdocs scan              # Should discover files
tdocs rank <some-file>  # Should show breakdown (if file has metadata)

# 2. Start with high-priority UI updates
# Edit ui/preview.sh to show ranks
# Edit tdocs_repl.sh to update prompt
# Edit core/metadata.sh for fast defaults

# 3. Test incrementally
# After each change, run tdocs ls or tdocs browse
# Make sure colors look right, ranks display correctly
```

## Key Files Reference

**Core logic** (done):
- `core/ranking.sh` - Ranking calculator
- `core/scan.sh` - Scan + promote commands
- `core/help.sh` - Minimal zen help
- `tdocs.sh` - Main command router

**UI layer** (needs work):
- `ui/preview.sh` - List display with ranks
- `core/search.sh` - Search result display
- `tdocs_repl.sh` - REPL prompt format
- `core/metadata.sh` - Fast defaults for add

**Integration**:
- `integrations/rag_evidence.sh` - RAG evidence with ranks
- `tdocs_commands.sh` - REPL command handlers
- `core/database.sh` - Rank caching in .meta

## Notes for Future

**Philosophy**: Type-based ranking with inverted boost creates a **living documentation system** where docs naturally mature from notes → guides → references, with fresh context getting visibility while it matters.

**User experience**: Minimal, zen, out of the way. Visible ranks build trust. Fast defaults reduce friction. Manual scan respects workflow.

**Integration**: TDOCS provides intelligent evidence to RAG. RAG usage validates TDOCS ranking. Symbiotic feedback loop.

---

**Session duration**: ~4 hours of planning and implementation
**Code written**: ~500 lines (ranking.sh, scan.sh, help updates)
**Docs written**: ~2000 lines (comprehensive guides)
**Completion**: 65% (core done, UI remains)
