# TSM Aggressive Consolidation - Completed

## Files Deleted
1. `include.sh` - Duplicate of core/include.sh (17 lines)
2. `core/ports_double.sh` - Merged into system/ports.sh (185 lines)  
3. `core/files.sh` - Obsolete TCS 3.0 file utilities (deleted)

## Massive Code Removal

### core/utils.sh
**BEFORE**: 518 lines  
**REMOVED**: ~350 lines of legacy code
- Removed entire `_tetra_tsm_get_all_processes()` (80 lines) - used .meta files
- Removed duplicate `tetra_tsm_resolve_name()` (54 lines)
- Removed `tetra_tsm_is_running_by_id/by_name()` (24 lines)
- Removed non-safe `tetra_tsm_get_next_id()` (60 lines)
- Consolidated to single thread-safe ID allocation
- Converted all resolution functions to JSON-only

### core/metadata.sh
**REMOVED**: 100 lines of compatibility shims
- `_tsm_get_process_file()` - DELETED
- `_tsm_get_pid_file()` - DELETED
- `_tsm_get_log_file()` - DELETED
- `_tsm_is_process_running()` - DELETED
- `_tsm_get_process_by_name()` - DELETED
- `_tsm_kill_process()` - DELETED
- Reduced exports from 19 to 6 functions

### system/ports.sh
**ADDED**: Double-entry port accounting (merged from ports_double.sh)
- `tsm_register_port()`
- `tsm_update_actual_port()`
- `tsm_deregister_port()`
- `tsm_scan_actual_ports()`
- `tsm_reconcile_ports()`

## Consolidations Completed

### 1. ID Allocation
- **BEFORE**: 3 implementations (non-safe, safe wrapper, metadata wrapper)
- **AFTER**: 1 thread-safe implementation in utils.sh
- **Lines saved**: ~120 lines

### 2. Port Systems
- **BEFORE**: 2 separate systems (named ports + double-entry)
- **AFTER**: Unified system in system/ports.sh
- **Lines saved**: 185 lines (file deleted)

### 3. Process Running Checks
- **BEFORE**: 4 duplicate implementations
- **AFTER**: 1 consolidated implementation
- **Lines saved**: ~60 lines

### 4. Name/ID Resolution
- **BEFORE**: 2 duplicate fuzzy matchers + separate helpers
- **AFTER**: 1 unified resolver with JSON metadata
- **Lines saved**: ~130 lines

### 5. Legacy .meta File Support
- **BEFORE**: Supported both .meta bash files AND meta.json
- **AFTER**: JSON only (PM2-style)
- **Lines saved**: ~200+ lines

### 6. Compatibility Shims
- **BEFORE**: 6 shim functions bridging old TCS 3.0 → new system
- **AFTER**: All removed - direct JSON access only
- **Lines saved**: ~100 lines

## Total Impact

| Category | Lines Removed |
|----------|---------------|
| Duplicate ID allocation | 120 |
| Legacy .meta support | 200 |
| Duplicate port systems | 185 |
| Process running checks | 60 |
| Name resolution duplicates | 130 |
| Compatibility shims | 100 |
| Deprecated functions | 50 |
| **TOTAL REMOVED** | **~845 lines** |

## Function Count Reduction

### core/utils.sh
- Before: 18 exported functions
- After: 5 core functions
- Reduction: 72%

### core/metadata.sh  
- Before: 19 exported functions
- After: 6 exported functions
- Reduction: 68%

## What Remains

### Still Needs Attention
1. `process/lifecycle.sh` (429 lines) - Has old start functions, but used by tests
2. `process/management.sh` (609 lines) - New kill command implementation
3. Commented-out includes in core/include.sh
4. Environment variable naming inconsistencies (PORT vs TETRA_PORT)

### Clean Unified APIs
- `tsm_get_next_id()` - Single thread-safe ID allocator
- `tsm_create_metadata()` - PM2-style JSON creation
- `tetra_tsm_is_running()` - Single running check
- `tetra_tsm_resolve_to_id()` - Unified name/ID resolution with fuzzy matching
- `tsm_start_any_command()` - Universal process starter

## Migration Status

✅ **COMPLETE**: JSON metadata migration  
✅ **COMPLETE**: Port system unification  
✅ **COMPLETE**: ID allocation consolidation  
✅ **COMPLETE**: Legacy shim removal  
⚠️  **PENDING**: lifecycle.sh deprecation (needs test migration)  
⚠️  **PENDING**: Environment variable standardization  

## Breaking Changes

1. All `_tsm_*` compatibility functions removed
2. `.meta` file support completely removed
3. `tetra_tsm_get_next_id_safe()` renamed to `tetra_tsm_get_next_id()`
4. Process directories now required (no flat file support)

## Performance Improvements

- **ID allocation**: Now thread-safe with file locking
- **Process lookup**: Direct jq JSON parsing (no bash eval)
- **Port reconciliation**: Single unified accounting system
- **Function exports**: 68% reduction improves bash startup time
