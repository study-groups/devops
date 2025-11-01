# Function Violations Report

## Executive Summary

This report identifies function export and call violations throughout the codebase, similar to the `repl_get_history_file()` issue that was discovered and fixed.

**Total Violations Found:** 500+ potential violations across 1065 exported functions

## Critical Issues

### 1️⃣ Exported Functions Not Defined in Same File (58 violations)

These are DEFINITE bugs - functions are exported but never defined:

#### REPL Integration Issues
- `bash/tree/demo_tree_repl.sh:254` - exports `repl_build_prompt` but doesn't define it
- `bash/org/org_repl.sh:399` - exports `repl_build_prompt` but doesn't define it
- `bash/game/games/estoface/core/estoface_repl.sh:394` - exports `repl_build_prompt` but doesn't define it
- `bash/game/games/pulsar/pulsar_repl.sh:446` - exports `repl_build_prompt` but doesn't define it
- `bash/game/games/formant/formant_repl.sh:357` - exports `repl_build_prompt` but doesn't define it
- `bash/rag/rag_repl.sh:451` - exports `repl_build_prompt` but doesn't define it
- `bash/tdocs/tdocs_repl.sh:91` - exports `repl_build_prompt` but doesn't define it

**Pattern:** Multiple REPL files export `repl_build_prompt` without defining it. This function was likely moved or renamed.

#### Org Module Issues (bash/org/)
Multiple test/experimental includes files export org functions without defining them:
- `includes_add_one.sh` - exports org_list, org_active, org_switch, org_create (not defined)
- `includes_verbose.sh` - exports org_list, org_active, org_switch, org_create, org_import, org_discover, org_validate, org_push, org_pull, org_rollback, org_history (not defined)
- `includes_add_all.sh` - exports org, org_list, org_active, org_switch, org_create (not defined)
- `includes_test_*.sh` - multiple test files with similar issues
- `includes_fixed.sh` - exports org_list, org_active, org_switch, org_create, org_import, org_discover, org_validate, org_push, org_pull, org_rollback, org_history (not defined)

**Pattern:** Test/experimental include files appear to be stubs or outdated.

#### TSM Core Issues (bash/tsm/core/core.sh)
Lines 77-128 export 15 functions that aren't defined:
- `tetra_tsm_setup`
- `_tsm_validate_script`
- `_tsm_generate_process_name`
- `_tsm_get_process_file`
- `_tsm_get_pid_file`
- `_tsm_get_log_file`
- `_tsm_write_process_info`
- `_tsm_read_process_info`
- `_tsm_is_process_running`
- `_tsm_get_process_by_name`
- `_tsm_kill_process`
- `_tsm_load_environment`
- `_tsm_extract_env_vars`
- `_tsm_get_env_port`
- `_tsm_get_env_name`

**Pattern:** These functions are likely defined in other files that should be sourced first.

#### Other Module Issues
- `bash/rag/cdp/tests/test_cdp_basic.sh:264-265` - exports `cdp_register_actions`, `cdp_execute_action` (not defined)
- `bash/rag/actions.sh:222` - exports `list_available_agents` (not defined)

---

## 2️⃣ Function Calls to Potentially Missing Functions (440+ warnings)

These require investigation - functions are called but may not exist globally:

### Logging System
- `bash/utils/unified_log.sh:28,139` - calls `tetra_log_console` which may not exist

### TSM Module (Most violations)

#### Main TSM File (bash/tsm/tsm.sh)
Calls to potentially missing functions:
- `tsm_load_components` (lines 8, 35)
- `tsm_show_simple_help` (lines 43, 296, 303, 403)
- `tsm_show_detailed_help` (lines 291, 301, 428)
- `tsm_setup` (lines 51, 67)
- `tsm_start`, `tsm_stop`, `tsm_delete`, `tsm_cleanup`, `tsm_kill`, `tsm_restart` (lifecycle commands)
- `tsm_list_services`, `tsm_show_service`, `tsm_info`, `tsm_logs`, `tsm_env`, `tsm_paths` (info commands)
- Port-related: `tsm_scan_ports`, `tsm_list_named_ports`, `tsm_scan_named_ports`, `tsm_ports_overview`, `tsm_validate_port_registry`, `tsm_set_named_port`, `tsm_remove_named_port`, `tsm_detect_conflicts`, `tsm_import_ports`, `tsm_export_ports`
- `tsm_doctor`, `tsm_list_patterns`, `tsm_save_pattern`, `tsm_save`, `tsm_rm`, `tsm_startup`

#### TSM Core Files
**bash/tsm/core/utils.sh** - Heavy use of:
- `tsm_json_escape` (lines 8, 23, 26, 39)
- `tsm_id` (lines 75, 85, 161, 162, 203, 248, 249, 263, 292, 293)
- `tsm_get_setsid` (line 122)
- `tsm_smart_resolve`, `tsm_id_to_name`, `tsm_name_to_id`, `tsm_resolve_to_id` (multiple lines)
- `tsm_is_running`, `tsm_extract_port`

**bash/tsm/core/environment.sh** - calls:
- `tsm_load_environment`, `tsm_extract_env_vars`, `tsm_get_env_port`, `tsm_get_env_name`

**bash/tsm/core/help.sh** - calls:
- `tsm_help_section`, `tsm_help_command`, `tsm_help_flag`, `tsm_help_example` (massively repeated)

**bash/tsm/core/validation.sh** - calls:
- `tsm_setup`, `tsm_validate_script`, `tsm_auto_detect_env`, `tsm_validate_env_file`, `tsm_resolve_script_path`, `tsm_generate_name`, `tsm_reset_id`, `tsm_id`

**bash/tsm/core/config.sh** - calls:
- `tsm_init_global_state` (lines 28, 50)

**bash/tsm/core/include.sh** - calls:
- `tsm_init_global_state` (lines 72, 73)

**bash/tsm/core/core.sh** - calls:
- `tsm_init_global_state`, `tsm_config`, `tsm_lifecycle_init_all`, `tsm_repl_load_utils`

#### TSM Tests
- **test_env_optimization.sh** - calls `tsm_get_env_port`, `tsm_get_env_name`
- **test_process_lifecycle.sh** - calls `tsm_is_running`, `tsm_id_to_name`, `tsm_name_to_id`, `tsm_resolve_to_id`
- **test_ports.sh** - calls `tsm_init_port_registry`, `tsm_register_port`, `tsm_update_actual_port`, `tsm_deregister_port`, `tsm_set_named_port`, `tsm_get_port_owner`, `tsm_validate_port_registry`, `tsm_remove_named_port`, `tsm_reconcile_ports`
- **test_migration_complete.sh** - calls `tsm_repl_custom_ps`
- **test_metadata.sh** - calls `tsm_id`

#### TSM System Files
**bash/tsm/system/doctor.sh** - calls:
- `tsm_managed`, `tsm_process_name`, `tsm_json_escape`, `tsm_vars`, `tsm_doctor`, `tsm_reconcile_ports`, `tsm_show_declared_ports`, `tsm_show_actual_ports`

**bash/tsm/system/formatting.sh** - calls:
- `tsm_get_terminal_width`, `tsm_get_format_mode`, `tsm_calculate_column_widths`, `tsm_procs_name`, `tsm_procs_env_file`, `tsm_procs_status`, `tsm_procs_port`, `tsm_procs_id`, `tsm_procs_pid`, `tsm_procs_uptime`, `tsm_format_list_compact`, `tsm_format_list_normal`

**bash/tsm/system/monitor.sh** - calls:
- `tsm_id` (lines 154, 155)

**bash/tsm/system/session_aggregator.sh** - calls:
- `tsm_sessions_`, `tsm_events_`, `tsm_output_sessions_json`, `tsm_output_sessions_detailed`, `tsm_users_`, `tsm_behaviors_`

**bash/tsm/system/analytics.sh** - calls:
- `tsm_clicks_`, `tsm_journey_`, `tsm_click_perf_`

**bash/tsm/system/resource_manager.sh** - calls:
- `tsm_component_resource_manager_info`, `tsm_component_resource_manager_init`, `tsm_component_resource_manager_start`

#### TSM Integrations
**bash/tsm/integrations/tview.sh** - calls:
- `tsm_get_services`, `tsm_get_enabled_services`, `tsm_service_status`, `tsm_service_info`, `tsm_execute`, `tsm_id`, `tsm_manage_menu`, `tsm_status`

### Boot System
- `bash/boot/boot_core.sh:88` - calls `tsm_repl` which may not exist

---

## Violation Patterns

### Pattern 1: Missing repl_build_prompt
**Type:** Exported but not defined
**Impact:** HIGH - Will cause "command not found" errors when modules load
**Affected:** 7 REPL implementations (tree, org, estoface, pulsar, formant, rag, tdocs)
**Root Cause:** Function was likely moved to bash/repl/ but exports weren't removed

### Pattern 2: Org Module Test Files
**Type:** Exported but not defined
**Impact:** MEDIUM - Only affects test/experimental code
**Affected:** 6 include files in bash/org/
**Root Cause:** Stale test files that should be cleaned up or archived

### Pattern 3: TSM Function Dependencies
**Type:** Functions called before being sourced
**Impact:** HIGH - Core TSM functionality depends on proper sourcing order
**Affected:** 100+ function calls across TSM module
**Root Cause:** Complex module with interdependencies, functions defined in separate files

### Pattern 4: Helper Function Exports (tsm_help_*, tsm_procs_*, etc.)
**Type:** Functions called but may not be globally available
**Impact:** MEDIUM - Formatting and help functions
**Affected:** 50+ calls
**Root Cause:** Functions defined in specific files, need proper sourcing

---

## Recommendations

### Immediate Actions (High Priority)

1. **Fix repl_build_prompt violations**
   - Remove exports from 7 REPL files OR
   - Ensure function is defined before export

2. **Clean up bash/org/ test files**
   - Archive or remove includes_*.sh test files
   - Keep only the active includes.sh

3. **Fix TSM core/core.sh exports**
   - Either define the 15 functions OR
   - Remove the export statements (lines 77-128)

### Medium Priority

4. **Review TSM Module Loading**
   - Document required sourcing order
   - Add guards to check if functions exist before calling
   - Consider using `declare -F function_name` checks

5. **Create Sourcing Dependencies**
   - Add explicit checks: `[[ $(type -t function_name) == function ]] || source file.sh`
   - Document module dependencies clearly

### Long Term

6. **Implement Function Registry**
   - Create a central registry of all public functions
   - Automated checking during module load
   - Better error messages when functions missing

7. **Add Pre-commit Hooks**
   - Run violation checker before commits
   - Prevent new violations from being introduced

---

## Similar to repl_get_history_file Issue

The `repl_get_history_file` violation was:
- ❌ bash/repl/core/loop.sh:11 was calling `repl_get_history_file()`
- ❌ bash/repl/repl.sh:90 was exporting `repl_get_history_file`
- ✅ Fixed by removing the call and export since function was removed

**Same pattern found in:**
1. `repl_build_prompt` - exported but not defined (7 files)
2. TSM core functions - exported but not defined (15 functions)
3. Org functions - exported but not defined (multiple files)

---

## Next Steps

Run the checker script anytime:
```bash
bash /Users/mricos/src/devops/tetra/check_function_violations.sh
```

The script checks:
1. Exported functions that aren't defined in the same file
2. Common function call patterns for potentially missing functions

Generated: 2025-11-01
