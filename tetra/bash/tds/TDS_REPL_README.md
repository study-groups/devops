# TDS REPL - Tetra Design System Interactive Explorer

An interactive REPL for exploring colors, themes, palettes, and tokens in the Tetra Design System.

## Quick Start

```bash
# Source Tetra
source ~/tetra/tetra.sh

# Load and run TDS REPL
source $TETRA_SRC/bash/tds/tds_repl.sh
tds_repl
```

## Accessing via TUI

The TDS module is integrated into the Tetra TUI:

1. Navigate to **Local × Inspect** context
2. The TDS module will be available alongside org and logs
3. Press Ctrl-Tab to cycle between modules
4. TDS uses the **electric** temperature theme (purple/magenta)

## Available Commands

### Theme Management

| Command | Description |
|---------|-------------|
| `show:themes` | List all available themes |
| `switch:theme-name` | Switch to a specific theme |
| `preview:themes` | Preview all themes side-by-side |
| `info:theme-name` | Show detailed theme information and palettes |

**Example:**
```
tds> show:themes
tds> switch:warm
tds> info:tokyo-night
```

### Palette Inspection

| Command | Description |
|---------|-------------|
| `show:palettes` | Show all 4 palette arrays with color swatches |
| `palette:primary` | Show PRIMARY palette (rainbow colors) |
| `palette:secondary` | Show SECONDARY palette (theme accents) |
| `palette:semantic` | Show SEMANTIC palette (status colors) |
| `palette:surface` | Show SURFACE palette (bg→fg gradient) |

**Example:**
```
tds> palette:secondary
tds> switch:warm
tds> palette:secondary    # See how colors changed!
```

### Token Exploration

| Command | Description |
|---------|-------------|
| `list:tokens` | List all color tokens grouped by category |
| `resolve:token-name` | Show token → palette → hex resolution |
| `validate:tokens` | Run token validation checks |

**Example:**
```
tds> list:tokens
tds> resolve:repl.prompt
tds> resolve:content.heading.h1
```

### Color Tools

| Command | Description |
|---------|-------------|
| `hex:#RRGGBB` | Display a color swatch for any hex color |
| `semantic:name` | Test semantic color rendering |

**Example:**
```
tds> hex:#3b82f6
tds> hex:#ea580c
tds> semantic:success
tds> semantic:error
```

### Temperature Themes

| Command | Description |
|---------|-------------|
| `show:temps` | List temperature themes with descriptions |
| `temp:warm` | Preview warm temperature theme |
| `temp:cool` | Preview cool temperature theme |
| `temp:neutral` | Preview neutral temperature theme |
| `temp:electric` | Preview electric temperature theme |

**Example:**
```
tds> show:temps
tds> temp:warm     # See org module colors
tds> temp:cool     # See logs module colors
```

### General

| Command | Description |
|---------|-------------|
| `help` | Show command help |
| `quit`, `exit`, `q` | Exit TDS REPL |

## Understanding the Color System

### Architecture Layers

```
TDS REPL
   ↓
Themes (tokyo-night, neon, warm, cool, etc.)
   ↓
Tokens (repl.prompt, content.heading.h1, etc.)
   ↓
Palette References (secondary:0, primary:1, semantic:3, etc.)
   ↓
Color Arrays (PRIMARY, SECONDARY, SEMANTIC, SURFACE)
   ↓
Hex Values (#3b82f6, #ea580c, etc.)
```

### Token Resolution Example

```
Token:    repl.prompt
   ↓
Resolves: secondary:0
   ↓
Looks up: SECONDARY[0]
   ↓
In default theme:  #0088FF (blue)
In warm theme:     #ea580c (orange)
In cool theme:     #3b82f6 (blue)
In electric theme: #d946ef (fuchsia)
```

## Temperature Themes

Temperature themes provide visual phase-shifts when switching between modules:

| Temperature | Color | Module | Feel |
|------------|-------|--------|------|
| **warm** | 🟠 Amber/Orange `#ea580c` | org | Inviting, organizational |
| **cool** | 🔵 Blue `#3b82f6` | logs | Analytical, focused |
| **neutral** | 🟢 Green `#10b981` | tsm | Balanced, operational |
| **electric** | 🟣 Fuchsia `#d946ef` | deploy, tds | Energetic, creative |

## Interactive Examples

### Explore Theme Differences

```bash
tds> palette:secondary         # See current palette
tds> switch:tokyo-night        # Switch theme
tds> palette:secondary         # See how palette changed
```

### Understand Token System

```bash
tds> list:tokens               # See all tokens
tds> resolve:repl.prompt       # See what it resolves to
tds> switch:warm               # Change theme
tds> resolve:repl.prompt       # Same token, different color!
```

### Test Custom Colors

```bash
tds> hex:#ff0044               # Test a red color
tds> hex:#00ff88               # Test a green color
tds> hex:#8844ff               # Test a purple color
```

### Compare Temperature Themes

```bash
tds> temp:warm                 # See warm palette
tds> temp:cool                 # See cool palette
tds> temp:neutral              # See neutral palette
tds> temp:electric             # See electric palette
```

## Integration with Tetra

### Module Configuration

The TDS module is registered in `bash/tetra/modes/matrix.sh`:

```bash
MODE_MATRIX["Local:Inspect"]="org logs tds"
MODULE_TEMPERATURE["tds"]="electric"
MODULE_MARKER["tds"]="◉"
```

### Action Interface

The TDS module provides these actions in the TUI:

- `show:themes` - Quick theme listing
- `show:palettes` - Quick palette view
- `list:tokens` - Token exploration
- `show:temps` - Temperature theme reference

### Files Created

- `bash/tds/tds_repl.sh` - Main REPL implementation
- `bash/tds/action_interface.sh` - TUI integration
- `bash/tds/actions.sh` - Module entry point

## Design Philosophy

The TDS REPL follows Tetra's design principles:

1. **Interactive Exploration** - Learn by doing, see results immediately
2. **Semantic Clarity** - Commands use clear verb:noun pattern
3. **Visual Feedback** - Color swatches, live theme switching
4. **Hierarchical Understanding** - See token → palette → hex resolution
5. **Module Integration** - Seamlessly integrated into TUI workflow

## Advanced Usage

### Theme Development

Use TDS REPL to develop and test new themes:

1. Create theme in `bash/tds/themes/mytheme.sh`
2. Register in theme registry
3. Load in TDS REPL: `switch:mytheme`
4. Inspect palettes: `show:palettes`
5. Test tokens: `resolve:repl.prompt`

### Color Selection

Use TDS REPL to pick colors for your code:

```bash
tds> palette:semantic          # See action/status colors
tds> hex:#dc2626               # Test specific color
tds> resolve:status.error      # See what semantic uses
```

### Debugging Color Issues

If colors don't look right in your module:

1. Launch TDS REPL
2. Check active theme: `show:themes`
3. Inspect palette: `palette:secondary`
4. Resolve token: `resolve:your.token`
5. Compare themes: `switch:tokyo-night` then `palette:secondary`

## Related Documentation

- `bash/tds/README.md` - TDS overview and architecture
- `bash/tds/THEMES.md` - Theme system documentation
- `bash/tetra/REFACTOR_COMPLETE.md` - Temperature theme refactor
- `bash/color/` - Low-level color primitives

## Quick Reference Card

```
THEMES          PALETTES           TOKENS          COLORS
-----------     ---------------    -----------     -----------
show:themes     palette:primary    list:tokens     hex:#RRGGBB
switch:warm     palette:secondary  resolve:token   semantic:name
info:warm       palette:semantic
temp:cool       palette:surface
```

---

**TDS REPL** - Making Tetra's design system explorable and understandable.
