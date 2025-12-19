# TDS Theme System - Quick Reference

## Overview

TDS (Tetra Design System) supports named themes that can be switched dynamically without restarting your shell. Each theme defines 32 colors organized into 4 palettes of 8 colors each.

## Available Themes

### 1. **default** - Default Tetra Colors
- **Author:** Tetra
- **Description:** Default Tetra color scheme
- **Style:** Balanced, professional
- **Use case:** General purpose, daily use

### 2. **tokyo-night** - Tokyo Night
- **Author:** Enkia (adapted for TDS)
- **Description:** Dark theme with vibrant colors inspired by Tokyo at night
- **Style:** Vibrant blues, purples, greens, warm reds
- **Use case:** Dark mode enthusiasts, modern aesthetic
- **Colors:**
  - ENV: Greens/cyans (#9ECE6A, #73DACA, ...)
  - MODE: Blues/purples (#7AA2F7, #2AC3DE, ...)
  - VERBS: Reds/oranges (#F7768E, #FF9E64, ...)
  - NOUNS: Purples/magentas (#BB9AF7, #9D7CD8, ...)

### 3. **neon** - Cyberpunk Neon
- **Author:** Tetra
- **Description:** High-contrast cyberpunk neon theme with electric colors
- **Style:** Pure saturated colors, maximum brightness
- **Use case:** High-contrast displays, cyberpunk aesthetic
- **Colors:**
  - ENV: Electric greens/cyans (#00FF00, #00FF88, ...)
  - MODE: Electric blues/purples (#0088FF, #00AAFF, ...)
  - VERBS: Hot pinks/oranges (#FF0044, #FF0088, ...)
  - NOUNS: Neon magentas/violets (#FF00FF, #FF88FF, ...)

## Quick Commands

### Switch Theme
```bash
# Switch to a different theme
tds_switch_theme "tokyo-night"
tds_switch_theme "neon"
tds_switch_theme "default"
```

### List Available Themes
```bash
# Show all available themes
tds_list_themes

# Output:
# Available TDS Themes:
#   ○ tokyo-night
#   ○ neon
#   ● default (active)
```

### Preview All Themes
```bash
# See all themes with color samples
tds_preview_themes

# Shows:
# - Theme name and description
# - Color palette hex codes
# - Live status badges and environment badges
```

### Compare Two Themes
```bash
# Compare themes side-by-side
tds_compare_themes "default" "tokyo-night"

# Output:
# default                        | tokyo-night
# ───────────────────────────────────────────
# ENV:  00AA00                   | ENV:  9ECE6A
# MODE: 0088FF                   | MODE: 7AA2F7
# ...
```

### Get Current Theme
```bash
# Print active theme name
tds_active_theme

# Output: default
```

### Theme Info
```bash
# Get detailed info about a theme
tds_theme_info "tokyo-night"

# Output:
# Theme: tokyo-night
# Name: Tokyo Night
# Author: Enkia (adapted for TDS)
# Description: Dark theme with vibrant colors...
# Palettes:
#   ENV_PRIMARY (8 colors)
#   MODE_PRIMARY (8 colors)
#   ...
```

## Setting Default Theme

### For Current Session
```bash
source bash/tds/tds.sh
tds_switch_theme "tokyo-night"
```

### Persistent (All Sessions)
Add to `~/.bashrc` or `~/tetra/tetra.sh`:
```bash
export TDS_ACTIVE_THEME="tokyo-night"
source ~/tetra/tetra.sh
```

## Interactive Demos

### Static Demo (All Features)
```bash
bash bash/tds/demo_tds.sh
```
Shows all TDS components with current theme.

### Interactive TUI Demo (Theme Switcher)
```bash
bash bash/tds/demo_tui.sh
```

**Controls:**
- `←` `→` - Cycle through themes (default ← → tokyo-night ← → neon)
- `1` - Overview (all features)
- `2` - Status indicators & badges
- `3` - Panel components
- `4` - Borders & layout
- `5` - Color tokens
- `r` - Refresh display
- `q` - Quit

## Using Themes in Your Code

### Automatic Theme Support
All TDS functions automatically use the active theme:

```bash
# These use current theme colors
tds_status success "Build succeeded"
tds_env_badge "prod"
tds_panel_success "Deploy" "Deployed to staging"
```

### Manual Color Access
Access theme palettes directly:

```bash
# After theme is loaded, palettes are available:
echo "${ENV_PRIMARY[0]}"    # First green color
echo "${MODE_PRIMARY[0]}"   # First blue color
echo "${VERBS_PRIMARY[0]}"  # First red/orange color
echo "${NOUNS_PRIMARY[0]}"  # First purple color
```

### Semantic Colors (Theme-Independent)
Use semantic color tokens for consistent meanings:

```bash
tds_color "success" "Operation succeeded"
tds_color "error" "Operation failed"
tds_color "warning" "Caution"
tds_color "info" "Information"
tds_color "pending" "In progress"

tds_env_badge "local"    # Cyan
tds_env_badge "dev"      # Green
tds_env_badge "staging"  # Yellow
tds_env_badge "prod"     # Red
```

## Creating Custom Themes

### 1. Create Theme File
Create `bash/tds/themes/my_theme.sh`:

```bash
#!/usr/bin/env bash

tds_load_theme_my_theme() {
    # Define 4 palettes (8 colors each)
    declare -ga ENV_PRIMARY=(
        "COLOR1" "COLOR2" "COLOR3" "COLOR4"
        "COLOR5" "COLOR6" "COLOR7" "COLOR8"
    )

    declare -ga MODE_PRIMARY=(
        "COLOR1" "COLOR2" "COLOR3" "COLOR4"
        "COLOR5" "COLOR6" "COLOR7" "COLOR8"
    )

    declare -ga VERBS_PRIMARY=(
        "COLOR1" "COLOR2" "COLOR3" "COLOR4"
        "COLOR5" "COLOR6" "COLOR7" "COLOR8"
    )

    declare -ga NOUNS_PRIMARY=(
        "COLOR1" "COLOR2" "COLOR3" "COLOR4"
        "COLOR5" "COLOR6" "COLOR7" "COLOR8"
    )

    # Generate complements (optional)
    if declare -f generate_complements >/dev/null 2>&1; then
        declare -ga ENV_COMPLEMENT MODE_COMPLEMENT
        declare -ga VERBS_COMPLEMENT NOUNS_COMPLEMENT

        generate_complements ENV_PRIMARY ENV_COMPLEMENT
        generate_complements MODE_PRIMARY MODE_COMPLEMENT
        generate_complements VERBS_PRIMARY VERBS_COMPLEMENT
        generate_complements NOUNS_PRIMARY NOUNS_COMPLEMENT
    fi

    # Theme metadata
    TDS_THEME_NAME="My Theme"
    TDS_THEME_DESCRIPTION="Custom theme description"

    return 0
}

export -f tds_load_theme_my_theme
```

### 2. Register Theme
In `bash/tds/tds.sh`, add:

```bash
source "$TDS_SRC/themes/my_theme.sh"
```

Or register dynamically:

```bash
source bash/tds/themes/my_theme.sh
tds_register_theme "my-theme" "tds_load_theme_my_theme"
```

### 3. Use Theme
```bash
tds_switch_theme "my-theme"
```

## Color Palette Guidelines

### ENV Palette (Environments)
Suggested progression: local → dev → staging → prod
- Index 0: Local development (cyan/teal)
- Index 1: Development server (green)
- Index 2: Staging environment (yellow/orange)
- Index 3: Production (red - caution!)

### MODE Palette (Modes/Operations)
Suggested: blues/purples for different operational modes
- Index 0: Primary mode (blue)
- Index 1: Secondary mode (darker blue)
- Index 2-7: Additional modes/states

### VERBS Palette (Actions/Warnings)
Suggested: warm colors (reds/oranges/yellows)
- Index 0: Errors, critical actions (red)
- Index 1: Warnings (orange)
- Index 2-7: Other action types

### NOUNS Palette (Entities/Objects)
Suggested: purples/magentas for data/entities
- Index 0: Primary entity type (purple)
- Index 1-7: Other entity types

## Troubleshooting

### Theme Not Loading
```bash
# Check if theme exists
tds_list_themes

# Check theme details
tds_theme_info "tokyo-night"

# Force reload TDS
source bash/tds/tds.sh
```

### Colors Not Changing
```bash
# Verify theme switch
tds_active_theme

# Check palette values
echo "${ENV_PRIMARY[0]}"

# Reload theme
tds_switch_theme "$(tds_active_theme)"
```

### Wrong Theme on Startup
```bash
# Check environment variable
echo "$TDS_ACTIVE_THEME"

# Unset and reload
unset TDS_ACTIVE_THEME
source bash/tds/tds.sh
```

## Best Practices

1. **Use semantic colors** instead of direct palette access for portability
2. **Set persistent theme** in shell config, not inline scripts
3. **Test themes** with `tds_preview_themes` before committing
4. **Document custom themes** with clear metadata
5. **Follow palette conventions** for consistent UX across themes

## Examples

### Check Current Theme Before Action
```bash
if [[ "$(tds_active_theme)" == "neon" ]]; then
    echo "High contrast mode active"
fi
```

### Temporary Theme Override
```bash
saved=$(tds_active_theme)
tds_switch_theme "tokyo-night" >/dev/null
# ... do something ...
tds_switch_theme "$saved" >/dev/null
```

### Theme-Specific Behavior
```bash
case "$(tds_active_theme)" in
    neon)
        INTENSITY="high"
        ;;
    tokyo-night)
        INTENSITY="medium"
        ;;
    *)
        INTENSITY="normal"
        ;;
esac
```

---

**For more information:**
- See `bash/tds/README.md` for TDS architecture
- Run `tds_preview_themes` to see all themes visually
- Run `bash bash/tds/demo_tui.sh` for interactive preview
