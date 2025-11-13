# TSM Code Cleanup TODO List

Based on the comprehensive code review session, here are the issues found and prioritized fixes needed.

## Summary of Code Review Findings

**Module Size:** ~8,550 lines across core/, process/, and system/ components
**Overall Assessment:** Well-structured and modular, but has security vulnerabilities and code smells

### ✅ **What's Good**
- ✓ No .files violations (adheres to CLAUDE.md)
- ✓ Consistent use of strong globals (TETRA_SRC, TETRA_DIR, TSM_SRC)
- ✓ Well-organized modular structure
- ✓ Good error handling with consistent return codes (64, 66, 1)
- ✓ Architecture restructure completed (interfaces/ → tsm_repl.sh)

---

## 🔴 HIGH PRIORITY - Security Issues

### 1. **Fix `eval` with User Input** - CRITICAL
**Risk Level:** HIGH - Command injection vulnerability
**Locations:**
- `core/start.sh:118` - `eval "$(tsm_parse_env_file "$env_file")"`
- `process/management.sh:24, 137` - Same pattern
- `interfaces/repl_v2.sh:660, 684` - `eval "${input#!}"` and `eval "$input"`

**Problem:**
```bash
# If env file contains:
PORT=8080; rm -rf /important/data
# eval executes the rm command!
```

**Fix Strategy:**
```bash
# INSTEAD OF:
eval "$(tsm_parse_env_file "$env_file")"

# DO THIS:
# Parse safely without eval
_tsm_parse_env_safe() {
    local env_file="$1"
    [[ ! -f "$env_file" ]] && return 1

    # Source in isolated subshell and extract values
    local port=$(
        set -a
        source "$env_file" 2>/dev/null
        echo "${PORT:-${TETRA_PORT:-}}"
    )
    local name=$(
        set -a
        source "$env_file" 2>/dev/null
        echo "${NAME:-${TETRA_NAME:-}}"
    )

    # Set in parent shell without eval
    ENV_PORT="$port"
    ENV_NAME="$name"
}
```

**Files to Fix:**
- [ ] `core/start.sh:118`
- [ ] `process/management.sh:24`
- [ ] `process/management.sh:137`
- [ ] `tsm_repl.sh:660, 684` (shell escape feature - needs user warning or removal)

---

### 2. **Validate Input Before `bash -c`** - CRITICAL
**Risk Level:** HIGH - Shell injection vulnerability
**Locations:**
- `process/lifecycle.sh:35, 68, 127, 387`
- `core/start.sh:219`

**Problem:**
```bash
$setsid_cmd bash -c "
    cd '$working_dir'
    $env_cmd
    exec $command ...
"
# If $command, $working_dir contain unescaped input = injection
```

**Fix Strategy:**
```bash
# Validate and sanitize before bash -c
_tsm_validate_path() {
    local path="$1"
    # Must be absolute path under TETRA_DIR or valid project path
    [[ "$path" =~ ^/ ]] || return 1
    [[ -d "$path" ]] || return 1
    # No shell metacharacters in path
    [[ "$path" =~ [\;\&\|\`\$] ]] && return 1
    return 0
}

_tsm_validate_command() {
    local cmd="$1"
    # Basic sanity check - no obviously malicious patterns
    [[ "$cmd" =~ (rm[[:space:]]+-rf|eval|source[[:space:]]+/dev/) ]] && return 1
    return 0
}

# Then use:
_tsm_validate_path "$working_dir" || return 1
_tsm_validate_command "$command" || return 1
```

**Files to Fix:**
- [ ] `process/lifecycle.sh` - Add validation before all `bash -c` calls
- [ ] `core/start.sh:219` - Add validation

---

### 3. **Safe Directory Removal** - MEDIUM
**Risk Level:** MEDIUM - Potential data loss
**Locations:**
- `process/lifecycle.sh:297, 300, 519, 568`
- `process/management.sh:519, 576, 691`

**Problem:**
```bash
rm -rf "$process_dir"
# If $process_dir is empty or miscalculated → disaster
```

**Fix Strategy:**
```bash
_tsm_safe_remove_dir() {
    local dir="$1"

    # Validate directory path
    [[ -z "$dir" ]] && {
        echo "Error: Cannot remove empty directory path" >&2
        return 1
    }

    # Must be under TSM_PROCESSES_DIR
    [[ "$dir" =~ ^"$TSM_PROCESSES_DIR"/.+ ]] || {
        echo "Error: Invalid process directory path: $dir" >&2
        return 1
    }

    # Must exist and be a directory
    [[ -d "$dir" ]] || {
        echo "Warning: Directory does not exist: $dir" >&2
        return 0  # Not an error if already gone
    }

    # Now safe to remove
    rm -rf "$dir"
}
```

**Files to Fix:**
- [ ] Create `_tsm_safe_remove_dir()` in `core/utils.sh`
- [ ] Replace all `rm -rf "$process_dir"` calls with safe version
- [ ] `process/lifecycle.sh` - 4 instances
- [ ] `process/management.sh` - 3 instances

---

## 🟡 MEDIUM PRIORITY - Code Quality

### 4. **Remove Hardcoded User Path**
**Location:** `process/lifecycle.sh:168`

**Problem:**
```bash
local dirname="${1:-/Users/mricos/tetra/public}"
```

**Fix:**
```bash
local dirname="${1:-$TETRA_DIR/public}"
```

**Files to Fix:**
- [ ] `process/lifecycle.sh:168`

---

### 5. **Consolidate Duplicate Function**
**Locations:**
- `core/setup.sh:8-38` - `tetra_tsm_setup()`
- `core/validation.sh:9-30` - `tetra_tsm_setup()` (duplicate)

**Fix:**
- [ ] Keep version in `core/setup.sh`
- [ ] Remove duplicate from `core/validation.sh`
- [ ] Verify no behavioral differences between versions

---

### 6. **Make Homebrew Paths Dynamic**
**Locations:**
- `core/runtime.sh:83-86`
- `core/setup.sh:11`
- `core/validation.sh:12`
- `core/utils.sh:127-128`

**Problem:**
```bash
"/opt/homebrew/opt/util-linux/bin"
"/opt/homebrew/bin/bash"
"/usr/local/bin/bash"
```

**Fix Strategy:**
```bash
# At top of core/config.sh or core/setup.sh
_tsm_detect_homebrew_prefix() {
    if command -v brew >/dev/null 2>&1; then
        brew --prefix
    elif [[ -d "/opt/homebrew" ]]; then
        echo "/opt/homebrew"
    elif [[ -d "/usr/local" ]]; then
        echo "/usr/local"
    else
        echo ""
    fi
}

HOMEBREW_PREFIX="${HOMEBREW_PREFIX:-$(_tsm_detect_homebrew_prefix)}"

# Then use:
local util_linux_bin="$HOMEBREW_PREFIX/opt/util-linux/bin"
```

**Files to Fix:**
- [ ] Add `_tsm_detect_homebrew_prefix()` to `core/config.sh`
- [ ] Replace hardcoded paths in `core/runtime.sh`
- [ ] Replace hardcoded paths in `core/setup.sh`
- [ ] Replace hardcoded paths in `core/validation.sh`
- [ ] Replace hardcoded paths in `core/utils.sh`

---

### 7. **Remove Old Pattern: dirname/BASH_SOURCE in Library**
**Location:** `process/lifecycle.sh:8`

**Problem:**
```bash
TSM_DIR="${TSM_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
```

**Fix:**
```bash
# This is a library file, not an entry point
# Just rely on TSM_SRC global (already set by include.sh)
# Remove this line entirely - TSM_DIR comes from core/config.sh
```

**Files to Fix:**
- [ ] `process/lifecycle.sh:8` - Remove BASH_SOURCE pattern

---

## 🟢 LOW PRIORITY - Consistency & Polish

### 8. **Standardize Error Messages**

**Problem:** Mix of error formats:
- `echo "tsm: error" >&2` ✓ (correct)
- `echo "error" >&2` (missing prefix)
- `echo "❌ error"` (emoji, no stderr)

**Fix Strategy:**
```bash
# Create error helper in core/utils.sh
tsm_error() {
    echo "tsm: $*" >&2
}

tsm_warn() {
    echo "tsm: warning - $*" >&2
}

# Use consistently:
tsm_error "process not found"
tsm_warn "setsid not available"
```

**Files to Fix:**
- [ ] Create `tsm_error()` and `tsm_warn()` helpers
- [ ] Audit all error messages across codebase
- [ ] Replace inconsistent formats (low priority - can be gradual)

---

## 📋 Task Checklist by File

### `core/start.sh`
- [ ] Replace `eval "$(tsm_parse_env_file ..."` with safe parsing (line 118)
- [ ] Add input validation before `bash -c` (line 219)

### `core/utils.sh`
- [ ] Create `_tsm_safe_remove_dir()` function
- [ ] Create `tsm_error()` and `tsm_warn()` helpers
- [ ] Replace hardcoded Homebrew path (line 127-128)

### `core/setup.sh`
- [ ] Replace hardcoded Homebrew path (line 11)
- [ ] Keep this version of `tetra_tsm_setup()`

### `core/validation.sh`
- [ ] Remove duplicate `tetra_tsm_setup()` function
- [ ] Replace hardcoded Homebrew path (line 12)

### `core/runtime.sh`
- [ ] Replace hardcoded Homebrew paths (lines 83-86)

### `core/config.sh`
- [ ] Add `_tsm_detect_homebrew_prefix()` function
- [ ] Export `HOMEBREW_PREFIX` variable

### `process/lifecycle.sh`
- [ ] Remove BASH_SOURCE pattern (line 8)
- [ ] Replace hardcoded user path (line 168)
- [ ] Add validation before `bash -c` (lines 35, 68, 127, 387)
- [ ] Replace `rm -rf` with `_tsm_safe_remove_dir()` (lines 297, 300, 519, 568)

### `process/management.sh`
- [ ] Replace `eval "$(tsm_parse_env_file ..."` (lines 24, 137)
- [ ] Replace `rm -rf` with `_tsm_safe_remove_dir()` (lines 519, 576, 691)

### `tsm_repl.sh` (formerly interfaces/repl_v2.sh)
- [ ] Review shell escape feature `eval "${input#!}"` (lines 660, 684)
- [ ] Either remove, restrict, or add clear security warning
- [ ] Consider adding command whitelist for shell escapes

---

## 🎯 Suggested Implementation Order

### Phase 1: Critical Security (Do First)
1. Create safe parsing function to replace `eval` for env files
2. Add input validation helpers (`_tsm_validate_path`, `_tsm_validate_command`)
3. Create `_tsm_safe_remove_dir()` function
4. Fix all `eval` usages in core/start.sh and process/management.sh
5. Add validation before all `bash -c` calls

### Phase 2: Code Quality
6. Remove duplicate `tetra_tsm_setup()`
7. Remove hardcoded user path
8. Remove BASH_SOURCE pattern from library file
9. Make Homebrew paths dynamic

### Phase 3: Polish (Optional)
10. Standardize error messages
11. Audit and improve error handling consistency

---

## 📊 Metrics & Impact

**Security Fixes:**
- 3 critical vulnerabilities (eval, bash -c, rm -rf)
- ~20 individual fix locations

**Code Quality:**
- 1 duplicate function removal
- 5+ hardcoded path fixes
- 1 hardcoded user path fix

**Total Files to Modify:** ~10 files
**Estimated Time:** 2-3 hours for security fixes, 1 hour for quality fixes

---

## 🧪 Testing Strategy

After fixes:
1. Run existing test suite: `tests/run_all_tests.sh`
2. Test REPL: `tsm repl` and verify no regressions
3. Test service lifecycle: start/stop/restart various services
4. Test with malicious env file (security validation)
5. Test on both Intel and ARM Homebrew paths
6. Verify no hardcoded paths remain: `grep -r "/Users/\|/opt/homebrew" core/ process/ system/`

---

## 📝 Notes

- Architecture restructure is complete (interfaces/ removed)
- TSM_ARCHITECTURE.md created and documents current structure
- Focus this cleanup on security and code quality only
- All changes should maintain backward compatibility
- Document any breaking changes in comments

---

## ✅ Completed (From Previous Session)

- [x] Remove duplicate tsm_repl.sh (untracked file)
- [x] Fix tsm.sh repl command to use tsm_repl_main
- [x] Restructure: interfaces/ → tsm_repl.sh in module root
- [x] Update all references (5 files)
- [x] Create TSM_ARCHITECTURE.md
- [x] No .files violations found (clean)
- [x] Strong globals usage confirmed (clean)

---

**Ready to start cleanup in new context!**
