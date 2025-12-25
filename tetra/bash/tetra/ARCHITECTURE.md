# Tetra Orchestrator Architecture

## Overview

Tetra is a module orchestrator providing three interfaces (cmd, repl, tui) to discovered module actions. It is a **module user**, not a module itself.

## File Structure

```
tetra/
├── tetra.sh                 # Main entry point
├── core/
│   ├── bootstrap.sh         # Environment validation, globals
│   ├── module_loader.sh     # Module discovery from bash/*/
│   ├── action_discovery.sh  # Action registration via declare_action()
│   ├── dispatcher.sh        # Action routing to modules
│   ├── context.sh           # [Org × Env × Mode] calculator
│   ├── agents.sh            # Agent management system
│   ├── help.sh              # Hierarchical help system
│   └── doctor.sh            # Installation health check
├── interfaces/
│   ├── cmd.sh               # Direct command interface
│   ├── repl.sh              # Interactive REPL interface
│   └── tui.sh               # Visual TUI interface
├── modes/
│   ├── matrix.sh            # Env×Mode → Module mapping
│   └── bug.sh               # Unicode explorer easter egg
└── rendering/
    ├── buffer.sh            # Differential screen rendering
    ├── actions.sh           # Action registry for TUI
    └── keychord.sh          # Key-chord detection
```

## Core Components

### Bootstrap (core/bootstrap.sh)

Validates environment on load:
- Bash 5.2+ requirement
- TETRA_SRC environment variable
- Initializes TETRA_DIR (~/.tetra)
- Sets up module and action registries

### Module Loader (core/module_loader.sh)

Discovers modules from `$TETRA_SRC/bash/*/`:
- Requires `actions.sh` for discoverability
- Loads module entry points
- Populates TETRA_MODULES registry

### Action Discovery (core/action_discovery.sh)

Modules register actions via `declare_action()`:
- Stores in TETRA_ACTIONS associative array
- Supports metadata: verb, noun, contexts, modes

### Dispatcher (core/dispatcher.sh)

Routes actions to owning modules:
- Parses `verb:noun` or `module verb:noun` patterns
- Handles orchestrator meta-actions (help, version, list)
- Delegates to module's `<module>_execute_action()`

### Context (core/context.sh)

Implements context algebra:
```
[Org × Env × Mode] → Actions
```

- **Org**: Organization context
- **Env**: Local, Dev, Staging, Production
- **Mode**: Comma-separated module filter

## Interface Modes

### CMD (interfaces/cmd.sh)

One-shot command execution:
```bash
tetra <action> [args]
```

### REPL (interfaces/repl.sh)

Interactive loop with:
- Persistent context across commands
- Slash commands for REPL control
- Readline editing support
- Optional rlwrap integration

### TUI (interfaces/tui.sh)

Visual interface with:
- Content model pattern (CONTENT_MODEL associative array)
- Differential buffer rendering
- SIGWINCH resize handling
- Animated separator
- Mode REPL integration on action execution

## Mode Matrix (modes/matrix.sh)

Maps Env×Mode to available modules:

```bash
MODE_MATRIX["Local:Inspect"]="org logs tds"
MODE_MATRIX["Dev:Execute"]="tsm deploy"
```

Each module has:
- **Temperature**: TDS theme (warm, cool, neutral, electric)
- **Marker**: Unicode identifier (⁘ ◇ ● ◉)

## TUI Rendering

### Content Model

Single source of truth for UI state:
```bash
declare -gA CONTENT_MODEL=(
    [env]="Local"
    [mode]="Inspect"
    [action]=""
    [action_state]="idle"
    [header_size]="max"
    [command_mode]="false"
    [view_mode]="false"
    [animation_enabled]="true"
)
```

### Layout Regions

```
┌─────────────────────────────────────┐
│ HEADER (resizable: max/med/min)     │
│  - State, Environment, Mode, Action │
├─────────────────────────────────────┤ ← Animated separator
│ :command_input_                      │ ← Command line (: key)
├─────────────────────────────────────┤
│ CONTENT (viewport-bounded)           │
│  - Context info, modules, actions    │
│  - Scrollable with 'v' mode         │
├─────────────────────────────────────┤
│ FOOTER                               │
│  - Context-sensitive hints           │
└─────────────────────────────────────┘
```

### Buffer System

- Differential rendering (only changed lines)
- Vsync for separator animation
- Full render on first draw or resize

## Spinner States

Tetra uses semantic dot progression:
```
· (U+00B7) - Idle/waiting
‥ (U+2025) - Initializing
… (U+2026) - Processing
⋯ (U+22EF) - Working
⁙ (U+2059) - Completing
```

## Module Markers

```
⁘  org     (Four dot punctuation)
◇  tsm     (White diamond)
●  logs    (Black circle)
◉  deploy  (Fisheye)
```

## Design Principles

1. **Orchestrator, not module**: Routes to modules, contains no domain logic
2. **Three interfaces**: cmd (one-shot), repl (interactive), tui (visual)
3. **Module discovery via actions.sh**: Required for discoverability
4. **Context algebra**: [Org × Env × Mode] → filtered actions
5. **Bash 5.2+**: Modern syntax, nameref, associative arrays
6. **TETRA_SRC as strong global**: Must be set for anything to work

## Dependencies

### Required
- Bash 5.2+
- TETRA_SRC environment variable

### Optional
- TDS (Tetra Display System) for TUI colors
- rlwrap for enhanced REPL history
- tcurses for TUI input handling

## External Integrations

TUI sources external components when available:
- `$TETRA_SRC/bash/repl/temperature_loader.sh`
- `$TETRA_SRC/bash/repl/mode_repl.sh`
- `$TETRA_SRC/bash/<module>/action_interface.sh`

These provide Mode REPL functionality with temperature-based theming.
