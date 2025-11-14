# TDOCS Color Tokens Reference

## Overview

TDOCS uses a comprehensive design token system for consistent, semantic color usage across all UI elements. All tokens use **foreground-only** colors (no background colors are applied).

## Token Categories

### 1. Scope Tokens (ENV Palette - Green)
Application reach and context.

```
tdocs.scope             → env:0 (default)
tdocs.scope.system      → env:0
tdocs.scope.module      → env:0
tdocs.scope.feature     → env:0
tdocs.scope.temporal    → env:0
```

### 2. Type Tokens (MODE Palette - Blue, with exceptions)
Document type classification.

```
tdocs.type              → mode:0 (default)
tdocs.type.spec         → mode:0 (blue)
tdocs.type.guide        → mode:0 (blue)
tdocs.type.investigation → mode:0 (blue)
tdocs.type.reference    → mode:0 (blue)
tdocs.type.plan         → mode:0 (blue) ✓
tdocs.type.summary      → mode:0 (blue)
tdocs.type.scratch      → mode:0 (blue)
tdocs.type.bug-fix      → verbs:0 (red) ★
tdocs.type.refactor     → verbs:3 (orange) ★
tdocs.type.tdocs        → mode:0 (blue)
```

**Note:** `bug-fix` and `refactor` use VERBS palette for visual distinction.

### 3. Module Tokens (VERBS Palette - Red/Orange)
Module ownership identification.

```
tdocs.module            → verbs:0
```

### 4. Grade Tokens (NOUNS Palette - Purple)
Reliability and authority level.

```
tdocs.grade             → nouns:0 (default)
tdocs.grade.A           → nouns:0 (Canonical)
tdocs.grade.B           → nouns:0 (Established)
tdocs.grade.C           → nouns:0 (Working)
tdocs.grade.X           → nouns:0 (Ephemeral)
```

### 5. Lifecycle Tokens (Mixed Palettes)
Document lifecycle stage with distinct colors per stage.

```
tdocs.lifecycle.C       → nouns:0 (purple - Canonical)
tdocs.lifecycle.S       → mode:0 (blue - Stable)
tdocs.lifecycle.W       → verbs:3 (orange - Working)
tdocs.lifecycle.D       → env:6 (gray - Draft)
tdocs.lifecycle.X       → verbs:0 (red - Archived)
```

### 6. List Display Tokens
UI elements in list views.

```
tdocs.list.path         → mode:7 (light text)
tdocs.list.count        → mode:6 (medium text)
tdocs.list.separator    → env:6 (subtle text)
```

### 7. Completeness Level Tokens
Documentation completeness indicators.

```
tdocs.level.0           → verbs:0 (red - no docs)
tdocs.level.1           → verbs:3 (orange - minimal)
tdocs.level.2           → env:2 (yellow-green - working)
tdocs.level.3           → mode:0 (blue - complete)
tdocs.level.4           → env:1 (green - exemplar)
```

### 8. REPL Prompt Tokens
Interactive prompt elements.

```
tdocs.prompt.bracket        → env:6 (gray [ ])
tdocs.prompt.paren          → mode:6 (gray ( ))
tdocs.prompt.arrow          → verbs:3 (orange >)
tdocs.prompt.arrow.pipe     → mode:6 (gray →)
tdocs.prompt.separator      → env:1 (green |)
tdocs.prompt.label          → mode:0 (blue)
tdocs.prompt.count          → nouns:3 (purple/magenta)
tdocs.prompt.filter.all     → env:1 (green "all")
tdocs.prompt.filter.core    → mode:0 (blue)
tdocs.prompt.filter.other   → verbs:3 (orange)
tdocs.prompt.module         → mode:6 (gray)
tdocs.prompt.topic1         → mode:0 (blue)
tdocs.prompt.topic2         → verbs:3 (orange)
tdocs.prompt.level          → env:1 (green)
tdocs.prompt.temporal       → verbs:1 (light orange)
tdocs.prompt.state          → nouns:3 (purple)
```

## Viewing Colors

### In REPL
```bash
# Start TDOCS REPL
tdocs

# View all color tokens with live rendering
/colors tokens
```

### Direct Command
```bash
# Run color viewer script
./ui/color_viewer.sh

# Or via color explorer
tdocs_color_explorer tokens
```

### Other Color Commands
```bash
/colors convert         # Show 24-bit to 256-color conversion
/colors assignments     # Show palette assignments
/colors pattern type    # Show 8-color pattern for category
/colors 256             # Show all 256 ANSI colors
/colors help            # Show full help
```

## Design Principles

1. **Foreground Only**: All tokens apply foreground colors only (never background)
2. **Semantic Meaning**: Each palette has semantic meaning:
   - ENV (green) = Environmental/scope concepts
   - MODE (blue) = Type/classification concepts
   - VERBS (red/orange) = Actions/module ownership
   - NOUNS (purple) = Authority/reliability
3. **Consistent Visual Grammar**: Most categories use single color (palette[0]) for simplicity
4. **Exceptions for Clarity**: Lifecycle and some types use varied colors for distinction

## Recent Fixes (2025-11-12)

- Added missing `tdocs.lifecycle.*` tokens (C/S/W/D/X)
- Added missing type tokens (`bug-fix`, `refactor`, `tdocs`)
- All tokens verified to use foreground-only colors
- Created comprehensive color viewer tool
- Integrated viewer into REPL `/colors` command

## Files

- Token definitions: `ui/tdocs_tokens.sh`
- Color viewer: `ui/color_viewer.sh`
- Color explorer: `ui/color_explorer.sh`
- Tag rendering: `ui/tags.sh`
- REPL commands: `tdocs_commands.sh`
