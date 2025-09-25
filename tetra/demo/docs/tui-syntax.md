# TUI Syntax and Layout Specification

## Overview

The TUI (Terminal User Interface) system handles all display, navigation, and input concerns separately from content logic. This specification defines the exact syntax and semantics for TView's interface.

## 4-Line Header Layout (tui.top)

```
Line 1: TVIEW hostname | MODE:ENV
Line 2: Env: [CURRENT] others others others
Line 3: Mode: others [CURRENT] others others
Line 4: Action: [current] other other (position/total)
```

### Example Display
```
TVIEW demo-host | LEARN:DEMO
Env: [DEMO] LOCAL REMOTE
Mode: [LEARN] BUILD TEST
Action: [explain_formula] show_structure demonstrate (1/3)
```

## Color Specification

### Environment Colors (5 total)
```bash
declare -A ENV_COLORS=(
    ["TETRA"]="blue"      # Central coordination - calm, authoritative
    ["LOCAL"]="green"     # Development - growth, safe
    ["DEV"]="yellow"      # Testing - attention, caution
    ["STAGING"]="orange"  # Pre-production - warning, preparation
    ["PROD"]="red"        # Production - critical, careful
)
```

### Demo Environment Colors (3 total)
```bash
declare -A DEMO_ENV_COLORS=(
    ["DEMO"]="cyan"       # Tutorial - educational, friendly
    ["LOCAL"]="green"     # Development - consistent with main
    ["REMOTE"]="magenta"  # Remote operations - distinctive
)
```

### UI Element Colors
```bash
declare -A UI_COLORS=(
    ["current_selection"]="bold+white+bg_color"    # [CURRENT] items
    ["other_options"]="dim+white"                  # non-current items
    ["separator"]="dim+white"                      # | and : characters
    ["position"]="dim+yellow"                      # (1/3) indicators
    ["hostname"]="bold+white"                      # hostname display
)
```

## Input Syntax

### Gamepad Mode (Single Key Navigation)
```bash
declare -A GAMEPAD_KEYS=(
    ["e"]="next_environment"      # Cycle environments forward
    ["E"]="prev_environment"      # Cycle environments backward
    ["d"]="next_mode"             # Cycle modes forward
    ["D"]="prev_mode"             # Cycle modes backward
    ["a"]="next_action"           # Cycle actions forward
    ["A"]="prev_action"           # Cycle actions backward
    ["l"]="execute_action"        # Execute selected action
    ["\n"]="execute_action"       # Enter also executes
    ["q"]="quit"                  # Exit application
    ["r"]="refresh"               # Refresh current view
    ["/"]="enter_repl_mode"       # Switch to REPL mode
)
```

### REPL Mode (Command Line Interface)
```bash
# Commands follow pattern: verb [noun] [--options]
tview> env demo              # Change to DEMO environment
tview> mode learn            # Change to LEARN mode
tview> action explain        # Execute explain action
tview> exec explain_formula  # Direct action execution
tview> gamepad              # Switch back to gamepad mode
tview> quit                 # Exit application
```

## Layout Regions

### Screen Division
```
┌─────────────────────────────────┐
│ Header (4 lines)                │ ← tui.top
├─────────────────────────────────┤
│                                 │
│                                 │
│ Content Area                    │ ← dynamic based on action
│                                 │
│                                 │
├─────────────────────────────────┤
│ Status Line                     │ ← hints, errors, progress
└─────────────────────────────────┘
```

### Header Line Specifications

#### Line 1: Title and Context
```
Format: TVIEW {hostname} | {MODE}:{ENV}
Example: TVIEW demo-host | LEARN:DEMO
Colors: "TVIEW" in white, hostname in bold, MODE:ENV in environment color
```

#### Line 2: Environment Selection
```
Format: Env: [CURRENT] other other other
Example: Env: [DEMO] LOCAL REMOTE
Colors: Current in environment color + bold, others in dim
```

#### Line 3: Mode Selection
```
Format: Mode: [CURRENT] other other other
Example: Mode: [LEARN] BUILD TEST
Colors: Current in white + bold, others in dim
```

#### Line 4: Action Selection
```
Format: Action: [current] other other (pos/total)
Example: Action: [explain_formula] show_structure (1/3)
Colors: Current in white + bold, others in dim, position in yellow
```

## Responsive Behavior

### Screen Width Adaptation
- **< 60 chars**: Truncate with ellipsis
- **60-100 chars**: Standard display
- **> 100 chars**: Add padding/spacing

### Long Content Handling
- **Environment names**: Truncate to 8 chars max
- **Mode names**: Truncate to 10 chars max
- **Action names**: Truncate to 15 chars max
- **Use ellipsis (...)** for truncated content

## Animation and Transitions

### Selection Changes
- **Immediate**: No animation for performance
- **Color flash**: Brief highlight on change
- **Smooth scrolling**: For action lists > screen height

### Mode Switching
- **Clear and redraw**: Complete screen refresh
- **Preserve cursor**: Remember position when possible

## Error States

### Invalid States
```
TVIEW demo-host | ERROR:INVALID
Env: [DEMO] LOCAL REMOTE
Mode: ERROR - Module not found
Action: No actions available
```

### Loading States
```
TVIEW demo-host | LEARN:DEMO
Env: [DEMO] LOCAL REMOTE
Mode: [LEARN] BUILD TEST
Action: Loading actions... ⟳
```

## Accessibility

### Screen Reader Support
- **ARIA labels**: For all interactive elements
- **Status announcements**: On state changes
- **Keyboard navigation**: All functions available via keyboard

### High Contrast Mode
- **Alternative color schemes**: For visibility impaired users
- **Bold text emphasis**: When color is insufficient
- **Pattern alternatives**: Not relying solely on color