# Module Usage Audit for Game REPL Help System

## Current Module Infrastructure

### bash/repl (Universal REPL System)
**Location:** `$TETRA_SRC/bash/repl`

**Components:**
- `repl.sh` - Main entry point, REPL loop, mode detection
- `core/mode.sh` - Execution mode management
- `core/input.sh` - Input handling
- `core/loop.sh` - Main REPL loop
- `prompt_manager.sh` - Prompt building system
- `symbol_parser.sh` - Command parsing
- `command_processor.sh` - Command execution
- `adapters/symbol_ui.sh` - UI adapters

**State Variables:**
- `REPL_MODE` - basic/enhanced/tui
- `REPL_HISTORY_BASE` - History file base path
- `REPL_PROMPT_BUILDERS` - Array of prompt builder functions
- `REPL_SLASH_COMMANDS` - Registered slash commands
- `REPL_SLASH_HANDLERS` - Command → handler mapping

**What We Should Use:**
- ✅ `repl_run()` - Main REPL entry
- ✅ `REPL_PROMPT_BUILDERS` - For custom prompt
- ✅ `REPL_HISTORY_BASE` - For history management
- ❌ Currently NOT using the universal command processor

### bash/color (Color System)
**Location:** `$TETRA_SRC/bash/color`

**Components:**
- `color_core.sh` - Core color functions (hex_to_256, text_color, etc.)
- `repl_colors.sh` - REPL-specific color constants
- `color_palettes.sh` - Color palette definitions
- `color_themes.sh` - Theme management

**Available:**
- `text_color(hex)` - Apply foreground color
- `bg_only(hex)` - Apply background color
- `reset_color()` - Reset colors
- `theme_aware_dim(hex, level)` - Dim colors toward background
- Simple color variables (no associative arrays, export-safe)

**REPL Color Constants:**
```bash
REPL_ENV_LOCAL, REPL_ENV_DEV, REPL_ENV_STAGING, REPL_ENV_PRODUCTION
REPL_MODE_INSPECT, REPL_MODE_TRANSFER, REPL_MODE_EXECUTE
REPL_ACTION_ACTIVE, REPL_ACTION_NONE
REPL_BRACKET, REPL_SEPARATOR, REPL_ARROW
```

**What We Should Use:**
- ✅ `text_color()` and `reset_color()` - Already using
- ✅ `theme_aware_dim()` - Already using
- ⚠️  Should consider using REPL color constants instead of TDS tokens

### bash/tds (Tetra Display System)
**Location:** `$TETRA_SRC/bash/tds`

**Components:**
- `tds.sh` - Main entry point
- `core/ansi.sh` - ANSI-aware width calculation
- `core/semantic_colors.sh` - Semantic color tokens
- `layout/borders.sh` - Border rendering
- `layout/spacing.sh` - Spacing utilities
- `tokens/repl_tokens.sh` - REPL token mappings
- `semantics/repl_ui.sh` - REPL UI rendering functions
- `renderers/markdown.sh` - Markdown rendering
- `components/panels.sh` - Pre-built panels

**Border Functions:**
- `tds_border_top(width, style)` - Top border
- `tds_border_bottom(width, style)` - Bottom border
- `tds_border_line(content, width, align, style)` - Bordered line with ANSI-aware centering
- `tds_panel_header(title, width, style)` - Complete panel header
- `tds_hr(width, char)` - Horizontal rule

**REPL UI Functions:**
- `tds_repl_render_env(env, index)` - Render environment indicator
- `tds_repl_render_mode(mode, index)` - Render mode indicator
- `tds_repl_render_action(action)` - Render action indicator
- `tds_repl_build_prompt(org, env, env_idx, mode, mode_idx, action)` - Full prompt

**What We Should Use:**
- ✅ `tds_border_*()` - Already using for borders
- ✅ `tds_visual_width()`, `tds_pad()` - ANSI-aware alignment
- ⚠️  Semantic colors use associative arrays (not export-safe)
- ⚠️  Consider for help rendering but avoid associative array issues

### bash/tui (Terminal UI)
**Location:** `$TETRA_SRC/bash/tui`

**Status:** Empty directory structure (core/, events/, view/)
- Not currently implemented
- Reserved for future TUI components

## Current Game REPL Implementation

### What We're Using ✅
1. **bash/repl** - `repl.sh` for basic REPL structure
2. **bash/color** - `repl_colors.sh` for color constants
3. **bash/tds** - Border functions for aligned boxes
4. **Game-specific** - `core/pulsar.sh` for engine protocol

### What We Added 🆕
1. **core/pulsar_help.sh** - Narrow/deep help tree
2. **core/pulsar_repl.sh** - REPL integration with help

### Issues to Fix ⚠️

#### 1. Color System Conflict
**Problem:** Using both `bash/color/repl_colors.sh` AND `bash/tds` semantic colors
- `repl_colors.sh` uses simple variables (export-safe)
- TDS uses associative arrays (NOT export-safe)
- Help system currently uses TDS semantic colors

**Solution:** Stick to `bash/color` system
```bash
# Instead of:
local hex=$(tds_semantic_color "content.heading.h1")

# Use:
local hex="$REPL_MODE_INSPECT"  # Or define help-specific colors
```

#### 2. Not Using REPL Command Processor
**Problem:** Help command handled manually in input processor
- bash/repl has `REPL_SLASH_HANDLERS` for command routing
- We're doing ad-hoc pattern matching instead

**Solution:** Register help as a slash command
```bash
REPL_SLASH_COMMANDS+=("help")
REPL_SLASH_HANDLERS[help]="pulsar_help"
```

#### 3. Prompt Building
**Problem:** Manual prompt building in `_pulsar_repl_build_prompt()`
- Could leverage `repl_build_org_prompt()` from `repl_colors.sh`
- Or use `tds_repl_build_prompt()` if appropriate

**Solution:** Use existing prompt builders or keep custom (game-specific is OK)

## Refactoring Recommendations

### Priority 1: Fix Color System
Replace TDS semantic colors with simple color variables:

```bash
# Define in core/pulsar_help.sh or use existing REPL colors
HELP_TITLE_COLOR="66FFFF"        # Cyan
HELP_SECTION_COLOR="8888FF"      # Purple
HELP_COMMAND_COLOR="FFAA00"      # Orange
HELP_TEXT_COLOR="FFFFFF"         # White
HELP_DIM_COLOR="888888"          # Gray
HELP_MUTED_COLOR="666666"        # Dark gray
```

### Priority 2: Keep TDS Borders
TDS borders are perfect for ANSI-aware alignment:
- ✅ Keep `tds_border_top()`, `tds_border_bottom()`, `tds_border_line()`
- ✅ Keep `tds_visual_width()`, `tds_pad()` for layout

### Priority 3: Consider REPL Integration
Optional enhancement - register help as proper slash command:
```bash
# In pulsar_repl_run()
REPL_SLASH_HANDLERS[help]="pulsar_help"
REPL_SLASH_HANDLERS[h]="pulsar_help"
```

## Module Dependency Chart

```
game/core/pulsar_repl.sh
├── bash/repl/repl.sh ✅
│   ├── bash/color/color_core.sh ✅
│   └── bash/tcurses/tcurses_input.sh ✅
├── bash/color/repl_colors.sh ✅
├── bash/tds/tds.sh ⚠️ (use borders only)
│   ├── bash/tds/core/ansi.sh ✅
│   ├── bash/tds/layout/borders.sh ✅
│   └── bash/tds/core/semantic_colors.sh ❌ (avoid)
└── game/core/pulsar_help.sh 🆕
    ├── Should use bash/color, not TDS semantic colors
    └── Can use TDS borders for layout
```

## Action Items

1. **Refactor pulsar_help.sh color helpers**
   - Remove TDS semantic color usage
   - Use simple hex color variables
   - Keep `text_color()` and `reset_color()` from color_core.sh

2. **Document color choices**
   - Define help-specific color constants
   - Align with existing REPL color scheme
   - Use `theme_aware_dim()` for dimming

3. **Keep borders**
   - TDS borders work great
   - ANSI-aware alignment is critical
   - No changes needed here

4. **Optional: Register slash commands**
   - Use REPL_SLASH_HANDLERS if desired
   - Not critical, current approach works

## Summary

**Good:**
- ✅ Using bash/repl for REPL structure
- ✅ Using bash/color for color functions
- ✅ Using TDS borders for alignment
- ✅ Help system is well-designed (narrow/deep)

**Needs Fix:**
- ⚠️  Stop using TDS semantic colors (associative array issues)
- ⚠️  Use simple color variables from bash/color instead
- ⚠️  Consider registering help as slash command

**Best Approach:**
Keep the current help system design, just swap out the color implementation to use simple variables instead of TDS tokens.
