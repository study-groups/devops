# TUI Documentation - Complete Analysis

This directory contains comprehensive analysis and design patterns for Tetra's TUI system.

## Quick Links

### Analysis Documents
1. **[TUI_LANDSCAPE_ANALYSIS.md](./TUI_LANDSCAPE_ANALYSIS.md)** - COMPREHENSIVE
   - 10,000+ words analyzing current TView vs. working demo patterns
   - Detailed breakdown of what's broken and why
   - Pattern analysis for each component (navigation, colors, actions, state, rendering)
   - Summary table comparing all approaches
   - **Read this first to understand the problems**

2. **[CANONICAL_TUI_DESIGN.md](./CANONICAL_TUI_DESIGN.md)** - IMPLEMENTATION GUIDE
   - Complete architectural design for canonical TUI system
   - File structure for new clean system
   - Code examples for each layer
   - 8 design rules with tests
   - Implementation checklist (4 phases)
   - **Read this to understand the solution**

### Reference Documents
3. **[separation.md](./separation.md)** - Architecture Principles
   - TUI vs TView separation
   - Interface contract definition
   - Benefits and communication patterns

4. **[toy-model.md](./toy-model.md)** - Toy Model Reference
5. **[step-def.md](./step-def.md)** - Step Definitions
6. **[tui-syntax.md](./tui-syntax.md)** - TUI Syntax Reference
7. **[next.md](./next.md)** - Next Steps

---

## TUI Landscape Summary

### Current State
- **Location**: `bash/tview/` - 45 files, ~3000 lines
- **Status**: BROKEN - tangled concerns, unmaintainable
- **Problem**: Attempted universal dashboard with mixed responsibilities

### Working Patterns Found
1. **demo/014** - Canonical harmonized system (BEST)
   - Buffer-based rendering, typed actions, clean main loop
   - 250-line demo vs. 1200+ line tview_core.sh

2. **demo/013** - TES + typed actions pattern
   - Action metadata, preview system, 3D navigation
   - ~200-line readable main loop

3. **demo/010** - Component rendering system
   - Sophisticated color system, double buffering
   - Color distance algorithms, design tokens

### Canonical Path Forward
**Delete ~30 files, adopt 3 demo patterns, create ~5 new canonical modules:**

```
bash/tui/
├── colors/ (from demo/010)
├── buffer.sh (from demo/014)
├── typography.sh (from demo/010)
├── gamepad_input.sh (from demo/014)
└── animation/ (from demo/014)

bash/tetra/tui/
├── state.sh (minimal: 3 indices)
├── navigation.sh (simple cycling)
├── renderer.sh (250-line main loop)
└── repl.sh (orchestrator integration)

bash/tetra/actions/
├── registry.sh (declare_action metadata)
├── actions_impl.sh (pure functions)
├── executor.sh (simple dispatcher)
└── module_discovery.sh (extensibility)
```

---

## Key Findings

### What's Broken in TView
1. **State Explosion** - 20+ global variables with unclear relationships
2. **Tangled Concerns** - Rendering mixes with data loading, SSH testing, TOML parsing
3. **Complex Navigation** - "AWSD contextual" changes meaning per mode
4. **Unused Infrastructure** - Color tokens defined but not applied
5. **Rigid Module Integration** - Hardcoded directory structure, no registry
6. **Poor Separation** - No boundary between TUI and content logic

### What Works in Demos
1. **Simple State** - `ENV_INDEX`, `MODE_INDEX`, `ACTION_INDEX` only
2. **Clear Navigation** - Consistent `(index ± 1) % length` pattern
3. **Buffer-Based Rendering** - Atomic updates, no flicker
4. **Typed Actions** - Metadata + pure functions + dispatcher
5. **Module Discovery** - Dynamic loading via interface contract
6. **Strong Separation** - TUI handles I/O, orchestrator handles dispatch

### The Fix
Replace TView with canonical design from demo/014:
- ✓ Simpler (5 files vs 45 files)
- ✓ Cleaner (clear concerns, no tangling)
- ✓ Testable (pure functions, separated logic)
- ✓ Maintainable (patterns are obvious)
- ✓ Extensible (module discovery)

---

## Architecture Comparison

| Aspect | Demo 010 | Demo 013 | Demo 014 | TView | Best |
|--------|----------|----------|----------|-------|------|
| Rendering | Component | Plain | Buffer | Direct | 014 ✓ |
| Navigation | — | 3D simple | 3D simple | 3D complex | 013 ✓ |
| Colors | Sophisticated | Basic | Inherited | Defined unused | 010 ✓ |
| Actions | Simple | Typed+meta | I/O signatures | Unstructured | 014 ✓ |
| State | Simple | Minimal | Minimal | Explosion | 013/014 ✓ |
| Module Integration | — | Simple | Discovery | Rigid | 014 ✓ |
| REPL | Basic | Slashes | — | Complex | 013 ✓ |
| Maintainability | Good | Excellent | Excellent | Poor | — |

**Verdict**: Adopt demo/014 as base, integrate demo/013 action model, use demo/010 colors.

---

## Design Rules (8 Key Principles)

1. **Separation of Concerns**
   - TUI: I/O, rendering, state
   - Orchestrator: context, dispatch, logic
   - Modules: actions, business logic

2. **Simple State**
   - Only: `ENV_INDEX`, `MODE_INDEX`, `ACTION_INDEX`
   - Everything else is derived
   - No side effects in updates

3. **Consistent Colors**
   - Define once in `color_core.sh`
   - Use variables always
   - Never hardcode ANSI escapes

4. **Buffered Rendering**
   - All writes to `TUI_BUFFERS` array
   - Single `tui_buffer_flush()`
   - No terminal writes during state updates

5. **Pure Action Functions**
   - Input: context
   - Output: text or status
   - No rendering or mutations

6. **Module Discovery**
   - No hardcoded lists
   - Each module self-registers
   - TUI loads dynamically

7. **Navigation Pattern**
   - Always: `(index ± 1) % length`
   - Reset action when changing context
   - No hidden navigation modes

8. **Testability**
   - Actions callable in subprocess
   - State changes observable
   - Buffer contents capturable

---

## Implementation Path

### Phase 1: Analysis & Planning ✓ DONE
- [x] TUI_LANDSCAPE_ANALYSIS.md
- [x] CANONICAL_TUI_DESIGN.md
- [x] Architecture comparison

### Phase 2: Core Infrastructure (TODO)
- [ ] Create bash/tui/colors/ module
- [ ] Create bash/tui/buffer.sh
- [ ] Create bash/tetra/tui/state.sh
- [ ] Create bash/tetra/tui/navigation.sh

### Phase 3: Rendering & Input (TODO)
- [ ] Create bash/tetra/tui/renderer.sh
- [ ] Create bash/tui/gamepad_input.sh
- [ ] Create bash/tetra/tui/repl.sh

### Phase 4: Action System (TODO)
- [ ] Create bash/tetra/actions/registry.sh
- [ ] Create bash/tetra/actions/executor.sh
- [ ] Create bash/tetra/actions/module_discovery.sh

### Phase 5: Integration & Testing (TODO)
- [ ] Verify module TUI interfaces
- [ ] Test navigation patterns
- [ ] Test action execution
- [ ] Integration testing

### Phase 6: Cleanup (TODO)
- [ ] Delete bash/tview/ (after migration)
- [ ] Move any keepable logic to modules
- [ ] Update documentation

---

## File Sizes & Statistics

**Current TView**: 45 files, ~3000 lines, unmaintainable
**Canonical Replacement**: ~10 files, ~500 lines, clean & maintainable

### Current TView Breakdown
```
Core files (3):
  - tview_core.sh: 1200 lines (tangled concerns)
  - tview_render.sh: 500 lines (mixed rendering/data)
  - tview_state.sh: 100 lines (confused state)

Module systems (4):
  - tview_rcm_*.sh: 4 files (complex RCM logic)
  - tview_modal*.sh: 2 files (modal system)
  - tview_modes.sh: Complex per-mode rendering

Subsystems (20+):
  - TOML subsystem: 11 files
  - Color system: unused infrastructure
  - SSH system: mixed concerns
  - Hooks system: underspecified

Debugging artifacts (8):
  - test_simple.sh, dashboard.sh, etc.
```

### Canonical Replacement Breakdown
```
TUI Layer (7 files, ~200 lines):
  - bash/tui/colors/ - color_core.sh, color_semantic.sh
  - bash/tui/buffer.sh - double buffering
  - bash/tui/typography.sh - text styling
  - bash/tui/gamepad_input.sh - input handling

Tetra Integration (5 files, ~300 lines):
  - bash/tetra/tui/state.sh - 20 lines of state
  - bash/tetra/tui/navigation.sh - simple navigation
  - bash/tetra/tui/renderer.sh - 250-line main loop
  - bash/tetra/actions/registry.sh - metadata
  - bash/tetra/actions/executor.sh - dispatcher
```

---

## Next Steps

1. **Read TUI_LANDSCAPE_ANALYSIS.md** for complete problem analysis
2. **Read CANONICAL_TUI_DESIGN.md** for implementation details
3. **Review demo/014/** as the canonical reference implementation
4. **Start Phase 2** when ready to implement

For questions or clarifications:
- Check the relevant .md file in this directory
- Review the demo code at `demo/basic/010/`, `demo/basic/013/`, `demo/basic/014/`
- Run the demo: `bash demo/basic/014/demo.sh`

