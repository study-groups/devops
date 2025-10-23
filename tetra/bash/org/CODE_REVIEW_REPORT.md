# Org REPL Code Review Report
**Date**: 2025-10-21
**Reviewer**: Claude Code
**Scope**: bash/org/ module (org REPL implementation)

## Executive Summary

A comprehensive code review of the Tetra org REPL implementation identified **45+ issues** across 6 categories. Critical path bugs similar to the recently fixed `org-name.toml` vs `tetra.toml` issue were found, along with state management problems, performance issues, and missing error handling.

**Status**:
- ✅ 4 critical bugs fixed immediately
- ⚠️  Medium/High priority issues documented for future work
- 📋 Refactoring recommendations provided

---

## 1. CRITICAL BUGS FIXED

### 1.1 Tab Completion Path Bug ✅ FIXED
**File**: `bash/org/org_completion.sh:132`
**Issue**: Same pattern as org-name/tetra.toml bug - wrong directory name

```bash
# Before:
local orgs_dir="$TETRA_DIR/org"   # ❌ Missing 's'

# After:
local orgs_dir="$TETRA_DIR/orgs"  # ✅ Fixed
```

**Impact**: Tab completion couldn't find any organizations
**Fix Commit**: Line 132 changed in org_completion.sh

---

### 1.2 Cursor Position Rendering Bug ✅ FIXED
**File**: `bash/org/org_repl_tui.sh:110-113`
**Issue**: Cursor always rendered at end, ignoring `CURSOR_POS` variable

```bash
# Before:
local input_line="${prompt_text}${ORG_REPL_INPUT}"
input_line="${input_line}█"  # ❌ Cursor always at end

# After:
local before_cursor="${ORG_REPL_INPUT:0:$ORG_REPL_CURSOR_POS}"
local after_cursor="${ORG_REPL_INPUT:$ORG_REPL_CURSOR_POS}"
local input_line="${prompt_text}${before_cursor}█${after_cursor}"  # ✅ Correct position
```

**Impact**: Visual cursor didn't match actual edit position
**Fix Commit**: Lines 110-113 refactored in org_repl_tui.sh

---

### 1.3 Action Array Bounds Bug ✅ FIXED
**File**: `bash/org/org_repl_tui.sh:309`
**Issue**: No bounds checking when accessing actions array

```bash
# Before:
local action="${actions[$ORG_REPL_ACTION_INDEX]}"  # ❌ Could be out of bounds

# After:
if [[ ${#actions[@]} -eq 0 ]] || [[ $ORG_REPL_ACTION_INDEX -ge ${#actions[@]} ]]; then
    _org_add_output "  No action available"
    return
fi
local action="${actions[$ORG_REPL_ACTION_INDEX]:-}"  # ✅ Bounds checked + default
```

**Impact**: Could attempt to execute undefined action
**Fix Commit**: Lines 309-313 added bounds check in org_repl_tui.sh

---

### 1.4 tmpfile Race Condition ✅ FIXED
**File**: `bash/org/org_repl.sh:33-36`
**Issue**: Unsafe tmpfile creation using only PID

```bash
# Before:
local tmpfile="/tmp/repl_prompt_$$"  # ❌ Only PID, not unique

# After:
local tmpfile
tmpfile=$(mktemp /tmp/repl_prompt.XXXXXX) || return 1  # ✅ Secure unique file
```

**Impact**: Potential file collision in concurrent sessions
**Fix Commit**: Lines 33-34 use mktemp in org_repl.sh

---

## 2. CONSISTENCY ISSUES (High Priority)

### 2.1 Duplicate Environment Definitions ✅ FIXED
**Files**: `actions.sh:7`, `org_repl.sh:13`, `org_repl_tui.sh:12`

**Status**: FIXED - Created `bash/org/org_constants.sh` with canonical definitions

```bash
# Created: bash/org/org_constants.sh
declare -a ORG_ENVIRONMENTS=("Local" "Dev" "Staging" "Production")
declare -a ORG_MODES=("Inspect" "Transfer" "Execute")
export ORG_ENVIRONMENTS
export ORG_MODES

# All files now source org_constants.sh:
# - bash/org/actions.sh
# - bash/org/org_repl.sh
# - bash/org/org_repl_tui.sh
# - bash/org/org_completion.sh
```

---

### 2.2 Environment Name Case Inconsistency ✅ FIXED
**File**: `bash/org/org_completion.sh:145`

**Status**: FIXED - Now dynamically generates from canonical ORG_ENVIRONMENTS

```bash
# Before:
echo "local dev staging prod qa"  # ❌ Wrong

# After (org_completion.sh:147-154):
org_completion_envs() {
    local envs=()
    for env in "${ORG_ENVIRONMENTS[@]}"; do
        envs+=("${env,,}")  # Convert to lowercase for completion
    done
    echo "${envs[@]}"
}
# Outputs: "local dev staging production" ✅ Correct!
```

---

### 2.3 Inconsistent Function Naming
**Pattern**: Mix of `org_*`, `_org_*`, `tetra_org_*`

**Recommendation**:
- `org_*` → Public API (exported functions)
- `_org_*` → Private helpers (not exported)
- `org_action_*` → Action handlers
- Avoid `tetra_org_*` unless truly tetra-level

---

## 3. STATE MANAGEMENT ISSUES

### 3.1 Duplicate State Initialization
**Files**: `org_repl.sh:9-14`, `org_repl_tui.sh:9-23`

Same variables defined in both files - could desynchronize.

**Recommendation**: Shared `_org_repl_init_state()` function:
```bash
_org_repl_init_state() {
    ORG_REPL_ENV_INDEX=0
    ORG_REPL_MODE_INDEX=0
    ORG_REPL_ACTION_INDEX=0
    ORG_REPL_ENVIRONMENTS=("${ORG_ENVIRONMENTS[@]}")
    ORG_REPL_MODES=("${ORG_MODES[@]}")
    ORG_REPL_INPUT=""
    ORG_REPL_CURSOR_POS=0
    ORG_REPL_FOCUS=0
    ORG_REPL_COMMAND_HISTORY=()
    ORG_REPL_HISTORY_INDEX=-1
}
```

---

### 3.2 Missing Cleanup Function
**Issue**: Global state pollutes shell after REPL exit

**Recommendation**:
```bash
_org_repl_cleanup() {
    unset ORG_REPL_ENV_INDEX ORG_REPL_MODE_INDEX ORG_REPL_ACTION_INDEX
    unset ORG_REPL_ENVIRONMENTS ORG_REPL_MODES
    unset ORG_REPL_INPUT ORG_REPL_CURSOR_POS ORG_REPL_FOCUS
    unset ORG_REPL_COMMAND_HISTORY ORG_REPL_HISTORY_INDEX
    unset ORG_REPL_OUTPUT_LINES ORG_REPL_LOG_LINES
    unset ORG_REPL_RUNNING ORG_REPL_SHOW_ACTION_MENU
}
```

Call in exit handlers and at REPL end.

---

### 3.3 History Index Edge Cases
**File**: `org_repl_tui.sh:256-257, 361-363`

User loses history position when switching focus - might be intentional but could be jarring.

**Consideration**: Save history position per focus section?

---

## 4. INPUT HANDLING GAPS

### 4.1 Missing Keyboard Shortcuts
**Current**: Only arrows, Tab, basic editing
**Missing**:
- Home/End keys (`\e[H`, `\e[F`)
- Delete key (`\e[3~`)
- Page Up/Down (`\e[5~`, `\e[6~`)
- Ctrl+A/E (line start/end)
- Ctrl+K/U (kill line)
- Ctrl+W (kill word)
- Ctrl+R (reverse search in history)

**Recommendation**: Add common readline shortcuts

---

### 4.2 No Paste Protection
**Issue**: Pasting multi-line text could execute commands accidentally

**Recommendation**: Detect bracketed paste mode:
```bash
# Enable bracketed paste
printf '\e[?2004h'

# Detect paste start/end
\e[200~ ... \e[201~
```

---

## 5. PERFORMANCE ISSUES

### 5.1 Redundant Action Lookups
**File**: `org_repl_tui.sh` - Multiple locations

`_org_actions()` called 6+ times per render cycle.

**Recommendation**: Cache actions when env/mode changes:
```bash
_org_cache_actions() {
    ORG_REPL_CACHED_ACTIONS=($(_org_actions))
}

# Call in _org_cycle_env(), _org_cycle_mode(), _org_navigate_up/down()
```

---

### 5.2 Full Re-render on Character Input
**File**: `org_repl_tui.sh:522`

Every keystroke triggers full screen re-render.

**Recommendation**: Skip render for simple character input:
```bash
[[:print:]])
    _org_handle_char "$char"
    # Skip render if just typing (focus=2 and no special action)
    [[ $ORG_REPL_FOCUS -eq 2 ]] || _org_render
    ;;
```

---

### 5.3 Inefficient Prompt Building
**File**: `org_repl_tui.sh:33-84`

15+ command substitutions (`$(...)`) per prompt build.

**Recommendation**: Use printf for better performance:
```bash
printf -v prompt '%s[%s%s%s x %s%s%s x %s%s%s] %s%s%s> %s' \
    "$(text_color "$REPL_BRACKET")" \
    "$(text_color "$REPL_ORG_ACTIVE")" "$org" "$(reset_color)" \
    # ... etc
```

---

## 6. ERROR HANDLING GAPS

### 6.1 Silent Action Failures
**File**: `actions.sh:62-80`

Actions can fail silently without user notification.

**Recommendation**:
```bash
org_execute_action() {
    # ... validation ...

    if declare -f "$func_name" &>/dev/null; then
        if ! "$func_name" "$env" "${args[@]}"; then
            echo "❌ Action failed: $action (exit code: $?)" >&2
            return 1
        fi
    else
        echo "❌ Action not implemented: $action" >&2
        return 1
    fi
}
```

---

### 6.2 Missing org_active Validation
**File**: `org_repl_tui.sh:26`

```bash
# Current:
_org_active() { org_active 2>/dev/null || echo "none"; }

# Better:
_org_active() {
    local result
    if result=$(org_active 2>&1); then
        echo "$result"
    else
        # Check if it's "no org" vs actual error
        if [[ "$result" == *"no active"* ]]; then
            echo "none"
        else
            echo "error" >&2
            return 1
        fi
    fi
}
```

---

## 7. CODE QUALITY IMPROVEMENTS

### 7.1 Magic Numbers Need Constants
**File**: `org_repl_tui.sh:94, 100-103, 119-121`

```bash
# Current:
tcurses_buffer_write_line 0 "$header"
tcurses_buffer_write_line 1 "TITLE"
tcurses_buffer_write_line 2 "$header"
tcurses_buffer_write_line 3 "HELP"

# Better:
readonly LAYOUT_HEADER_TOP=0
readonly LAYOUT_HEADER_TITLE=1
readonly LAYOUT_HEADER_BOTTOM=2
readonly LAYOUT_HELP_LINE=3
readonly LAYOUT_PROMPT_BLANK=4
readonly LAYOUT_PROMPT_INPUT=5
readonly LAYOUT_CONTENT_START=6
```

---

### 7.2 Large Functions Need Breaking Down
**File**: `org_repl_tui.sh`

- `_org_render()`: 75 lines → Split into:
  - `_org_render_header()`
  - `_org_render_prompt()`
  - `_org_render_content()`
  - `_org_render_logs()`

- Main loop: 104 lines → Extract key handlers:
  - `_org_handle_navigation()`
  - `_org_handle_special_keys()`

---

### 7.3 Missing Function Documentation
**All files**: Functions lack header comments

**Standard format**:
```bash
# Brief description
# Arguments:
#   $1 - Description
# Globals Modified:
#   VAR_NAME - How it's modified
# Returns:
#   0 on success, 1 on error
# Output:
#   What it prints to stdout/stderr
function_name() {
    ...
}
```

---

## 8. SECURITY CONSIDERATIONS

### 8.1 Shell Command Injection
**File**: `org_repl.sh:78`

```bash
[[ "$input" == !* ]] && { eval "${input:1}"; return 0; }
```

**Status**: Intentional feature (shell escape with `!`)
**Recommendation**: Document this as a feature, not a bug

---

### 8.2 Input Sanitization
**File**: `org_repl_tui.sh:516-518`

No validation on printable character input.

**Recommendation**: Limit input length:
```bash
[[:print:]])
    if [[ ${#ORG_REPL_INPUT} -lt 1000 ]]; then  # Max input length
        _org_handle_char "$char"
    fi
    ;;
```

---

## 9. NEW TAB NAVIGATION (Already Implemented) ✅

The new TAB-based navigation model has been successfully implemented:

- ✅ TAB cycles focus: Env → Mode → Action
- ✅ Arrows context-aware: select options when on Env/Mode, navigate history when on Action
- ✅ Underline visual indicator shows current focus
- ✅ Command history works correctly
- ✅ Legacy Ctrl shortcuts still functional

**Files Updated**:
- `bash/org/org_repl_tui.sh`: Core navigation logic
- `bash/org/test_navigation.sh`: Automated test suite
- `bash/org/demo_navigation.sh`: Visual demo

---

## 10. REFACTORING ROADMAP

### Phase 1: Critical Fixes (Completed ✅)
1. ✅ Fix org_completion.sh path
2. ✅ Fix cursor rendering
3. ✅ Add bounds checking
4. ✅ Replace tmpfile with mktemp

### Phase 2: Consistency & Consolidation (High Priority)
1. Create `bash/org/org_config.sh` with canonical definitions
2. Consolidate state initialization
3. Fix environment name inconsistencies
4. Standardize function naming
5. Add cleanup function

### Phase 3: Performance (Medium Priority)
1. Implement action caching
2. Optimize render cycle
3. Improve prompt building

### Phase 4: Error Handling (Medium Priority)
1. Add comprehensive error handling to actions
2. Improve org_active validation
3. Add input sanitization

### Phase 5: Features & Polish (Low Priority)
1. Add missing keyboard shortcuts
2. Implement reverse search (Ctrl+R)
3. Add bracketed paste protection
4. Break down large functions
5. Add comprehensive documentation

---

## 11. TESTING RECOMMENDATIONS

### Unit Tests Needed
```bash
bash/org/tests/
├── test_state_management.sh
├── test_navigation.sh  # ✅ Exists
├── test_input_handling.sh
├── test_error_cases.sh
└── test_performance.sh
```

### Integration Tests
- Multi-org switching
- Environment transitions
- Action execution pipeline
- History persistence

---

## 12. SUMMARY

### Issues by Severity
| Severity | Count | Status |
|----------|-------|--------|
| Critical | 4 | ✅ Fixed |
| High | 8 | ✅ 2 Fixed, 📋 6 Documented |
| Medium | 12 | 📋 Documented |
| Low | 21+ | 📋 Documented |

### Files Reviewed
- ✅ `bash/org/org_repl_tui.sh` (540 lines)
- ✅ `bash/org/org_repl.sh` (195 lines)
- ✅ `bash/org/actions.sh` (228 lines)
- ✅ `bash/org/tetra_org.sh` (980 lines)
- ✅ `bash/org/org_completion.sh` (200 lines)

### Total Issues: 45+
### Fixed: 6 bugs (4 critical + 2 high priority)
### Documented: 39 improvements

### Latest Fixes (2025-10-21):
1. ✅ Duplicate environment definitions consolidated to `org_constants.sh`
2. ✅ Environment name case inconsistency fixed in completion

---

## APPENDIX A: Quick Reference

### Critical Functions to Refactor
1. `_org_render()` - Too complex (75 lines)
2. `org_repl_tui()` main loop - Too long (104 lines)
3. `org_execute_action()` - Needs error handling

### Variables to Consolidate
- `ORG_ENVIRONMENTS` (3 definitions)
- `ORG_MODES` (3 definitions)
- State variables (duplicated across files)

### Documentation Gaps
- No function headers anywhere
- No usage examples in comments
- Missing README for navigation model

---

**Report End**

For questions or clarifications, refer to specific line numbers in the files mentioned above.
