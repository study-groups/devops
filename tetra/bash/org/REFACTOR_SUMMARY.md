# Org REPL Refactoring Summary

**Date**: 2025-10-24
**Status**: ✅ Complete

## Problem

The bash/org REPL was broken and not following the proper Tetra module architecture:

- Had a monolithic `org_repl_tui.sh` file (1338 lines) that reimplemented TUI functionality
- Did not properly use `bash/repl`, `bash/tds`, and `bash/tui` components
- Violated the modular design pattern established by other modules (e.g., pulsar)

## Solution

Refactored `org_repl.sh` to follow the proper architecture pattern:

### Before
- `org_repl.sh`: 197 lines (incomplete, delegated to org_repl_tui.sh)
- `org_repl_tui.sh`: 1338 lines (monolithic, custom TUI implementation)
- **Total**: 1535 lines

### After
- `org_repl.sh`: 298 lines (complete, self-contained)
- `org_repl_tui.sh`: **ARCHIVED** ✅
- **Total**: 298 lines (-80% reduction)

## Architecture

The refactored org REPL now properly follows the Tetra module pattern:

```
bash/org/org_repl.sh
├── Sources bash/repl/repl.sh       (Universal REPL system)
├── Sources bash/color/repl_colors.sh (Color system)
├── Sources bash/tds components      (Display system: borders, layout)
├── Implements repl_build_prompt()   (Custom prompt builder)
├── Implements repl_process_input()  (Custom input processor)
└── Calls repl_run()                 (Main REPL loop)
```

### Key Components

1. **State Management** (lines 32-36)
   - Environment, mode, and action indices
   - Follows ORG_ENVIRONMENTS and ORG_MODES from org_constants.sh

2. **Navigation** (lines 55-77)
   - Ctrl+E: Cycle environment
   - Ctrl+R: Cycle mode
   - Ctrl+A: Cycle action

3. **Prompt Builder** (lines 83-111)
   - Uses color system for visual clarity
   - Shows: [org] env × mode → action ▶
   - Supports both custom and fallback rendering

4. **Input Processor** (lines 117-193)
   - Handles verb:noun action format
   - Shell commands (!command)
   - Built-in commands (help, actions, status, list)
   - Exit handling

5. **Main Entry Point** (lines 255-286)
   - Banner display with org branding
   - Keybinding setup
   - Callback override pattern
   - Clean shutdown

## Benefits

✅ **Modular**: Properly uses bash/{repl,tds,color}
✅ **Maintainable**: 80% less code, clearer structure
✅ **Consistent**: Follows same pattern as pulsar_repl.sh
✅ **Extensible**: Easy to add features via bash/repl hooks
✅ **Compatible**: Works with existing org commands and actions

## Testing

```bash
# Load and test
source ~/tetra/tetra.sh
tmod load org
org repl

# Should display:
# 🏢 ORG REPL v2.0
# Active organization: [current_org]
# Type 'help' for commands, /env /mode /action to navigate
```

## Full Takeover Mode (v2.1)

**Architecture Clarification**: The org REPL operates in **full takeover mode**, not mixed CLI mode.

### REPL Mode Types

bash/repl has two independent mode systems:

1. **Input Modes** (how input is read):
   - `basic` - Simple `read -r -p`
   - `enhanced` - `tcurses_input_read_line` (colors, history) ← **org uses this**
   - `tui` - Full-screen buffer

2. **Execution Modes** (how commands are interpreted):
   - `augment` - Shell by default, module commands need `/` prefix
   - `takeover` - Module commands by default, shell needs `!` prefix ← **org uses this**

### Navigation Commands

In takeover mode, commands are executed **without `/` prefix**:

| Command | Alias | Function |
|---------|-------|----------|
| `env` | `e` | Cycle environment (Local→Dev→Staging→Production) |
| `mode` | `m` | Cycle mode (Inspect→Transfer→Execute) |
| `action` | `a` | Cycle action |
| `next` | `n` | Cycle to next (action→mode→env) |

Commands return status code `2` to signal the REPL loop to refresh the prompt.

### TDS Theme Integration

The prompt now uses **bash/tds theme palette tokens**:

- `repl.prompt.bracket` - Colored `[]` brackets around org name
- `repl.exec.repl` - Green indicator for takeover mode (⚡)
- `repl.env.{local|dev|staging|production}` - Environment-specific colors
- `repl.mode.{inspect|transfer|execute}` - Mode-specific colors
- `repl.action.primary` - Action color
- `repl.prompt.arrow` - Prompt arrow `▶`

Example prompt:
```
[pixeljam-arcade] local × inspect → view:toml ▶
└─ bracket ─┘   └ env ┘ └ mode ┘ └─ action ──┘ └arrow┘
```

### Why Not bind -x?

Initial attempt used `bind -x '"\C-e": _org_cycle_env'` but:
- `bind -x` only works in parent shell, not inside `read -e`
- bash/repl uses `read -e` (enhanced mode) = new readline context
- Ctrl+E is a default readline binding (move to end of line)
- From bash/repl/README.md: "`bind -x` callbacks **can't refresh the prompt mid-input**"

**Solution**: Plain commands in takeover mode (no keybindings, no `/` prefix).

## Files Changed

- ✏️ `bash/org/org_repl.sh` - Completely refactored
- 📦 `bash/org/org_repl_tui.sh` - Archived to `bash/org/archive/pre_refactor_20251024/`
- ✅ `bash/org/includes.sh` - No changes needed (already clean)

## Migration Notes

- Old TUI-specific functions archived (not removed) for reference
- Demo files (`demo_navigation.sh`, `test_navigation.sh`) may reference old functions
  - These are test files and can be updated or removed as needed
- No breaking changes to public API (`org repl` command still works)

## Next Steps (Optional)

1. Update demo/test files to use new REPL pattern
2. Add more sophisticated help system (topic-based)
3. Consider adding bash/tui components for richer UI (when bash/tui is implemented)
4. Add REPL plugins/extensions via repl_register_command()

## References

- **Pattern Reference**: `bash/game/games/pulsar/pulsar_repl.sh`
- **REPL System**: `bash/repl/repl.sh`
- **Display System**: `bash/tds/tds.sh`
- **Color System**: `bash/color/repl_colors.sh`
