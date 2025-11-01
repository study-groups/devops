# TES Action Lifecycle Implementation

## Changes Made

### 1. Updated Action State Machine (action_state.sh)

**Before:** Simple UI states
```bash
States: idle → pending → executing → success/error → idle
```

**After:** TES-compliant lifecycle
```bash
States: template → qualified → ready → executing → success/error → idle
```

**New State Symbols:**
- `idle` ● - Neutral state (for simple actions)
- `template` ○ - Action declared, needs inputs/resolution
- `qualified` ◐ - Inputs provided, needs validation
- `ready` ◉ - Validated, can execute safely
- `executing` ▶ - Currently running
- `success` ✓ - Completed successfully
- `error` ✗ - Failed with error

**New Functions Added:**
- `is_fully_qualified()` - Check if action has all inputs resolved
- `is_action_ready()` - Check if action is validated and safe to execute
- `qualify_action()` - Mark action as having inputs resolved
- `mark_action_ready()` - Mark action as validated and ready

### 2. Enhanced Action Execution (demo.sh)

**Before:** Direct execution without validation
```bash
set_action_state "$action" "executing"
execute_action_with_feedback "$action"
```

**After:** TES-compliant 5-phase execution
```bash
# PHASE 1: QUALIFY - Check if action is fully qualified
# PHASE 2: VALIDATE - Pre-flight checks
# PHASE 3: EXECUTE - Run the action
# PHASE 4: RESULT - Show success/error state
# PHASE 5: RESET - Return to idle
```

Actions now:
1. Check qualification (inputs resolved)
2. Auto-validate simple actions (no inputs)
3. Show clear error messages if not ready
4. Only execute when fully qualified and validated

### 3. Fixed Ctrl-O Pager (viewport.sh)

**Before:**
```bash
echo "$content" | glow  # Renders and exits immediately
read -n1 -s -p "Press any key to return..."
```

**After:**
```bash
tput smcup  # Save terminal state
echo "$content" | glow --pager  # Interactive paging
tput rmcup  # Restore terminal state
```

Now `glow --pager` opens interactively, user can scroll/search, and pressing 'q' returns to TUI automatically.

## TES Compliance

### From TES Section 5.1:
```
Template (abstract) → Qualified (concrete) → Execute (safe)
     declare              resolve              validate + run
```

### Implementation Mapping:

| TES Phase | Implementation | State Symbol |
|-----------|----------------|--------------|
| Template | Action declared in registry | ○ template |
| Qualified | `is_fully_qualified()` passes | ◐ qualified |
| Ready | `is_action_ready()` passes | ◉ ready |
| Execute | `execute_action_with_feedback()` | ▶ executing |
| Result | Success or Error state | ✓ success / ✗ error |

### From TES Section 9.1 (Validation):
```
is_fully_qualified() {
    # Check all required inputs are resolved
    if [[ "${action_def[inputs]}" =~ @[a-z]+$ ]]; then
        return 1  # Has unresolved symbols
    fi
    return 0
}
```

✅ **Implemented** - Actions with unresolved symbols (@staging, @dev, etc.) are blocked from execution.

## Usage

### Simple Actions (No Inputs)
```bash
view:toml :: () → @tui[content]
```
1. User presses Enter
2. Auto-qualified (no inputs needed)
3. Auto-validated (no pre-flight checks)
4. Executes immediately

### Complex Actions (With Inputs)
```bash
deploy:staging :: (@source) → @tui[content] where @app[stdout]
```
1. User provides inputs (@source symbol)
2. System resolves symbol → checks qualified
3. Pre-flight validation (SSH connectivity, etc.)
4. Only executes if ready

## Testing

Run the test suite:
```bash
bash test_lifecycle.sh
```

Run the demo:
```bash
bash demo.sh
```

Test Ctrl-O pager:
1. Navigate to any action
2. Press Enter to execute
3. Press Ctrl-O to view full content in glow
4. Press 'q' to return to TUI

## Files Changed

1. `action_state.sh` - Added TES lifecycle states and validation functions
2. `demo.sh` - Implemented 5-phase TES-compliant execution
3. `viewport.sh` - Fixed `glow --pager` for interactive viewing
4. `test_lifecycle.sh` - New test file for lifecycle validation
5. `LIFECYCLE_CHANGES.md` - This document
