# TUI Grammar Development - Session Summary

**Date:** 2025-10-03
**Working Directory:** `/Users/mricos/src/devops/tetra/demo/basic`
**Bash Version:** 5.2.15(1)-release

---

## Completed Work

### ✅ 1. TUI Grammar Planning Document
**File:** `TUI_GRAMMAR_PLAN.md`

Comprehensive 350+ line planning document covering:
- Complete grammar specification (operators `::`, `→`, `×`, `@`)
- Three-layer routing model (TUI/Module/Stream)
- PData capability integration
- Resource URI schemes
- Execution pipeline (5 steps)
- Detailed implementation plan for demos 011-015
- Full examples for all three execution modes

### ✅ 2. Demo 011: ENV-based Configuration
**Location:** `demo/basic/011/`

**Files:**
- `tui.conf` - All design tokens as ENV_VARs
- `demo.sh` - Basic TUI with configurable layout

**Features:**
- Header/Content/CLI/Footer layout system
- All UI elements defined as environment variables
- HTML/CSS generation ready
- Clean separation of configuration from logic

### ✅ 3. Demo 012: Action Routing + State Machine
**Location:** `demo/basic/012/`

**Files:**
- `tui.conf` - Configuration with operator constants
- `action_registry.sh` - Declarative action signatures (FIXED array bug)
- `action_state.sh` - State machine logic (NEW)
- `action_preview.sh` - Preview/validation system (NEW)
- `modal.sh` - Modal popup system (NEW)
- `router.sh` - Multi-target routing
- `demo.sh` - Main application with state machine integration

**Features:**
- **Routing annotations:** `show:demo :: @tui[content]`
- **State machine:** idle → pending → executing → success/error
- **Execution modes:**
  - Immediate actions `[auto]` - execute on selection
  - Deferred actions `[manual]` - require Enter
- **State display:** Visual symbols (●○▶✓✗) in header
- **Action previews:** Show can/cannot before execution
- **Modal error popups:** Require acknowledgment on error
- **Multi-layer routing:** TUI buffers + app streams
- **Defensive programming:** Fixes "3:3 :: 3" array iteration bug

---

## Root Cause Analysis: Array Iteration Bug

### The "3:3 :: 3" Problem

**Symptom:** Random "3:3 :: 3" entries in action registry listing

**Root Cause:** Nameref scope collision in bash functions
- `local -n action_def="$var"` can collide with outer scope variables
- Environment-specific - only appears during runtime with certain state
- Bash 5.2 handles namerefs correctly, but defensive programming needed

**Solutions Implemented:**

1. **Explicit Registry Array:**
   ```bash
   declare -a ACTION_REGISTRY=(
       "show_demo"
       "configure_demo"
       ...
   )
   ```

2. **Unique Nameref Names:**
   ```bash
   local -n _reg_action="ACTION_${action_name}"  # Unique prefix
   ```

3. **Defensive Validation:**
   ```bash
   # Validate action exists
   if ! declare -p "ACTION_${action_name}" &>/dev/null; then
       continue
   fi

   # Validate required fields
   [[ -z "${_reg_action[verb]}" || -z "${_reg_action[noun]}" ]] && continue
   ```

---

## Key Technical Decisions

### Grammar Operators

| Operator | Symbol | Semantics | Example |
|----------|--------|-----------|---------|
| Cross product | `×` | Compose context | `ENV × MODE` |
| Pairing | `:` | Action syntax | `show:log` |
| Contract | `::` | Type signature | `ACTION :: Type` |
| Flow | `→` | Execution | `ACTION → @target` |
| Route | `@` | Target annotation | `@tui[content]` |

### Three-Layer Routing Model

```bash
# Layer 1: TUI Components (display)
@tui[header]   # Top status
@tui[content]  # Main display
@tui[cli]      # Interactive CLI
@tui[footer]   # Bottom status

# Layer 2: Module Storage (persistence)
@nginx[access_log]  # Module-specific endpoint
@deploy[run_log]    # Resolved by module

# Layer 3: App Streams (firehose)
@app[stdout]   # Virtual stdout (real stdio renders TUI)
@app[events]   # Event bus
@app[metrics]  # Metrics feed
```

### State Machine Flow

```
idle ──f(immediate)──> executing ──> success ──> idle
  │                          │
  └──f(deferred)──> pending ─┘
                       │
                   Enter│
                       ↓
                   executing ──error──> error ──Enter──> idle
```

---

## File Structure

```
demo/basic/
├── TUI_GRAMMAR_PLAN.md          # Comprehensive planning doc
├── SESSION_SUMMARY.md            # This file
├── 011/                          # ENV-based configuration
│   ├── tui.conf
│   └── demo.sh
└── 012/                          # Action routing + state machine
    ├── tui.conf
    ├── action_registry.sh        # FIXED: Defensive iteration
    ├── action_state.sh           # NEW: State machine
    ├── action_preview.sh         # NEW: Preview/validation
    ├── modal.sh                  # NEW: Modal popups
    ├── router.sh
    └── demo.sh                   # ENHANCED: Full integration
```

---

## Next Steps

### Immediate (Remaining Demos)

**Demo 013: Module Endpoint Binding**
- Add module-specific storage endpoints
- Implement resource URI resolution (`file://`, `ssh://`)
- Template variable expansion (`{run_id}`, `{user}`)
- Module registration system

**Demo 014: Capability Validation (PData Integration)**
- Integrate PData capability syntax (`read:~log/**`)
- Validate actions before execution
- Show permission errors in modal
- User vs admin capability examples

**Demo 015: Complete Grammar System**
- Full operator implementation
- Complete execution pipeline
- All three execution modes (local, remote, config-at-distance)
- Reusable grammar library
- Integration with bash/tview

### Integration (Post-Demos)

1. Extract grammar into `/Users/mricos/src/devops/tetra/bash/utils/grammar/`
2. Integrate with existing `bash/deploy` module
3. Replace `bash/tview` with new TUI framework
4. Add HTML/CSS code generation
5. Document API for module authors

### Extensions (Future)

- Type checking (stronger contracts)
- Event bus implementation (`@app[events]`)
- Metrics collection (`@app[metrics]`)
- Interactive action builder (TUI for grammar)
- REPL with action discovery

---

## Quick Reference

### Running Demos

```bash
# Demo 011: ENV-based config
cd /Users/mricos/src/devops/tetra/demo/basic/011
./demo.sh

# Demo 012: Action routing + state machine
cd /Users/mricos/src/devops/tetra/demo/basic/012
./demo.sh
```

### Key Commands (Demo 012)

```
e/E - Cycle environments
d/D - Cycle modes
f/F - Cycle actions (immediate actions auto-execute!)
Enter - Execute deferred action (or acknowledge error)
r - Show routing table
s - Show app stream
c - Clear content
q - Quit
```

### Action Examples

```bash
# Immediate action (auto-executes on selection)
declare_action "show_demo" \
    "verb=show" \
    "noun=demo" \
    "routes=@tui[content]" \
    "immediate=true" \
    "can=Display demo information" \
    "cannot=Modify system state"

# Deferred action (requires Enter, shows preview)
declare_action "execute_deployment" \
    "verb=execute" \
    "noun=deployment" \
    "routes=@tui[content],@deploy[run_log]" \
    "immediate=false" \
    "can=Deploy to staging environment" \
    "cannot=Deploy to production"
```

---

## Known Issues & Limitations

### Resolved ✅
- ~~Array iteration bug ("3:3 :: 3")~~ - Fixed with defensive programming

### Current Limitations
- No actual PData integration yet (placeholder validation)
- Module endpoints not yet implemented (demo 013)
- No SSH resource resolution yet (demo 013)
- Error handling is simulated (not real validation)

---

## Environment

```bash
# Globals required
TETRA_SRC=/Users/mricos/src/devops/tetra
TETRA_DIR=/Users/mricos/tetra  # Optional runtime dir

# Current working directory
PWD=/Users/mricos/src/devops/tetra/demo/basic/010

# Bash version
BASH_VERSION=5.2.15(1)-release

# Platform
OS=darwin (macOS)
```

---

## Resources

- **Planning Doc:** `demo/basic/TUI_GRAMMAR_PLAN.md`
- **PData Docs:** `../../devpages/pdata/` (symlinked)
- **Deploy Module:** `../../bash/deploy/`
- **Existing TView:** `../../bash/tview/` (to be replaced)

---

## Todo List

- [x] Create demo 011: ENV-based config system
- [x] Write TUI grammar planning document
- [x] Create demo 012: Action routing with @annotations
- [x] Enhance demo 012 with state machine + fix array bug
- [ ] Create demo 013: Module endpoint binding
- [ ] Create demo 014: Capability validation (PData)
- [ ] Create demo 015: Complete grammar system

---

**Status:** Ready to proceed with demos 013-015
**Next:** Demo 013 - Module endpoint binding with resource URIs

---

## For New Shell Session

```bash
# Start from working directory
cd /Users/mricos/src/devops/tetra/demo/basic

# Review planning document
cat TUI_GRAMMAR_PLAN.md

# Review this summary
cat SESSION_SUMMARY.md

# Test current demos
cd 012 && ./demo.sh

# Continue with demo 013
# See TUI_GRAMMAR_PLAN.md section "Demo 013"
```
