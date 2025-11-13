# Tetra TUI/REPL Architecture Summary

## Overview

The Tetra codebase contains a sophisticated Terminal User Interface (TUI) and REPL system with multiple layers of abstraction, component organization, and mode switching capabilities. The architecture spans several directories with both production code and experimental implementations.

---

## Directory Structure & Main TUI Implementations

### 1. **tcurses/** (Production v1.0.0 - Core Terminal Primitives)
**Location**: `/Users/mricos/src/devops/tetra/bash/tcurses/`

Primary TUI foundation library providing low-level terminal control.

**Core Files**:
- `tcurses.sh` - Main library entry point, sources all subsystems
- `tcurses_screen.sh` - Terminal initialization, state management, cursor control
- `tcurses_input.sh` - Keyboard input handling, escape sequences, special keys
- `tcurses_buffer.sh` - Double-buffer system for efficient screen rendering
- `tcurses_animation.sh` - Frame timing, BPM sync, FPS management
- `tcurses_readline.sh` - Character-by-character input loop with TAB completion
- `tcurses_repl.sh` - REPL component (command input + response display)
- `tcurses_modal.sh` - Vim-like mode system (NORMAL, COMMAND, REPL)
- `tcurses_completion.sh` - TAB completion with hints and categories
- `tcurses_log_footer.sh` - 4-line scrolling log at bottom of screen
- `tcurses_actions.sh` - Action execution with logging (module:action pattern)

**Key Characteristics**:
- Alternate screen buffer management
- Raw terminal mode configuration
- ANSI escape code handling
- Efficient differential rendering
- Animation frame timing with beat synchronization

---

### 2. **repl/** (Universal REPL System)
**Location**: `/Users/mricos/src/devops/tetra/bash/repl/`

Universal REPL framework that can be integrated into any Tetra module.

**Core Files**:
- `repl.sh` - Main REPL entry point and initialization
- `core/mode.sh` - Mode detection (simple/readline) and hybrid execution mode
- `core/input.sh` - Mode-specific input reading (simple vs readline)
- `core/loop.sh` - Main REPL loop with prompt building and input processing
- `command_processor.sh` - Input dispatcher for module commands and slash commands
- `prompt_manager.sh` - Dynamic prompt building system
- `tcurses_readline.sh` - Enhanced readline with completion integration

**Module Registry Pattern**:
- `repl_register_module()` - Register module with commands
- `repl_register_slash_command()` - Register slash commands
- `repl_set_module_context()` - Switch module context

**Execution Modes**:
- **Hybrid Mode** (Always): Shell commands by default, `/slash` for module/meta commands
- **Input Modes**: simple (basic read) or readline (enhanced with history/completion)

**History Management**:
- Single unified history file: `$TETRA_DIR/repl/history`
- Per-session history support
- History navigation with up/down arrows

---

### 3. **tui/** (Consolidated TUI v1.0.0)
**Location**: `/Users/mricos/src/devops/tetra/bash/tui/`

Unified TUI library consolidating tcurses production code with demo enhancements.

**Structure**:
```
tui/
  ├── core/
  │   ├── screen.sh       - Screen management (wraps tcurses_screen)
  │   ├── input.sh        - Input handling
  │   ├── buffer.sh       - Double-buffering
  │   └── animation.sh    - Animation system
  ├── components/
  │   ├── header.sh       - Header with min/med/max states
  │   ├── footer.sh       - Log footer
  │   └── modal.sh        - Modal dialogs
  └── integration/
      ├── repl.sh         - REPL component integration
      └── actions.sh      - Action system integration
```

**API Pattern**:
- All tcurses_* functions wrapped as tui_* aliases
- Single initialization: `tui_init [FPS] [BPM]`
- Automatic screen, buffer, animation init
- Unified cleanup: `tui_cleanup`

---

### 4. **estovox/tui/** & **estovox/repl/** (Speech Synthesis TUI)
**Location**: `/Users/mricos/src/devops/tetra/bash/estovox/{tui,repl}/`

Domain-specific TUI implementation for voice synthesis with interactive controls.

**TUI Files**:
- `modes.sh` - Mode switching (command, interactive, ipa_chart)
- `renderer.sh` - Facial visualization using terminal characters
- `status_bar.sh` - Mode-specific status display with control hints
- `buffer.sh` - Screen buffering for Estovox
- `keyboard.sh` - Interactive key bindings
- `ipa_chart.sh` - IPA phonetic chart display

**Unique Features**:
- Real-time facial control visualization
- Mode-specific status bars with keyboard hints
- Control state management (jaw, tongue, lips)

---

## Screen Layout & Rendering Architecture

### Standard TUI Layout (3-Section Model)

```
┌─────────────────────────────────────────┐
│  HEADER (1-7 lines, expandable)         │  ← Dynamic size: min/med/max
│  - Title                                │
│  - Environment selection                │
│  - Mode selection                       │
│  - Current action with signature        │
│  - Status indicator                     │
│  - Info (TES objects, paths)            │
├─────────────────────────────────────────┤
│  CONTENT AREA (flexible)                │  ← Dynamic height based on header
│  - Main interactive area                │
│  - REPL input/response (if active)      │
├─────────────────────────────────────────┤
│  FOOTER (5 lines fixed)                 │  ← Always visible
│  - Separator line                       │
│  - 4-line scrolling log (module:action) │
└─────────────────────────────────────────┘
```

### Rendering Approach

**Double-Buffering System**:
```
Back Buffer (write)  ──┐
                       ├──> Differential Compare ──> Screen Output
Front Buffer (cache) ──┘
```

**Key Rendering Functions**:
- `tcurses_buffer_render_full()` - Complete screen redraw
- `tcurses_buffer_render_diff()` - Only changed lines
- `tcurses_buffer_render_vsync()` - VSync-synchronized rendering

**Buffer Operations**:
- `tcurses_buffer_write_line(LINE_NUM, TEXT)` - Write entire line
- `tcurses_buffer_write_at(LINE, COL, TEXT)` - Write at position
- `tcurses_buffer_clear()` - Clear back buffer

---

## Mode Switching Mechanism

### Modal System (Vim-like)

**Three Primary Modes** (from tcurses_modal.sh):

```
┌──────────────┐
│   NORMAL     │  ◄──  Navigation mode (default)
│   mode       │       - Read-only screen interaction
└──────────────┘

┌──────────────┐
│   COMMAND    │  ◄──  Command entry (: prefix)
│   mode       │       - Interpreted as `:command`
└──────────────┘

┌──────────────┐
│   REPL       │  ◄──  Execute commands
│   mode       │       - Shell by default
└──────────────┘
```

**Mode Switching API**:
```bash
modal_set "NORMAL"          # Set mode
modal_get                   # Get current mode
modal_get_prev              # Get previous mode (for toggle)
modal_is "COMMAND"          # Test current mode
modal_info "REPL"           # Get mode description
```

### Estovox Mode Switching

Simpler state machine for domain-specific modes:
```bash
estovox_set_mode "interactive"  # Direct control mode
estovox_set_mode "command"      # Text command mode
estovox_set_mode "ipa_chart"    # Display mode
```

---

## Status Display Implementation

### Multi-Layer Status System

**1. Header Status Line**:
```bash
header_render_status()
# Shows:
# - State symbol (○ for idle, ▪ for running, ✓ for complete)
# - State name (idle, running, complete)
# - Optional: Action detail (if SHOW_DETAIL=true)
# - Optional: Content title
```

**2. Log Footer Status Entries**:
```bash
log_footer_add "module" "action" "details"
# Format: [HH:MM:SS] module:action | details
# Colors:  cyan   + action_color
# Actions: ok, error, change, exec, insert
```

**3. Status Bar (Estovox)**:
```bash
estovox_render_status_bar()
# Mode-specific control hints
# Example: "MODE: INTERACTIVE | WASD: Jaw | IJKL: Tongue | Q/E: Lips"
```

**4. Info Display**:
```bash
header_render_info()
# Shows TES operation signatures:
# - exec_at: where action executes
# - source_at: data source location
# - target_at: data target location
# - tes_operation: type of operation
```

---

## Theming & Color System

### Color Integration

**Framework**:
- Depends on: `$TETRA_SRC/bash/color/color.sh`
- Color-aware rendering throughout

**Status Colors** (from tcurses_actions.sh):
```
ok/success     → Green (#9ECE6A)
error/fail     → Red (#F7768E)
warning/pending → Yellow (#E0AF68)
change/exec    → Purple (#BB9AF7)
module names   → Cyan (#7DCFFF)
default        → White (#7AA2F7)
```

**Completion Categories** (from tcurses_completion.sh):
```
TDS      → Cyan (36)
REPL     → Magenta (35)
Palette  → Yellow (33)
Unknown  → White (37)
```

**Header Visualization**:
- Selected items highlighted with brackets: `[selected]`
- Color codes in environment/mode display
- Status symbols: ○ (idle), ▪ (running), ✓ (complete), ✗ (error)

---

## Input Handling & Completion

### Keyboard Input Pipeline

```
┌──────────────────────────────┐
│ Raw Key (read -rsn1)         │  ← Single character
├──────────────────────────────┤
│ Escape Sequence Detection    │  ← Multi-char sequences
│ (arrows, function keys, etc) │
├──────────────────────────────┤
│ Input Mode Processing        │  ← simple vs readline
├──────────────────────────────┤
│ Completion System            │  ← TAB handling
├──────────────────────────────┤
│ Modal Input Handler          │  ← Mode-specific behavior
├──────────────────────────────┤
│ Command Processor            │  ← Dispatch to handlers
└──────────────────────────────┘
```

### Input Modes

**Simple Mode** (`repl_read_input`):
```bash
read -r -p "$prompt" input
```

**Readline Mode** (`tcurses_readline`):
```bash
- Character-by-character input loop
- Real-time cursor positioning
- History navigation (up/down)
- TAB completion with menu
- Emacs-style editing (Ctrl-A, Ctrl-E, etc)
```

**Key Constants** (from tcurses_input.sh):
```
TCURSES_KEY_UP, DOWN, LEFT, RIGHT    - Arrow keys
TCURSES_KEY_ESC, ENTER, BACKSPACE    - Control keys
TCURSES_KEY_TAB, SHIFT_TAB            - Completion
TCURSES_KEY_CTRL_C, CTRL_D, CTRL_Z    - Signals
```

### TAB Completion System

**State Management**:
```bash
REPL_INPUT              # Current input text
REPL_CURSOR_POS         # Cursor position
REPL_COMPLETION_WORDS   # Available completions
REPL_COMPLETION_HINTS   # Help text per word
REPL_COMPLETION_MATCHES # Filtered matches
```

**Completion Flow**:
1. Extract word at cursor: `_repl_get_current_word()`
2. Filter against word list
3. Display menu above/below input
4. Navigate with Tab/Shift-Tab
5. Insert selected completion

**Generator Pattern**:
```bash
repl_set_completion_generator "function_name"
# Function should output completions (one per line)
```

---

## Animation & Timing System

### Frame Timing

**Animation State**:
```bash
_TCURSES_ANIM_ENABLED=true/false
_TCURSES_ANIM_PAUSED=true/false
_TCURSES_ANIM_FPS=30              # Frames per second
_TCURSES_ANIM_BPM=120             # Beats per minute
```

**Timing Methods** (fallback chain):
1. `$EPOCHREALTIME` - Bash 5.0+ builtin (preferred)
2. `gdate` - GNU date (fallback)
3. `date +%s%N` - Unix timestamp with nanoseconds
4. `seconds` - Last resort (less precise)

### Beat Synchronization

**BPM to Frame Timing**:
```
Beat Interval = 60.0 / BPM
Frame Time = 1.0 / FPS

Example (120 BPM, 30 FPS):
- Beat Interval: 0.5 seconds
- Frame Time: 0.033 seconds
- Frames per beat: 15
```

**Beat Phase** (0.0 to 1.0):
- Used for beat-synchronized animations
- `tcurses_animation_get_beat_phase()` returns float

**Key Functions**:
```bash
tcurses_animation_enable/disable
tcurses_animation_pause/resume
tcurses_animation_set_fps FPS
tcurses_animation_set_bpm BPM
tcurses_animation_should_tick()   # Check if frame should render
tcurses_animation_record_frame()  # Record timing for stats
tcurses_animation_get_avg_fps()   # Performance metrics
```

---

## Command Processing & Module Integration

### Module Registry Pattern

**Registration**:
```bash
repl_register_module "module_name" "cmd1 cmd2 cmd3" "help.namespace"
repl_register_module_handler "module.command" "handler_function"
```

**Module Context Tracking**:
```bash
REPL_MODULE_REGISTRY["module_name"]="cmd1 cmd2 cmd3"
REPL_MODULE_CONTEXT="current_module"
repl_set_module_context "new_module"
```

### Input Dispatch Flow

```
Input: "/flow create"
  │
  ├─► Slash command? (/flow create)
  │   └─► repl_dispatch_slash()
  │       └─► REPL_SLASH_HANDLERS[flow]()
  │
  ├─► Shell escape? (! prefix)
  │   └─► eval "${input#!}"
  │
  └─► Default: Shell command
      └─► eval "$input"
```

### Symbol Processing

**Symbol Pattern Recognition**:
```bash
repl_has_symbols() { [[ "$input" =~ \$\{|@\{|:[a-z] ]] }
repl_process_symbols() { ... }
```

---

## Core Files Summary Table

| File | Purpose | Key Functions |
|------|---------|---|
| tcurses_screen.sh | Terminal control | tcurses_screen_init, cleanup, move_cursor |
| tcurses_input.sh | Key handling | tcurses_input_read_key, read_line |
| tcurses_buffer.sh | Double-buffering | tcurses_buffer_write_line, render_diff |
| tcurses_animation.sh | Frame timing | tcurses_animation_set_fps, get_beat_phase |
| tcurses_readline.sh | Input loop | tcurses_readline_insert_char, redraw |
| tcurses_completion.sh | Tab completion | repl_register_completion_words, tab_handler |
| tcurses_modal.sh | Mode system | modal_set, modal_get, modal_is |
| tcurses_log_footer.sh | Status logging | log_footer_add, log_footer_render |
| repl.sh | REPL framework | repl_run, repl_main_loop |
| repl/core/mode.sh | Mode detection | repl_detect_mode (simple/readline) |
| repl/core/loop.sh | REPL loop | repl_main_loop |
| repl/command_processor.sh | Input dispatch | repl_process_input, repl_dispatch_slash |
| repl/prompt_manager.sh | Prompt building | repl_register_prompt_builder, repl_build_prompt |
| tui.sh | Unified API | tui_init, tui_cleanup, tui_* aliases |

---

## Data Flow Examples

### REPL Command Execution

```
1. User Input: "org deploy prod"
   │
2. repl_main_loop()
   ├─► Build prompt (repl_build_prompt)
   ├─► Read input (repl_read_input)
   │
3. repl_process_input("org deploy prod")
   ├─► Check symbols
   ├─► Not slash command, execute as shell
   │
4. eval "org deploy prod"
   └─► Output captured and displayed
```

### Mode Transition Example

```
1. Key: "Escape"
2. Modal system detects Escape
3. modal_set "NORMAL"
4. Next render loop:
   ├─► Clear input state
   ├─► Reset cursor visibility
   ├─► Trigger prompt rebuild (return code 2)
   └─► Rerender entire screen
```

### Status Update Flow

```
1. Action executes: org_deploy_prod()
2. Exit code captured: $? = 0
3. log_footer_add "org" "ok" "prod deployed"
   ├─► Colorize based on exit code
   ├─► Add timestamp
   ├─► Append to log array
   └─► Keep only last 4 lines
4. Next render:
   ├─► tcurses_buffer_write_line() for each log entry
   └─► tcurses_buffer_render_diff() shows new entry
```

---

## Initialization Sequence

### Typical TUI Startup

```bash
#!/bin/bash
source ~/tetra/tetra.sh  # Sets TETRA_SRC

# Initialize TUI
source "$TETRA_SRC/bash/tui/tui.sh"
tui_init 30 120  # 30 FPS, 120 BPM

# Setup module-specific REPL
source "$TETRA_SRC/bash/repl/repl.sh"
repl_register_module "mymodule" "cmd1 cmd2"
repl_register_slash_command "status" "show_status"

# Main loop
while true; do
    # Render frame
    tcurses_buffer_clear
    # ... draw content ...
    tcurses_buffer_render_diff
    
    # Handle input
    key=$(tcurses_input_read_key)
    case "$key" in
        "q") break ;;
        *) handle_key "$key" ;;
    esac
done

# Cleanup
tui_cleanup
```

### REPL-Only Startup

```bash
#!/bin/bash
source ~/tetra/tetra.sh

source "$TETRA_SRC/bash/repl/repl.sh"
repl_register_module "org" "list deploy remove"
repl_register_slash_command "exit" "repl_exit"

repl_run "readline"  # Enter REPL loop
```

---

## Key Design Patterns

### 1. **Global State Management**
- All state in `declare -g` variables
- Accessible across function calls
- No subshells for state preservation

### 2. **Double-Buffering Pattern**
- `_TCURSES_BACK_BUFFER` (write)
- `_TCURSES_FRONT_BUFFER` (cache)
- Differential rendering only changed lines

### 3. **Mode-Driven Architecture**
- Input behavior changes by mode
- Rendering changes by mode
- Status display changes by mode

### 4. **Registry Pattern**
- Module registration
- Handler registration
- Completion registration
- Prompt builder registration

### 5. **Callback Pattern**
- Prompt builders: `repl_build_prompt()`
- Completion generators: `repl_set_completion_generator()`
- Modal handlers: `modal_set()`

---

## Common Integration Points

### For New Modules

1. **Add REPL**:
   ```bash
   source "$TETRA_SRC/bash/repl/repl.sh"
   repl_register_module "mymod" "cmd1 cmd2"
   ```

2. **Add Custom Prompt**:
   ```bash
   mymod_prompt() { echo "[mymod] "; }
   repl_register_prompt_builder "mymod" "mymod_prompt"
   ```

3. **Add Completion**:
   ```bash
   mymod_completions() { echo -e "cmd1\ncmd2"; }
   repl_set_completion_generator "mymod_completions"
   ```

4. **Add Slash Commands**:
   ```bash
   mymod_status() { echo "Status: OK"; }
   repl_register_slash_command "status" "mymod_status"
   ```

---

## Current Known Implementations

### Production REPLs (from trepl.sh registry):
- org, rag, tdocs, qa, tmod, game, vox, tkm, tsm
- logs, pbase, melvin, midi, tcurses, tds, deploy, tree

### Experimental Implementations:
- estovox (speech synthesis with facial visualization)
- demo/basic/014 (action signature system)

---

## Architecture Strengths

1. **Modular Layers**: tcurses → tui → repl → module-specific
2. **Flexible Initialization**: Can use components independently
3. **Efficient Rendering**: Differential updates + double-buffering
4. **Rich Input System**: Multiple modes, completion, history
5. **Extensible**: Module registry, handlers, generators
6. **Consistent Patterns**: Modal system, prompt builders, callbacks

---

## Refactoring Considerations

### High-Level Structure
- Three layers are well-separated
- Clear dependencies (tcurses ← tui ← repl)
- Some duplication between tcurses_repl.sh and tui/integration/repl.sh

### Input Processing
- Modal system could be more explicit
- Completion state management is scattered

### Status Display
- Multiple status sources (header, footer, status_bar)
- Color system tightly coupled to text_color() function

### Mode Switching
- Modal system is good but could benefit from event model
- No built-in state machine validation

