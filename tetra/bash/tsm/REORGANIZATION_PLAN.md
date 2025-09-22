# TSM File Reorganization Plan

## Current Problem
`tsm_interface.sh` = 1,169 lines, 29 functions - TOO BIG!

## Proposed File Structure

### tsm_process.sh - Process Lifecycle Management (~400 lines)
**Functions handling process start/stop/restart lifecycle:**
- `_tsm_start_process()` - Core process starting
- `_tsm_start_command_process()` - Command-based processes
- `_tsm_start_cli_internal()` - CLI process management
- `tetra_tsm_start_python()` - Python processes
- `tetra_tsm_start_webserver()` - Web server processes
- `tetra_tsm_stop_single()` - Stop individual process
- `tetra_tsm_stop_by_id()` - Stop by ID
- `tetra_tsm_restart_single()` - Restart individual process
- `tetra_tsm_restart_by_id()` - Restart by ID
- `_tsm_restart_unified()` - Unified restart logic
- `tetra_tsm_delete_single()` - Delete individual process
- `tetra_tsm_delete_by_id()` - Delete by ID

### tsm_cli.sh - CLI Command Handlers (~400 lines)
**Functions that handle user CLI commands:**
- `tetra_tsm_start()` - Main start command
- `tetra_tsm_start_cli()` - CLI-specific start
- `tetra_tsm_start_command()` - Command start handler
- `tetra_tsm_stop()` - Main stop command
- `tetra_tsm_delete()` - Main delete command
- `tetra_tsm_restart()` - Main restart command
- `tetra_tsm_kill()` - Kill command
- `_tsm_start_from_service_definition()` - Service definitions

### tsm_validation.sh - Validation & Helpers (~300 lines)
**Functions for validation and utility helpers:**
- `tetra_tsm_setup()` - System setup
- `_tsm_validate_script()` - Script validation
- `_tsm_auto_detect_env()` - Environment detection
- `_tsm_validate_env_file()` - Environment file validation
- `_tsm_resolve_script_path()` - Path resolution
- `_tsm_generate_name()` - Name generation
- `_tsm_save_metadata()` - Metadata management
- `tetra_tsm_reset_id()` - ID reset utility

### Updated tsm_interface.sh (~100 lines)
**Coordination and main interface only:**
- Function exports
- Module coordination
- Main interface bootstrapping

## Dependencies & Loading Order
1. `tsm_validation.sh` - No dependencies (utilities)
2. `tsm_process.sh` - Depends on validation
3. `tsm_cli.sh` - Depends on process + validation
4. `tsm_interface.sh` - Coordinates all above

## Migration Strategy
1. Create new files with functions moved in groups
2. Update exports and dependencies
3. Update loading order in `tsm.sh`
4. Test each step
5. Remove old functions from `tsm_interface.sh`

## Benefits
- Single responsibility per file
- Easier maintenance and testing
- Clearer dependencies
- Better modularity
- Easier to find functions