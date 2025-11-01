# TUI vs REPL: Understanding the Difference

## REPL (Line-Based Commands)

**Input Model**: Full line with Enter key
```bash
read -r -e -p "$prompt" line    # Read full line until Enter
```

### Characteristics
- **Input unit**: Full line (until Enter pressed)
- **Editing**: Yes (Emacs keybindings: Ctrl-A/E/K, arrow history)
- **Echo**: Visible as you type
- **Prompt**: Visible (`$ tdocs>`)
- **Terminal**: `stty echo icanon`
- **Use case**: Command execution, shell augmentation

### Examples
```bash
$ tdocs> /ls --core           # List core documents [Enter]
$ tdocs> /view README.md      # View document [Enter]
$ tdocs> git status           # Shell commands work too! [Enter]
```

### Use REPL for:
- Command execution
- Shell augmentation (hybrid mode)
- Interactive browsing with readline history
- Module-specific operations

### REPL Modules
- `rag_repl` - RAG flow management
- `org_repl` - Organization context
- `tdocs_repl` - Document browser

---

## TUI (Character-Based Navigation)

**Input Model**: Single keypress, no Enter
```bash
read -rsn1 -t 0.1 key    # Read single character, no Enter
```

### Characteristics
- **Input unit**: Single character
- **Editing**: None (immediate action)
- **Echo**: Silent (`-s` flag)
- **Prompt**: Hidden (full-screen rendering)
- **Terminal**: `stty -echo -icanon`
- **Use case**: Navigation, games, interactive UIs

### Examples
```bash
# In game TUI:
p      # Pause (instant, no Enter)
j      # Move down
k      # Move up
q      # Quit
```

### Use TUI for:
- Full-screen applications
- Real-time games
- Navigation interfaces
- Immediate response to keypresses

### TUI Applications
- Game loop (`bash/game/`)
- TCurses demos
- Future: Visual document browser

---

## Key Insight

**These are TWO DIFFERENT SYSTEMS** that happen to share tcurses infrastructure.

### Don't Mix Them!

- Use **REPL** for commands with arguments and shell integration
- Use **TUI** for visual navigation and instant actions

### They Share
- TCurses library for terminal control
- Color system (TDS tokens)
- Some input primitives

### But They're Separate
- Different input models (line vs character)
- Different use cases (command vs navigation)
- Different terminal modes

---

## Hybrid Mode (REPL Only)

REPL runs in **hybrid mode** by default:

```bash
$ tdocs> ls -la          # Shell command (no prefix needed)
$ tdocs> /ls             # Module command (slash prefix)
$ tdocs> git status      # Shell still works!
$ tdocs> /view README.md # Module command
```

**TUI doesn't have "hybrid mode"** - it's always character-by-character navigation.

---

## When to Use Which

| Feature | REPL | TUI |
|---------|------|-----|
| Enter key required | Yes | No |
| Editing before submit | Yes | No |
| Visible prompt | Yes | No |
| Shell commands | Yes (hybrid) | No |
| History navigation | Yes | No |
| Full-screen rendering | No | Yes |
| Immediate keypresses | No | Yes |

### Use REPL when you want:
- To type commands with arguments
- To use shell commands alongside module commands
- To edit before executing
- Command history

### Use TUI when you want:
- Visual navigation
- Instant response to keys
- Full-screen layouts
- Game-like controls

---

## Technical Details

### REPL Terminal Setup
```bash
stty echo icanon    # Echo on, canonical mode
tput cnorm          # Cursor visible
```

### TUI Terminal Setup
```bash
stty -echo -icanon  # Echo off, raw mode
tput civis          # Cursor invisible
```

### REPL Input Loop
```bash
while true; do
    input=$(read -r -e -p "$prompt")  # Wait for full line
    process_command "$input"
done
```

### TUI Input Loop
```bash
while true; do
    key=$(read -rsn1 -t 0.1)  # Get single char
    case "$key" in
        p) pause ;;
        q) break ;;
    esac
    render_screen
done
```

---

## Migration Guide

If you have code that tries to mix REPL and TUI:

### Before (Confused)
```bash
# DON'T: Trying to use one-key input in REPL
repl_run "tui"  # This doesn't make sense!
```

### After (Clear)
```bash
# REPL for commands
repl_run "readline"

# OR TUI for navigation (separate function)
game_run_tui
```

---

## Summary

- **REPL** = Read-Eval-Print **Loop** (line-based commands)
- **TUI** = **T**ext **U**ser **I**nterface (character-based navigation)
- They're different systems for different purposes
- Don't confuse them or try to mix them
- Choose based on your use case
