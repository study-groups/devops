# Flax Protocol Specification

## Overview

Flax operates in two modes:
1. **Native Bash** - Pure bash implementation (current)
2. **Accelerated** - C co-processor handles rendering via protocol

The bash layer remains the API. When a C backend is available, commands are piped to it instead of executing in bash.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Game Code (bash)                                       │
│  - flax_sprite_create, flax_draw_text, etc.            │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  Flax API Layer (bash)                                  │
│  - Checks FLAX_BACKEND                                  │
│  - Routes to native or accelerated                      │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
┌───────────────┐        ┌───────────────────────┐
│ Native Bash   │        │ flaxd (C backend)     │
│ - String ops  │        │ - FIFO input          │
│ - printf      │        │ - Double buffering    │
└───────────────┘        │ - Hardware timing     │
                         │ - Fast compositing    │
                         └───────────────────────┘
```

## Protocol Format

Commands sent via FIFO to flaxd:

```
COMMAND:arg1:arg2:arg3:...\n
```

All coordinates are 1-indexed. Colors are 256-palette integers.

## Commands

### Buffer Operations
```
CLR                          # Clear buffer
FLUSH                        # Flush buffer to terminal
HOME                         # Cursor to 1,1
GOTO:row:col                 # Move cursor
```

### Drawing
```
TEXT:row:col:color:text      # Draw text at position
CHAR:row:col:color:char      # Draw single character
RECT:row:col:w:h:color       # Draw rectangle outline
FILL:row:col:w:h:char:color  # Fill rectangle
HLINE:row:col:len:char:color # Horizontal line
VLINE:row:col:len:char:color # Vertical line
```

### Colors/Attributes
```
FG:color                     # Set foreground (256 palette)
BG:color                     # Set background
RGB:r:g:b                    # True color foreground
RESET                        # Reset attributes
BOLD                         # Enable bold
DIM                          # Enable dim
```

### Sprites
```
SCREATE:id                   # Create sprite, return id
STEXT:id:row:col:z:color:text  # Create text sprite
SBOX:id:row:col:w:h:z:color  # Create box sprite
SMOVE:id:row:col             # Move sprite
SZ:id:z                      # Set z-order
SSHOW:id                     # Show sprite
SHIDE:id                     # Hide sprite
SCONTENT:id:base64content    # Set content (base64 for newlines)
SDELETE:id                   # Delete sprite
SCLEAR                       # Delete all sprites
SRENDER                      # Composite all sprites to buffer
```

### Screen Control
```
INIT                         # Initialize (alt screen, hide cursor)
CLEANUP                      # Restore terminal
SIZE                         # Query terminal size -> "rows:cols"
```

### Timing/Metrics
```
FPS:n                        # Set target FPS
FRAME                        # Get frame number -> "n"
METRICS                      # Get metrics -> "fps:frame_time:sprites:bufsize"
DEBUG:0|1                    # Toggle debug overlay
```

### Input
```
KEY:timeout_ms               # Read key -> "key" or "" on timeout
```

## Response Format

Queries return data on stdout:
```
OK                           # Success (no data)
OK:data                      # Success with data
ERR:message                  # Error
```

## Example Session

```
→ INIT
← OK
→ SIZE
← OK:24:80
→ FPS:30
← OK
→ STEXT:1:10:40:0:46:Hello World
← OK:1
→ SMOVE:1:10:42
← OK
→ SRENDER
← OK
→ FLUSH
← OK
→ KEY:33
← OK:q
→ CLEANUP
← OK
```

## C Implementation Notes

### flaxd.c structure

```c
// Main components
typedef struct {
    int id;
    int x, y, w, h, z;
    int visible;
    int color;
    char *content;
} Sprite;

typedef struct {
    char *buffer;
    size_t bufsize;
    Sprite sprites[MAX_SPRITES];
    int sprite_count;
    int running;
    struct termios orig_termios;
    int rows, cols;
    double target_fps;
    uint64_t frame;
} FlaxState;

// Core functions
void flax_init(FlaxState *state);
void flax_cleanup(FlaxState *state);
void flax_process_command(FlaxState *state, const char *cmd);
void flax_flush(FlaxState *state);
void flax_composite_sprites(FlaxState *state);
```

### Performance Targets

| Operation | Bash | C Target |
|-----------|------|----------|
| Clear buffer | 0.1ms | 0.001ms |
| Draw text | 0.5ms | 0.01ms |
| Composite 10 sprites | 5ms | 0.1ms |
| Full frame flush | 2ms | 0.5ms |
| **Total frame** | **10-20ms** | **<2ms** |

### Build Integration

```bash
# In flax.sh
if [[ -x "$FLAX_SRC/bin/flaxd" ]]; then
    FLAX_BACKEND="accelerated"
    # Start co-processor
    mkfifo "$FLAX_FIFO" 2>/dev/null
    "$FLAX_SRC/bin/flaxd" < "$FLAX_FIFO" &
    FLAX_PID=$!
    exec 3>"$FLAX_FIFO"
else
    FLAX_BACKEND="native"
fi
```

## Future Extensions

- `AUDIO:` commands for sound co-processor
- `NET:` commands for multiplayer
- `GPU:` commands for shader-like effects (gradients, etc.)
- Shared memory for zero-copy buffer updates
