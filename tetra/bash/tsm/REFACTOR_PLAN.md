# TSM Complete Refactor Plan

## Methodology
- **Small, incremental changes** - Test after each step
- **Preserve functionality** - No feature changes during refactor
- **Backup before each phase** - Easy rollback if needed
- **Test continuously** - Verify TSM works after each change

## Phase 1: Critical Function Deduplication ⚠️ URGENT
**Goal:** Resolve function conflicts causing unpredictable behavior

### 1.1 Fix `_tsm_start_process()` duplication
- **Current:** Defined in both `tsm_core.sh:208` and `tsm_interface.sh:261`
- **Action:** Analyze both implementations, keep the better one, remove duplicate
- **Test:** Start/stop processes work correctly

### 1.2 Fix `tetra_tsm_get_next_id()` duplication
- **Current:** Modified in both files, causing ID conflicts
- **Action:** Single implementation in `tsm_utils.sh`, remove from `tsm_interface.sh`
- **Test:** New processes get correct lowest unused IDs

### 1.3 Handle `tsm_core_improved.sh`
- **Current:** Abandoned refactor attempt
- **Action:** Integrate improvements or remove file
- **Test:** No missing function errors

## Phase 2: File Reorganization
**Goal:** Split oversized files and improve separation of concerns

### 2.1 Split `tsm_interface.sh` (1,169 lines → ~400 lines each)
- Create `tsm_cli.sh` - CLI command handlers
- Create `tsm_process.sh` - Process lifecycle management
- Keep `tsm_interface.sh` - Interface coordination only

### 2.2 Reorganize by responsibility
- Group related functions together
- Clear file boundaries
- Update dependency loading order

## Phase 3: Standardization
**Goal:** Consistent patterns across codebase

### 3.1 Function naming conventions
- Public API: `tetra_tsm_*`
- Internal: `_tsm_*`
- Helper: `_tsm_*_helper`

### 3.2 Error handling unification
- Standard return codes: 0, 1, 64, 66
- Consistent error message format
- Unified validation patterns

## Phase 4: Optimization & Documentation
**Goal:** Performance, maintainability, usability

### 4.1 Code optimization
- Reduce complexity
- Improve algorithms
- Better resource usage

### 4.2 Documentation
- Function-level docs
- Architecture overview
- Usage examples

## Testing Strategy
- Functional tests after each phase
- Integration tests for workflows
- Performance validation
- Rollback procedures

## Success Criteria
- All existing functionality preserved
- Code maintainability improved
- Bug count reduced
- Performance maintained or improved