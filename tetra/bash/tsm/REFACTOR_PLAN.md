# TSM Complete Refactor Plan

## Methodology
- **Small, incremental changes** - Test after each step
- **Preserve functionality** - No feature changes during refactor
- **Backup before each phase** - Easy rollback if needed
- **Test continuously** - Verify TSM works after each change

## Phase 1: Critical Function Deduplication ✅ COMPLETED
**Goal:** Resolve function conflicts causing unpredictable behavior

### 1.1 Fix `_tsm_start_process()` duplication ✅ DONE
- **Previous:** Defined in both `tsm_core.sh:208` and `tsm_interface.sh:261`
- **Resolution:** Function moved to `tsm_process.sh`, duplicates removed
- **Result:** Start/stop processes work correctly

### 1.2 Fix `tetra_tsm_get_next_id()` duplication ✅ DONE
- **Previous:** Modified in both files, causing ID conflicts
- **Resolution:** Single implementation in `tsm_utils.sh`, removed from `tsm_interface.sh`
- **Result:** New processes get correct lowest unused IDs

### 1.3 Handle `tsm_core_improved.sh` ✅ DONE
- **Previous:** Abandoned refactor attempt
- **Resolution:** Marked as OBSOLETE, functions integrated into proper modules
- **Result:** No missing function errors

## Phase 2: File Reorganization ✅ COMPLETED
**Goal:** Split oversized files and improve separation of concerns

### 2.1 Split `tsm_interface.sh` ✅ DONE (30 lines, was 1,169 lines)
- ✅ Created `tsm_cli.sh` (577 lines) - CLI command handlers
- ✅ Created `tsm_process.sh` (406 lines) - Process lifecycle management
- ✅ Created `tsm_validation.sh` (242 lines) - Validation and helpers
- ✅ Reduced `tsm_interface.sh` to coordination only (30 lines)

### 2.2 Reorganize by responsibility ✅ DONE
- ✅ Functions grouped by responsibility in specialized modules
- ✅ Clear file boundaries established
- ✅ Dependency loading order updated in `tsm.sh`

## Phase 3: Standardization 🔄 IN PROGRESS
**Goal:** Consistent patterns across codebase

### 3.1 Function naming conventions ⚠️ PARTIAL
- ✅ Public API: `tetra_tsm_*` - Most functions follow this pattern
- ✅ Internal: `_tsm_*` - Internal functions properly prefixed
- ⚠️ Helper: `_tsm_*_helper` - Some helpers need renaming for consistency

### 3.2 Error handling unification ⚠️ NEEDS WORK
- ⚠️ Standard return codes: 0, 1, 64, 66 - Some modules inconsistent
- ⚠️ Consistent error message format - Varies across modules
- ⚠️ Unified validation patterns - Different validation styles used

## Phase 4: Optimization & Documentation ⏳ PENDING
**Goal:** Performance, maintainability, usability

### 4.1 Code optimization
- ⏳ Reduce complexity - Some large functions remain (tsm_doctor.sh: 781 lines)
- ⏳ Improve algorithms - Performance analysis needed
- ⏳ Better resource usage - Memory and process optimization pending

### 4.2 Documentation
- ⏳ Function-level docs - Limited inline documentation
- ⏳ Architecture overview - Needs comprehensive update
- ⏳ Usage examples - Basic examples exist in tsm.md

## Current Architecture Status ✅
- **Total files:** 39 (.sh + .md)
- **Total lines:** ~10,000+
- **Largest modules:** tsm_doctor.sh (781), tsm_ports.sh (758), tsm_cli.sh (577)
- **Core coordination:** Clean dependency loading in tsm.sh
- **Interface:** Successfully split into specialized modules

## Testing Strategy
- ✅ Functional tests after each phase - Basic testing completed
- ⚠️ Integration tests for workflows - Need comprehensive test suite
- ⏳ Performance validation - Pending
- ✅ Rollback procedures - OBSOLETE files preserved

## Success Criteria Assessment
- ✅ All existing functionality preserved
- ✅ Code maintainability improved (modular structure achieved)
- ⚠️ Bug count reduced - Ongoing monitoring needed
- ⏳ Performance maintained or improved - Requires analysis