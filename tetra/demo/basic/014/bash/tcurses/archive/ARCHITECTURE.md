# TCurses Architecture

## Layered Design

```
┌─────────────────────────────────────────────┐
│         Application Layer                   │
│  (demo_production.sh, your apps)            │
│                                             │
│  - Business logic                           │
│  - Event handlers                           │
│  - State management                         │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│      High-Level TUI Components              │
│  (tcurses_log_footer, tcurses_text_anim)    │
│                                             │
│  - Log footer (4-line scrolling)            │
│  - Text animations (fly-in, reveal)         │
│  - Pre-built UI widgets                     │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│      Low-Level TCurses Primitives           │
│                                             │
│  tcurses_screen.sh    - Terminal setup      │
│  tcurses_input.sh     - Key reading         │
│  tcurses_input_sm.sh  - Input state machine │
│  tcurses_buffer.sh    - Double buffering    │
│  tcurses_animation.sh - BPM/FPS timing      │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│         Terminal / OS                       │
│  (stty, tput, /dev/tty)                     │
└─────────────────────────────────────────────┘
```

## Low-Level Primitives

### tcurses_screen.sh
- Terminal initialization (`stty -echo -icanon min 1`)
- Alternate screen buffer
- Cursor control
- Dimension tracking

### tcurses_input.sh
- Key reading helpers
- Escape sequence detection
- Key name mapping

### tcurses_input_sm.sh
- **State machine for robust input**
- States: IDLE → ESCAPE → READY → ERROR
- Handles timing issues properly
- No duplicate reads

### tcurses_buffer.sh
- Double-buffered rendering
- Differential updates (only draw changes)
- Line-based drawing

### tcurses_animation.sh
- FPS control (default 30fps)
- BPM synchronization (default 120bpm)
- Beat phase tracking (0.0-1.0)
- Oscillators (sine, triangle, square)
- Frame timing

## High-Level Components

### tcurses_log_footer.sh
- 4-line scrolling log at bottom
- module:action format
- Auto-truncation
- Timestamp tracking

### tcurses_text_anim.sh
- `text_anim_fly_in()` - text flies in from edges
- `text_anim_reveal()` - letter-by-letter reveal
- `easing()` - ease-in, ease-out, ease-in-out

## Design Principles

### Separation of Concerns
- **Low-level** = terminal primitives (don't know about widgets)
- **High-level** = UI components (use primitives)
- **Application** = business logic (use components)

### Robust Input Handling
- State machine eliminates race conditions
- Proper backspace detection (0x7f on macOS)
- Control character mapping (Ctrl-A = 0x01)
- Clean escape sequence handling

### Animation System
- BPM-based timing for musical sync
- Frame-based updates for smooth animation
- Beat phase (0.0-1.0) for oscillators
- Delta timing between events

### Logging Format
```
[HH:MM:SS] module:action | details
```

Example:
```
[21:54:38] input:key | 'h' δ=150ms
[21:54:39] system:ready | Power-on complete
```

## Usage Pattern

```bash
# Source layers
source tcurses_screen.sh      # Low-level
source tcurses_input.sh
source tcurses_buffer.sh
source tcurses_animation.sh

source tcurses_log_footer.sh  # High-level
source tcurses_text_anim.sh

# Initialize
tcurses_screen_init
tcurses_buffer_init height width
tcurses_animation_init fps bpm
log_footer_init

# Event loop
while true; do
    # Render
    tcurses_buffer_clear
    # ... draw UI ...
    log_footer_render y width
    tcurses_buffer_render_diff

    # Input
    key=$(tcurses_input_read_key timeout)
    # ... handle key ...

    # Animation
    tcurses_animation_record_frame
    # ... update state ...
done

# Cleanup
tcurses_screen_cleanup
```

## Production Demo Features

The `demo_production.sh` showcases:

1. **Power-on Animation**
   - "TCURSES" flies in from left/right
   - Subtitle reveals letter-by-letter
   - Progress bar

2. **Running Mode**
   - 4-line log footer (no scroll)
   - BPM indicator with visual pulse
   - Key input display with delta timing
   - Delta in milliseconds AND beats

3. **Module:Action Logging**
   - `system:init` - startup
   - `animation:enable` - animation on
   - `input:key` - key press with delta
   - `system:exit` - shutdown

4. **BPM Delta Display**
   - Shows time between keypresses
   - In both milliseconds and beats
   - Beat count and phase tracking

## File Responsibility

| File | Layer | Responsibility |
|------|-------|----------------|
| tcurses_screen.sh | Low | Terminal setup, stty, alternate buffer |
| tcurses_input.sh | Low | Key reading, escape sequences |
| tcurses_input_sm.sh | Low | Input state machine (robust) |
| tcurses_buffer.sh | Low | Double buffering, diff rendering |
| tcurses_animation.sh | Low | FPS, BPM, timing, oscillators |
| tcurses_log_footer.sh | High | 4-line scrolling log widget |
| tcurses_text_anim.sh | High | Text animation effects |
| demo_production.sh | App | Demo application |

## Testing

```bash
# Test state machine in isolation
./test_state_machine.sh

# Test clean input (no duplicates)
./example_clean.sh

# Production demo
./demo_production.sh
```

## Key Fixes

1. **Backspace Detection**
   - macOS sends 0x7f (DEL), not 0x08 (Ctrl-H)
   - Properly mapped in control char detection

2. **Terminal Settings**
   - `min 1` for proper blocking (not `min 0`)
   - Eliminates empty reads

3. **State Machine**
   - IDLE → ESCAPE → READY flow
   - No duplicate reads
   - Clean escape sequence handling

4. **Animation**
   - date +%s%N for nanosecond timing (Linux)
   - date +%s%3N for milliseconds (if supported)
   - Graceful fallback on macOS
