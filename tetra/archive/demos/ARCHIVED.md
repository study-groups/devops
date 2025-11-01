# Demos Archive

**Archived Date:** 2025-11-01
**Reason:** Consolidated into unified `bash/tui/` library

## What Happened

All demo directories (`demo/basic/001` through `demo/basic/014`) have been archived. The best patterns from these demos have been extracted and consolidated into the **unified TUI library at `bash/tui/`**.

## What Replaced the Demos

### Single Canonical Example
**Location:** `$TETRA_SRC/bash/tui/demo.sh`

This is the **one and only** TUI demo you need. It shows:
- Double buffering for flicker-free rendering
- Animation with BPM synchronization
- Input handling with escape sequences
- REPL integration
- Complete TUI application pattern

**Run it:**
```bash
cd $TETRA_SRC/bash/tui
./demo.sh
```

### Production-Ready Library
**Location:** `$TETRA_SRC/bash/tui/`

The unified TUI library provides:
- **Core primitives** (`core/screen.sh`, `core/input.sh`, `core/buffer.sh`, `core/animation.sh`)
- **Components** (`components/modal.sh`, `components/header.sh`, `components/footer.sh`)
- **Integration** (`integration/repl.sh`, `integration/actions.sh`)
- **Complete documentation** (`README.md`)

## Evolution of Demos

### Demo 001-008 (Early Experiments)
Basic TUI explorations that informed the design.

### Demo 009 (Basic REPL)
First REPL implementation → Now in `bash/repl/`

### Demo 010 (TUI Framework)
Color system and component framework → **Archived**
- Patterns extracted to `bash/color/` and `bash/tui/`

### Demo 012 (Action System)
Action registry patterns → Now in `bash/tui/integration/actions.sh`

### Demo 013 (TES Resolution)
TES (Tetra Endpoint Specification) system → Patterns remain in archived demo

### Demo 014 (Harmonized TUI)
**Most complete implementation** → Core patterns extracted to `bash/tui/`
- Double buffering → `bash/tui/core/buffer.sh`
- Animation system → `bash/tui/core/animation.sh`
- Terminal control → `bash/tui/core/screen.sh`
- Input handling → `bash/tui/core/input.sh`
- Header component → `bash/tui/components/header.sh`
- REPL integration → `bash/tui/integration/repl.sh`

## Migration Guide

### If You Were Using demo/basic/010
**Old:**
```bash
source "$DEMO_DIR/bash/app/app.sh"
```

**New:**
```bash
source "$TETRA_SRC/bash/tui/tui.sh"
tui_init
# Use tui_* functions
```

### If You Were Using demo/basic/014
**Old:**
```bash
source "$DEMO_DIR/bash/tcurses/tcurses_buffer.sh"
tcurses_buffer_init
```

**New:**
```bash
source "$TETRA_SRC/bash/tui/tui.sh"
tui_init  # Initializes everything
# Use tui_buffer_* functions
```

### If You Need Advanced Patterns from Demo 014

The demo 014 code remains in `archive/demos/basic_all/014/` for reference:
- Region-based buffer management
- Oscillator animations
- Complex action state machine
- Multi-level header system

These are **reference patterns only** - build your own abstractions on top of `bash/tui/`.

## Historical Value

These demos remain archived for:
1. **Reference** - See how TUI patterns evolved
2. **Learning** - Study different approaches to TUI architecture
3. **Recovery** - Extract specific patterns if needed

## What to Use Instead

### For Simple TUI Applications
Use `bash/tui/` directly:
```bash
source ~/tetra/tetra.sh
source "$TETRA_SRC/bash/tui/tui.sh"

tui_init 30 120
trap 'tui_cleanup' EXIT INT TERM

while true; do
    tui_buffer_clear
    tui_buffer_write_line 0 "Hello TUI!"
    tui_buffer_render_diff

    local key=$(tui_read_key 0.1)
    [[ "$key" == "q" ]] && break
done
```

### For Complex TUI Applications
See these production examples:
- **bash/game/** - Full game engine with TUI
- **bash/estovox/** - Voice synthesis TUI
- **bash/tui/demo.sh** - Canonical example

### For REPL Applications
Use `bash/repl/`:
```bash
source ~/tetra/tetra.sh
source "$TETRA_SRC/bash/repl/repl.sh"

# Your REPL here
```

## Directory Structure

```
archive/demos/
├── ARCHIVED.md (this file)
├── basic_010/          # Early TUI framework (demo 010 only)
│   └── ARCHIVED.md
└── basic_all/          # All demos 001-014
    ├── 001/
    ├── 002/
    ...
    └── 014/           # Most complete (reference implementation)
```

## See Also

- **bash/tui/README.md** - Complete API documentation
- **bash/tui/demo.sh** - Working example
- **bash/repl/** - Universal REPL system
- **bash/color/** - Color system
- **bash/game/** - Advanced TUI game engine

---

**Bottom Line:** Use `bash/tui/` for all new TUI development. The demos served their purpose and are now archived.
