# TDOCS Review Guide

Managing work-in-progress markdown documents with the tdocs review system.

## Overview

The tdocs review system helps manage the lifecycle of WIP documentation files (like `PLAN.md`, `STATUS.md`, `REFACTOR_COMPLETE.md`, etc.) by:

1. **Discovering** - Finding all WIP docs matching common patterns
2. **Classifying** - Mapping filenames to proper tdocs types
3. **Managing** - Interactive or batch archival, formalization, or deletion

## WIP Document Taxonomy

These filename patterns are automatically mapped to tdocs types:

| Pattern | TDOCS Type | Discovery Mode |
|---------|-----------|----------------|
| `*COMPLETE*` | `summary` | track |
| `*SUMMARY*` | `summary` | track |
| `*STATUS*` | `summary` | track |
| `*FIX*`, `*FIXES*` | `bug-fix` | track |
| `*REFACTOR*` | `refactor` | track |
| `*PLAN*` | `plan` | plan |
| `*PROPOSAL*` | `proposal` | plan |
| `*MIGRATION*` | `refactor` | track |
| `*CHANGES*` | `changelog` | track |
| `*IMPLEMENTATION*` | `summary` | track |

## Quick Start

### 1. List all WIP documents

```bash
source ~/tetra/tetra.sh
tdocs review list

# List specific pattern
tdocs review list COMPLETE
```

**Output:**
```
=== WIP Documents ===

repl                 summary         TREE_COMPLETION_COMPLETE /path/to/file.md
midi                 refactor        PROMPT_REFACTOR_COMPLETE /path/to/file.md
...

=== Summary ===
Total: 78 documents

By type:
  summary          42
  refactor         15
  bug-fix          12
  plan              9

By module:
  repl             15
  midi             12
  org              10
  ...
```

### 2. Interactive review

```bash
tdocs review interactive

# Or via REPL
tdocs repl
tdocs> /review
```

**Interactive Session:**
```
[1/78] REPL_FIXES_COMPLETE.md
  Path: /Users/mricos/src/devops/tetra/bash/repl/REPL_FIXES_COMPLETE.md
  Module: repl
  Detected type: summary

  Preview:
    # REPL Fixes Complete

    All tab completion issues resolved...

  Actions:
    [a] Archive → bash/archive/docs/2025-11/repl/REPL_FIXES_COMPLETE.md
    [f] Formalize as tdoc (add metadata, keep in place)
    [m] Move to different location
    [k] Keep as-is (no changes)
    [d] Delete permanently
    [s] Skip (decide later)
    [q] Quit review

  Action [a/f/m/k/d/s/q]: _
```

### 3. Batch operations

```bash
# Archive all *COMPLETE* docs
tdocs review batch COMPLETE

# Or use the batch command directly
source ~/tetra/tetra.sh
source bash/tdocs/core/review.sh
tdocs_review_batch_archive "COMPLETE"
```

## Actions Explained

### Archive (a)
Moves document to dated archive directory:
```
bash/repl/REPL_FIXES_COMPLETE.md
  → bash/archive/docs/2025-11/repl/REPL_FIXES_COMPLETE.md
```

**When to use:**
- Document describes completed work
- Useful for historical reference
- Don't want to lose the content

### Move (m)
Relocate document to a better location with interactive prompts:

```
  Move options:
    [1] bash/repl/docs/REPL_FIXES_COMPLETE.md (module docs/)
    [2] bash/repl/REPL_FIXES_COMPLETE.md (module root)
    [3] docs/REPL_FIXES_COMPLETE.md (global docs/)
    [4] Custom path

  Choose destination [1/2/3/4]: _
```

**When to use:**
- Document belongs in module's `docs/` subdirectory
- Should be in global `docs/` instead of module
- Moving between modules
- Consolidating to better location

### Formalize (f)
Adds tdocs metadata frontmatter, keeps file in place:

```markdown
---
type: summary
lifecycle: W
module: repl
created: 2025-10-15
updated: 2025-11-14
tags: []
---

# REPL Fixes Complete

Original content...
```

**When to use:**
- Document is still relevant
- Want to track it in tdocs system
- Content should be searchable/discoverable

### Keep (k)
No changes, file remains as-is.

**When to use:**
- Still actively working on it
- Not ready to decide
- Needs review first

### Delete (d)
Permanently removes the file (requires confirmation).

**When to use:**
- Content is obsolete
- Duplicates existing docs
- No historical value

### Skip (s)
Move to next document without action.

**When to use:**
- Need more time to decide
- Requires consultation
- Come back later

## Using from REPL

```bash
# Launch tdocs REPL
tdocs repl

# In REPL
tdocs> /review-list              # List all WIP docs
tdocs> /review-list COMPLETE     # List specific pattern
tdocs> /review interactive       # Start interactive review
tdocs> /review batch SUMMARY     # Batch archive SUMMARY docs
```

## Integration with Existing Workflow

### Before: Ad-hoc WIP docs
```
bash/midi/
├── README.md
├── REPL_FIXES_COMPLETE.md
├── STATUS.md
├── REFACTORING_SUMMARY.md
├── IMPLEMENTATION_NOTES.md
└── includes.sh
```

### After: Clean structure
```
bash/midi/
├── README.md
├── docs/
│   └── REFACTORING_2025.md  (formalized, with metadata)
└── includes.sh

bash/archive/docs/2025-11/midi/
├── REPL_FIXES_COMPLETE.md
├── STATUS.md
└── IMPLEMENTATION_NOTES.md
```

## Advanced Usage

### Custom patterns

```bash
# Find specific patterns
tdocs_find_legacy_wip "TODO" "bash/midi"

# Cleanup with custom pattern
tdocs review list "DEPRECATED"
```

### Programmatic access

```bash
source ~/tetra/tetra.sh
source bash/tdocs/core/review.sh

# Get type from filename
type=$(tdocs_detect_type_from_filename "REPL_FIXES.md")
# → "bug-fix"

# Extract module
module=$(tdocs_extract_module "/path/to/bash/midi/file.md")
# → "midi"

# Suggest archive path
archive=$(tdocs_suggest_archive_path "/path/to/bash/midi/STATUS.md")
# → "/path/to/bash/archive/docs/2025-11/midi/STATUS.md"
```

### Batch formalize

```bash
# Formalize all PLAN docs
source bash/tdocs/core/review.sh
tdocs_review_batch_formalize "PLAN"
```

## Best Practices

### 1. Regular review sessions
Run review monthly or when accumulation is noticed:
```bash
# Quick check
tdocs review list | tail -20

# If > 20 docs, run review
tdocs review interactive
```

### 2. Archive completed work
Anything with `COMPLETE`, `SUMMARY` in name → archive immediately

### 3. Formalize living docs
If a doc is referenced regularly → formalize it with metadata

### 4. Use proper tdocs types going forward
Instead of creating `NEW_FEATURE_PLAN.md`, use:
```bash
tdocs init docs/new_feature.md --type plan --module mymodule
```

### 5. Don't accumulate status files
Replace status files with:
```bash
# Log status to TRS
trs_write mymodule note status md "refactoring complete, tests passing"

# Or use git commit messages
git commit -m "Complete REPL refactoring

All tab completion issues resolved.
Tests passing. Ready for review."
```

## Statistics

Current WIP doc count (as of 2025-11-14):
```
Total: 78 WIP documents

By type:
  summary          42  (COMPLETE, SUMMARY, STATUS, IMPLEMENTATION)
  refactor         15  (REFACTOR, REFACTORING, MIGRATION)
  bug-fix          12  (FIX, FIXES)
  plan              9  (PLAN, PROPOSAL)

By module:
  repl             15
  midi             12
  org              10
  tdocs             8
  game              6
  ...
```

**Target:** Reduce to < 20 active WIP docs, rest archived or formalized

## See Also

- `bash/tdocs/README.md` - Main tdocs documentation
- `bash/tdocs/docs/PROMPT_DESIGN.md` - TDOCS taxonomy design
- `bash/tdocs/core/tdocs_constants.sh` - Type and lifecycle definitions
- `bash/trs/trs.sh` - TRS for time-based records
