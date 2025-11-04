# Tetra TUI Architecture

## Vision
The unified Tetra TUI combines the best elements from all demo prototypes into a production-ready interface.

## Core Principles

### 1. Content Model (from unicode_explorer_v2.sh)
- All displayable data lives in `CONTENT_MODEL` associative array
- Separation of "what to display" (data) from "where to display" (presentation)
- Single source of truth for all UI state

### 2. TDS-Powered Rendering (from unicode_explorer_v2.sh)
- Tetra Display System (TDS) provides semantic color system
- Theme-aware: colors defined by purpose, not hard-coded
- Consistent across all components

### 3. Buffer System (from 014)
- Flicker-free differential rendering
- Only update changed regions
- Vsync support for animations
- Performance-first approach

### 4. Responsive Layout
- Terminal resize support via SIGWINCH trap
- Dynamic region recalculation on resize
- All components adapt to new dimensions
- Separator width adjusts automatically
- Content viewport recalculates available lines

### 5. Layout Regions (from unicode_explorer_v2.sh + 014)
```
┌─────────────────────────────────────┐
│ HEADER (dynamic size: max/med/min) │
│  - Environment / Mode / Action     │
│  - Action signature               │
│  - Status line                    │
├─────────────────────────────────────┤ ← Animated separator
│ :command_input_here_                │ ← Command line (when ':' pressed)
├─────────────────────────────────────┤
│                                     │
│ CONTENT (viewport-bounded)          │
│  - Action output                    │
│  - Preview mode                     │
│  - System views                     │
│  - Command results                  │
│                                     │
├─────────────────────────────────────┤
│ FOOTER (5 lines, from 014)          │
│  - Navigation hints (centered)      │
│  - Mode indicators                  │
└─────────────────────────────────────┘
```

### 6. Action System (from 013)
- Typed action signatures: `(inputs) → output [where effects]`
- TES integration for remote operations
- Action registry with discovery
- Preview mode for action details

### 7. Tetra Branded Spinner

The Tetra spinner uses semantic dot punctuation for state indication:

```bash
# Spinner character array (dot-based progression)
declare -ga TETRA_SPINNER=(
    $'\u00B7'    # Middle Dot (·) - idle/waiting
    $'\u2025'    # Two Dot Leader (‥) - initializing
    $'\u2026'    # Horizontal Ellipsis (…) - processing
    $'\u22EF'    # Midline Horizontal Ellipsis (⋯) - working
    $'\u2059'    # Five Dot Punctuation (⁙) - completing
)

# Spinner semantic states
TETRA_SPINNER_IDLE=0        # · - waiting for input
TETRA_SPINNER_INIT=1        # ‥ - starting operation
TETRA_SPINNER_PROC=2        # … - processing data
TETRA_SPINNER_WORK=3        # ⋯ - active work
TETRA_SPINNER_DONE=4        # ⁙ - operation complete
```

Animation cycles through states for executing actions, returns to idle when complete.

### 8. Modes & Features

#### Primary Mode: Tetra TUI
- Environment navigation (Local/Dev/Staging/Production)
- Mode selection (Inspect/Transfer/Execute)
- Action execution with feedback
- Preview mode (auto-show action details)

#### Command Mode (`:`)
- Command line appears below animated separator
- Commands can modify header, content, or footer
- Supports action execution, state changes, views
- ESC to exit command mode

#### Easter Egg: "bug" Mode
- Press `u` key to enter Bug (Unicode Playground)
- Full unicode_explorer_v2.sh experience
- Color cycling showcase
- Interactive glyph matrix exploration
- Press ESC to return to main TUI

#### Optional: Web Dashboard
- Press `w` to toggle web server
- HTTP code analyzer (from 010)
- Module discovery view
- Not auto-started

### 9. Input Handling
- Keyboard primary
- Arrow keys for navigation
- Single-key commands (brief, from 013)
- Multiplexed input for gamepad support (optional)
- Terminal resize detection (SIGWINCH)

### 10. Performance
- Differential rendering (only changed lines)
- Lazy computation (status on demand)
- Animation controller with FPS tracking
- Responsive layout (adapts to terminal size)
- Efficient resize handling

## Component Responsibilities

### interfaces/tui.sh (Main Entry Point)
- Initialize TUI environment
- Main event loop
- Mode switching (normal ↔ command ↔ bug ↔ web)
- Resize handler (SIGWINCH trap)
- Cleanup on exit

### rendering/content_model.sh
- CONTENT_MODEL data structure
- Update functions for each field
- Data validation

### rendering/layout.sh
- Terminal size detection
- Layout breakpoints (wide/normal/compact/minimal)
- Region calculations
- Viewport management
- Resize recalculation

### rendering/buffer.sh
- Screen buffer management
- Differential rendering
- Vsync rendering

### rendering/components.sh
- render_header()
- render_separator()
- render_command_line()
- render_content()
- render_footer()

### actions/registry.sh
- Action discovery
- Signature formatting
- Context-aware action lists

### modes/command.sh
- Command parsing
- Command execution
- Tab completion
- History management

### modes/bug.sh
- Embedded unicode_explorer_v2.sh
- Color cycling demos
- Interactive glyph composition
- Return to main TUI

### optional/web_dashboard.sh
- HTTP server management
- Module discovery
- AST generation

## Color System (TDS)

Colors are semantic, defined in TDS theme:
```
tetra.header.env         - Environment indicator
tetra.header.mode        - Mode indicator
tetra.action.verb        - Action verb
tetra.action.noun        - Action noun
tetra.action.executing   - Executing state (with spinner)
tetra.action.success     - Success state (⁘ marker)
tetra.action.error       - Error state (⁘ marker)
tetra.separator.line     - Animated separator
tetra.command.prompt     - Command mode prompt (:)
tetra.command.input      - Command input text
tetra.footer.hint        - Navigation hints
tetra.content.normal     - Regular content
tetra.content.dim        - Secondary info
tetra.spinner.active     - Active spinner dots
tetra.spinner.idle       - Idle spinner dot
```

## Unicode Branding

Tetra uses semantic Unicode characters for visual branding:

- **U+2058 ⁘** - Primary marker (FOUR DOT PUNCTUATION)
  - Success indicators
  - List markers
  - Status badges

- **Spinner States** (see section 7)
  - Progression through dot patterns
  - Visual feedback during operations

## Key Bindings

### Navigation
- `e` - Cycle environment
- `m` - Cycle mode
- `a` - Cycle action
- `Enter` - Execute action

### Views
- `p` - Toggle preview mode
- `v` - View full content (with scroll)
- `s` - Show action signatures
- `l` - Show execution log

### Modes
- `u` - Enter "bug" (Unicode Playground easter egg)
- `w` - Toggle web dashboard
- `:` - Command/REPL mode

### Controls
- `h` - Cycle header size
- `o` - Toggle animation
- `c` - Clear content
- `q` - Quit

### View Mode (when in 'v')
- `↑/↓` - Scroll
- `ESC` - Back to normal

### Command Mode (when in ':')
- Type commands at prompt (below separator)
- `ESC` - Exit command mode
- `Enter` - Execute command
- `↑/↓` - Command history
- `Tab` - Command completion

## Resize Handling

Terminal resize is handled via SIGWINCH trap:

```bash
trap 'handle_resize' WINCH

handle_resize() {
    # Recalculate terminal dimensions
    read TUI_HEIGHT TUI_WIDTH < <(stty size 2>/dev/null)
    [[ -z "$TUI_HEIGHT" ]] && TUI_HEIGHT=$(tput lines)
    [[ -z "$TUI_WIDTH" ]] && TUI_WIDTH=$(tput cols)

    # Recalculate layout regions
    calculate_layout

    # Force full re-render
    needs_redraw=true
    is_first_render=true
}
```

On resize:
- All components recalculate their dimensions
- Separator adjusts to new width
- Content viewport recalculates visible lines
- Footer remains anchored at bottom
- Full screen re-render ensures consistency

## Implementation Priority

⁘ Architecture document
⁘ Basic TUI scaffolding (interfaces/tui.sh)
⁘ Content model + layout system
⁘ Buffer rendering system
⁘ Resize handling (SIGWINCH)
⁘ Header/separator/footer components
⁘ Command mode with prompt below separator
⁘ Action integration (from 013)
⁘ Bug mode (unicode explorer easter egg)
⁘ Web dashboard integration
⁘ Polish & animations with spinner
