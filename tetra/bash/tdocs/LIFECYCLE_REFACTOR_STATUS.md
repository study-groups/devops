# Lifecycle Refactor - Implementation Status

## Completed ✓

### 1. Core Constants System
**File**: `core/tdocs_constants.sh` (NEW)
- Defined lifecycle stages: D/W/S/C/X (draft/working/stable/canonical/archived)
- Lifecycle multipliers for ranking (D=0.8x, W=1.0x, S=1.3x, C=1.6x, X=0.1x)
- Evidence weight mapping for RAG (C=primary, S=secondary, W=tertiary, D/X=excluded)
- Discovery modes: learn/ref/why/track/plan/all
- Type-to-mode mapping
- Type base ranks
- Helper functions for validation and lookup

### 2. Database Schema Update
**File**: `core/database.sh`
- Changed parameter from `grade` → `lifecycle`
- Default lifecycle: W (working)
- Added type alias resolution (spec/specification)
- Added lifecycle validation
- Evidence weight now calculated from lifecycle constants
- JSON output uses `"lifecycle"` field instead of `"grade"`

### 3. Ranking System Enhancement
**File**: `core/ranking.sh`
- Base rank now uses constants (`tdoc_type_rank()`)
- Added lifecycle parameter to `tdoc_calculate_rank()`
- Lifecycle multiplier applied to base rank
- Adjusted max rank to 2.0 (allows canonical docs to rank higher)
- JSON output includes lifecycle_multiplier and adjusted_base factors

### 4. Main Module Integration
**File**: `tdocs.sh`
- Sources `tdocs_constants.sh` before other components
- Constants available to all tdocs modules

## Remaining Work

### 5. Render Functions - Lifecycle Badges
**Files**: `ui/tags.sh`, `core/search.sh`
**Status**: NOT STARTED

**Tasks**:
- Update `tdoc_render_compact()` to extract and display lifecycle
- Show lifecycle badge: `filename [C]` or `filename [W]`
- Color-code badges based on lifecycle
- Update search result rendering

### 6. REPL - Discovery Mode Prompt
**File**: `tdocs_repl.sh`
**Status**: NOT STARTED

**Tasks**:
- Update `_tdocs_repl_build_prompt()` to show discovery mode instead of type breakdown
- Format: `[mode] context × view [lifecycle] ▶`
- Add mode detection to `find` command
- Add lifecycle filter display `[S+]` syntax
- Implement keyboard navigation (`→/←` for mode cycling)

### 7. Find Command - Mode Detection
**File**: `tdocs_repl.sh` (find command section)
**Status**: NOT STARTED

**Tasks**:
- Detect discovery mode from type argument
- Auto-switch to appropriate mode: `find guide` → `[learn]` mode
- Support plural forms: `guides` → `guide`
- Filter documents by mode's type list

### 8. Help Text Updates
**Files**: Multiple
**Status**: NOT STARTED

**Tasks**:
- Update all help text: grade → lifecycle
- Document lifecycle stages (D/W/S/C/X)
- Document discovery modes
- Update examples in help

### 9. Data Migration
**Status**: NOT STARTED - CRITICAL

**Tasks**:
- Create migration script to convert existing metadata
- Map A→C, B→S, C→W, X→X
- Update all `.meta` files in `$TDOCS_DB_DIR`
- Handle documents without lifecycle (default to W)
- Preserve backup of original data

### 10. Backward Compatibility
**Status**: NOT STARTED

**Tasks**:
- Add grade→lifecycle alias in read functions
- Gracefully handle old "grade" field in metadata
- Warn on deprecated field usage

## Testing Checklist

- [ ] Create new document with lifecycle
- [ ] Ranking includes lifecycle multiplier
- [ ] Search results show lifecycle badges
- [ ] Filter by lifecycle (`[S+]`)
- [ ] Discovery mode switching works
- [ ] Migration script tested on backup
- [ ] RAG evidence weight calculated correctly

## Breaking Changes

1. **Database Schema**: `grade` field renamed to `lifecycle`
   - Old `.meta` files need migration
   - Old frontmatter needs update

2. **Function Signatures**: `tdoc_calculate_rank()` now requires lifecycle parameter
   - Calls without lifecycle will use default (W)
   - Should audit all callers

3. **JSON Output**: Metadata now has `lifecycle` instead of `grade`
   - External tools reading metadata need update

## Migration Strategy

### Phase 1: Soft Launch (Current)
- New code uses lifecycle
- Old grade field tolerated in reads
- No user-facing changes yet

### Phase 2: UI Update
- Prompt shows discovery modes
- Lifecycle badges in list view
- Help text updated

### Phase 3: Hard Cutover
- Run migration script
- Remove grade compatibility layer
- Announce breaking change

## Next Steps

1. **Immediate**: Complete render functions (lifecycle badges)
2. **Next**: Update REPL prompt system
3. **Then**: Implement discovery mode navigation
4. **Finally**: Data migration + testing

## Notes

- Discovery mode system aligns with org REPL patterns
- Lifecycle is semantically clearer than grade
- Type+lifecycle gives fine-grained ranking control
- Migration is one-way (no rollback without backup)
