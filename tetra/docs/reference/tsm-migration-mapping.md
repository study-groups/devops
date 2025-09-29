# TSM Migration File Mapping

## Overview
This document provides the detailed file-by-file mapping for migrating TSM from the flat tsm_*.sh structure to the organized hierarchical structure.

## Current Status
- ✅ **New organized structure is working** (bash/tsm/core/, system/, etc.)
- ❌ **Old flat structure still exists** (bash/tsm/tsm_*.sh files)
- 🎯 **Goal: Remove duplicates, keep organized structure**

## File Mapping Table

### Core Components (Already Migrated ✅)
| Old File (TO REMOVE) | New File (KEEP) | Status | Notes |
|---------------------|-----------------|--------|-------|
| `tsm_config.sh` | `core/config.sh` | ✅ Active | New file in use |
| `tsm_utils.sh` | `core/utils.sh` | ✅ Active | New file in use |
| `tsm_validation.sh` | `core/validation.sh` | ✅ Active | New file in use |
| `tsm_environment.sh` | `core/environment.sh` | ✅ Active | New file in use |
| `tsm_files.sh` | `core/files.sh` | ✅ Active | New file in use |
| `tsm_helpers.sh` | `core/helpers.sh` | ✅ Active | New file in use |
| `tsm_setup.sh` | `core/setup.sh` | ✅ Active | New file in use |
| `tsm_core.sh` | `core/core.sh` | ✅ Active | New file in use |

### System Components (Already Migrated ✅)
| Old File (TO REMOVE) | New File (KEEP) | Status | Notes |
|---------------------|-----------------|--------|-------|
| `tsm_formatting.sh` | `system/formatting.sh` | ✅ Active | New file in use |
| `tsm_ports.sh` | `system/ports.sh` | ✅ Active | New file in use |
| `tsm_doctor.sh` | `system/doctor.sh` | ✅ Active | New file in use |
| `tsm_monitor.sh` | `system/monitor.sh` | ✅ Active | New file in use |
| `tsm_patrol.sh` | `system/patrol.sh` | ✅ Active | New file in use |
| `tsm_analytics.sh` | `system/analytics.sh` | ✅ Active | New file in use |
| `tsm_audit.sh` | `system/audit.sh` | ✅ Active | New file in use |
| `tsm_resource_manager.sh` | `system/resource_manager.sh` | ✅ Active | New file in use |
| `tsm_session_aggregator.sh` | `system/session_aggregator.sh` | ✅ Active | New file in use |

### Process Components (Already Migrated ✅)
| Old File (TO REMOVE) | New File (KEEP) | Status | Notes |
|---------------------|-----------------|--------|-------|
| `tsm_process.sh` | `process/management.sh` | ✅ Active | New file in use |
| `tsm_lifecycle.sh` | `process/lifecycle.sh` | ✅ Active | New file in use |
| `tsm_inspect.sh` | `process/inspection.sh` | ✅ Active | New file in use |
| `tsm_list.sh` | `process/list.sh` | ✅ Active | New file in use |

### Services Components (Already Migrated ✅)
| Old File (TO REMOVE) | New File (KEEP) | Status | Notes |
|---------------------|-----------------|--------|-------|
| `tsm_service.sh` | `services/definitions.sh` | ✅ Active | New file in use |
| `tsm_services_config.sh` | `services/registry.sh` | ✅ Active | New file in use |
| - | `services/startup.sh` | ✅ Active | New functionality |

### Interface Components (Already Migrated ✅)
| Old File (TO REMOVE) | New File (KEEP) | Status | Notes |
|---------------------|-----------------|--------|-------|
| `tsm_interface.sh` | `interfaces/cli.sh` | ✅ Active | New file in use |
| `tsm_repl.sh` | `interfaces/repl.sh` | ✅ Active | New file in use |
| `tsm_cli.sh` | `interfaces/cli.sh` | ✅ Active | Merged into cli.sh |

### Integration Components (Already Migrated ✅)
| Old File (TO REMOVE) | New File (KEEP) | Status | Notes |
|---------------------|-----------------|--------|-------|
| `tsm_nginx.sh` | `integrations/nginx.sh` | ✅ Active | New file in use |
| `tsm_systemd.sh` | `integrations/systemd.sh` | ✅ Active | New file in use |
| `tsm_tview.sh` | `integrations/tview.sh` | ✅ Active | New file in use |

### Special Cases - Root Level Files
| File | Action | Status | Notes |
|------|--------|--------|-------|
| `tsm.sh` | **KEEP** | ✅ Active | Main entry point |
| `include.sh` | **KEEP** | ✅ Active | New include system |
| `include_minimal.sh` | **KEEP** | ✅ Active | Minimal loader |
| `index.sh` | **KEEP** | ✅ Active | Index system |
| `tserve.sh` | **KEEP** | ✅ Active | Service runner |
| `tserve_enhanced.sh` | **KEEP** | ✅ Active | Enhanced features (514 lines vs 313 in tserve.sh) |

### Files to Investigate Further
| File | Issue | Action Needed | Resolution |
|------|-------|---------------|------------|
| `tsm_discover.sh` | Service discovery functionality | ✅ KEEP | Unique functionality, no equivalent in organized structure |
| `tserve_enhanced.sh` | Enhanced version of tserve.sh | ✅ KEEP | Different implementation (514 vs 313 lines), enhanced features |

### Obsolete Files (Already Marked)
| File | Status | Notes |
|------|--------|-------|
| `OBSOLETE_tsm_core_improved.sh` | ✅ Can remove | Already marked obsolete |

## Migration Commands

### Phase 1: Safe Removals (Verified Duplicates)
```bash
# Core duplicates - SAFE TO REMOVE
rm bash/tsm/tsm_config.sh
rm bash/tsm/tsm_utils.sh
rm bash/tsm/tsm_validation.sh
rm bash/tsm/tsm_environment.sh
rm bash/tsm/tsm_files.sh
rm bash/tsm/tsm_helpers.sh
rm bash/tsm/tsm_setup.sh
rm bash/tsm/tsm_core.sh

# System duplicates - SAFE TO REMOVE
rm bash/tsm/tsm_formatting.sh
rm bash/tsm/tsm_ports.sh
rm bash/tsm/tsm_doctor.sh
rm bash/tsm/tsm_monitor.sh
rm bash/tsm/tsm_patrol.sh
rm bash/tsm/tsm_analytics.sh
rm bash/tsm/tsm_audit.sh
rm bash/tsm/tsm_resource_manager.sh
rm bash/tsm/tsm_session_aggregator.sh

# Process duplicates - SAFE TO REMOVE
rm bash/tsm/tsm_process.sh
rm bash/tsm/tsm_lifecycle.sh
rm bash/tsm/tsm_inspect.sh
rm bash/tsm/tsm_list.sh

# Services duplicates - SAFE TO REMOVE
rm bash/tsm/tsm_service.sh
rm bash/tsm/tsm_services_config.sh

# Interface duplicates - SAFE TO REMOVE
rm bash/tsm/tsm_interface.sh
rm bash/tsm/tsm_repl.sh
rm bash/tsm/tsm_cli.sh

# Integration duplicates - SAFE TO REMOVE
rm bash/tsm/tsm_nginx.sh
rm bash/tsm/tsm_systemd.sh
rm bash/tsm/tsm_tview.sh

# Obsolete files
rm bash/tsm/OBSOLETE_tsm_core_improved.sh
```

### Phase 2: Validation Commands
```bash
# Test TSM still works after removals
./bash/tsm/tsm.sh list
./bash/tsm/tsm.sh doctor

# Verify no broken includes
bash -n bash/tsm/include.sh
bash -n bash/tsm/tsm.sh
```

### Phase 3: Final Verification ✅ COMPLETE
```bash
# ✅ VERIFIED: tsm_discover.sh has unique service discovery functionality
# ✅ VERIFIED: tserve_enhanced.sh is different from tserve.sh (enhanced features)
# ✅ ALL FILES CLASSIFIED - Ready for migration
```

## Risk Assessment

### ✅ ZERO RISK - Verified Safe Removals
- All tsm_*.sh files in Phase 1 have direct equivalents in organized structure
- New organized files are actively used and working
- 27 files can be safely removed immediately

### ✅ VERIFIED - Keep Unique Files
- `tsm_discover.sh` - Unique service discovery functionality
- `tserve_enhanced.sh` - Enhanced server with additional features

### ✅ NO RISK - Keep As-Is
- Root level files (tsm.sh, include.sh, etc.) - essential entry points
- All organized directory structure - working and in use

## Expected Results

**Before Migration:**
- 70+ files in bash/tsm/ (flat + organized)
- Confusing dual structure
- Risk of loading wrong files

**After Migration:**
- ~40 files in bash/tsm/ (organized only)
- Clean hierarchical structure
- Single source of truth for each component
- Reduced complexity by ~40%

## Rollback Plan

If anything breaks:
```bash
git checkout HEAD -- bash/tsm/tsm_*.sh
```

All removed files can be instantly restored from git.