# TUI Landscape Analysis: Current TView vs. Working Demo Patterns

## Executive Summary

You have a complex, feature-rich **broken TView system** (`bash/tview/`) with ~45 files attempting to be a universal UI framework, and **three working demo patterns** (`demo/basic/010, 013, 014`) that progressively show canonical approaches to TUI architecture.

**Key Finding**: The demos demonstrate that clean, working TUIs follow **strict separation of concerns** with modular, testable components. TView tried to do everything at once and became unmaintainable.

---

## 1. CURRENT TVIEW SYSTEM (BROKEN)

### 1.1 What It Is
`bash/tview/` is an attempt at a **universal real-time monitoring/operations dashboard** for tetra infrastructure with:
- Multi-mode navigation (TOML, TKM, TSM, DEPLOY, ORG, RCM)
- Multi-environment context (TETRA, LOCAL, DEV, STAGING, PROD, QA)
- Remote Command Execution (RCM) with SSH prefix management
- Service/Key management interfaces
- Color design tokens and theming
- Modal system, REPL interface, layout manager
- Complex state management for RCM async execution

### 1.2 Problems with Current TView

**1. Tangled Concerns**
- `tview_core.sh` (1200+ lines): Mixes action execution, modal handling, REPL dispatch, navigation, rendering
- `tview_render.sh`: Rendering mixed with data fetching (loads TOML data, checks SSH)
- `tview_colors.sh`: Color definitions but also semantic layout rules
- No clear boundary between interface (TUI) and content (TView)

**2. State Explosion**
- Global arrays: `RCM_COMMAND_STATES`, `RCM_COMMAND_RESULTS`, `RCM_COMMAND_PIDS`, `RCM_COMMAND_EXPANDED`, etc.
- Complex nested state: `LAYOUT_STATE["show_results"]`, `TVIEW_STATE[key_sequence]`
- Mode-specific keymaps duplicated: `RCM_KEYMAP`, `TOML_KEYMAP`, `TKM_KEYMAP`, `TSM_KEYMAP`
- No single source of truth for state shape

**3. Navigation Complexity**
- 3D navigation space (Org × Env × Mode × Item) managed in `tview_core.sh`
- Multiple context switching paths: gamepad keys, REPL slash commands, modal actions
- `handle_gamepad_input_with_layout()` is 150+ lines handling all possible key combinations
- "AWSD contextual navigation" is underspecified - different behaviors per mode

**4. Rendering Problems**
- No viewport abstraction (demo/014 uses triple-buffering)
- Direct terminal writes scattered across files: `\033[${line};1H\033[K`
- Screen regions calculated ad-hoc rather than managed by layout system
- No component-based rendering (demo/010 has component system)

**5. Module Integration Failure**
- `get_actions_for_context()` tries to dynamically load module files
- Hardcoded directory structure: `"$TETRA_SRC/bash/$(echo "$mode" | tr '[:upper:]' '[:lower:]')/tview"`
- No action registry or standardized interface
- Each module must have `actions.sh` with `get_actions()` and `execute_action()` - very rigid

**6. Color System Overambition**
- `tview_colors.sh`: 100+ lines of color definitions and design tokens
- Attempts "semantic" colors for all contexts: environments, modes, statuses, actions
- But rendering doesn't consistently USE these tokens - inline ANSI escapes elsewhere
- Color theming infrastructure exists but not actually applied

**7. Documentation Disconnect**
- `demo/docs/separation.md` defines TUI vs TView separation clearly
- TView implementation violates this everywhere
- Example: `load_ssh_connectivity()` in `tview_render.sh` is a content operation in interface code

---

## 2. WORKING DEMO PATTERNS

### 2.1 Demo 010 - Component Architecture (Renders Only)

**Location**: `demo/basic/010/`

**What It Shows**:
- Color module system with sophisticated distance calculations
- Component-based rendering (planned, not fully implemented)
- Double buffering for flicker-free updates
- Typography system (bold, dim, underline)
- View controller pattern for screen layouts
- REPL with structured handlers

**Key Files**:
```
demo/basic/010/
├── bash/app/
│   ├── app.sh                    # Orchestration
│   ├── components/
│   │   └── component_system.sh   # Component registry and rendering
│   ├── controllers/
│   │   └── view_controllers.sh   # Layout management
│   ├── rendering/
│   │   └── double_buffer.sh      # Flicker-free updates
│   ├── action_router.sh          # Simple action dispatch
│   └── handlers/                 # Handler implementations
├── bash/tui/
│   ├── modules/
│   │   ├── tui_init.sh          # TUI initialization
│   │   ├── typography.sh        # Text styling
│   │   ├── colors/              # Sophisticated color system
│   │   │   ├── color_core.sh
│   │   │   ├── color_palettes.sh
│   │   │   ├── color_themes.sh
│   │   │   ├── color_elements.sh
│   │   │   ├── color_ui.sh
│   │   │   └── color_module.sh
│   │   └── ...
```

**Patterns**:
1. **Separation**: TUI modules live in `bash/tui/`, app code in `bash/app/`
2. **Color Design**: Palette → Themes → Elements → UI (pyramid of abstraction)
3. **Component Registry**: Functions like `declare_component()`, track rendered elements
4. **Double Buffering**: All writes go to buffer, single flush at display time
5. **View Controllers**: One controller per major screen state
6. **Action Routing**: Simple verb:noun parsing, dispatch to handlers

**Strengths**:
- Clean module boundaries
- Color system is algorithmic (distance-based palette generation)
- Buffer abstraction isolates rendering concerns
- Easy to test individual components

**Limitations**:
- Doesn't show full application flow (modal system, REPL, multi-mode navigation)
- Component system is documented but not fully integrated
- Limited to single environment/mode context

---

### 2.2 Demo 013 - TES + Typed Actions (Content Model)

**Location**: `demo/basic/013/`

**What It Shows**:
- TES (Tetra Endpoint Specification) resolution system integrated with UI
- Structured action definitions with metadata
- Action preview before execution
- Navigation through 3D space (System/Local/Dev × Monitor/Control/Deploy × actions)
- Modal system for detailed views
- REPL for command-line mode

**Key Files**:
```
demo/basic/013/
├── demo.sh                       # Main application loop
├── tui.conf                      # TUI configuration constants
├── action_registry.sh            # ACTION_DEF metadata registry
├── action_state.sh               # Action execution state tracking
├── action_preview.sh             # Preview rendering
├── action_executor.sh            # Execution engine with TES
├── viewport.sh                   # Scrollable viewport abstraction
├── colors/                       # Color module from 010
├── modal.sh                      # Modal system
├── router.sh                     # Simple router
├── repl.sh                       # REPL interface
├── typography.sh                # Typography from 010
└── tes_resolver.sh               # TES resolution logic
```

**Patterns**:
1. **Action Metadata**: Each action has verb, noun, environment, mode context
2. **Progressive Disclosure**: Action preview → Execute → Show results
3. **State Separation**: 
   - `ACTION_INDEX`, `ENV_INDEX`, `MODE_INDEX` for navigation
   - `PREVIEW_MODE` for auto-preview toggle
   - `ACTION_REGISTRY` for metadata
4. **Modal System**: Show details without disrupting navigation state
5. **TES Integration**: Actions reference TES levels and operations
6. **Simple Renderer**: Direct output to terminal, viewport handles scrolling

**Strengths**:
- Actions are first-class, documented with metadata
- Clear execution contexts (System:Monitor, Local:Control, Dev:Deploy)
- Preview system reduces surprise on execution
- TES provides structured approach to endpoints
- ~200-line main loop is readable

**Limitations**:
- No async execution handling (actions must complete)
- Modal system is basic (no nested modals)
- Color system from 010 but rendering is plain text
- REPL is minimal (basic slash commands)
- No animation or dynamic updates

---

### 2.3 Demo 014 - Harmonized TUI + Typed Actions (Canonical)

**Location**: `demo/basic/014/`

**What It Shows**:
- **BEST CURRENT PATTERN**: Combines rendering quality from 010 with action model from 013
- Double buffering + animation controller for smooth updates
- Typed action system with I/O signatures
- Header animation (oscillator + line animator)
- Gamepad input with smooth key handling
- Module discovery for extensibility
- Clear lifecycle: Header → Content → Footer

**Key Files**:
```
demo/basic/014/
├── demo.sh                       # 250-line harmonized main loop
├── tui.conf                      # TUI configuration
├── bash/tui/
│   ├── colors/color_core.sh      # Rich color system
│   ├── buffer.sh                 # Double buffering
│   ├── animation_controller.sh   # Animation state machine
│   ├── oscillator.sh             # Sine wave animation
│   ├── line_animator.sh          # Animated separator
│   ├── header.sh                 # Header rendering
│   ├── gamepad_input.sh          # Input handling
│   └── typography.sh
├── bash/actions/
│   ├── registry.sh               # ACTION_* metadata declarations
│   ├── state.sh                  # Action execution state
│   ├── router.sh                 # Route actions to handlers
│   ├── actions_impl.sh           # Action implementations
│   ├── executor.sh               # Execution engine
│   └── module_discovery.sh       # Find module actions
└── REFACTOR_SUMMARY.md           # Architecture document
```

**Patterns**:
1. **Buffer-Based Rendering**:
   ```bash
   tui_write_header "$line_num" "$line"   # Write to buffer
   tui_write_separator "$separator_line"
   tui_write_content "$content"
   tui_buffer_flush                       # Single flush to screen
   ```

2. **Animation System**:
   ```bash
   osc_init                               # Initialize oscillator
   line_init                              # Initialize line animator
   separator_line=$(line_animate_from_osc "$(osc_get_position)" | tr -d '\n')
   ```

3. **Action I/O Signatures**:
   ```bash
   declare_action "view_env" \
       "verb=view" \
       "noun=env" \
       "inputs=" \
       "output=@tui[content]" \
       "exec_at=@local" \
       "tes_operation=read"
   ```

4. **Module Discovery**:
   ```bash
   get_module_actions "$env" "$mode"      # Dynamic action list
   ```

5. **Viewport/Scroll Management**:
   ```bash
   if [[ -n "${TUI_BUFFERS["@tui[content]"]}" ]]; then
       content="${TUI_BUFFERS["@tui[content]"]}"
   fi
   ```

6. **State Simplicity**:
   ```bash
   ENV_INDEX, MODE_INDEX, ACTION_INDEX   # Only what's needed
   SHOW_DETAIL, VIEW_MODE                # Current display state
   ```

**Strengths**:
- Smooth animation and rendering
- Clean action model with I/O signatures
- Module discovery for extensibility
- Simple main loop (250 lines vs tview's 1200+)
- Animation doesn't block input (oscillator updates per keystroke)
- Rich typography and colors applied consistently
- Clear lifecycle in render functions

**Architecture Quality**:
- ✓ Separation of concerns (TUI vs actions vs state)
- ✓ Composable components (buffer, animator, header)
- ✓ Testable (actions are functions, not global state)
- ✓ Maintainable (3 core files: actions/, tui/, state)
- ✓ Extensible (module discovery)
- ✓ Scalable (handles env × mode × action navigation)

---

## 3. INTERFACES IN ORCHESTRATOR

### 3.1 Tetra REPL Interface

**Location**: `bash/tetra/interfaces/repl.sh`

**What It Shows**:
- REPL uses tcurses input system (readline-like)
- Simple slash command parsing (`/help`, `/org`, `/env`, `/mode`, `/context`, etc.)
- Dispatch to orchestrator for action handling
- Context tracking (org × env × mode)
- Return codes for flow control (0=continue, 1=exit, 2=update prompt)

**Pattern**:
```bash
tetra_repl_build_prompt() {
    local org="$(tetra_get_org)"
    local env="$(tetra_get_env)"
    local mode="$(tetra_get_mode)"
    echo "[${org} × ${env} × ${mode:-all}] tetra> "
}

tetra_repl_process_line() {
    if [[ "$line" == /* ]]; then
        # Slash commands
        case "$cmd_name" in
            org) tetra_set_org "$cmd_args" ;;
            env) tetra_set_env "$cmd_args" ;;
            ...
        esac
    else
        # Dispatch to action
        tetra_dispatch_action $line
    fi
}
```

**Key Ideas**:
- Context is not in TUI, it's in orchestrator (tetra_get_org, tetra_set_org)
- TUI just displays the context and receives commands
- Actions dispatched back to orchestrator, not handled in TUI
- REPL is thin wrapper around orchestrator

---

## 4. CANONICAL ARCHITECTURE

Based on all three demos and orchestrator interface, the canonical TUI architecture is:

```
┌─────────────────────────────────────────┐
│ ORCHESTRATOR (bash/tetra/)              │
│ - Context: org × env × mode             │
│ - Action registry and dispatch          │
│ - State persistence                     │
└─────────────────────────────────────────┘
                    ↑↓
┌─────────────────────────────────────────┐
│ TUI SYSTEM                              │
│                                         │
│ ┌──────────────────────────────────┐   │
│ │ Input Handling                   │   │
│ │ - Keyboard (gamepad_input.sh)    │   │
│ │ - REPL readline integration      │   │
│ │ - Event loop                     │   │
│ └──────────────────────────────────┘   │
│                ↓                        │
│ ┌──────────────────────────────────┐   │
│ │ State Management                 │   │
│ │ - Display state (ENV_INDEX, ...)│   │
│ │ - Navigation history            │   │
│ │ - Modal/drill mode              │   │
│ └──────────────────────────────────┘   │
│                ↓                        │
│ ┌──────────────────────────────────┐   │
│ │ Rendering System                 │   │
│ │ - Buffer-based (flicker-free)   │   │
│ │ - Components (header, content)   │   │
│ │ - Animation controller          │   │
│ │ - Color design tokens           │   │
│ └──────────────────────────────────┘   │
│                ↓                        │
│ ┌──────────────────────────────────┐   │
│ │ Output                           │   │
│ │ - Terminal screen via tput       │   │
│ └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

---

## 5. DETAILED PATTERNS ANALYSIS

### 5.1 Navigation Pattern

**Demo 013/014 Pattern** (Working):
```bash
# Global state: indices into arrays
ENV_INDEX=0            # Which environment
MODE_INDEX=0           # Which mode (context)
ACTION_INDEX=0         # Which action in current context

ENVIRONMENTS=("Local" "Dev" "Staging" "Production")
MODES=("Inspect" "Transfer" "Execute")

# Get actions for current context
get_actions() {
    local env="${ENVIRONMENTS[$ENV_INDEX]}"
    local mode="${MODES[$MODE_INDEX]}"
    case "$env:$mode" in
        "Local:Inspect") echo "view:toml view:env check:local" ;;
        "Dev:Transfer") echo "fetch:config push:config" ;;
        ...
    esac
}

# Navigate - simple array cycling
navigate_env() {
    ENV_INDEX=$(( (ENV_INDEX + 1) % ${#ENVIRONMENTS[@]} ))
    ACTION_INDEX=0  # Reset action when changing context
}
```

**TView Pattern** (Broken):
- 6+ types of state: CURRENT_ENV, CURRENT_MODE, CURRENT_ITEM, DRILL_LEVEL, SCROLL_OFFSET, FILE_VIEW_MODE
- 3D navigation space but inconsistently implemented
- "AWSD contextual navigation" changes meaning based on mode
- Navigation spreads across 4 files: `tview_navigation.sh`, `tview_core.sh`, `tview_keys.sh`, `tview_rcm_state.sh`

**Why Demo 013/014 Works**:
- Single canonical state: `(ENV_INDEX, MODE_INDEX, ACTION_INDEX)`
- Navigation always follows same pattern: `(index + 1) % length`
- State reset is explicit: changing ENV resets ACTION_INDEX
- No hidden navigation modes (drill, scroll, file view)

---

### 5.2 Color System Pattern

**Demo 010 Pattern** (Sophisticated but not integrated):
```bash
# Color core: ANSI codes and tput
COLOR_RED=$(tput setaf 1)
COLOR_RESET=$(tput sgr0)

# Palette: Named groups
AMIGOS_ORANGE="$ORANGE"
TETRA_PURPLE="$PURPLE"

# Semantic: Purpose-driven assignments
ENV_LOCAL_COLOR="$STEEL"       # Cool blue-gray
ENV_DEV_COLOR="$LIME"          # Bright green
ENV_PROD_COLOR="$CORAL"        # Alert red

# Distance-based: Algorithmic color selection
weighted_rgb_distance() {
    local hex1="$1" hex2="$2"
    # Calculate distance with human eye perception weights
    # Used to find maximally contrasting colors
}
```

**Demo 014 Pattern** (Integrated):
- Inherits color system from 010
- Uses `color_core.sh` for palette
- Applies colors consistently in rendering

**TView Pattern** (Overambitious):
- `tview_colors.sh` defines all these concepts
- But rendering code doesn't use them consistently
- Mixed inline ANSI escapes: `\033[35m` for purple, `\033[0m` for reset
- Color tokens defined but not applied in header/content rendering

**Why Demo Works**:
- Colors are definitional (palette layer), not sprinkled throughout code
- Rendering always uses `COLOR_*` variables
- Semantic assignments (ENV_LOCAL_COLOR) are optional enhancements
- Fallback to basic ANSI if extended colors unavailable

---

### 5.3 Action Execution Pattern

**Demo 013/014 Pattern** (Type-safe):
```bash
# Registry: Metadata about actions
declare_action "view_env" \
    "verb=view" \
    "noun=env" \
    "inputs=" \
    "output=@tui[content]" \
    "exec_at=@local" \
    "tes_operation=read"

# Implementation: Actual function
action_view_env() {
    local env="${1:-Local}"
    # Return data to output destination (@tui[content])
    echo "Environment: $env"
}

# Execution: Simple router
execute_action() {
    local action_id="$1"
    local env="$2"
    
    if declare -f "action_${action_id//:/_}" >/dev/null 2>&1; then
        "action_${action_id//:/_}" "$env"
    fi
}
```

**TView Pattern** (Unstructured):
- `get_actions_for_context()` dynamically loads module files
- Each module must have `actions.sh` with `get_actions()` and `execute_action()`
- No metadata, no I/O signatures
- Execution is hardcoded in `execute_action_line()` with case statements
- Output handling is ad-hoc (show in modal, file view, results area)

**Why Demo Works**:
- Actions are discoverable (metadata in declaration)
- I/O is explicit (output=@tui[content])
- Execution location is clear (exec_at=@local, @remote)
- Functions are pure (input → output, not side-effect heavy)
- Easy to test: just call the function, check return

---

### 5.4 State Management Pattern

**Demo 013/014 Pattern** (Minimal):
```bash
# Only what's needed for navigation and display
ENV_INDEX=0
MODE_INDEX=0
ACTION_INDEX=0
SHOW_DETAIL=false
VIEW_MODE=false
SCROLL_OFFSET=0
```

**TView Pattern** (Explosion):
```bash
CURRENT_ENV, CURRENT_MODE, CURRENT_ITEM, DRILL_LEVEL, SCROLL_OFFSET, FILE_VIEW_MODE
RCM_COMMAND_STATES, RCM_COMMAND_RESULTS, RCM_COMMAND_EXIT_CODES, RCM_COMMAND_PIDS, RCM_COMMAND_EXPANDED
RCM_EDITING_MODE, RCM_EDIT_ENV, RCM_EDIT_BUFFER
LAYOUT_STATE[...], TVIEW_STATE[...], ACTION_LINE[...]
TVIEW_HINT, TVIEW_STATUS_FIELD
```

**Why Demo Works**:
- Each piece of state has clear purpose
- Relationship between state variables is obvious
- State reset logic is simple (change ENV → reset ACTION_INDEX)
- Rendering just reads state (no state mutations during display)

---

### 5.5 Rendering Pattern

**Demo 014 Pattern** (Buffer-based):
```bash
# Initialization
tui_buffer_init        # Clear buffers

# Rendering to buffers
while [[ render loop ]]; do
    tui_write_header 0 "$header_line"
    tui_write_header 1 "$env_line"
    tui_write_separator "$separator"
    tui_write_content "$content"
    tui_write_footer "$status"
    
    # Single flush to terminal
    tui_buffer_flush
done
```

**TView Pattern** (Direct writes):
- Direct terminal writes scattered across files
- `printf "\033[${line};1H\033[K"` in multiple places
- Screen regions calculated ad-hoc
- Multiple rendering passes (header, content, actions, status)
- Race conditions possible with async RCM commands

**Why Demo Works**:
- All writes are buffered (atomic from terminal perspective)
- Single flush point means consistent display
- Animation doesn't flicker
- Easier to test (can capture buffer contents)
- Async commands don't interfere with rendering

---

## 6. WHAT TO DELETE FROM TVIEW

### Safe to Delete (Completely Redundant)

1. **RCM System** (`tview_rcm_*.sh` - 4 files)
   - Hardcoded SSH prefix management
   - Complex state management for async execution
   - Not used in demo patterns
   - Alternative: Route to SSH module if needed

2. **Modal Subsystem** (`tview_modal.sh`, `tview_action_modal.sh`)
   - Basic modal system
   - Demo 013 has better modal implementation
   - Replace with demo/013 modal.sh approach

3. **Hooks System** (`tview_hooks.sh`)
   - "Context-triggered actions" - underspecified
   - Not in demo patterns
   - Delete

4. **SSH System** (`tview_ssh.sh`)
   - SSH testing and connectivity checking
   - Should be in tkm module, not TUI
   - Delete from TUI

5. **TOML Subsystem** (`tview/toml/` - 11 files)
   - Complex TOML parsing, editing, cursor navigation
   - Should be in separate module with TUI interface
   - Too much business logic in TUI

6. **Content Registry** (`tview/content/registry/`)
   - Environment capabilities registration
   - Should be in orchestrator, not TUI
   - Delete

7. **Debugging Artifacts**
   - `test_simple.sh`, `dashboard.sh`, `repl_dashboard.sh`, `static_dashboard.sh`
   - Dead code
   - Delete

### Should Refactor

1. **Colors** (`tview_colors.sh`)
   - Extract to shared color module (like demo/010)
   - Make it optional, not required

2. **Layout** (`tview_layout.sh`)
   - Keep concept but simplify
   - Use buffer-based approach from demo/014

3. **Navigation** (`tview_navigation.sh`, `tview_keys.sh`)
   - Simplify to demo/014 pattern
   - Single `navigate_*()` function per axis
   - Remove "contextual AWSD"

4. **State** (`tview_state.sh`)
   - Keep only necessary fields
   - Use demo/014 minimal state model

5. **REPL** (`tview_repl.sh`)
   - Refactor to follow orchestrator pattern (repl.sh in interfaces/)
   - Slash commands for context switching
   - Dispatch actions to orchestrator

---

## 7. WHAT TO KEEP FROM TVIEW

1. **Core Concept**: 3D navigation (Env × Mode × Action)
2. **Architecture Goal**: Thin UI interface over orchestrator
3. **Color Token Idea**: Semantic colors for environments/modes
4. **Layout Idea**: Top-down with sticky header and footer
5. **REPL Concept**: Shell-like interface for command line use

---

## 8. PATH TO CANONICAL DESIGN

### Phase 1: Extract Working Patterns
1. Copy demo/014 structure: `actions/`, `tui/`, state management
2. Adapt for full tetra integration (org × env × mode contexts)
3. Keep navigation simple: follow demo/013 env:mode action selection

### Phase 2: Modularize Content
1. Move TOML logic → separate module (toml/tview/)
2. Move SSH/Keys logic → tkm module (tkm/tview/)
3. Move Service logic → tsm module (tsm/tview/)
4. Each module provides: `get_actions()`, action functions

### Phase 3: Shared TUI Layer
1. `bash/tui/` - Rendering, colors, typography, buffer
2. `bash/tetra/interfaces/` - REPL, context management
3. No business logic in TUI
4. No hardcoded environment/mode/action lists (discovery-based)

### Phase 4: Integration
1. TUI action → dispatch to orchestrator
2. Orchestrator manages context (org, env, mode)
3. TUI just displays + handles input
4. All async operations in orchestrator, not TUI

---

## 9. COLOR/STYLING MODULE CHECKLIST

Based on patterns:

**Required**:
- [ ] ANSI code generation (tput-based)
- [ ] Core palette (8 colors)
- [ ] Extended palette (256 colors with fallbacks)
- [ ] Text formatting (bold, dim, underline, reverse)
- [ ] Semantic assignments (ENV_* colors, STATUS_* colors)

**Optional**:
- [ ] Distance-based palette generation
- [ ] Contrast ratio calculation
- [ ] Theme switching
- [ ] Color validation

**Apply**:
- [ ] Define colors early (color_core.sh)
- [ ] Use variables consistently: `${COLOR_GREEN}text${COLOR_RESET}`
- [ ] Never hardcode ANSI codes in rendering functions
- [ ] Provide color_reset function for cleanup

---

## 10. SUMMARY TABLE

| Aspect | Demo 010 | Demo 013 | Demo 014 | TView | Status |
|--------|----------|----------|----------|-------|--------|
| **Rendering** | Component-based | Plain text | Buffer-based | Direct writes | 014 wins |
| **Navigation** | Not shown | 3D simple | 3D simple | 3D complex | 013/014 win |
| **Colors** | Sophisticated | Basic | Inherited | Defined but unused | 010 wins (integrated in 014) |
| **Actions** | Simple handlers | Typed w/ metadata | I/O signatures | Unstructured | 014 wins |
| **State** | Simple | Minimal | Minimal | Explosion | 013/014 win |
| **REPL** | Basic | Slash commands | Not shown | Complex | 013 pattern |
| **Animation** | Not shown | Not shown | Oscillator/liner | No | 014 unique |
| **Maintainability** | Good | Excellent | Excellent | Poor | 013/014 |
| **Extensibility** | Components | Simple | Module discovery | Rigid | 014 |
| **Testability** | Medium | High | High | Low | 013/014 |

---

## Conclusion

**Delete most of TView.** The working demos (especially 014) show that a clean, maintainable TUI system is much simpler than what TView attempted.

**Canonical approach**:
1. Keep: 3D navigation concept, color theming idea, REPL integration
2. Adopt: Demo 014 rendering + buffer + animation
3. Adopt: Demo 013 action model + TES integration
4. Adopt: Demo 010 color system (apply consistently)
5. Delete: ~30 files of complex state, RCM, modal subsystem, TOML editor, etc.

**Result**: Clean, maintainable, extensible TUI in ~5 core files (state, navigation, rendering, actions, repl) instead of ~45 files.

