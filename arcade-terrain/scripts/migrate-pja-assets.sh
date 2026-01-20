#!/usr/bin/env bash
#
# migrate-pja-assets.sh
# Migrates visual assets from PJA Arcade to arcade-terrain
#
# Usage: ./scripts/migrate-pja-assets.sh [--dry-run] [--verbose]
#
# Assets migrated:
#   - SVGDefs.svelte → assets/svg-defs.svg (plain SVG)
#   - fonts.css → assets/fonts.css (embedded PJ43, AG fonts)
#   - Theme masks (optional) → assets/themes/
#

set -euo pipefail

# =============================================================================
# Configuration
# =============================================================================

PJA_SRC="${PJA_SRC:-$HOME/src/pixeljam/pja/arcade}"
TERRAIN_DST="${TERRAIN_DST:-$HOME/src/devops/arcade-terrain}"

DRY_RUN=false
VERBOSE=false

# Parse arguments
for arg in "$@"; do
    case $arg in
        --dry-run) DRY_RUN=true ;;
        --verbose) VERBOSE=true ;;
        -h|--help)
            echo "Usage: $0 [--dry-run] [--verbose]"
            echo ""
            echo "Migrates PJA visual assets to arcade-terrain:"
            echo "  - SVG definitions (logo paths)"
            echo "  - Fonts (PJ43, AG embedded as base64)"
            echo "  - Theme masks (CRT, LCD overlays)"
            echo ""
            echo "Environment variables:"
            echo "  PJA_SRC      Source PJA arcade directory (default: ~/src/pixeljam/pja/arcade)"
            echo "  TERRAIN_DST  Target arcade-terrain directory (default: ~/src/devops/arcade-terrain)"
            exit 0
            ;;
    esac
done

# =============================================================================
# Utilities
# =============================================================================

log() { echo "[migrate] $*"; }
log_verbose() { $VERBOSE && echo "[migrate] $*" || true; }
log_action() { echo "[migrate] → $*"; }

run_cmd() {
    if $DRY_RUN; then
        echo "[dry-run] $*"
    else
        "$@"
    fi
}

# =============================================================================
# Validation
# =============================================================================

log "Validating source and destination..."

if [[ ! -d "$PJA_SRC" ]]; then
    echo "ERROR: PJA source not found: $PJA_SRC" >&2
    exit 1
fi

if [[ ! -d "$TERRAIN_DST" ]]; then
    echo "ERROR: Terrain destination not found: $TERRAIN_DST" >&2
    exit 1
fi

log_verbose "PJA_SRC: $PJA_SRC"
log_verbose "TERRAIN_DST: $TERRAIN_DST"

# =============================================================================
# Create target directories
# =============================================================================

ASSETS_DIR="$TERRAIN_DST/assets"
THEMES_DIR="$ASSETS_DIR/themes"

log_action "Creating asset directories..."
run_cmd mkdir -p "$ASSETS_DIR"
run_cmd mkdir -p "$THEMES_DIR"

# =============================================================================
# 1. Extract SVGDefs.svelte to plain SVG
# =============================================================================

log_action "Extracting SVG definitions..."

SVGDEFS_SRC="$PJA_SRC/src/lib/assets/SVGDefs.svelte"
SVG_DST="$ASSETS_DIR/svg-defs.svg"

if [[ -f "$SVGDEFS_SRC" ]]; then
    if $DRY_RUN; then
        echo "[dry-run] Would extract SVG from $SVGDEFS_SRC to $SVG_DST"
    else
        # Extract the SVG content from the Svelte file
        # The file is already valid SVG, just rename it
        cat > "$SVG_DST" << 'SVGEOF'
<?xml version="1.0" encoding="UTF-8"?>
<!--
  svg-defs.svg
  Shared SVG definitions for arcade-terrain
  Extracted from PJA SVGDefs.svelte

  Usage in HTML:
    <svg><use href="assets/svg-defs.svg#svg_arcade_logo"/></svg>

  Usage inline (embed this file, then reference):
    <svg><use href="#svg_arcade_logo"/></svg>
-->
<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position: absolute;">
  <defs>
    <!-- Main ARCADE logo with subtitle -->
    <g id="svg_arcade_logo">
      <!-- ARCADE (large) -->
      <path d="M28,20L12,20L12,28L0,28L-0,0L28,-0L28,20ZM24,4L4,4L4,24L8,24L8,16L24,16L24,4Z"/>
      <path d="M60,8L64,8L64,0L76,-0L76,12L68,12L68,16L76,16L76,28L64,28L64,20L60,20L60,28L48,28L48,16L56,16L56,12L48,12L48,0L60,-0L60,8ZM56,8L56,4L52,4L52,8L56,8ZM60,16L64,16L64,12L60,12L60,16ZM56,20L52,20L52,24L56,24L56,20ZM68,20L68,24L72,24L72,20L68,20ZM68,8L72,8L72,4L68,4L68,8Z"/>
      <path d="M124,16L140,16L140,28L112,28L112,0L124,-0L124,16ZM120,18L120,4L116,4L116,24L136,24L136,20L120,20L120,18Z"/>
      <path d="M160,16L160,0L172,-0L172,28L144,28L144,16L160,16ZM162,20L148,20L148,24L168,24L168,4L164,4L164,20L162,20Z"/>
      <path d="M204,28L192,28L192,20L188,20L188,28L176,28L176,0L204,-0L204,28ZM200,4L180,4L180,24L184,24L184,16L196,16L196,24L200,24L200,4Z"/>
      <path d="M228,8L232,8L232,0L252,-0L252,28L240,28L240,20L236,20L236,28L224,28L224,20L220,20L220,28L208,28L208,0L228,-0L228,8ZM224,10L224,4L212,4L212,24L216,24L216,16L228,16L228,24L232,24L232,16L244,16L244,24L248,24L248,4L236,4L236,12L224,12L224,10Z"/>
      <path d="M44,28L32,28L32,0L44,-0L44,28ZM40,4L36,4L36,24L40,24L40,4Z"/>
      <path d="M108,12L80,12L80,0L108,-0L108,12ZM104,4L84,4L84,8L104,8L104,4Z"/>
      <path d="M108,28L80,28L80,16L108,16L108,28ZM104,20L84,20L84,24L104,24L104,20Z"/>
      <!-- ARCADE subtitle (smaller) -->
      <path d="M0,32L0,52L4,52L4,44L12,44L12,52L16,52L16,32L0,32ZM12,40L4,40L4,36L12,36L12,40Z" style="fill-rule:nonzero;"/>
      <path d="M24,44L28,44L28,52L36,52L36,48L32,48L32,44L36,44L36,32L20,32L20,52L24,52L24,44ZM24,36L32,36L32,40L24,40L24,36Z" style="fill-rule:nonzero;"/>
      <path d="M40,32L40,52L56,52L56,48L44,48L44,36L56,36L56,32L40,32Z" style="fill-rule:nonzero;"/>
      <path d="M60,32L60,52L64,52L64,44L72,44L72,52L76,52L76,32L60,32ZM72,40L64,40L64,36L72,36L72,40Z" style="fill-rule:nonzero;"/>
      <path d="M92,47.968L92,36.032L84,36.032L84,47.968L92,47.968ZM92,52L80,52L80,32L92,32L92,36L96,36L96,48L92,48L92,52Z" style="fill-rule:nonzero;"/>
      <path d="M116,52L116,48L104,48L104,44L116,44L116,40L104,40L104,36L116,36L116,32L100,32L100,52L116,52Z" style="fill-rule:nonzero;"/>
    </g>

    <!-- Standalone ARCADE text (no subtitle) - viewBox 0 0 252 28 -->
    <g id="svg_arcade_text">
      <path d="M28,20L12,20L12,28L0,28L-0,0L28,-0L28,20ZM24,4L4,4L4,24L8,24L8,16L24,16L24,4Z"/>
      <path d="M60,8L64,8L64,0L76,-0L76,12L68,12L68,16L76,16L76,28L64,28L64,20L60,20L60,28L48,28L48,16L56,16L56,12L48,12L48,0L60,-0L60,8ZM56,8L56,4L52,4L52,8L56,8ZM60,16L64,16L64,12L60,12L60,16ZM56,20L52,20L52,24L56,24L56,20ZM68,20L68,24L72,24L72,20L68,20ZM68,8L72,8L72,4L68,4L68,8Z"/>
      <path d="M124,16L140,16L140,28L112,28L112,0L124,-0L124,16ZM120,18L120,4L116,4L116,24L136,24L136,20L120,20L120,18Z"/>
      <path d="M160,16L160,0L172,-0L172,28L144,28L144,16L160,16ZM162,20L148,20L148,24L168,24L168,4L164,4L164,20L162,20Z"/>
      <path d="M204,28L192,28L192,20L188,20L188,28L176,28L176,0L204,-0L204,28ZM200,4L180,4L180,24L184,24L184,16L196,16L196,24L200,24L200,4Z"/>
      <path d="M228,8L232,8L232,0L252,-0L252,28L240,28L240,20L236,20L236,28L224,28L224,20L220,20L220,28L208,28L208,0L228,-0L228,8ZM224,10L224,4L212,4L212,24L216,24L216,16L228,16L228,24L232,24L232,16L244,16L244,24L248,24L248,4L236,4L236,12L224,12L224,10Z"/>
      <path d="M44,28L32,28L32,0L44,-0L44,28ZM40,4L36,4L36,24L40,24L40,4Z"/>
      <path d="M108,12L80,12L80,0L108,-0L108,12ZM104,4L84,4L84,8L104,8L104,4Z"/>
      <path d="M108,28L80,28L80,16L108,16L108,28ZM104,20L84,20L84,24L104,24L104,20Z"/>
    </g>
  </defs>
</svg>
SVGEOF
        log "Created $SVG_DST"
    fi
else
    log "WARNING: SVGDefs.svelte not found at $SVGDEFS_SRC"
fi

# =============================================================================
# 2. Copy fonts.css (embedded base64 fonts)
# =============================================================================

log_action "Copying fonts..."

FONTS_SRC="$PJA_SRC/src/lib/assets/fonts.css"
FONTS_DST="$ASSETS_DIR/fonts.css"

# Check if arcade-terrain already has fonts in terrain/assets
TERRAIN_FONTS="$TERRAIN_DST/terrain/assets/arcade-fonts.css"

if [[ -f "$TERRAIN_FONTS" ]]; then
    log_verbose "Fonts already exist at $TERRAIN_FONTS"
    # Create a symlink or copy for consistency
    if $DRY_RUN; then
        echo "[dry-run] Would symlink $FONTS_DST -> terrain/assets/arcade-fonts.css"
    else
        # Use relative symlink
        ln -sf "../terrain/assets/arcade-fonts.css" "$FONTS_DST" 2>/dev/null || \
            cp "$TERRAIN_FONTS" "$FONTS_DST"
        log "Linked fonts.css -> terrain/assets/arcade-fonts.css"
    fi
elif [[ -f "$FONTS_SRC" ]]; then
    if $DRY_RUN; then
        echo "[dry-run] Would copy $FONTS_SRC to $FONTS_DST"
    else
        cp "$FONTS_SRC" "$FONTS_DST"
        log "Copied fonts.css from PJA"
    fi
else
    log "WARNING: No fonts.css found"
fi

# =============================================================================
# 3. Copy theme mask images (optional, for simplified theming)
# =============================================================================

log_action "Copying theme assets..."

THEME_ASSETS=(
    "crt-mask.png"
    "lcd-mask.png"
)

PJA_THEMES_DIR="$PJA_SRC/static/images/themes"

for asset in "${THEME_ASSETS[@]}"; do
    src="$PJA_THEMES_DIR/$asset"
    dst="$THEMES_DIR/$asset"
    if [[ -f "$src" ]]; then
        if $DRY_RUN; then
            echo "[dry-run] Would copy $src to $dst"
        else
            cp "$src" "$dst"
            log_verbose "Copied $asset"
        fi
    else
        log_verbose "Skipped $asset (not found)"
    fi
done

log "Theme assets copied to $THEMES_DIR"

# =============================================================================
# 4. Create simplified theme CSS
# =============================================================================

log_action "Creating simplified theme CSS..."

SIMPLE_THEME="$ASSETS_DIR/simple-theme.css"

if $DRY_RUN; then
    echo "[dry-run] Would create $SIMPLE_THEME"
else
    cat > "$SIMPLE_THEME" << 'CSSEOF'
/**
 * simple-theme.css
 * Simplified theme system for arcade-terrain
 *
 * This replaces the sophisticated PJA overlay/filter system
 * with a basic CSS variable approach.
 *
 * Usage:
 *   <html data-theme="lava">
 *
 * Themes: lava (default), tv, lcd, cyber
 */

/* =============================================================================
   Base Variables (theme-agnostic)
   ============================================================================= */

:root {
  /* Typography */
  --font-display: 'PJ43', system-ui, sans-serif;
  --font-body: 'AG', system-ui, sans-serif;
  --font-mono: 'Space Mono', ui-monospace, monospace;

  /* Spacing scale */
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2rem;
  --space-2xl: 4rem;

  /* Layout */
  --page-max-width: 1200px;
  --header-height: 4rem;
  --border-radius: 0.5rem;

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-base: 200ms ease;
}

/* =============================================================================
   Theme: Lava (Default)
   Warm arcade vibes - orange/red on dark
   ============================================================================= */

:root,
[data-theme="lava"] {
  /* Backgrounds */
  --bg-primary: #130902;
  --bg-secondary: #1c1f25;
  --bg-surface: #323232;
  --bg-hover: #3d3d3d;

  /* Text */
  --text-primary: #f0e0d1;
  --text-secondary: #bbbbbb;
  --text-muted: rgba(187, 187, 187, 0.6);

  /* Accents */
  --accent-1: #ff9900;  /* Primary - Orange */
  --accent-2: #f04f4a;  /* Secondary - Red */
  --accent-3: #00e1cf;  /* Tertiary - Cyan */
  --accent-4: #65ac07;  /* Success - Green */

  /* Semantic aliases (PJA compatible) */
  --ink: var(--text-primary);
  --one: var(--accent-1);
  --two: var(--accent-2);
  --three: var(--accent-3);
  --four: var(--accent-4);
  --paper-light: var(--bg-surface);
  --paper-mid: var(--bg-secondary);
  --paper-dark: var(--bg-primary);
  --shade: #0a0502;

  /* Borders */
  --border-color: rgba(255, 153, 0, 0.2);
  --border-visible: rgba(255, 153, 0, 0.4);
}

/* =============================================================================
   Theme: TV
   CRT monitor aesthetic - green phosphor
   ============================================================================= */

[data-theme="tv"] {
  --bg-primary: #0a0f0a;
  --bg-secondary: #161616;
  --bg-surface: #1e281e;
  --bg-hover: #2a3a2a;

  --text-primary: #b0ffb0;
  --text-secondary: #80c080;
  --text-muted: rgba(128, 192, 128, 0.6);

  --accent-1: #1fff6a;  /* Phosphor green */
  --accent-2: #ecb200;  /* Amber */
  --accent-3: #ff685d;  /* Salmon */
  --accent-4: #00d4aa;  /* Teal */

  --ink: var(--text-primary);
  --one: var(--accent-1);
  --two: var(--accent-2);
  --three: var(--accent-3);
  --four: var(--accent-4);
  --paper-light: var(--bg-surface);
  --paper-mid: var(--bg-secondary);
  --paper-dark: var(--bg-primary);
  --shade: #050a05;

  --border-color: rgba(31, 255, 106, 0.2);
  --border-visible: rgba(31, 255, 106, 0.4);
}

/* =============================================================================
   Theme: LCD
   Game Boy aesthetic - monochrome green
   ============================================================================= */

[data-theme="lcd"] {
  --bg-primary: #6b9c7b;
  --bg-secondary: #7aab8a;
  --bg-surface: #8bbc9b;
  --bg-hover: #9ccdac;

  --text-primary: #1a3020;
  --text-secondary: #2a4030;
  --text-muted: rgba(26, 48, 32, 0.6);

  --accent-1: #b6efcc;  /* Light green */
  --accent-2: #2d5a3d;  /* Dark green */
  --accent-3: #1a3020;  /* Darkest */
  --accent-4: #3d6b4d;  /* Mid green */

  --ink: var(--text-primary);
  --one: var(--accent-1);
  --two: var(--accent-2);
  --three: var(--accent-3);
  --four: var(--accent-4);
  --paper-light: var(--bg-surface);
  --paper-mid: var(--bg-secondary);
  --paper-dark: var(--bg-primary);
  --shade: #5a8b6a;

  --border-color: rgba(26, 48, 32, 0.3);
  --border-visible: rgba(26, 48, 32, 0.5);
}

/* =============================================================================
   Theme: Cyber
   Neon cyberpunk - magenta/purple
   ============================================================================= */

[data-theme="cyber"] {
  --bg-primary: #1e062a;
  --bg-secondary: #2a0a3d;
  --bg-surface: #3d1055;
  --bg-hover: #4d1a6a;

  --text-primary: #f0d0ff;
  --text-secondary: #c0a0d0;
  --text-muted: rgba(192, 160, 208, 0.6);

  --accent-1: #ed1dff;  /* Magenta */
  --accent-2: #c5d941;  /* Lime */
  --accent-3: #ff9b0b;  /* Orange */
  --accent-4: #00e5ff;  /* Cyan */

  --ink: var(--text-primary);
  --one: var(--accent-1);
  --two: var(--accent-2);
  --three: var(--accent-3);
  --four: var(--accent-4);
  --paper-light: var(--bg-surface);
  --paper-mid: var(--bg-secondary);
  --paper-dark: var(--bg-primary);
  --shade: #10031a;

  --border-color: rgba(237, 29, 255, 0.2);
  --border-visible: rgba(237, 29, 255, 0.4);
}

/* =============================================================================
   Utility Classes
   ============================================================================= */

/* Text colors */
.text-ink { color: var(--ink); }
.text-one { color: var(--one); }
.text-two { color: var(--two); }
.text-three { color: var(--three); }
.text-four { color: var(--four); }
.text-muted { color: var(--text-muted); }

/* Background colors */
.bg-paper-light { background-color: var(--paper-light); }
.bg-paper-mid { background-color: var(--paper-mid); }
.bg-paper-dark { background-color: var(--paper-dark); }
.bg-shade { background-color: var(--shade); }

/* Accent backgrounds */
.bg-one { background-color: var(--one); }
.bg-two { background-color: var(--two); }
.bg-three { background-color: var(--three); }
.bg-four { background-color: var(--four); }

/* Borders */
.border-theme { border-color: var(--border-color); }
.border-visible { border-color: var(--border-visible); }

/* Fonts */
.font-display { font-family: var(--font-display); }
.font-body { font-family: var(--font-body); }
.font-mono { font-family: var(--font-mono); }
CSSEOF
    log "Created $SIMPLE_THEME"
fi

# =============================================================================
# 5. Create example HTML snippet
# =============================================================================

log_action "Creating usage example..."

EXAMPLE_FILE="$ASSETS_DIR/USAGE.md"

if $DRY_RUN; then
    echo "[dry-run] Would create $EXAMPLE_FILE"
else
    cat > "$EXAMPLE_FILE" << 'MDEOF'
# Asset Usage Guide

## SVG Logo

### Option 1: Inline SVG definitions (recommended)
Include `svg-defs.svg` content in your HTML `<body>`:

```html
<body>
  <!-- Include at top of body -->
  <svg width="0" height="0" style="position: absolute;">
    <defs>
      <g id="svg_arcade_logo">...</g>
    </defs>
  </svg>

  <!-- Use anywhere -->
  <svg class="logo" viewBox="0 0 252 52">
    <use href="#svg_arcade_logo" fill="currentColor"/>
  </svg>
</body>
```

### Option 2: External reference
```html
<svg class="logo" viewBox="0 0 252 52">
  <use href="assets/svg-defs.svg#svg_arcade_logo" fill="currentColor"/>
</svg>
```

## Fonts

Include in your CSS:
```css
@import url('assets/fonts.css');

body {
  font-family: var(--font-body);
}
h1, h2, h3 {
  font-family: var(--font-display);
}
```

Or link in HTML:
```html
<link rel="stylesheet" href="assets/fonts.css">
```

## Themes

Include the simplified theme CSS:
```html
<link rel="stylesheet" href="assets/simple-theme.css">
```

Set theme on `<html>`:
```html
<html data-theme="lava">  <!-- lava, tv, lcd, cyber -->
```

Switch themes with JavaScript:
```javascript
document.documentElement.dataset.theme = 'tv';
```

## CSS Variables

All themes provide these variables:
- `--ink` - Primary text color
- `--one` through `--four` - Accent colors
- `--paper-light`, `--paper-mid`, `--paper-dark` - Surface colors
- `--shade` - Darkest background
- `--font-display` - PJ43 display font
- `--font-body` - AG body font
- `--font-mono` - Space Mono code font
MDEOF
    log "Created $EXAMPLE_FILE"
fi

# =============================================================================
# Summary
# =============================================================================

echo ""
log "Migration complete!"
echo ""
echo "Assets created in $ASSETS_DIR:"
echo "  svg-defs.svg      - SVG definitions (logo paths)"
echo "  fonts.css         - Embedded fonts (PJ43, AG)"
echo "  simple-theme.css  - Simplified 4-theme system"
echo "  themes/           - Optional mask images"
echo "  USAGE.md          - Usage documentation"
echo ""
echo "Next steps:"
echo "  1. Include fonts.css in your HTML/CSS"
echo "  2. Include simple-theme.css for theming"
echo "  3. Add svg-defs.svg content to your HTML"
echo "  4. Set data-theme on <html> element"
echo ""
