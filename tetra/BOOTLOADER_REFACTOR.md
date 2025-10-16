# Bootloader Refactor - Next Steps

## Current State
- Added basic error tracking to `bash/bootloader.sh`
- `TETRA_BOOT_ERRORS` array captures component load failures
- `_tetra_load_component()` function wraps sourcing with error handling
- Boot errors now reported to stderr

## Problems Remaining
1. **Return statement chaos** - Hundreds of `return` statements scattered throughout codebase without consistent error handling
2. **Silent failures** - Components fail to load with no trace of why
3. **No boot sequence visibility** - Can't see what's loading, when, or how long it takes
4. **Missing component detection** - boot_modules.sh, boot_prompt.sh don't exist but bootloader tries to load them
5. **Module auto-loading black box** - Lines 56-55 in bootloader.sh attempt module loading with minimal feedback

## Aggressive Refactor Needed

### 1. Boot Tracing System
- Add `TETRA_BOOT_TRACE` flag to enable verbose boot logging
- Timestamp each component load (start/end/duration)
- Log file: `$TETRA_DIR/logs/boot-$(date +%s).log`
- Show dependency tree as components load
- Capture stderr from each component load

### 2. Return Statement Audit & Fix
- Run `find_all_returns.sh > return_audit.txt`
- Systematically replace naked `return N` with proper error handling:
  ```bash
  # Bad
  [[ -z "$var" ]] && return 1

  # Good
  if [[ -z "$var" ]]; then
    echo "ERROR: Missing required var" >&2
    return 1
  fi
  ```
- Add error context to every failure point

### 3. Component Validation
- Pre-flight check before loading ANY component
- Verify all boot/*.sh files exist before attempting load
- Create missing components or fail-fast with clear message

### 4. Module Loading Overhaul
- Lines 56-85 in bootloader.sh need complete rewrite
- Add per-module load timing
- Capture and display module load failures with stack traces
- Add retry logic for critical modules

### 5. Structured Logging
- Create `bash/utils/boot_logger.sh`
- Functions: `boot_log_info`, `boot_log_error`, `boot_log_timing`
- Color-coded output: GREEN=success, RED=error, YELLOW=warning, BLUE=timing
- JSON output option for parsing

## Tools Available

All debugging tools now organized in `tools/` directory:

### Debug Tools (`tools/debug/`)
- `find_all_returns.sh` - Lists every return statement
- `analyze_returns.sh` - Pattern analysis (has bugs, needs fixing)
- `preflight_check.sh` - Pre-flight check before sourcing tetra
- `safe_source_tetra.sh` - Safe wrapper with error handling
- `debug_incremental.sh` - Test components step-by-step
- `capture_terminal_state.sh` - Capture terminal state for crash debugging

### Bootloader Tools (`tools/bootloader/`)
- `tetra_entry.sh` - Reference ~/tetra/tetra.sh implementation

### Configuration (`config/`)
- `examples/modules.conf` - Module enable/disable configuration
- `examples/ports.toml` - TSM named port registry

See `tools/README.md` and `config/README.md` for detailed documentation.

## Commands to Start

### Debugging
```bash
# Check system state before sourcing
bash tools/debug/preflight_check.sh

# Audit current state
tools/debug/find_all_returns.sh > return_audit_$(date +%Y%m%d).txt

# Test incrementally to find what breaks
bash tools/debug/debug_incremental.sh

# Safe source with debug output
source tools/debug/safe_source_tetra.sh --debug

# Full trace with log
source tools/debug/safe_source_tetra.sh --trace --log
```

### Development
```bash
# Source with trace enabled
TETRA_BOOT_TRACE=1 source bash/bootloader.sh

# Reload after changes
tetra_reload  # or: ttr
```

## Priority Order
1. Fix missing boot/*.sh components (boot_modules.sh, boot_prompt.sh)
2. Add boot tracing/logging infrastructure
3. Refactor module auto-loading (lines 56-85)
4. Systematic return statement audit and fix
5. Add regression tests for bootloader

## Success Criteria
- Zero silent failures
- Every error has context and file:line reference
- Boot sequence completes in <500ms with clear progress output
- All return statements have error messages before them
- Boot log captures full trace for debugging
