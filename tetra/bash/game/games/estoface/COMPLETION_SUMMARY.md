# Estoface REPL Tab Completion

## How It Works

Press TAB to show available options below the prompt:

```bash
💤 estoface > help <TAB>

  overview gamepad model rendering formant testing roadmap references

💤 estoface > help gamepad <TAB>

  mapping grid rhythm

💤 estoface > help gamepad.m<TAB>

  mapping

💤 estoface > <TAB>

  help start stop restart status mode show record play quit exit
```

## Features

- **Context-aware**: Shows commands or help topics based on what you're typing
- **Filtered**: Narrows down based on partial input
- **Colored**: Green for matches, gray for no matches
- **Non-intrusive**: Shows options, you still type (no auto-insert)

## Implementation

Uses `bind -x` to intercept TAB key and show completions via `tree_complete`:

```bash
💤 estoface > help gamepad<TAB>
  # Shows: mapping grid rhythm

💤 estoface > help gamepad.mapping
  # Shows help for that topic
```

## Why This Approach?

**Simple + Reliable**:
- No complex bash completion arrays
- Works in basic readline mode
- User maintains control (explicit typing)
- Familiar pattern (like Python REPL hints)

**vs. Auto-complete**:
- Auto-insert with `bind -x` is complex/buggy
- This shows all options clearly
- Better for discovery/learning
- Consistent across different terminal configs

## Usage Tips

1. **Explore**: Press TAB to see what's available
2. **Filter**: Start typing, TAB to narrow down
3. **Navigate**: Use help hierarchy with dots: `help gamepad.grid`
4. **Quick**: Just type if you know the command (no TAB needed)

## Example Session

```bash
$ game
[tetra x user x lobby] > play estoface

⚡ ESTOFACE REPL v0.1
...

💤 estoface > <TAB>
  help start stop restart status mode show record play quit exit

💤 estoface > h<TAB>
  help

💤 estoface > help <TAB>
  overview gamepad model rendering formant testing roadmap references

💤 estoface > help g<TAB>
  gamepad

💤 estoface > help gamepad<TAB>
  mapping grid rhythm

💤 estoface > help gamepad.grid

■ Grid
  4x4 position system = 256 mouth configs

  Primary: Jaw × Rounding = 16
  Secondary: Tongue H × F = 16
  Corners (easy): NE=[i] NW=[u] SE=[æ] SW=[ɑ]
  Diagonals (hard): Rare phonemes


💤 estoface > quit
⚡ Goodbye
```

## Files

- **core/estoface_repl.sh**: Completion logic (`_estoface_complete_readline`)
- **estoface_help.sh**: Help tree data (30+ nodes)
- **bash/tree/complete.sh**: `tree_complete()` function

## Future Enhancements

- History-based suggestions
- Fuzzy matching
- Command aliases
- Parameter completion (for show, record, etc.)
- Context help (show brief help inline)
