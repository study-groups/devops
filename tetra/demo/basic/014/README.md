# Demo 014: Harmonized TUI + Typed Actions

Combines the best features from demos 010 and 013:

## From Demo 010 (TUI Framework)

**Color System** (`bash/tui/colors/`):
- Distance-based verb×noun coloring
- Cached color computation (`HEX_TO_256_CACHE`)
- `render_action_verb_noun()` with semantic colors

**Typography** (`bash/tui/typography.sh`):
- TES operators: `::` `→` `×` `@`
- Design tokens for consistent UI

## From Demo 013 (Typed Actions)

**Action Registry** (`bash/actions/registry.sh`):
- Typed action declarations
- TES metadata (tes_level, tes_target, tes_operation)
- `declare_action()` helper

**State Machine** (`bash/actions/state.sh`):
- States: idle, executing, success, error
- State symbols: ○ ▶ ✓ ✗
- TES lifecycle helpers

**Execution** (`bash/actions/executor.sh`):
- Unified tetra.jsonl logging
- Observer pattern (buffer updates only)
- Timing and error tracking

## Structure

```
demo/basic/014/
├── demo.sh              # Main entry point
├── tui.conf             # Configuration
├── bash/
│   ├── tui/
│   │   ├── colors/
│   │   │   └── color_core.sh    # Distance-based colors
│   │   └── typography.sh        # TES operators
│   └── actions/
│       ├── registry.sh          # Action declarations
│       ├── state.sh             # State machine
│       ├── router.sh            # Output routing
│       ├── executor.sh          # Execution + logging
│       └── actions_impl.sh      # Implementation logic
└── README.md
```

## Running

```bash
./demo/basic/014/demo.sh
```

## Navigation

- `e` - Cycle environment (APP/DEV)
- `d` - Cycle mode (Learn/Try/Test)
- `f` - Cycle action
- `Enter` - Execute current action
- `r` - Show routing table
- `l` - Show execution log
- `c` - Clear content
- `q` - Quit

## Features

### Colorized Actions
Each verb×noun pair gets unique colors based on string distance:
- `show×demo` - computed colors
- `view×toml` - different colors
- Cached for performance

### State Machine
Actions transition through states:
- `○ idle` - Ready to execute
- `▶ executing` - Running
- `✓ success` - Completed successfully
- `✗ error` - Failed (press Enter to clear)

### Unified Logging
All actions logged to `$TETRA_DIR/logs/tetra.jsonl`:
```json
{"timestamp":"2025-10-12T19:30:00Z","module":"demo014","verb":"show","subject":"demo","status":"success","exec_at":"@local","metadata":{"duration_ms":23}}
```

### Typed Actions
Actions declare routing and TES metadata:
```bash
declare_action "show_demo" \
    "verb=show" \
    "noun=demo" \
    "output=@tui[content]" \
    "immediate=true"
```

## Key Concepts Salvaged

**010 Concepts**:
- Distance-based color computation
- Color caching system
- Typography and operators
- Component-based thinking

**013 Concepts**:
- Typed action registry
- TES metadata structure
- State machine pattern
- Unified logging format
- Observer pattern for updates

## What's Different

- Simplified: No double-buffering (future enhancement)
- Focused: Core action execution with colors
- Clean separation: TUI vs Actions vs State
- Production-ready patterns for tetra core
