# Estovox Architecture

## Overview

Estovox is a modular facial animation system built for the Tetra framework. It provides real-time TUI rendering of facial expressions and IPA-based phoneme articulation through a clean separation of concerns.

## Design Philosophy

1. **Module-First**: Built as a Tetra module, not a standalone application
2. **State-Driven**: All animation flows through a central state system
3. **Preset-Based**: Phonemes and expressions defined as state presets
4. **Interpolated**: Smooth transitions via configurable lerp rates
5. **TUI Native**: Designed for terminal rendering from the ground up

## Directory Structure

```
estovox/
├── estovox.sh              # Main module entry point & public API
├── core/
│   ├── state.sh            # State variables, getters/setters, math
│   └── animation.sh        # Animation loop, preset application
├── presets/
│   ├── phonemes.sh         # IPA phoneme definitions
│   └── expressions.sh      # Facial expression definitions
├── tui/
│   └── renderer.sh         # Terminal rendering, frame building
├── repl/
│   ├── commands.sh         # Command handlers and dispatcher
│   └── estovox_repl.sh     # REPL main loop
├── demo_estovox.sh         # Demonstration script
├── test_estovox.sh         # Test suite
├── README.md               # User documentation
├── QUICKSTART.md           # Getting started guide
└── ARCHITECTURE.md         # This file
```

## Core Components

### 1. State System (`core/state.sh`)

**Purpose**: Central state management for all facial parameters

**Key Features**:
- 23 normalized (0.0-1.0) state variables
- Immutable parameter list (`ESTOVOX_PARAMS`)
- Target system for animation tweening
- Math utilities (lerp, clamp)
- Symmetry enforcement for eyebrows

**State Variables**:
```
Eyebrows: L/R height, arch, angle, symmetry
Eyes:     openness (global + L/R), gaze H/V
Mouth:    jaw, lips, tongue, velum (IPA articulators)
```

**API**:
```bash
estovox_get_param <param>
estovox_set_param <param> <value>
estovox_set_target <param> <value> [rate]
estovox_has_target <param>
estovox_clear_target <param>
estovox_update_frame
estovox_reset_state
```

### 2. Animation Engine (`core/animation.sh`)

**Purpose**: Handle animation loops and preset application

**Key Features**:
- Background animation loop (50 FPS)
- Preset-to-target conversion
- Sequence playback
- Animation lifecycle management

**API**:
```bash
estovox_apply_preset <name> [rate]
estovox_play_sequence <phone:ms> ...
estovox_start_animation
estovox_stop_animation
```

### 3. Preset System (`presets/`)

**Purpose**: Define reusable state configurations

**phonemes.sh**:
- IPA-based phoneme definitions
- Accurate articulator positioning
- Vowels, consonants, special positions

**expressions.sh**:
- Emotional expressions (happy, sad, etc.)
- Eyebrow configurations
- Eye states (winks, blinks)
- Communicative expressions

**Format**:
```bash
estovox_get_phoneme_preset "a"
# Returns:
# ESTOVOX_JAW_OPENNESS:0.9
# ESTOVOX_LIP_ROUNDING:0.0
# ...
```

### 4. TUI Renderer (`tui/renderer.sh`)

**Purpose**: Convert state to visual terminal output

**Key Features**:
- Character-based face rendering
- Dynamic gaze positioning
- Status panel with live parameters
- Screen coordinate mapping
- Buffer-based rendering

**Rendering Pipeline**:
```
State → Position Calculation → Character Selection → Buffer Build → Screen Output
```

**API**:
```bash
estovox_build_frame       # Build frame buffer
estovox_render_frame      # Render to screen
estovox_init_screen       # Setup terminal
estovox_restore_screen    # Cleanup terminal
```

### 5. Command System (`repl/commands.sh`)

**Purpose**: User command interface

**Command Categories**:
- Articulation: `ph`, `expr`, `say`, `seq`
- State: `set`, `setimm`, `get`, `reset`
- Info: `list`, `help`
- Control: `quit`

**Command Flow**:
```
User Input → Parse → Dispatch → Handler → State Update → Render
```

**API**:
```bash
estovox_process_command <cmd> [args...]
estovox_cmd_* functions      # Individual handlers
```

### 6. REPL (`repl/estovox_repl.sh`)

**Purpose**: Interactive command loop

**Features**:
- Non-blocking input with animation
- Command history (readline)
- Error display
- Graceful cleanup

**Lifecycle**:
```
Init → Start Animation → Command Loop → Cleanup
```

## Data Flow

### Preset Application Flow

```
1. User: ph a
2. estovox_process_command("ph", "a")
3. estovox_cmd_phoneme("a")
4. estovox_apply_preset("a")
5. estovox_get_phoneme_preset("a")
6. For each param: estovox_set_target(param, value, rate)
7. Animation loop: estovox_update_frame()
8. For each target: lerp current → target
9. estovox_render_frame()
10. Screen updates
```

### Animation Loop

```
Background Process:
while ESTOVOX_RUNNING:
    estovox_update_frame()      # Update all targeted params
    estovox_render_frame()      # Render to screen
    sleep 0.02                  # 50 FPS
```

### Frame Rendering

```
1. Get current state values
2. Calculate screen positions
3. Select characters based on state
4. Build buffer string with ANSI positioning
5. Output buffer to terminal
```

## Key Algorithms

### Linear Interpolation (Lerp)

```bash
lerp(current, target, rate) = current + (target - current) * rate
```

Used for smooth transitions between states.

### Value Clamping

```bash
clamp(value, min=0.0, max=1.0)
```

Ensures all parameters stay in valid range.

### Symmetry Enforcement

```bash
if symmetry > 0.5:
    avg = (left + right) / 2
    left = lerp(left, avg, symmetry)
    right = lerp(right, avg, symmetry)
```

Automatically balances eyebrow positions.

## Integration Points

### With Tetra Framework

- Uses `$TETRA_SRC` for module location
- Follows Tetra module conventions
- Integrates with TDS when available
- Compatible with Tetra REPL patterns

### Module API

```bash
# Initialize module
estovox_module_init

# Access state system
estovox_set_param / estovox_get_param

# Apply presets
estovox_apply_preset

# Animation control
estovox_start_animation / estovox_stop_animation

# Standalone REPL
estovox repl
```

### As a Library

```bash
#!/usr/bin/env bash
source "$TETRA_SRC/bash/estovox/estovox.sh"

estovox_module_init
estovox_init_screen
estovox_start_animation

# Your code here
estovox_apply_preset "happy"
sleep 2

estovox_stop_animation
estovox_restore_screen
```

## Performance Considerations

1. **Animation Rate**: 20ms per frame (50 FPS)
   - Adjustable via `ESTOVOX_FRAME_TIME_MS`
   - Trade-off: smoothness vs CPU usage

2. **Rendering**: Buffer-based output
   - Single echo per frame
   - Minimizes terminal I/O

3. **Math**: bc for floating-point
   - Required for 0.0-1.0 precision
   - Slightly slower than integer math

4. **Background Loop**: Separate process
   - Non-blocking for REPL input
   - Cleaned up on exit

## Extension Points

### Adding New Phonemes

Edit `presets/phonemes.sh`:
```bash
estovox_get_phoneme_preset() {
    case $phoneme in
        newphone)
            echo "ESTOVOX_JAW_OPENNESS:0.5"
            echo "ESTOVOX_LIP_ROUNDING:0.3"
            ;;
    esac
}
```

### Adding New Expressions

Edit `presets/expressions.sh`:
```bash
estovox_get_expression_preset() {
    case $expression in
        myexpr)
            echo "ESTOVOX_EYEBROW_L_HEIGHT:0.7"
            echo "ESTOVOX_LIP_CORNER_HEIGHT:0.8"
            ;;
    esac
}
```

### Adding New Commands

Edit `repl/commands.sh`:
```bash
estovox_cmd_mycommand() {
    # Implementation
}

estovox_process_command() {
    case $cmd in
        mycmd) estovox_cmd_mycommand "$@" ;;
    esac
}
```

### Custom Rendering

Edit `tui/renderer.sh`:
```bash
estovox_build_frame() {
    # Modify character selection
    # Change positioning
    # Add new visual elements
}
```

## Testing Strategy

1. **Unit Tests**: `test_estovox.sh`
   - State management
   - Math functions
   - Preset loading
   - Command processing

2. **Integration**: `demo_estovox.sh`
   - Full animation sequences
   - Visual verification

3. **Manual**: REPL usage
   - Interactive testing
   - Edge case exploration

## Future Architecture Enhancements

1. **Plugin System**: Load custom phoneme/expression sets
2. **Recording**: Save/replay animation sequences
3. **Network**: Remote control API
4. **Multi-character**: Multiple faces on screen
5. **Color**: Leverage TDS color system
6. **Sound**: TTS integration for synchronized speech
7. **Export**: Animation → ASCII art file format

## Dependencies

- bash 5.2+
- bc (floating-point math)
- tput (terminal control)
- Optional: TDS components

## Design Patterns Used

1. **Module Pattern**: Namespace isolation with `estovox_` prefix
2. **State Pattern**: Central state with update loop
3. **Command Pattern**: Command dispatcher with handlers
4. **Preset Pattern**: Reusable state configurations
5. **Observer Pattern**: Animation loop observes target changes
6. **Builder Pattern**: Frame buffer construction

## Conclusion

Estovox demonstrates a clean architecture for interactive TUI applications in bash, with proper separation of concerns, extensibility, and integration with the Tetra framework.
