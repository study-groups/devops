# TSM (Tetra Service Manager) Comprehensive Audit Report

**Date:** 2025-10-13
**Auditor:** Claude Code
**Scope:** Complete codebase audit of `/Users/mricos/src/devops/tetra/bash/tsm/`

---

## Executive Summary

The TSM codebase consists of **54 shell script files** organized into a modular architecture. The audit reveals several significant issues including **duplicate functionality**, **multiple competing include systems**, **dead code**, and **poor error messaging for port conflicts**. The codebase has undergone multiple refactoring phases but retains legacy code and overlapping implementations.

### Critical Findings
1. **Multiple include files doing the same thing** (3 different include systems)
2. **Duplicate ID generation functions** (2 implementations)
3. **Duplicate `tetra_tsm_is_running` function** (defined 3 times in utils.sh)
4. **Poor port conflict error messaging** - shows "no PID file" instead of actual port conflict
5. **Legacy tserve files** that appear unused
6. **Test files mixed with production code**

---

## 1. File Structure and Architecture

### Main Entry Points
- **`tsm.sh`** (484 lines) - Primary entry point, loads components via `include.sh`
- **`index.sh`** (71 lines) - Module metadata and tab completion
- **`includes.sh`** (6 lines) - Sources both `tsm.sh` and `index.sh`

### Directory Organization
```
tsm/
├── core/           # Core functionality (12 files)
├── system/         # System utilities (9 files)
├── process/        # Process management (4 files)
├── services/       # Service definitions (3 files)
├── interfaces/     # CLI and REPL (2 files)
├── handlers/       # Request handlers (2 files)
├── integrations/   # External integrations (3 files)
├── tview/          # TView integration (2 files)
├── tests/          # Test files (14 files)
└── [legacy files]  # tserve.sh, tserve_enhanced.sh, tsm_discover.sh
```

---

## 2. CRITICAL ISSUE: Multiple Include Systems

### Problem: Three Different Include Mechanisms

#### 2.1 `include.sh` (59 lines) - **PRIMARY SYSTEM**
**Location:** `/Users/mricos/src/devops/tetra/bash/tsm/include.sh`

```bash
# Requires MOD_SRC to be set
# Loads 23 files in dependency order:
- core/ (9 files)
- system/ (6 files)
- services/ (3 files)
- process/ (4 files)
- interfaces/ (2 files)
- handlers/ (2 files)
- integrations/ (3 files)
```

**Status:** ✅ Currently used by `tsm.sh`

#### 2.2 `include_minimal.sh` (84 lines) - **DEBUG VERSION**
**Location:** `/Users/mricos/src/devops/tetra/bash/tsm/include_minimal.sh`

```bash
# Same as include.sh but with:
- Echo statements for debugging
- Missing: analytics, session_aggregator, audit, repl
- Comment: "# Skipping complex lifecycle system for now - keep it simple"
```

**Status:** ⚠️ **DEAD CODE** - Never sourced, appears to be debug/troubleshooting artifact

#### 2.3 `includes.sh` (6 lines) - **LEGACY WRAPPER**
**Location:** `/Users/mricos/src/devops/tetra/bash/tsm/includes.sh`

```bash
#!/usr/bin/env bash
# TSM module includes
source "$(dirname "${BASH_SOURCE[0]}")/tsm.sh"
source "$(dirname "${BASH_SOURCE[0]}")/index.sh"
```

**Status:** ⚠️ **UNUSED** - Not referenced anywhere in codebase

### Recommendation
**DELETE:** `include_minimal.sh` and `includes.sh`
**KEEP:** `include.sh` as the single include mechanism

---

## 3. Duplicate Code Analysis

### 3.1 ID Generation Functions - **DUPLICATE**

#### Function: `_tsm_get_next_id()`
**Location 1:** `/Users/mricos/src/devops/tetra/bash/tsm/core/helpers.sh` (Lines 8-20)
```bash
_tsm_get_next_id() {
    local id_file="$TSM_ID_FILE"
    local next_id
    if [[ -f "$id_file" ]]; then
        next_id=$(cat "$id_file")
    else
        next_id=0
    fi
    echo $((next_id + 1)) > "$id_file"
    echo "$next_id"
}
```

#### Function: `tetra_tsm_get_next_id()`
**Location 2:** `/Users/mricos/src/devops/tetra/bash/tsm/core/utils.sh` (Lines 137-169)
```bash
tetra_tsm_get_next_id() {
    # Find the lowest unused ID by checking existing metadata files
    local used_ids=()
    local meta_files=("$TSM_PROCESSES_DIR"/*.meta)
    # [33 lines of smart ID allocation logic]
}
```

**Analysis:**
- `_tsm_get_next_id()` uses simple counter in file (old method)
- `tetra_tsm_get_next_id()` scans metadata files and finds lowest unused ID (new method)
- The new method is superior and is what's actually called by `core/start.sh:96`

**Recommendation:**
- **DELETE** `_tsm_get_next_id()` from `core/helpers.sh`
- **KEEP** `tetra_tsm_get_next_id()` in `core/utils.sh`

### 3.2 `tetra_tsm_is_running()` - **TRIPLE DEFINITION**

Defined **3 TIMES** in the same file: `core/utils.sh`

**Location 1:** Lines 394-417 (Legacy wrapper)
```bash
tetra_tsm_is_running_by_id() { ... }
tetra_tsm_is_running_by_name() { ... }
tetra_tsm_is_running() {
    tetra_tsm_is_running_by_name "$1"
}
```

**Location 2:** Lines 478-494 (Full implementation)
```bash
tetra_tsm_is_running() {
    local process_name="$1"
    [[ -z "$process_name" ]] && return 1
    local process_file="$TSM_PROCESSES_DIR/$process_name.meta"
    [[ ! -f "$process_file" ]] && return 1
    local pid=$(grep -o "pid=[0-9]*" "$process_file" 2>/dev/null | cut -d'=' -f2)
    [[ -z "$pid" ]] && return 1
    kill -0 "$pid" 2>/dev/null
}
```

**Used by 9 files:**
- `process/inspection.sh`
- `process/lifecycle.sh`
- `process/management.sh`
- `services/definitions.sh`
- `core/start.sh`
- `handlers/service_handler.sh`
- And several test files

**Recommendation:**
- **KEEP** the full implementation (lines 478-494)
- **DELETE** the duplicate at lines 420-422
- The by_id and by_name variants are still useful

### 3.3 Process Starting Functions - **OVERLAPPING**

#### Old Method: `tetra_tsm_start_command()`
**Location:** `process/management.sh:77-226`
- 150 lines
- Complex argument parsing
- Manual port/env extraction
- Calls `_tsm_start_command_process()`

#### New Method: `tsm_start_any_command()`
**Location:** `core/start.sh:54-181`
- 128 lines
- Universal command executor
- Smart type detection
- Port discovery from command
- **This is the modern approach**

**Current Flow:** `tsm.sh:286` checks if `tsm_start_any_command` exists and uses it; otherwise falls back to old method

**Recommendation:**
- **TRANSITION**: Complete migration to `tsm_start_any_command()`
- **DEPRECATE**: `tetra_tsm_start_command()` once migration complete
- This is in-progress refactoring

---

## 4. Dead Code and Unused Files

### 4.1 Legacy tserve Files - **POSSIBLY UNUSED**

#### `tserve.sh` (314 lines)
- Single test server with symlink management
- References `tsm_services_config.sh` which doesn't exist
- Generates service definitions for TSM
- **Last modified:** Old references suggest this predates current architecture

#### `tserve_enhanced.sh` (515 lines)
- Advanced dev server with HTTPS, CORS, live reload
- Self-contained Python server generator
- No integration with current TSM structure
- **Status:** Standalone utility, may still be useful

**Recommendation:**
- **INVESTIGATE**: Verify if tserve is still used
- **CONSIDER**: Move to separate utilities directory if kept
- **DOCUMENT**: If kept, add README explaining purpose

### 4.2 `tsm_discover.sh` (395 lines) - **DEAD CODE?**
- Process discovery and analysis
- Not sourced by any current file
- May have been replaced by `process/inspection.sh`

**Recommendation:**
- **DELETE** if functionality exists elsewhere
- **OR** integrate if still needed

### 4.3 `include_minimal.sh` - **DEBUG ARTIFACT**
As discussed in Section 2.2 - should be deleted.

### 4.4 `interfaces/cli.sh` - **EMPTY SHELL**
**Location:** `/Users/mricos/src/devops/tetra/bash/tsm/interfaces/cli.sh`
```bash
# All specific functions moved to specialized modules
# This file now serves as the main interface coordination point
```

Only contains comments stating functions were moved elsewhere.

**Recommendation:** **DELETE** - serves no purpose

---

## 5. Port Conflict Error Handling - **CRITICAL UX ISSUE**

### The Problem
When `tsm start --env local node server.js` fails because port 4444 is in use, user sees:
```
❌ Failed to start: server-4444 (no PID file)
```

This is **misleading** - the problem isn't a missing PID file, it's that the port is already occupied.

### Root Cause Analysis

#### Error Source: `core/start.sh:134-143`
```bash
# Verify started
if [[ ! -f "$pid_file" ]]; then
    echo "❌ Failed to start: $name (no PID file)" >&2
    return 1
fi

local pid=$(cat "$pid_file")
if ! kill -0 "$pid" 2>/dev/null; then
    echo "❌ Failed to start: $name (process died immediately)" >&2
    [[ -f "$log_err" ]] && tail -5 "$log_err" >&2
    return 1
fi
```

### What Actually Happens

1. **Process starts** (PID file gets created)
2. **Port bind fails** (port 4444 already in use)
3. **Process exits immediately**
4. **0.5s sleep completes**
5. **PID file check passes** (file exists!)
6. **Process liveness check FAILS** (`kill -0` fails because process died)
7. **Shows error:** "process died immediately" + stderr tail

**BUT:** This still doesn't clearly identify port conflict as the issue!

### The Fix

The diagnostic function exists but isn't called from the right place!

**Available but Unused:** `system/doctor.sh:267-368` - `tsm_diagnose_startup_failure()`
```bash
tsm_diagnose_startup_failure() {
    # Check port conflict
    local existing_pid=$(lsof -ti :$port 2>/dev/null)
    if [[ -n "$existing_pid" ]]; then
        error "Port $port is already in use"
        echo "  PID:     $existing_pid"
        echo "  Process: $process_name"
        # ... helpful context
    fi
}
```

This function IS called from:
- `process/management.sh:209` (in `tetra_tsm_start_command`)
- `process/lifecycle.sh:145` (in `tetra_tsm_start_python`)

But NOT from:
- `core/start.sh:141` (in `tsm_start_any_command`) ⚠️ **MISSING!**

### Recommendation

**Fix:** Modify `core/start.sh` lines 140-144:

```bash
local pid=$(cat "$pid_file")
if ! kill -0 "$pid" 2>/dev/null; then
    echo "❌ Failed to start: $name (process died immediately)" >&2
    echo >&2
    # ADD THIS LINE:
    if declare -f tsm_diagnose_startup_failure >/dev/null 2>&1; then
        tsm_diagnose_startup_failure "$name" "$port" "$final_command" "$env_file"
    else
        [[ -f "$log_err" ]] && tail -5 "$log_err" >&2
    fi
    return 1
fi
```

This will provide proper port conflict diagnosis.

---

## 6. Architectural Issues

### 6.1 Inconsistent Function Naming

**Prefixes used:**
- `tetra_tsm_*` - Public API functions (48 functions)
- `_tsm_*` - Private/internal functions (42 functions)
- `tsm_*` - Module-specific functions (87 functions)

**Problem:** No clear convention. Some public functions use `_tsm_` prefix.

### 6.2 Metadata File Format Inconsistency

**Old format** (used in some files):
```bash
TSM_ID=0
PROCESS_NAME=server-4444
PID=12345
# ... uppercase, underscores
```

**New format** (current standard):
```bash
tsm_id=0
name=server-4444
pid=12345
# ... lowercase, no prefixes
```

This is mostly resolved but causes issues when reading old metadata.

### 6.3 Environment File Handling

Multiple ways to detect/load environment:
- `core/environment.sh` - Has env loading functions
- `core/validation.sh:_tsm_auto_detect_env()` - Different detection logic
- `process/management.sh` - Yet another env resolution approach

**Recommendation:** Consolidate env handling in one place

---

## 7. Test Files in Production Tree

**Issue:** 14 test files mixed with production code in `/bash/tsm/tests/`

```
tests/
├── run_all_tests.sh
├── test_improved_kill.sh
├── test_kill_debug.sh
├── test_lifecycle.sh
├── test_log_rotate.sh
├── test_nc_server.sh
├── test_persistent_server.sh
├── test_service_conventions.sh
├── test_service_definitions.sh
├── test_simple_kill.sh
├── test_start_restart_services.sh
├── test_tsm_id.sh
└── test_webserver_start.sh
```

**Recommendation:**
- Move to `/bash/tsm/test/` or `/tests/tsm/` (note: singular 'test' is convention)
- Or move outside source tree entirely

---

## 8. TSM Start Flow Analysis

### Command: `tsm start --env local node server.js`

**Call Stack:**

1. **`tsm.sh:64-71`** - `tsm()` function, case `start`
   - Calls `tetra_tsm_start "$@"`

2. **`process/management.sh:230-299`** - `tetra_tsm_start()`
   - Parses flags (`--env local`)
   - Resolves env file: `local` → `env/local.env`
   - Collects command args: `[node, server.js]`
   - Checks if first arg is known service (not in this case)
   - Line 286: Checks if `tsm_start_any_command` exists
   - Calls `tsm_start_any_command("node server.js", "env/local.env", "", "")`

3. **`core/start.sh:54-181`** - `tsm_start_any_command()`
   - Line 67: Detects type with `tsm_detect_type("node server.js")` → "command"
   - Line 70: Resolves interpreter → "node"
   - Line 82: Discovers port from command/env → "4444"
   - Line 87: Generates name → "node-4444"
   - Line 90-93: Checks if already running (returns false if not)
   - Line 96: Gets next TSM ID
   - Line 123-129: Starts process with `setsid bash -c "..."`
   - **Line 131: sleep 0.5**
   - Line 134-137: Checks PID file exists ⚠️ **"no PID file" error**
   - Line 140-144: Checks process running ⚠️ **"process died" error**
   - Line 147-158: Saves metadata
   - Line 161-178: Registers port (double-entry accounting)

### Where Port Conflict Occurs

Between lines 129 (process start) and 131 (sleep):
1. Process spawns
2. Tries to bind to port 4444
3. **EADDRINUSE** error (port in use)
4. Process writes error to stderr
5. Process exits with non-zero code
6. PID file was created but process is now dead

After sleep at line 131:
- PID file exists ✓
- But `kill -0 $pid` fails because process is dead
- Error: "process died immediately"
- Optionally shows last 5 lines of stderr

**Missing:** No check for port availability BEFORE starting process

---

## 9. Recommendations Summary

### Critical (Do First)

1. **FIX PORT CONFLICT ERROR** (Section 5)
   - Add `tsm_diagnose_startup_failure` call to `core/start.sh:143`
   - Estimated effort: 5 minutes

2. **DELETE DUPLICATE INCLUDES** (Section 2)
   - Remove `include_minimal.sh`
   - Remove `includes.sh`
   - Estimated effort: 2 minutes

3. **FIX DUPLICATE FUNCTIONS** (Section 3)
   - Remove `_tsm_get_next_id` from `core/helpers.sh`
   - Remove duplicate `tetra_tsm_is_running` from `core/utils.sh`
   - Estimated effort: 5 minutes

### High Priority

4. **DELETE DEAD CODE** (Section 4)
   - Remove `interfaces/cli.sh` (empty)
   - Investigate and remove/archive `tsm_discover.sh`
   - Estimated effort: 15 minutes

5. **CLEAN UP TSERVE FILES** (Section 4.1)
   - Determine if still used
   - If yes: move to separate dir + document
   - If no: delete
   - Estimated effort: 30 minutes

### Medium Priority

6. **REORGANIZE TESTS** (Section 7)
   - Move test files out of production tree
   - Estimated effort: 10 minutes

7. **CONSOLIDATE ENV HANDLING** (Section 6.3)
   - Single source of truth for env file detection
   - Estimated effort: 2 hours

8. **DOCUMENT NAMING CONVENTIONS** (Section 6.1)
   - Add CONVENTIONS.md explaining prefixes
   - Estimated effort: 30 minutes

### Low Priority

9. **COMPLETE START MIGRATION** (Section 3.3)
   - Finish transition to `tsm_start_any_command`
   - Remove old `tetra_tsm_start_command` code
   - Estimated effort: 4 hours

---

## 10. File-by-File Analysis

### Core Files (12 files)

| File | Lines | Status | Notes |
|------|-------|--------|-------|
| `config.sh` | 130 | ✅ Good | Global configuration |
| `core.sh` | 135 | ✅ Good | Module initialization |
| `environment.sh` | ? | ⚠️ Check | May overlap with validation.sh |
| `files.sh` | ? | ✅ Good | File path management |
| `helpers.sh` | 46 | ⚠️ Has duplicate | Remove `_tsm_get_next_id` |
| `include.sh` | 59 | ✅ Good | Keep as single include |
| `ports_double.sh` | ? | ✅ Good | Double-entry port accounting |
| `runtime.sh` | ? | ✅ Good | Runtime detection |
| `setup.sh` | ? | ✅ Good | Setup utilities |
| `start.sh` | 186 | ⚠️ Needs fix | Add diagnostic call |
| `utils.sh` | 495 | ⚠️ Has duplicate | Fix `tetra_tsm_is_running` |
| `validation.sh` | 243 | ✅ Good | Validation functions |

### System Files (9 files)

| File | Lines | Status | Notes |
|------|-------|--------|-------|
| `analytics.sh` | ? | ✅ Good | Tetra token analytics |
| `audit.sh` | ? | ✅ Good | System audit |
| `doctor.sh` | 838 | ✅ Good | Diagnostics (underused!) |
| `formatting.sh` | ? | ✅ Good | Output formatting |
| `monitor.sh` | ? | ✅ Good | Process monitoring |
| `patrol.sh` | ? | ✅ Good | Cleanup patrol |
| `ports.sh` | ? | ✅ Good | Port management |
| `resource_manager.sh` | ? | ✅ Good | Resource tracking |
| `session_aggregator.sh` | ? | ✅ Good | Session analysis |

### Process Files (4 files)

| File | Lines | Status | Notes |
|------|-------|--------|-------|
| `inspection.sh` | 418 | ✅ Good | Process info/logs |
| `lifecycle.sh` | 407 | ✅ Good | Start/stop/restart |
| `list.sh` | ? | ✅ Good | Process listing |
| `management.sh` | 618 | ⚠️ Overlap | Has old start code |

### Services Files (3 files)

| File | Lines | Status | Notes |
|------|-------|--------|-------|
| `definitions.sh` | 388 | ✅ Good | Service definitions |
| `registry.sh` | ? | ✅ Good | Service registry |
| `startup.sh` | ? | ✅ Good | Service startup |

### Dead/Questionable Files

| File | Lines | Status | Action |
|------|-------|--------|--------|
| `include_minimal.sh` | 84 | ❌ Dead | DELETE |
| `includes.sh` | 6 | ❌ Dead | DELETE |
| `interfaces/cli.sh` | 31 | ❌ Empty | DELETE |
| `tsm_discover.sh` | 395 | ❓ Unknown | Investigate |
| `tserve.sh` | 314 | ❓ Unknown | Investigate |
| `tserve_enhanced.sh` | 515 | ❓ Unknown | Investigate |

---

## 11. Specific Port Conflict Fix

### Current Code (`core/start.sh:134-144`)

```bash
# Verify started
if [[ ! -f "$pid_file" ]]; then
    echo "❌ Failed to start: $name (no PID file)" >&2
    return 1
fi

local pid=$(cat "$pid_file")
if ! kill -0 "$pid" 2>/dev/null; then
    echo "❌ Failed to start: $name (process died immediately)" >&2
    [[ -f "$log_err" ]] && tail -5 "$log_err" >&2
    return 1
fi
```

### Improved Code (with port diagnosis)

```bash
# Verify started
if [[ ! -f "$pid_file" ]]; then
    echo "❌ Failed to start: $name (no PID file)" >&2
    echo >&2
    echo "Possible causes:" >&2
    echo "  - Process failed to initialize" >&2
    echo "  - Permission denied creating PID file" >&2
    echo "  - setsid not available (run 'tsm setup')" >&2
    [[ -f "$log_err" ]] && {
        echo >&2
        echo "Recent errors:" >&2
        tail -5 "$log_err" >&2
    }
    return 1
fi

local pid=$(cat "$pid_file")
if ! kill -0 "$pid" 2>/dev/null; then
    echo "❌ Failed to start: $name (process died immediately)" >&2
    echo >&2

    # Check for port conflict first
    if [[ "$port" != "none" ]] && command -v lsof >/dev/null 2>&1; then
        local existing_pid=$(lsof -ti :$port 2>/dev/null)
        if [[ -n "$existing_pid" ]]; then
            local process_cmd=$(ps -p $existing_pid -o args= 2>/dev/null | head -c 80 || echo "unknown")
            echo "🔴 Port $port is already in use!" >&2
            echo "   Blocking process: PID $existing_pid" >&2
            echo "   Command: $process_cmd" >&2
            echo >&2
            echo "Solutions:" >&2
            echo "   • Stop the process: kill $existing_pid" >&2
            echo "   • Or use a different port: tsm start --port XXXX $command" >&2
            echo "   • Or use doctor: tsm doctor kill $port" >&2
            return 1
        fi
    fi

    # No port conflict, show stderr
    echo "Process started but crashed immediately." >&2
    echo "Check error logs:" >&2
    [[ -f "$log_err" ]] && tail -10 "$log_err" >&2
    return 1
fi
```

---

## 12. Conclusion

The TSM codebase is **functional but needs cleanup**. The architecture is sound with good separation of concerns, but the presence of dead code, duplicate functions, and confusing include systems adds maintenance burden.

### Immediate Actions (< 30 minutes total)
1. Fix port conflict error message
2. Delete duplicate include files
3. Delete duplicate function definitions
4. Delete empty cli.sh

### Short-term Actions (< 4 hours)
5. Investigate and handle tserve files
6. Move test files
7. Consolidate environment handling
8. Document conventions

### Long-term (ongoing)
9. Complete migration to universal start
10. Establish naming conventions
11. Add integration tests for port conflicts

The most critical user-facing issue is the **port conflict error messaging**, which should be fixed immediately as it directly impacts the debugging experience mentioned in the audit request.

---

## Appendix A: Function Call Graph

```
tsm() [tsm.sh]
└── tetra_tsm_start() [process/management.sh]
    └── tsm_start_any_command() [core/start.sh]
        ├── tsm_detect_type() [core/runtime.sh]
        ├── tsm_resolve_interpreter() [core/runtime.sh]
        ├── tsm_discover_port() [core/start.sh]
        ├── tsm_generate_process_name() [core/start.sh]
        ├── tetra_tsm_is_running() [core/utils.sh] ⚠️ DUPLICATE
        ├── tetra_tsm_get_next_id() [core/utils.sh]
        ├── tetra_tsm_get_setsid() [core/utils.sh]
        ├── tsm_register_port() [core/ports_double.sh]
        └── [MISSING] tsm_diagnose_startup_failure() [system/doctor.sh]
```

---

## Appendix B: Duplicate Function Locations

### `_tsm_get_next_id()`
- `core/helpers.sh:8-20` ❌ DELETE THIS
- Called by: NOTHING (dead code)

### `tetra_tsm_get_next_id()`
- `core/utils.sh:137-169` ✅ KEEP THIS
- Called by: `core/start.sh:96`, `core/validation.sh:194`

### `tetra_tsm_is_running()`
- `core/utils.sh:420-422` (wrapper) ❌ DELETE THIS
- `core/utils.sh:478-494` (full impl) ✅ KEEP THIS
- Called by: 9 files across codebase

---

**End of Report**
