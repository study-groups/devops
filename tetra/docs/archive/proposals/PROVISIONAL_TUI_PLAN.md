# PROVISIONAL TUI PLAN

**Status**: Provisional - Under Discussion
**Created**: 2025-10-17
**Context**: Canonical TUI architecture proposal combining Demo/010 patterns + TCurses primitives

## Overview

This document outlines a proposed canonical TUI (Terminal User Interface) architecture that consolidates patterns from existing implementations (Demo/010, TCurses, TView) into a cohesive system.

## Three-Tier Separation

```
┌─────────────────────────────────────────┐
│  REPL Layer (bash/utils/repl_utils.sh) │  ← User interaction
│  - Input parsing                        │
│  - Command dispatch                     │
│  - History management                   │
└──────────────────┬──────────────────────┘
                   │
                   ↓ Hands transaction to TTM
┌─────────────────────────────────────────┐
│  TTM - Tetra Transaction Manager (NEW)  │  ← Transaction orchestration
│  - Begin transaction                    │
│  - TES progressive resolution           │
│  - Action lifecycle (7-state FSM)       │
│  - Flow orchestration                   │
│  - Checkpoint/rollback                  │
│  - Commit/abort                         │
│  - Event publishing                     │
└──────────────────┬──────────────────────┘
                   │
                   ↓ Updates view via pubsub
┌─────────────────────────────────────────┐
│  TUI Layer (bash/tui/)                  │  ← Visual rendering
│  - Subscribe to TTM events              │
│  - Screen management (TCurses)          │
│  - Component rendering                  │
│  - Animation & timing                   │
└─────────────────────────────────────────┘
```

## TUI Layer Responsibilities

The TUI layer is **purely reactive** - it subscribes to events and renders, never mutates state.

### Core Architecture (5 Layers)

**Layer 1: Terminal Primitives** (from TCurses)
- Screen/cursor management, input handling, double-buffering
- Animation system with FPS/BPM timing
- Files: `screen.sh`, `input.sh`, `buffer.sh`, `animation.sh`

**Layer 2: Event System** (Pubsub)
- Pure publish-subscribe from demo/010
- Event types: state changes, user input, system events
- File: `pubsub.sh` with `subscribe()`, `publish()`, `unsubscribe()`

**Layer 3: Event Subscriptions**
- TUI components subscribe to TTM events
- Event handlers update component state
- Never directly mutate application state

**Layer 4: Component System**
- Pure reactive components
- Component types: header, content, footer, modal
- Color theming from demo/010

**Layer 5: View Layer**
- Renders components to screen buffers
- Double-buffered output
- Animation coordination

## Proposed Module Structure

```
bash/tui/                          # NEW: TUI rendering layer
├── tui.sh                        # Main entry + orchestration
├── core/
│   ├── screen.sh                # TCurses screen primitives
│   ├── input.sh                 # Input handling (keyboard + gamepad)
│   ├── buffer.sh                # Double buffering
│   └── animation.sh             # FPS/BPM timing
├── events/
│   ├── pubsub.sh               # Event bus (from demo/010)
│   └── subscriptions.sh        # TUI event handlers
├── view/
│   ├── view.sh                 # View layer coordinator
│   ├── components/             # Component implementations
│   │   ├── header.sh
│   │   ├── content.sh
│   │   ├── footer.sh
│   │   └── modal.sh
│   └── themes/                 # Color schemes
│       ├── color_core.sh
│       └── color_themes.sh
└── config/
    └── tui.conf                # Default configuration
```

## Event Subscription Pattern

The TUI subscribes to TTM events and updates display accordingly:

```bash
# TUI initialization
init_tui_subscriptions() {
    # Transaction lifecycle
    subscribe "transaction.began" "tui_on_transaction_began"
    subscribe "transaction.committed" "tui_on_transaction_committed"
    subscribe "transaction.failed" "tui_on_transaction_failed"
    subscribe "transaction.rolled_back" "tui_on_transaction_rolled_back"

    # TES resolution
    subscribe "tes.resolved" "tui_on_tes_resolved"

    # Action state changes
    subscribe "action.state_changed" "tui_on_action_state_changed"
    subscribe "action.completed" "tui_on_action_completed"
    subscribe "action.failed" "tui_on_action_failed"

    # Flow state changes
    subscribe "flow.stage_changed" "tui_on_flow_stage_changed"
}

# Example handler
tui_on_transaction_began() {
    local tx_id="$1"
    local action="$2"

    # Update header with transaction indicator
    set_header_status "⊙ $action"
    mark_component_dirty "header"
}

tui_on_tes_resolved() {
    local tx_id="$1"
    local level="$2"
    local result="$3"

    # Show progress in footer
    set_footer_message "→ TES level $level: $result"
    mark_component_dirty "footer"
}
```

## Component System

### Component Lifecycle

1. **Subscribe** to relevant events
2. **Update** internal state when events fire
3. **Mark dirty** when state changes
4. **Render** on next animation frame
5. **Write** to buffer
6. **Swap** buffers (double-buffering)

### Component Types

**Header** (`view/components/header.sh`)
- Shows current context (Org × Env × Mode)
- Transaction status indicator
- Minimal/Medium/Maximum states

**Content** (`view/components/content.sh`)
- Main display area
- Action results
- Flow status
- Data tables/lists

**Footer** (`view/components/footer.sh`)
- Context-sensitive help
- Progress indicators
- Status messages

**Modal** (`view/components/modal.sh`)
- Confirmation dialogs
- Error messages
- Detailed information overlays

## Key Design Principles

1. **TUI is stateless** - Only renders what it's told via events
2. **Pure reactive** - Subscribes to events, never mutates state
3. **Double-buffered** - Flicker-free rendering
4. **Component-based** - Composable UI elements
5. **Theme-aware** - Consistent color schemes
6. **Animation-ready** - FPS/BPM timing support

## Integration with TTM

The TUI layer **never calls TTM functions directly**. All communication happens via pubsub:

- **TTM → TUI**: Events published by TTM, subscribed by TUI
- **TUI → TTM**: User input events published by TUI, subscribed by TTM

This loose coupling ensures:
- TUI can be swapped (e.g., web UI, GUI)
- TTM can run headless
- Components can be tested in isolation

## Implementation Phases

1. **Copy TCurses primitives** → `bash/tui/core/`
2. **Copy demo/010 pubsub** → `bash/tui/events/pubsub.sh`
3. **Create subscription handlers** → `bash/tui/events/subscriptions.sh`
4. **Build component system** → `bash/tui/view/components/`
5. **Port color theming** → `bash/tui/view/themes/`
6. **Create demo app** showing TTM → TUI integration
7. **Document component API** and theming system

## Sources

This plan synthesizes patterns from:
- **Demo/010**: Modular architecture, pubsub, component system
- **TCurses**: Low-level terminal primitives, double-buffering, animation
- **Demo/014**: Gamepad input, advanced TCurses patterns
- **TView**: Multi-mode UI, modal system (conceptual only - implementation to be replaced)

## Open Questions

1. Should TUI handle input directly or publish input events to TTM?
2. What's the right granularity for dirty-marking (per-component vs per-region)?
3. How do we handle concurrent animations (multiple spinners, progress bars)?
4. Should themes be configurable at runtime or compile-time?

## Related Documents

- `docs/PROVISIONAL_TTM_PLAN.md` - Transaction manager architecture
- `demo/docs/separation.md` - TUI vs TView separation principles
- `demo/basic/010/` - Reference implementation for patterns
