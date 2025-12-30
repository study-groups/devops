#!/usr/bin/env bash

# TDS Color Guide
# Generates documentation for the 4-palette system
# Pass output to agents/LLMs for consistent color usage

tds_color_guide() {
    cat <<'EOF'
## TDS Color System: 4-Palette Architecture

### The Four Palettes

| Palette | Purpose | Index Pattern |
|---------|---------|---------------|
| **PRIMARY** | Rainbow colors for cycling | 8 maximally distinct hues (universal) |
| **SECONDARY** | Theme accent colors | Offset rainbow for variety (theme-specific) |
| **SEMANTIC** | Status colors | error/warning/success/info + dims (derived) |
| **SURFACE** | Background to foreground | 8-step luminosity gradient (derived) |

### Index Semantics

```
PRIMARY   - RAINBOW:   [0]=red [1]=orange [2]=yellow [3]=green [4]=cyan [5]=blue [6]=purple [7]=pink
SECONDARY - ACCENT:    Offset hues for theme personality
SEMANTIC  - STATUS:    [0]=error [1]=warning [2]=success [3]=info [4-7]=dim versions
SURFACE   - GRADIENT:  [0]=darkest (bg) → [7]=brightest (fg)
```

### PRIMARY: Collection Cycling

Use PRIMARY to color items in a collection distinctly:
```bash
actions=(get set create delete copy edit path save validate)
for i in "${!actions[@]}"; do
    text_color "${PRIMARY[$((i % 8))]}"
    printf "%s " "${actions[$i]}"
done
# Output: get(red) set(orange) create(yellow) delete(green) copy(cyan) edit(blue) path(purple) save(pink) validate(red)
```

Helper function: `tds_cycle_print get set create delete copy edit path save validate`

### SEMANTIC: Status Colors (Derived)

Derived from PRIMARY for consistent status meanings:
- `SEMANTIC[0]` = error/fail/bad - red
- `SEMANTIC[1]` = warning/caution - orange
- `SEMANTIC[2]` = success/good - green
- `SEMANTIC[3]` = info/neutral - blue
- `SEMANTIC[4-7]` = dim versions of above

### Standard Tokens

**STATUS (SEMANTIC):** `status.error` `status.warning` `status.success` `status.info`

**TEXT (SURFACE):** `text.primary` `text.secondary` `text.muted` `text.dim`

**ACTION (PRIMARY/SECONDARY):** `action.primary` `action.secondary`

### Usage Patterns

```bash
# Semantic status
text_color "${SEMANTIC[2]}"; echo "PASS"; reset_color

# Collection cycling (rainbow)
tds_cycle_print list get set create delete

# Text hierarchy
text_color "${SURFACE[7]}"; echo "Primary text"; reset_color
text_color "${SURFACE[5]}"; echo "Muted text"; reset_color
```
EOF
}

# Compact version for quick reference
tds_color_guide_compact() {
    cat <<'EOF'
TDS 4-Palette System:
  PRIMARY[0-7]   Rainbow colors for cycling (universal)
  SECONDARY[0-7] Theme accent palette (theme-specific)
  SEMANTIC[0-7]  Status: error/warning/success/info + dims (derived)
  SURFACE[0-7]   Background → foreground gradient (derived)

Collection cycling: tds_cycle_print get set create delete copy edit path save
Status colors: SEMANTIC[0]=error SEMANTIC[2]=success
EOF
}

export -f tds_color_guide tds_color_guide_compact
