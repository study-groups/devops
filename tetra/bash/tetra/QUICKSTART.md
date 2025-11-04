# Tetra TUI - Quick Start Guide

## Launch

```bash
source ~/tetra/tetra.sh
tetra tui
```

## Key Bindings Cheat Sheet

### Navigation
```
e    Cycle Environment    (Local → Dev → Staging → Prod)
m    Cycle Mode           (Inspect → Transfer → Execute)
a    Cycle Action         (context-aware actions)
↵    Execute Action       (shows spinner: · ‥ … ⋯ ⁙)
```

### Views & Modes
```
v    View Mode            (scroll with ↑↓, ESC to exit)
:    Command Mode         (line appears below separator)
u    Bug Mode             (unicode explorer easter egg)
w    Web Dashboard        (coming soon)
```

### Controls
```
h    Cycle Header         (max → med → min → max)
o    Toggle Animation     (⋯ marker on separator)
c    Clear Content
q    Quit
```

## First Steps

1. **Navigate**: Try `e` `m` `a` to cycle through options
2. **Execute**: Press `Enter` to run the current action
3. **Command**: Press `:` then type `help` and `Enter`
4. **Bug Mode**: Press `u` to enter unicode playground
5. **Resize**: Resize your terminal - watch it adapt!

## Features

⁘ **Responsive** - Adapts to terminal size
⁘ **Animated** - Smooth separator with toggle
⁘ **Semantic** - TDS colors throughout
⁘ **Fast** - Differential rendering, minimal CPU
⁘ **Fun** - Unicode explorer easter egg (bug mode)

## Examples

### Execute a Local Action
```
1. Press 'e' until you see "Local"
2. Press 'm' until you see "Inspect"
3. Press 'a' until you see "view:toml"
4. Press Enter
→ Configuration file displayed
```

### Deploy to Dev
```
1. Press 'e' until you see "Dev"
2. Press 'm' until you see "Execute"
3. Press 'a' until you see "deploy:dev"
4. Press Enter
→ Deploy simulation runs
```

### Explore Unicode (Bug Mode)
```
1. Press 'u'
→ Unicode explorer launches
→ Use arrow keys to browse glyphs
→ Press 1,2,3,4 to compose matrix
→ Press 'q' to return to Tetra TUI
```

## Troubleshooting

**TDS not found?**
- Ensure `TDS_SRC` points to `$TETRA_SRC/bash/tds`

**Unicode explorer not found?**
- Check `$TETRA_SRC/bash/repl/experiments/unicode_explorer_v2.sh` exists

**Terminal rendering issues?**
- Try resizing terminal
- Press 'c' to clear content
- Press 'q' and restart

## Architecture

See `ARCHITECTURE.md` for complete design documentation.
See `BUILD_SUMMARY.md` for implementation details.

---
⁘ **Tetra TUI** - The definitive tetra app
