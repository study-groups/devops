# Tetra Mode-Module-REPL Refactor - COMPLETE

## Summary

Successfully refactored the TDS temperature theme system to fix color phase-shifts and implement proper lazy loading architecture.

## Issues Fixed

### 1. ✅ Bug Mode References Removed
**File**: `bash/tetra/interfaces/tui.sh:349`
- Removed `u=bug` from footer help text
- Bug mode remains accessible via `u` key (easter egg preserved)

### 2. ✅ Color Phase-Shifts Now Working
**Root Causes**:
- Temperature themes used non-existent `TDS_COLORS[]` array
- Missing `repl.prompt` token in token system
- Themes didn't define required palette arrays

**Fixes**:
- All 4 temperature themes now properly define `ENV_PRIMARY`, `MODE_PRIMARY`, `VERBS_PRIMARY`, `NOUNS_PRIMARY` arrays
- Added `repl.prompt` and `marker.primary` tokens to token system
- Colors now change correctly during phase-shifts

**Verified Colors**:
- warm (org): `#ea580c` - Deep orange 🟠
- cool (logs): `#3b82f6` - Deep blue 🔵
- neutral (tsm): `#10b981` - Deep green 🟢
- electric (deploy): `#d946ef` - Deep fuchsia 🟣

### 3. ✅ Lazy Loading Implemented
**Problem**: Themes were eagerly loaded 3x during boot (registration spam)

**Root Cause Analysis**:
1. `tds.sh` sourced all temperature themes → 4 registrations
2. `tui.sh` sourced `temperature_loader.sh` → `repl_init_temperatures()` re-sourced themes → 4 more
3. `mode_repl.sh` sourced `temperature_loader.sh` again → 4 more
4. **Total**: 12 "Registered theme" messages!

**Solution**:
- Temperature themes now registered WITHOUT sourcing via `tds_register_lazy_theme()`
- `tds_switch_theme()` lazy-loads theme file only when first needed
- `repl_init_temperatures()` checks if themes already registered before sourcing
- Source guard added to prevent re-sourcing

**Result**: Zero registration spam on boot, themes load on-demand

## New Architecture Components

### 1. Theme Stack System
**File**: `bash/tds/core/theme_stack.sh`

Manages hierarchical theme switching:
```bash
TUI (system theme: default)
  └─> REPL enters → push "warm" onto stack
        └─> REPL exits → pop stack, restore "default"
```

**Key Functions**:
- `tds_push_theme()` - Save current, switch to new
- `tds_pop_theme()` - Restore previous theme
- `repl_enter_with_temperature()` - REPL-specific entry
- `repl_exit_restore_theme()` - REPL-specific exit

### 2. Theme Validation
**File**: `bash/tds/core/theme_validation.sh`

Validates themes before activation:
- All 4 palette arrays defined
- Each palette has exactly 8 colors
- All colors are valid hex (#RRGGBB)

**Functions**:
- `tds_validate_palette()`
- `tds_validate_theme()`
- `tds_show_theme_validation()`

### 3. Token Validation
**File**: `bash/tds/core/token_validation.sh`

Validates required tokens exist:
- `repl.prompt`, `content.dim`, `marker.primary`, etc.
- Checks token → palette references are valid
- Reports missing tokens

**Functions**:
- `tds_validate_token()`
- `tds_validate_all_tokens()`
- `tds_show_token_validation()`

### 4. Palette Visualization Tool
**File**: `bash/tds/tools/show_palette.sh`

Shows exact colors for each theme:
```bash
./show_palette.sh warm cool neutral electric
```

Displays:
- All 4 palette arrays with hex colors
- RGB color swatches
- Key token resolutions

## Files Modified

### Core TDS
- `bash/tds/tds.sh` - Added validation modules, removed eager theme loading
- `bash/tds/themes/theme_registry.sh` - Added lazy loading logic, registration spam fix
- `bash/tds/tokens/color_tokens.sh` - Added `marker.primary` and `marker.active` tokens
- `bash/tds/tokens/repl_tokens.sh` - Added `repl.prompt` token

### Temperature Themes
- `bash/tds/themes/warm.sh` - Added palette arrays, source guard
- `bash/tds/themes/cool.sh` - Added palette arrays
- `bash/tds/themes/neutral.sh` - Added palette arrays
- `bash/tds/themes/electric.sh` - Added palette arrays

### REPL System
- `bash/repl/temperature_loader.sh` - Integrated theme stack, added lazy loading check
- `bash/tetra/interfaces/tui.sh` - Removed bug mode reference from footer

## New Files Created
1. `bash/tds/core/theme_stack.sh` - Theme hierarchy management
2. `bash/tds/core/theme_validation.sh` - Theme validation
3. `bash/tds/core/token_validation.sh` - Token validation
4. `bash/tds/tools/show_palette.sh` - Palette visualization

## Performance Impact

**Before**:
- Boot: 12 theme registrations (eager loading)
- Memory: All themes loaded regardless of use
- Messages: Spam during initialization

**After**:
- Boot: 0 theme registrations (lazy loading)
- Memory: Themes loaded only when REPLs need them
- Messages: Clean boot, only intentional messages

## Testing

```bash
# Test lazy loading
source ~/tetra/tetra.sh  # Should be silent

# Test phase-shifts
tds_switch_theme warm    # Loads on-demand
tds_switch_theme cool    # Different color!

# Visualize palettes
bash/tds/tools/show_palette.sh warm cool neutral electric

# Validate themes
source bash/tds/core/theme_validation.sh
tds_show_theme_validation warm

# Validate tokens
source bash/tds/core/token_validation.sh
tds_show_token_validation
```

## Architecture Patterns Established

### 1. Lazy Registration Pattern
```bash
# Register without sourcing
tds_register_lazy_theme "theme_name" "loader_fn" "description"

# Lazy load on first switch
tds_switch_theme "theme_name"  # Sources file now
```

### 2. Source Guard Pattern
```bash
# At top of every theme file
[[ "${__TDS_THEME_NAME_LOADED:-}" == "true" ]] && return 0
__TDS_THEME_NAME_LOADED=true
```

### 3. Theme Stack Pattern
```bash
# REPL entry
repl_enter_with_temperature "module" "temperature"

# REPL exit
repl_exit_restore_theme
```

## Future Improvements

1. **Auto-create missing tokens** - Helper to generate sensible defaults
2. **Theme hot-reload** - Update themes without restarting
3. **Theme inheritance** - Base theme + temperature overlay
4. **Color interpolation** - Smooth color transitions during phase-shifts

## Lessons Learned

1. **Eager loading kills performance** - Lazy loading is essential for modular systems
2. **Source guards prevent chaos** - Every sourceable file needs a guard
3. **Token systems need validation** - Missing tokens fail silently, very hard to debug
4. **Debugging tools are essential** - `show_palette.sh` made color issues visible
5. **Self-documenting code** - Using tools like tbash/self helps find architectural issues

---

**Status**: ✅ Production-ready
**Date**: 2025-11-02
**Systems**: TDS, Mode-Module-REPL, Theme Stack
