# Game REPL Architecture

All Tetra game REPLs use the unified `bash/repl` system with **Pattern 1 (Custom Routing)** for full control over command dispatch.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Game REPL Layer                          │
│  (formant_repl.sh, pulsar_repl.sh, estoface_repl.sh)       │
│                                                              │
│  • Custom prompt builder: _<game>_build_prompt()           │
│  • Custom input handler: _<game>_process_input()           │
│  • Game-specific commands and state                         │
└────────────────────┬────────────────────────────────────────┘
                     │ Overrides repl_build_prompt()
                     │         repl_process_input()
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Unified REPL System                         │
│                  (bash/repl/repl.sh)                        │
│                                                              │
│  • Main loop: repl_main_loop()                              │
│  • Input reading: repl_read_input() (basic/enhanced/tui)   │
│  • Command dispatch: repl_dispatch_slash()                  │
│  • Built-in commands: /help, /theme, /mode, /exit          │
│  • History management (per-mode)                            │
└────────────────────┬────────────────────────────────────────┘
                     │ Uses
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Color/Theme System                        │
│           (bash/color/repl_colors.sh + themes/)             │
│                                                              │
│  • Default REPL colors (REPL_BRACKET, REPL_ARROW, etc.)    │
│  • Theme-aware overrides from palette themes                │
│  • Runtime theme switching: /theme <name>                   │
│  • Game-specific palettes: synthwave, arcade, pulsar       │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Pattern

### 1. Source Dependencies

Every game REPL must source the unified system:

```bash
#!/usr/bin/env bash
# Game REPL - Interactive Shell

# Source dependencies
source "$TETRA_SRC/bash/repl/repl.sh"
source "$TETRA_SRC/bash/color/repl_colors.sh"

# REPL Configuration
REPL_HISTORY_BASE="${TETRA_DIR}/game/<game>_repl_history"
```

### 2. Implement Custom Functions

Create game-specific prompt builder and input processor:

```bash
# Prompt builder - Sets global REPL_PROMPT variable
_<game>_build_prompt() {
    local status_symbol="💤"
    local status_color="666666"

    # Game-specific logic...

    local tmpfile
    tmpfile=$(mktemp /tmp/<game>_repl_prompt.XXXXXX) || return 1

    # Build colored prompt
    text_color "$REPL_BRACKET"
    printf '[' >> "$tmpfile"
    reset_color >> "$tmpfile"

    text_color "FFAA00"
    printf '<game>' >> "$tmpfile"
    reset_color >> "$tmpfile"

    text_color "$REPL_BRACKET"
    printf '] ' >> "$tmpfile"
    reset_color >> "$tmpfile"

    text_color "$REPL_ARROW"
    printf '> ' >> "$tmpfile"
    reset_color >> "$tmpfile"

    REPL_PROMPT=$(<"$tmpfile")
    rm -f "$tmpfile"
}

# Input processor - Returns 0 (continue) or 1 (exit)
_<game>_process_input() {
    local input="$1"

    # Empty input
    [[ -z "$input" ]] && return 0

    # Shell command escape
    if [[ "$input" == !* ]]; then
        eval "${input:1}"
        return 0
    fi

    # Exit commands
    case "$input" in
        exit|quit|q) return 1 ;;
        help|h|\?) _<game>_show_help; return 0 ;;
    esac

    # Parse command
    local cmd_args=($input)
    local cmd="${cmd_args[0]}"

    case "$cmd" in
        start)
            <game>_start_engine
            ;;
        status)
            <game>_show_status
            ;;
        # ... more game commands ...
        *)
            echo "❌ Unknown command: $cmd"
            echo "   Type 'help' for available commands"
            ;;
    esac

    return 0
}
```

### 3. Main Entry Point

Use the callback override pattern:

```bash
<game>_game_repl_run() {
    echo ""
    text_color "66FFFF"
    echo "⚡ GAME REPL"
    reset_color
    echo ""
    echo "Type 'help' for commands"
    echo ""

    # Override REPL callbacks with game-specific implementations
    repl_build_prompt() { _<game>_build_prompt "$@"; }
    repl_process_input() { _<game>_process_input "$@"; }
    export -f repl_build_prompt repl_process_input

    # Run unified REPL loop (provides /help, /theme, /mode, /exit commands)
    repl_run

    # Cleanup
    unset -f repl_build_prompt repl_process_input

    echo ""
    text_color "66FFFF"
    echo "Goodbye! ⚡"
    reset_color
    echo ""
}

export -f <game>_game_repl_run
```

## Built-in Features

All game REPLs automatically get these from `bash/repl`:

| Feature | Description |
|---------|-------------|
| **Input modes** | Auto-detect basic/enhanced/tui modes |
| **History** | Per-module command history |
| **Shell escape** | `!<cmd>` to run shell commands |
| **Return codes** | 0=continue, 1=exit, 2=refresh prompt |

**Note**: Game REPLs use **Pattern 1 (Custom Routing)**, so they do NOT automatically get `/help`, `/theme`, `/mode` commands unless explicitly implemented.

## Theme System

### Using Themes

```bash
# In any game REPL:
/theme                    # List available themes
/theme synthwave          # Switch to synthwave palette
/theme dark/tokyo_night   # Dark background + Tokyo Night palette
```

### Available Palettes

| Palette | Description | Best For |
|---------|-------------|----------|
| `synthwave` | Neon pink/cyan/purple | Formant (vocal synthesis) |
| `arcade` | Bright primary colors | Estoface (arcade games) |
| `pulsar` | Electric blue/purple | Pulsar (energy waves) |
| `tokyo_night` | Modern VS Code theme | General development |
| `nord` | Cool arctic palette | General development |

### Creating Custom Palettes

Add a new file to `bash/color/themes/palette/`:

```bash
#!/usr/bin/env bash
# My Custom Palette

# Override REPL colors
REPL_ENV_LOCAL="FF0000"
REPL_ENV_DEV="00FF00"
REPL_MODE_INSPECT="0000FF"
# ... etc ...

# Override semantic palettes
ENV_PRIMARY=(
    "FF0000" "FF3300" "FF6600" "FF9900"
    "FFCC00" "FFFF00" "CCFF00" "99FF00"
)
# ... MODE_PRIMARY, VERBS_PRIMARY, NOUNS_PRIMARY ...

# Generate complements
if command -v generate_complements >/dev/null 2>&1; then
    generate_complements ENV_PRIMARY ENV_COMPLEMENT
    generate_complements MODE_PRIMARY MODE_COMPLEMENT
    generate_complements VERBS_PRIMARY VERBS_COMPLEMENT
    generate_complements NOUNS_PRIMARY NOUNS_COMPLEMENT
fi
```

## Benefits

✅ **Unified base code** - All REPLs share the same loop, input handling, and command dispatch
✅ **Consistent UX** - Same commands and behavior across all games
✅ **Theme support** - Runtime theme switching with `/theme`
✅ **Enhanced input** - Arrow keys, history search (via tcurses)
✅ **Easy maintenance** - Fix once in bash/repl, all games benefit
✅ **Reduced code** - ~40% less duplication vs custom loops
✅ **Extensibility** - Easy to add new built-in commands

## Examples

### Formant (Vocal Synthesis)

```bash
source ~/tetra/tetra.sh
tmod load game
game select formant

# Synthwave theme for retro vocal synthesis aesthetic
/theme synthwave

# Use formant commands
start
speak "hello world"
/theme tokyo_night  # Switch themes on the fly!
```

### Pulsar (Energy Engine)

```bash
source ~/tetra/tetra.sh
tmod load game
game select pulsar

# Use pulsar commands (takeover mode - no prefix needed)
start
spawn wave1 80 48 18 6 0.5 0.6 0
status
!pwd  # Shell commands need ! prefix
```

### Estoface (Arcade)

```bash
source ~/tetra/tetra.sh
tmod load game
game select estoface

# Arcade theme for bright retro colors
/theme arcade

# Estoface uses C binary, but bash REPL available for debugging:
estoface_bash_repl
```

## Migration Notes

### Before (Custom Loop)

```bash
while true; do
    _game_build_prompt
    read -e -p "$REPL_PROMPT" input
    [[ -n "$input" ]] && history -s "$input"
    _game_process_input "$input" || break
done
```

- ❌ No enhanced input (arrow keys, history search)
- ❌ ~150 lines of duplicated loop logic
- ❌ Manual history management
- ❌ Inconsistent behavior across games
- ❌ No auto-detection of input capabilities

### After (Unified REPL - Pattern 1)

```bash
repl_build_prompt() { _game_build_prompt; }
repl_process_input() { _game_process_input "$@"; }
export -f repl_build_prompt repl_process_input
repl_run
```

- ✅ Enhanced input mode (tcurses, colors, history)
- ✅ ~15 lines instead of 150
- ✅ Automatic history management
- ✅ Consistent behavior everywhere
- ✅ Auto-detect input capabilities (basic/enhanced/tui)

## See Also

- `bash/repl/README.md` - Full REPL system documentation
- `bash/color/color_themes.sh` - Theme system implementation
- `bash/game/games/*/` - Individual game REPL implementations
