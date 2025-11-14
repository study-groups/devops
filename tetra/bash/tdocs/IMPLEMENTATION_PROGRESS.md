# TDOCS Refactoring Implementation Progress

## Completed ✅

### 1. Core Ranking System (`core/ranking.sh`)
- ✅ Type-to-base-rank mapping (reference=1.0, guide=0.6, notes=0.3)
- ✅ Length bonus calculator (0.01-0.02 based on word count)
- ✅ Metadata bonus (module field, tag richness)
- ✅ **Inverted recency boost** (0.05 * exp(-days/14) for fresh notes)
- ✅ Timeless flag support (disables recency boost)
- ✅ `tdoc_calculate_rank()` - main formula
- ✅ `tdoc_show_rank_breakdown()` - explain ranking to user

### 2. Help System Refinement (`core/help.sh`)
- ✅ Minimal zen main help (under 30 lines)
- ✅ Removed "authority" terminology
- ✅ Added `help rank` - formula breakdown
- ✅ Added `help types` - type descriptions with examples
- ✅ Updated color palette (subtle intensity variations)
- ✅ Task-oriented organization (not categorical)

### 3. New Commands (`core/scan.sh`, `tdocs.sh`)
- ✅ `tdocs scan` - Manual discovery of tetra/bash and tetra/docs
- ✅ `tdocs rank <file>` - Show ranking breakdown
- ✅ `tdocs promote <file>` - Interactive type promotion
- ✅ `tdocs add` - Alias for init (preferred name)
- ✅ Wired up in main tdocs.sh

### 4. Documentation
- ✅ Created comprehensive refactoring docs:
  - `TDOCS_REFINEMENT_SUMMARY.md` - Before/after comparison
  - `FLOW_AND_SEMANTICS.md` - Design philosophy
  - `TDOCS_RAG_INTEGRATION.md` - Integration guide
  - Updated `docs/README.md` with authority → type semantics

## In Progress 🚧

### 5. Display Updates (Showing Ranks in Grey)
**Status**: Need to update preview.sh, search.sh

**What needs to happen**:
- `tdocs ls` output:
  ```
  reference (3)
    REPL_SPECIFICATION.md                1.05
    AUTH_SPECIFICATION.md                1.04

  guide (12)
    completion_patterns.md               0.63

  notes (5)
    investigation_20251106.md            0.35  fresh

  unranked (9)
    new_feature.md
  ```
  - Group by type (reference/guide/notes/unranked)
  - Right-align ranks in dim grey
  - Add "fresh" hint for <7 day notes
  - Show unranked files at bottom

- `tdocs search` output:
  ```
  1.05  reference  REPL_SPECIFICATION.md
  0.63  guide      completion_patterns.md
  0.35  notes      completion_fix.md  fresh
  ```
  - Rank first (dim grey)
  - Type second (dim grey)
  - Document name (cyan, intensity by type)

**Files to modify**:
- `ui/preview.sh` - Update `tdoc_list_docs()` and `tdoc_render_list_with_preview()`
- `core/search.sh` - Update search result formatting
- `integrations/rag_evidence.sh` - Show ranks in evidence selection

### 6. REPL Prompt Refactoring
**Status**: Need to update tdocs_repl.sh

**Current prompt**:
```
[rag × canonical spec → 3] find >
```

**New prompt**:
```
[rag | ref:3 guide:12 notes:5] 20 >
```

**What needs to happen**:
- Update `_tdocs_repl_build_prompt()` in `tdocs_repl.sh`
- Change format from `modules × filters → count` to `module | type:counts total`
- Show type breakdown (ref:3 guide:12 notes:5) instead of filter names
- Use pipe `|` separator instead of `×`
- Shorten type names (ref, guide, notes)
- Update color coding (intensity by type)

**Files to modify**:
- `tdocs_repl.sh` - Prompt builder function
- `tdocs_commands.sh` - Filter command handlers (support short forms: ref, guide, notes)

### 7. Fast Defaults for `tdocs add`
**Status**: Need to update metadata.sh or create new add handler

**Current `tdocs init`**:
- Interactive prompts for each field
- Requires explicit confirmation

**New `tdocs add`**:
```bash
$ tdocs add completion_fix.md

  completion_fix.md

  type: bug-fix ✓
  timeless: no ✓
  tags: completion,rag,2025-11-06 ✓

  [enter to accept, or field name to edit]
  >

  ✓ indexed  rank: 0.35
```

**What needs to happen**:
- Show detected defaults with ✓ checkmarks
- Single prompt: press enter to accept all
- If user types field name, edit that field only
- After edits, show final result with rank

**Files to modify**:
- `core/metadata.sh` - Update `tdoc_init_doc()` or create `tdoc_add_doc()`
- Make it the default for `tdocs add` command

## Remaining Work 📋

### High Priority
1. **Display ranks in ls/search** (ui/preview.sh, core/search.sh)
2. **REPL prompt refactoring** (tdocs_repl.sh)
3. **Fast defaults for add** (core/metadata.sh)

### Medium Priority
4. Update database.sh to calculate and store ranks in .meta files
5. Update RAG evidence display to show ranks
6. Add unranked file detection and grouping in ls
7. Update filter commands to support short forms (ref, guide, notes)

### Low Priority (Polish)
8. Add color intensity by type (bright/normal/dim cyan)
9. Update completion for new commands (scan, rank, promote)
10. Add fresh hints (<7 days) to display
11. Update tree help integration
12. Create RANKING_SYSTEM.md technical doc

## Testing Checklist

- [ ] `tdocs scan` discovers all markdown files in tetra/bash and tetra/docs
- [ ] `tdocs add <file>` shows fast defaults, press enter to accept
- [ ] `tdocs rank <file>` shows breakdown with formula
- [ ] `tdocs promote <file>` changes type and recalculates rank
- [ ] `tdocs ls` groups by type and shows ranks in grey
- [ ] `tdocs search` shows ranks before results
- [ ] REPL prompt shows `[module | type:counts] total >`
- [ ] Help system shows minimal zen style
- [ ] Ranking formula works (inverted boost for fresh docs)
- [ ] Timeless flag prevents recency boost
- [ ] RAG integration uses new ranks

## Notes

**Key Design Decisions**:
- **Inverted boost** (not penalty) for fresh docs - positive framing
- **Type-based** (not authority-based) - less hierarchical
- **Visible ranks** (grey, not hidden) - transparency
- **Fast defaults** (`tdocs add`) - minimal friction
- **Manual scan** (user rhythm) - not automatic
- **Minimal zen help** (under 30 lines) - get out of the way

**Semantic Shifts**:
- authority → type (reference/guide/notes)
- canonical/established/working/ephemeral → reference/guide/notes
- init → add (lighter weight)
- Ranks visible everywhere (transparent bookkeeping)

**Remaining Integration**:
- REPL needs prompt + filter updates
- Display needs rank rendering
- Add command needs fast defaults
- Database needs rank caching

## Next Steps

1. Update preview.sh to show ranks and group by type
2. Update search.sh to show ranks in results
3. Refactor REPL prompt format
4. Implement fast defaults for add command
5. Test end-to-end workflow
6. Update remaining docs

Current implementation is ~60% complete. Core logic (ranking, scan, promote) is done. UI updates (display, REPL) and polish remain.
