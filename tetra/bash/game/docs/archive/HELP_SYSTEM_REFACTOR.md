# Pulsar REPL Help System Refactor

## Overview

Refactored the game REPL help system from a flat, monolithic help screen into a **narrow and deep** hierarchical help tree with TDS color integration.

## What Changed

### Before (Flat Structure)
- Single massive help screen with 50+ items
- All information at once
- No hierarchy or progressive disclosure
- Basic monochrome output

### After (Narrow & Deep)
- **6 top-level topics** (narrow)
- Each topic has comprehensive focused help (deep)
- Progressive disclosure: quick actions first, details on demand
- Full TDS color integration with dim/brightness hierarchy
- Cross-referenced topics for navigation

## File Structure

```
bash/game/core/
├── pulsar_help.sh         # NEW: Modular help system
└── pulsar_repl.sh         # MODIFIED: Delegates to help system
```

## Help Tree Structure

```
help (main)
├── Quick Actions (hello, trinity, start)
└── Help Topics
    ├── help engine    → Engine control (start, stop, status)
    ├── help sprite    → Sprite management (spawn, set, kill)
    ├── help preset    → Quick demos (hello, trinity, dance)
    ├── help script    → Script loading (.pql files)
    ├── help protocol  → Raw Engine Protocol commands
    └── help params    → Parameter reference guide
```

## Color Hierarchy (TDS Integration)

The help system uses TDS color palettes with theme-aware dimming:

| Element | Palette | ANSI | Brightness | Purpose |
|---------|---------|------|------------|---------|
| Title | `ENV_PRIMARY[3]` | 120 cyan | Brightest | Main headings |
| Sections | `MODE_PRIMARY[2]` | 55 purple | Bright | Major sections |
| Subsections | `MODE_PRIMARY[0]` | 33 cyan | Medium | Subsections |
| Commands | `VERBS_PRIMARY[2]` | 130 orange | Bright | Command names |
| Text | `MODE_PRIMARY[7]` | 103 gray | Normal | Primary text |
| Dim | `MODE_PRIMARY[6]` + dim(2) | 103 gray | Dimmed | Secondary info |
| Muted | `MODE_PRIMARY[5]` + dim(3) | 60 gray | Very dim | Tertiary/hints |

### Theme-Aware Dimming

Uses `theme_aware_dim()` from `color_core.sh`:
- Level 0 = full color
- Level 2 = slightly dimmed (secondary text)
- Level 3 = more dimmed (muted hints)
- Level 7 = merged with background

## Usage Examples

```bash
# Top-level help (narrow)
help              # Shows 6 topics + quick actions

# Deep dive into topics
help engine       # All engine commands
help sprite       # All sprite management
help params       # Complete parameter reference

# Alternative syntax
h engine          # Short form
? sprite          # Question mark works too
```

## Key Features

### 1. Narrow Top Level
Only 6 top-level topics instead of overwhelming users with 50+ items at once.

### 2. Deep Topic Pages
Each topic provides comprehensive focused help:
- **engine**: start, stop, restart, status, states
- **sprite**: spawn, set, kill, list, properties
- **preset**: hello, trinity, dance with examples
- **script**: load command, .pql format, behavior
- **protocol**: raw commands, INIT, SPAWN_PULSAR, SET, KILL
- **params**: Complete parameter reference with ranges and examples

### 3. Progressive Disclosure
```
Main help → Quick actions first
         └→ Topics on demand
              └→ Detailed help within topic
```

### 4. Cross-References
Topics link to related help pages:
- `help engine` → "See also: 'help sprite'"
- `help sprite` → "See also: 'help params'"
- `help script` → "See also: 'help protocol'"

### 5. Visual Hierarchy
Three levels of brightness create clear information hierarchy:
- **Bright**: Commands and headings stand out
- **Normal**: Primary readable text
- **Dim**: Supporting details and hints

## Implementation Details

### Color Helper Functions

```bash
_help_title()      # Cyan - main titles (ENV_PRIMARY[3])
_help_section()    # Purple - major sections (MODE_PRIMARY[2])
_help_subsection() # Blue - subsections (MODE_PRIMARY[0])
_help_command()    # Orange - command names (VERBS_PRIMARY[2])
_help_text()       # White - primary text (MODE_PRIMARY[7])
_help_dim()        # Gray dimmed - secondary (MODE_PRIMARY[6] + dim(2))
_help_muted()      # Dark gray - tertiary (MODE_PRIMARY[5] + dim(3))
```

### Help Dispatcher

The `pulsar_help()` function routes topics to specific help functions:

```bash
pulsar_help()
├── main|"" → pulsar_help_main()
├── engine|start|stop|status → pulsar_help_engine()
├── sprite|spawn|set|kill → pulsar_help_sprite()
├── preset|hello|trinity → pulsar_help_preset()
├── script|load|pql → pulsar_help_script()
├── protocol|raw|commands → pulsar_help_protocol()
└── param|params|parameter → pulsar_help_params()
```

### REPL Integration

Updated `core/pulsar_repl.sh`:
1. Sources `pulsar_help.sh`
2. Delegates `help` command to `pulsar_help()`
3. Supports `help <topic>` syntax via input processor

## Testing

Test scripts included:
- `test_help.sh` - Comprehensive test of all help topics
- `test_help_navigation.sh` - Demo of narrow/deep navigation

Run tests:
```bash
./test_help.sh               # Test all topics
./test_help_navigation.sh    # Visual demo
```

## Benefits

1. **Cognitive Load**: Users see 6 topics instead of 50+ items
2. **Discoverability**: Clear topic categories make features easy to find
3. **Depth**: Each topic provides complete information
4. **Visual Clarity**: Color hierarchy guides attention
5. **Navigation**: Cross-references help users explore related topics
6. **Maintainability**: Modular structure makes updates easy

## Alignment with CLAUDE.md

This refactor follows the global preferences:
- Uses `TETRA_SRC` as a strong global
- Integrates with TDS (`bash/tds`) for colors
- Bash 5.2 compatible
- Follows tetra module structure

## Future Enhancements

Potential additions:
- Breadcrumb navigation for multi-level help
- Search within help topics
- Interactive examples that execute commands
- Context-sensitive help based on engine state
