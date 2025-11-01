# Header Animation System - Demo 014

## Overview

The header system has been refactored to support dynamic sizing and sophisticated line animation with an oscillator-driven marker.

## Architecture

### Modules Created

1. **`bash/tui/oscillator.sh`** - Animation timing engine
   - Provides beat-based animation control
   - Bounces between min/max boundaries
   - Position values: 0-100
   - Configurable BPM (beats per minute)

2. **`bash/tui/line_animator.sh`** - Sophisticated separator rendering
   - Color-aware line drawing
   - Configurable length, alignment (left/center/right)
   - Animated marker positioning
   - Knows middle of line, can calculate any position

3. **`bash/tui/header.sh`** - Robust header rendering
   - Three size states: **min**, **med**, **max**
   - REPL line support (appears above separator)
   - Modular line-by-line rendering
   - Can grow/shrink, taking over Info space

## Header Size States

### Min (1 line)
```
Demo 014: Action Signatures | [Local × Inspect]
────────────────────────○───────────────────────
```

### Med (4 lines)
```
Demo 014: Action Signatures | [Local × Inspect]
Environment:  [Local] Dev Staging Production
Mode:         [Inspect] Transfer Execute
Action:       view×toml  (1/21)
────────────────────────○───────────────────────
```

### Max (7 lines) - Default
```
Demo 014: Action Signatures | [Local × Inspect]
Environment:  [Local] Dev Staging Production
Mode:         [Inspect] Transfer Execute
Action:       view×toml  (1/21)
Status:       ○ idle - Content Title
Info:         exec_at=@local source_at=@local
              in=/path/to/input out=/path/to/output
────────────────────────○───────────────────────
```

## Separator Line Features

The separator line is a single dashed line with:
- **Marker** (○) that can be positioned anywhere (0-100%)
- **Animation** driven by oscillator (bounces back and forth)
- **Color control** - line color, marker color separately configurable
- **Alignment** - left, center (default), or right
- **Length awareness** - knows its width, middle point, and current marker position

## Keybindings

### Header Controls
- `h` / `H` - Cycle header size (max → med → min → max)
- `o` / `O` - Toggle oscillator animation (start/stop)
- `/` - Toggle REPL line (appears above separator)

### Oscillator Control
- `←` - Move oscillator marker left (-5 positions)
- `→` - Move oscillator marker right (+5 positions)
- Oscillator auto-bounces when running

### Navigation (unchanged)
- `e` / `E` - Cycle environment
- `m` / `M` - Cycle mode
- `a` / `A` - Cycle action (changed from `f`)

## REPL Line

The REPL appears on the line **above the separator**:
```
...
Info:         exec_at=@local source_at=@local
REPL:         > <input here with cursor>
────────────────────────○───────────────────────
```

## Oscillator API

```bash
# Initialize
osc_init

# Control
osc_start              # Start animation
osc_stop               # Stop animation
osc_tick               # Advance one beat (call in main loop)

# Position
osc_get_position       # Returns 0-100
osc_set_position N     # Set to specific position
osc_reset              # Reset to center (50)

# Configuration
osc_set_range MIN MAX  # Set bounce boundaries
osc_set_bpm BPM        # Set beats per minute
osc_reverse            # Toggle direction
```

## Line Animator API

```bash
# Initialize
line_init

# Configuration
line_set_length WIDTH
line_set_align left|center|right
line_set_char "─"
line_set_marker "○"
line_set_marker_position 0-100
line_set_color "\033[2m"
line_set_marker_color "\033[1;36m"

# Rendering
line_render_aligned                    # Render with current settings
line_animate_from_osc POSITION        # Render with oscillator position
line_render_at POSITION               # One-shot render at position

# Utilities
line_get_middle                       # Get center index
line_get_marker_index                 # Calculate marker index from percentage
```

## Header API

```bash
# Size control
header_set_size min|med|max
header_get_lines                      # Returns line count for current size

# REPL control
header_repl_toggle
header_repl_set_input "text"

# Rendering
header_render                         # Render complete header
header_render_title                   # Individual line renders
header_render_env
header_render_mode
header_render_action
header_render_status
header_render_info
header_render_repl
```

## Integration

The main render loop now:
1. Ticks the oscillator (if running)
2. Renders header using header module
3. Renders animated separator using line animator + oscillator position
4. Renders content (unchanged)
5. Renders footer with new keybindings

```bash
while true; do
    osc_tick
    render_screen
    read -rsn1 -t 0.05 key || key=""
    # ... handle input ...
done
```

## Color Philosophy

The line animator is **only concerned with color** of:
- The line itself (default: dim/gray)
- The marker (default: bright cyan)

It knows:
- How long the line is
- Where the middle is
- If it's left/center/right aligned

All positioning logic is separated from rendering logic.

## Future Enhancements

- Multiple oscillators (different speeds/ranges)
- Marker shape variations (pulse, grow/shrink)
- Color gradients along the line
- Multiple markers on same line
- Vertical oscillation for header size
- Smooth transitions between header sizes
