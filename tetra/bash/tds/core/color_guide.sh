#!/usr/bin/env bash

# TDS Color Guide
# Generates documentation for the 8x4 palette system
# Pass output to agents/LLMs for consistent color usage

tds_color_guide() {
    cat <<'EOF'
## TDS Color System: 8x4 Palette Architecture

### The Four Palettes

| Palette | Purpose | Index Pattern |
|---------|---------|---------------|
| **ENV** | "Where" - contexts, environments | A/B alternating hue families (theme-specific) |
| **MODE** | "How" - semantic states | bad/warning/good/info + dims (theme-specific) |
| **VERBS** | "Do" - collection cycling | 8 rainbow colors for visual distinction (universal) |
| **NOUNS** | "What" - text hierarchy | dark→bright gradient (theme-specific) |

### Index Semantics

```
ENV   - ALTERNATE: [0,2,4,6]=hue A  [1,3,5,7]=hue B (light→dim)
MODE  - SEMANTIC:  [0]=bad [1]=warning [2]=good [3]=info [4-7]=dim versions
VERBS - RAINBOW:   [0]=red [1]=orange [2]=yellow [3]=green [4]=cyan [5]=blue [6]=purple [7]=pink
NOUNS - GRADIENT:  [0]=darkest → [7]=brightest
```

### VERBS: Collection Cycling

Use VERBS to color items in a collection distinctly:
```bash
actions=(get set create delete copy edit path save validate)
for i in "${!actions[@]}"; do
    text_color "${VERBS_PRIMARY[$((i % 8))]}"
    printf "%s " "${actions[$i]}"
done
# Output: get(red) set(orange) create(yellow) delete(green) copy(cyan) edit(blue) path(purple) save(pink) validate(red)
```

Helper function: `tds_cycle_print get set create delete copy edit path save validate`

### MODE: Semantic States (Theme-Specific)

Each theme defines its own colors for these semantic meanings:
- `MODE[0]` = bad/fail/error/off - theme's "negative" color
- `MODE[1]` = warning/caution/pending - theme's "caution" color
- `MODE[2]` = good/pass/success/on - theme's "positive" color
- `MODE[3]` = info/neutral/default - theme's "info" color
- `MODE[4-7]` = dim versions of above

Example: warm theme uses amber/brown, arctic uses cyan/blue

### Standard Tokens

**STATUS (MODE):** `status.bad` `status.warning` `status.good` `status.info` (+ `.dim` variants)

**ENVIRONMENT (ENV):** `env.a.primary` `env.a.light` `env.b.primary` `env.b.light`

**TEXT (NOUNS):** `text.darkest` → `text.brightest` (8-step gradient)

### Usage Patterns

```bash
# Semantic status (theme-colored)
text_color "${MODE_PRIMARY[2]}"; echo "PASS"; reset_color

# Collection cycling (rainbow)
tds_cycle_print list get set create delete

# Environment distinction
text_color "${ENV_PRIMARY[0]}"; echo "production"; reset_color
text_color "${ENV_PRIMARY[1]}"; echo "staging"; reset_color
```
EOF
}

# Compact version for quick reference
tds_color_guide_compact() {
    cat <<'EOF'
TDS 8x4 Palette:
  ENV[0-7]   "Where" - A/B alternating contexts (theme-specific)
  MODE[0-7]  "How"   - bad/warning/good/info + dims (theme-specific)
  VERBS[0-7] "Do"    - rainbow cycle for collections (universal)
  NOUNS[0-7] "What"  - dark→bright gradient (theme-specific)

Collection cycling: tds_cycle_print get set create delete copy edit path save
Semantic states: MODE[0]=bad MODE[2]=good (theme colors)
EOF
}

export -f tds_color_guide tds_color_guide_compact
