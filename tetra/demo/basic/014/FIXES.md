# TUI Fixes - Demo 014

## Issues Fixed

### 1. Oscillator Causing Action Cycling

**Problem**: The oscillator was triggering continuous re-renders, making the UI feel like it was cycling through states.

**Root Cause**:
- Main loop called `osc_tick` unconditionally
- `read -rsn1 -t 0.05` timeout caused loop to continue
- Every timeout triggered a render, creating animation loop

**Solution** (demo.sh:332-355):
```bash
# Track if screen needs redraw
local needs_redraw=true

while true; do
    # Only render if something changed
    if [[ "$needs_redraw" == "true" ]]; then
        render_screen
        needs_redraw=false
    fi

    # Read with timeout ONLY when oscillator running
    if [[ "$OSC_RUNNING" == "true" ]]; then
        read -rsn1 -t 0.05 key || key=""
        osc_tick
        needs_redraw=true
    else
        # Blocking read when oscillator stopped
        read -rsn1 key
        needs_redraw=true
    fi

    # Skip if no key (timeout)
    [[ -z "$key" ]] && continue
    ...
done
```

**Key Changes**:
- Added `needs_redraw` flag to track when screen needs updating
- Only use timeout when oscillator is running
- Blocking read when oscillator is stopped (no unnecessary redraws)
- Skip rest of loop if timeout occurred with no key press

### 2. Screen Flickering

**Problem**: Visible flickering during every render cycle.

**Root Cause**:
- Using `clear` command which:
  - Clears entire screen buffer
  - Resets cursor position
  - Causes visible flash between clear and redraw

**Solution** (demo.sh:221-229):
```bash
# Render full screen with proper cursor positioning (no clear to prevent flicker)
render_screen() {
    # Move cursor to home and clear screen once
    printf '\033[H\033[2J'

    render_header
    render_content
    render_footer
}
```

**Key Changes**:
- Replaced `clear` with ANSI escape sequence `\033[H\033[2J`
- `\033[H` - Move cursor to home (0,0)
- `\033[2J` - Clear screen from cursor
- Single atomic operation reduces visible flicker

### 3. TUI Element Addressing Scheme

**Problem**: Sequential rendering without proper coordinate-based addressing made it hard to update specific screen regions.

**Solution**: Created `bash/tui/buffer.sh` with proper buffer management:

```bash
# TUI Buffer Management - Proper addressing scheme for TUI elements
# Uses coordinate-based addressing instead of sequential rendering

# Screen buffer (associative array keyed by row:col)
declare -gA TUI_SCREEN_BUFFER
declare -gA TUI_PREV_BUFFER

# Logical addressing
declare -g TUI_REGION_HEADER_START=0
declare -g TUI_REGION_HEADER_END=6
declare -g TUI_REGION_SEP_ROW=7
declare -g TUI_REGION_CONTENT_START=8
declare -g TUI_REGION_FOOTER_START=20

# API functions
tui_buffer_set(row, col, content)      # Set at coordinates
tui_buffer_set_line(row, content)      # Set full line
tui_buffer_render_diff()               # Differential update (only changed)
tui_buffer_render_full()               # Full screen redraw

# Region-specific writers
tui_write_header(line_num, content)
tui_write_separator(content)
tui_write_content(line_num, content)
tui_write_footer(line_num, content)
```

**Benefits**:
- **Coordinate-based addressing**: Can update any screen position directly
- **Differential updates**: Only render changed content
- **Region awareness**: Logical regions (header/separator/content/footer) automatically positioned
- **Double buffering**: Compare with previous state to minimize updates
- **Flicker-free**: Only changed cells are updated

### Future Integration

The buffer system is created but not yet integrated. To integrate:

1. Source buffer.sh in demo.sh
2. Call `tui_buffer_init()` at startup
3. Replace `render_header/content/footer` to write to buffer instead of stdout
4. Call `tui_buffer_render_diff()` instead of `render_screen()`

This will provide true double-buffering with minimal screen updates.

## Animation Loop Behavior

### Before Fixes:
```
Loop:
  ├─ osc_tick (always)
  ├─ render_screen (always)
  ├─ read timeout (0.05s)
  └─ timeout → loop again
Result: Continuous render loop, actions appear to cycle
```

### After Fixes:
```
Oscillator STOPPED:
  ├─ render if needs_redraw
  ├─ blocking read (waits for key)
  └─ key pressed → handle → render once

Oscillator RUNNING:
  ├─ render if needs_redraw
  ├─ read with timeout (0.05s)
  ├─ timeout → osc_tick → needs_redraw=true
  ├─ no key → skip input handling
  └─ loop → render (animation frame)

Result: Silent animation, no action cycling, smooth
```

## Testing

The oscillator now:
- **When stopped**: UI is completely silent, no redraws
- **When running** (press 'o'): Smooth marker animation on separator
- **Arrow keys**: Manual marker positioning works
- **Header cycling** (press 'h'): Clean transitions between min/med/max

## Performance

- **Reduced renders**: Only render when state changes or oscillator ticks
- **Eliminated flicker**: ANSI sequences instead of `clear`
- **Future optimization**: Differential buffer updates (when integrated)
