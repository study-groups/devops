# TDS 4-Palette System

The Tetra Design System uses a 4-palette architecture for consistent, themeable colors across all modules.

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    4-PALETTE SYSTEM                         │
├─────────────┬─────────────┬─────────────┬─────────────────-─┤
│   PRIMARY   │  SECONDARY  │  SEMANTIC   │     SURFACE       │
│  (rainbow)  │  (accents)  │  (status)   │   (bg → fg)       │
├─────────────┼─────────────┼─────────────┼───────────────────┤
│ [0] red     │ [0] coral   │ [0] error   │ [0] bg dark       │
│ [1] orange  │ [1] gold    │ [1] warning │ [1] ...           │
│ [2] yellow  │ [2] lime    │ [2] success │ [2] ...           │
│ [3] green   │ [3] emerald │ [3] info    │ [3] ...           │
│ [4] cyan    │ [4] azure   │ [4] err dim │ [4] ...           │
│ [5] blue    │ [5] royal   │ [5] wrn dim │ [5] ...           │
│ [6] purple  │ [6] orchid  │ [6] suc dim │ [6] ...           │
│ [7] pink    │ [7] rose    │ [7] inf dim │ [7] fg light      │
└─────────────┴─────────────┴─────────────┴───────────────────┘
        ↑               ↑           ↑               ↑
    DEFINED         DEFINED     DERIVED         DERIVED
   by theme        by theme   from PRIMARY   from BACKGROUND
```

## The Four Palettes

### PRIMARY - Rainbow Colors (8 hues)

**Purpose:** Universal distinct colors for cycling through lists, categories, or visual distinction.

**Usage:** When you need N different colors that are visually distinct.

```bash
# Cycle through items with different colors
for i in {0..7}; do
    text_color "${PRIMARY[$i]}"
    echo "Item $i"
done
reset_color
```

**Default values:**
| Index | Color  | Hex      | Hue  |
|-------|--------|----------|------|
| 0     | Red    | `E53935` | 0°   |
| 1     | Orange | `FB8C00` | 30°  |
| 2     | Yellow | `FDD835` | 60°  |
| 3     | Green  | `43A047` | 120° |
| 4     | Cyan   | `00ACC1` | 180° |
| 5     | Blue   | `1E88E5` | 210° |
| 6     | Purple | `8E24AA` | 270° |
| 7     | Pink   | `EC407A` | 330° |

### SECONDARY - Theme Accents (8 hues)

**Purpose:** Module-specific accent colors that define the theme's personality.

**Usage:** UI accents, highlights, module branding.

```bash
# Module accent color
text_color "${SECONDARY[0]}"
echo "Module Header"
reset_color
```

**Default values:** Offset rainbow (+22° from PRIMARY) - themes often override this entirely.

### SEMANTIC - Status Colors (8 slots)

**Purpose:** Consistent meaning across all modules - errors are always red, success always green.

**Usage:** Status indicators, alerts, feedback.

```bash
# Status messages
text_color "${SEMANTIC[0]}"; echo "Error: Something failed"; reset_color
text_color "${SEMANTIC[1]}"; echo "Warning: Check this"; reset_color
text_color "${SEMANTIC[2]}"; echo "Success: All good"; reset_color
text_color "${SEMANTIC[3]}"; echo "Info: FYI"; reset_color
```

**Slots:**
| Index | Meaning     | Derived From  |
|-------|-------------|---------------|
| 0     | Error       | PRIMARY[0]    |
| 1     | Warning     | PRIMARY[1]    |
| 2     | Success     | PRIMARY[3]    |
| 3     | Info        | PRIMARY[5]    |
| 4     | Error dim   | dimmed [0]    |
| 5     | Warning dim | dimmed [1]    |
| 6     | Success dim | dimmed [2]    |
| 7     | Info dim    | dimmed [3]    |

### SURFACE - Background to Foreground Gradient (8 steps)

**Purpose:** UI surfaces, text hierarchy, backgrounds.

**Usage:** Panel backgrounds, borders, text colors at different emphasis levels.

```bash
# Text hierarchy
text_color "${SURFACE[7]}"; echo "Primary text (bright)"
text_color "${SURFACE[5]}"; echo "Secondary text"
text_color "${SURFACE[3]}"; echo "Tertiary text (dim)"
reset_color

# Background (use with bg_color)
bg_color "${SURFACE[0]}"  # Darkest background
bg_color "${SURFACE[1]}"  # Slightly lighter
```

**Gradient (dark theme):**
| Index | Lightness | Use Case          |
|-------|-----------|-------------------|
| 0     | 8%        | Deep background   |
| 1     | 20%       | Panel background  |
| 2     | 32%       | Elevated surface  |
| 3     | 44%       | Borders, dim text |
| 4     | 56%       | Secondary text    |
| 5     | 68%       | Body text         |
| 6     | 80%       | Emphasis text     |
| 7     | 92%       | Primary text      |

## Theme Inputs vs Derived Palettes

Themes define 4 values:
```bash
BACKGROUND="1A1A2E"    # Anchor color for SURFACE gradient
TINT="10"              # Saturation of SURFACE (0=gray, higher=colored)
PRIMARY=(...)          # 8 rainbow colors
SECONDARY=(...)        # 8 accent colors
```

The system derives:
```bash
tds_derive             # Called automatically
# Creates SEMANTIC from PRIMARY[0,1,3,5]
# Creates SURFACE from BACKGROUND + TINT
```

## Quick Reference

### Accessing Colors

```bash
# Direct array access
echo "${PRIMARY[0]}"     # "E53935"
echo "${SEMANTIC[2]}"    # success color

# Using tds_color function
tds_color primary 0      # returns hex
tds_color semantic 2     # returns hex

# Apply to terminal
tds_apply primary 0      # sets terminal color
text_color "${PRIMARY[0]}"  # same effect
```

### Common Patterns

```bash
# Error message
text_color "${SEMANTIC[0]}"
echo "Error: $message"
reset_color

# Success with dim context
text_color "${SEMANTIC[6]}"  # dim success
echo "Previous: OK"
text_color "${SEMANTIC[2]}"  # bright success
echo "Current: OK"
reset_color

# List with cycling colors
items=("alpha" "beta" "gamma" "delta")
for i in "${!items[@]}"; do
    text_color "${PRIMARY[$((i % 8))]}"
    echo "${items[$i]}"
done
reset_color

# UI panel
bg_color "${SURFACE[1]}"
text_color "${SURFACE[7]}"
echo " Panel Title "
reset_color
```

## Migration from Old Names

| Old Name       | New Name  | Notes                    |
|----------------|-----------|--------------------------|
| ENV_PRIMARY    | PRIMARY   | Rainbow colors           |
| MODE_PRIMARY   | SECONDARY | Theme accents            |
| VERBS_PRIMARY  | SEMANTIC  | Status colors (derived)  |
| NOUNS_PRIMARY  | SURFACE   | Bg→fg gradient (derived) |

```bash
# Old code
color="${ENV_PRIMARY[0]}"
color="${VERBS_PRIMARY[2]}"

# New code
color="${PRIMARY[0]}"
color="${SEMANTIC[2]}"
```

## Creating a Theme

```bash
#!/usr/bin/env bash
# themes/mytheme.sh

tds_load_theme_mytheme() {
    # Theme inputs
    BACKGROUND="0D1117"   # GitHub dark
    TINT="15"

    declare -ga PRIMARY=(
        "F85149" "D29922" "E3B341" "3FB950"
        "58A6FF" "388BFD" "A371F7" "DB61A2"
    )

    declare -ga SECONDARY=(
        "FF7B72" "D29922" "7EE787" "56D4DD"
        "79C0FF" "A5D6FF" "D2A8FF" "FFA198"
    )

    # Derive SEMANTIC and SURFACE
    tds_derive

    TDS_THEME_NAME="My Theme"
}
```

## Files

| File | Purpose |
|------|---------|
| `color/color_palettes.sh` | Palette definitions, tds_derive() |
| `tds/themes/*.sh` | Individual theme definitions |
| `tds/core/semantic_colors.sh` | Semantic color mapping |
| `tds/tokens/color_tokens.sh` | Token → palette mapping |

## Testing

```bash
# View all palettes
source ~/tetra/tetra.sh
tetra_load_module tds
echo "palette list" | tds_repl

# View specific palette
echo "palette get primary" | tds_repl
echo "palette get semantic" | tds_repl

# Test in code
echo "PRIMARY: ${PRIMARY[*]}"
echo "SEMANTIC: ${SEMANTIC[*]}"
```
