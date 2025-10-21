# TSM Legacy Code Archive - 2025-10-17

## Archived Files

This directory contains legacy TSM code that was removed during the module loading refactor.

### Files Archived

1. **tsm_discover.sh** (11KB) - Old discovery mechanism, superseded by organized module structure
2. **tserve.sh** - Legacy test server implementation
3. **tserve_enhanced.sh** - Legacy enhanced test server
4. **test_new_structure.sh** - Test script used during refactor, now redundant
5. **handlers/** - Incomplete handler experiment (base_handler.sh, service_handler.sh)
   - Never integrated into main codebase
   - Functionality duplicated in services/ modules
6. **tview/** - Old TView integration (actions.sh, providers.sh)
   - Replaced by integrations/tview.sh

### Why Archived

These files were:
- Never sourced by the active codebase
- Referencing non-existent files (tsm_monitor.sh, tsm_analytics.sh, tsm_session_aggregator.sh at wrong paths)
- Incomplete experiments that never reached production
- Superseded by the organized module structure in core/, system/, services/, process/, integrations/

### Refactor Summary

**Before:**
- 8 modules loaded
- Missing critical modules (metadata, runtime, start, list)
- Broken lazy-loading with wrong file paths
- No initialization

**After:**
- 30 modules loaded in 6 dependency-ordered phases
- TETRA_SRC validation
- All analytics/monitor/session functions pre-loaded
- Proper initialization with _tsm_init_global_state

### Recovery

If needed, these files can be recovered from this archive or from git history at commit: `$(git rev-parse HEAD)`
