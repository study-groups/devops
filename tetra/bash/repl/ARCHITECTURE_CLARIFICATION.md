# bash/repl Architecture Clarification

**Created**: 2025-10-24
**Purpose**: Harmonize documentation with actual implementation

## Two Independent Mode Systems

bash/repl has **two independent mode systems** that are often confused:

### 1. Input Modes (How input is read)

Controls the input mechanism:

- **basic** - Simple `read -r -p` (fallback, no dependencies)
- **enhanced** - `tcurses_input_read_line` (colors, readline, history)
- **tui** - Full-screen buffer integration (for TUI apps)

**Auto-detected** by `repl_detect_mode()` based on:
- Is tcurses available? → enhanced
- Is TUI framework active? → tui
- Otherwise → basic

### 2. Execution Modes (How commands are routed)

Controls command interpretation (only matters if using built-in routing):

- **augment** (aka "shell") - Shell commands by default, `/cmd` for module
- **takeover** (aka "repl") - Module commands by default, `!cmd` for shell

**Only applies** when using the default `repl_process_input()` from `command_processor.sh`.

## Two Implementation Patterns

Modules can use bash/repl in two different ways:

### Pattern 1: Custom Routing (Simple, Full Control)

**Used by**: game module REPLs (pulsar, formant, estoface), org REPL

**How it works**:
```bash
# Override repl_process_input() completely
_mymod_process_input() {
    local input="$1"

    # Implement your own routing
    case "$input" in
        exit|quit|q) return 1 ;;
        help) mymod_show_help; return 0 ;;
        start) mymod_start; return 0 ;;
        *)
            # Handle as module command
            echo "Unknown: $input"
            return 0
            ;;
    esac
}

# Wire it up
mymod_repl() {
    repl_process_input() { _mymod_process_input "$@"; }
    export -f repl_process_input
    repl_run
    unset -f repl_process_input
}
```

**Characteristics**:
- ✅ Full control over command dispatch
- ✅ Simple to understand
- ✅ Can implement takeover-style (commands without prefix)
- ❌ No built-in `/mode`, `/theme`, `/help` commands (unless you call them)
- ❌ No execution mode switching
- ❌ More code to write

**Example**: bash/game/games/pulsar/pulsar_repl.sh:315-420

### Pattern 2: Built-in Routing (Feature-Rich)

**Used by**: rag, potentially other modules

**How it works**:
```bash
# Register module commands as slash commands
mymod_cmd_start() {
    echo "Starting..."
    return 0
}
repl_register_slash_command "start" "mymod_cmd_start"

# Don't override repl_process_input - use the built-in one
mymod_repl() {
    REPL_HISTORY_BASE="${TETRA_DIR}/mymod/history"

    # Optional: Force takeover mode
    REPL_EXECUTION_MODE="takeover"

    repl_run
}
```

**Characteristics**:
- ✅ Built-in `/mode`, `/theme`, `/history`, `/help`, `/clear` commands
- ✅ Users can switch between augment ↔ takeover modes
- ✅ Less code to write
- ✅ Consistent UX across modules
- ❌ Commands require `/` prefix (in augment mode)
- ❌ Less control over routing priority

**Example**: See bash/repl/test_repl.sh:111-165

## Slash Commands: Meta vs Module

### Meta Commands (Built-in)

Always available from `repl_dispatch_slash()`:

```bash
/help [topic]     # Show help
/exit, /quit, /q  # Exit REPL
/mode [mode]      # Toggle execution mode (shell/repl)
/theme [name]     # Change color theme
/history [n]      # Show command history
/clear            # Clear screen
```

These work ONLY if you use the built-in `repl_process_input()` (Pattern 2).

### Module Commands (Registered)

Custom commands registered via `repl_register_slash_command()`:

```bash
repl_register_slash_command "start" "mymod_cmd_start"
repl_register_slash_command "status" "mymod_cmd_status"
```

Access as `/start`, `/status` (requires `/` prefix in augment mode, not in takeover mode).

## Common Misconceptions

### ❌ Misconception 1: "bind -x can cycle state and update prompt"

**Reality**: `bind -x` doesn't work inside `read -e` or `tcurses_input_read_line`.

From bash/repl/README.md:409:
> "- `bind -x` callbacks can't refresh the prompt mid-input"

**Solution**: Use commands instead of keybindings:
```bash
# Not: bind -x '"\C-e": _cycle_env'
# Instead: Command "env" or "e" that cycles environment
```

### ❌ Misconception 2: "All REPLs support /mode and /theme"

**Reality**: Only if using Pattern 2 (built-in routing).

Pattern 1 REPLs (game modules, org) override `repl_process_input()`, so they don't get built-in slash commands unless explicitly added.

### ❌ Misconception 3: "Slash commands always need / prefix"

**Reality**: Depends on execution mode.

- **Augment mode**: `/cmd` for module, `cmd` for shell
- **Takeover mode**: `cmd` for module, `!cmd` for shell, `/cmd` for meta

But this only applies to Pattern 2 (built-in routing).

## Recommendations

### For New Modules

**Use Pattern 2** (built-in routing) unless you have specific needs:
- More features out of the box
- Less code to maintain
- Consistent UX

### For Game Modules

**Use Pattern 1** (custom routing):
- Games need full control
- Takeover-style feels more natural for game commands
- Don't need mode switching

### For Tool Modules (rag, org, etc.)

**Consider Pattern 2**:
- Tool users expect `/help`, `/theme` commands
- Mode switching is useful (shell vs module mode)
- Less code to maintain

BUT org currently uses Pattern 1 (custom routing) because it has complex state (env × mode × action) and needs full control.

## Migration Path

If a module wants to switch from Pattern 1 to Pattern 2:

1. Remove `repl_process_input()` override
2. Convert commands to registered slash commands:
   ```bash
   # Before (Pattern 1)
   case "$cmd" in
       start) mymod_start ;;
   esac

   # After (Pattern 2)
   mymod_cmd_start() { mymod_start; }
   repl_register_slash_command "start" "mymod_cmd_start"
   ```
3. Set execution mode if needed:
   ```bash
   REPL_EXECUTION_MODE="takeover"  # For takeover-style
   ```
4. Benefit from built-in `/mode`, `/theme`, `/help`

## Documentation Updates Needed

1. **bash/repl/README.md**:
   - Clarify two patterns upfront
   - Remove bind -x examples (doesn't work)
   - Show both patterns clearly

2. **bash/game/REPL_ARCHITECTURE.md**:
   - Document Pattern 1 (custom routing) as the game standard
   - Remove references to `/mode` unless implementing it
   - Clarify that `/theme` needs explicit implementation

3. **bash/org/org_repl.sh**:
   - Already uses Pattern 1 correctly ✅
   - Uses takeover-style (commands without prefix) ✅
   - Uses TDS theme tokens ✅

## See Also

- `bash/repl/command_processor.sh` - Built-in routing implementation
- `bash/repl/core/mode.sh` - Execution mode system
- `bash/game/games/pulsar/pulsar_repl.sh` - Pattern 1 example
- `bash/repl/test_repl.sh` - Pattern 2 example
