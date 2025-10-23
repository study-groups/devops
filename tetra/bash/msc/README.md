# MSC - Message Sequence Chart Generator

**Version:** 1.0
**Status:** Active Development
**Shepherd:** bash/tds

## Overview

MSC is a terminal-based message sequence chart (MSC) generator for visualizing interactions between system components. It renders ASCII diagrams with smart lane allocation, entity-based coloring, and terminal-aware layout.

## Features

- **Smart Lane Allocation** - Hybrid width calculation (min widths + proportional expansion)
- **Entity Coloring** - Each column header gets unique color from palette
- **Word Wrapping** - Text lanes wrap content for maximum readability
- **Terminal Aware** - Respects COLUMNS environment variable
- **No Borders** - Clean ASCII art focusing on lanes and arrows
- **TDS Integration** - Colors and utilities from Tetra Display System

## Architecture

```
bash/msc/
├── includes.sh           # Module entry point
├── msc.sh                # Core data structures and state
├── msc_layout.sh         # Width calculation and text wrapping
├── msc_render.sh         # ASCII rendering engine
└── README.md             # This file
```

## Quick Start

```bash
# Initialize MSC with entities
msc_init "User" "REPL" "Database" "API"

# Record messages
msc_message "User" "REPL" "user new mike"
msc_message "REPL" "Database" "write_user_record()"
msc_message "Database" "REPL" "OK"
msc_message "REPL" "API" "POST /api/users/create"
msc_message "API" "REPL" "200 OK + user data"

# Add notes
msc_note "Database" "Writing to disk..."

# Render diagram
msc_render

# Clear state for next diagram
msc_clear
```

## API Reference

### Initialization

**msc_init <entity1> <entity2> ...**
- Initialize MSC with list of entities (column headers)
- Assigns colors automatically
- Resets any previous state

**msc_clear**
- Reset MSC state completely
- Call before starting new diagram

### Recording Events

**msc_message <from> <to> <label>**
- Record a message arrow from one entity to another
- Label appears on arrow
- Validates entities exist

**msc_note <entity> <text>**
- Add a note/comment on specific entity lane
- Text wraps if too long

**msc_activate <entity>**
- Mark entity as active (future: visual indicator)

**msc_deactivate <entity>**
- Mark entity as inactive

### Rendering

**msc_render**
- Calculate layout and render complete diagram
- Outputs to stdout
- Terminal-aware width calculation

### Layout Queries

**msc_get_terminal_width**
- Get current terminal width (from COLUMNS or tput)

**msc_get_lane_width <entity>**
- Get calculated width for entity's text lane

**msc_get_arrow_width**
- Get calculated width for arrow lanes

**msc_get_total_width**
- Get total diagram width

### Utilities

**msc_wrap_text <text> <width>**
- Word-wrap text to fit in specified width
- Returns multiline string

**msc_pad_text <text> <width> [pad_char]**
- Pad text to exact width (left-aligned)
- Truncates if too long

**msc_center_text <text> <width>**
- Center text in given width

## Layout Algorithm

### Hybrid Width Calculation

1. **Count lanes**: N entities = N text lanes + (N-1) arrow lanes
2. **Calculate minimums**:
   - Text lane min: 15 chars
   - Arrow lane min: 7 chars
3. **Check fit**: If minimums don't fit terminal, accept overflow
4. **Distribute extra**: 70% to text lanes, 30% to arrow lanes
5. **Apply equally**: Divide extra space evenly among lanes of each type

### Example

Terminal width: 120 chars
Entities: 4 (User, REPL, DB, API)

Lanes: 4 text + 3 arrow = 7 total
Minimums: (4 × 15) + (3 × 7) = 60 + 21 = 81 chars
Extra: 120 - 81 = 39 chars
Distribution:
- Text: 39 × 0.70 = 27 → 27/4 = 6 per lane → 15+6 = 21 chars
- Arrow: 39 × 0.30 = 12 → 12/3 = 4 per lane → 7+4 = 11 chars

Final: (4 × 21) + (3 × 11) = 84 + 33 = 117 chars

## Color System

Entities cycle through default palette:
1. Cyan (#66FFFF)
2. Pink (#FF6B9D)
3. Yellow (#FFD666)
4. Teal (#95E1D3)
5. Rose (#F38BA8)
6. Lavender (#B4BEFE)
7. Sky (#89DCEB)
8. Peach (#FAB387)

Colors applied via bash/color system (text_color/reset_color).

## Output Format

```
[User]       [REPL]       [Database]   [API]
   |            |              |          |
   |----------->|                         |
   | user new   |                         |
   | mike       |                         |
   |            |------------->|          |
   |            | write_user_  |          |
   |            | record()     |          |
   |            |<-------------|          |
   |            | OK           |          |
   |            |------------------------->|
   |            | POST /api/users/create  |
   |            |<-------------------------|
   |            | 200 OK + user data      |
   |            |              |          |
```

## Integration with TDS

MSC is shepherded by bash/tds (Layer 6):

```bash
# In bash/tds/tds.sh
MSC_SRC="${MSC_SRC:-$(dirname "$TDS_SRC")/msc}"
if [[ -f "$MSC_SRC/msc.sh" ]]; then
    source "$MSC_SRC/msc.sh"
    source "$MSC_SRC/msc_layout.sh"
    source "$MSC_SRC/msc_render.sh"
fi
```

TDS provides:
- Color system (text_color, reset_color)
- ANSI utilities (if needed for future enhancements)
- Terminal geometry detection

## Data Directory Structure

```
$TETRA_DIR/msc/
├── logs/                 # MSC generation logs
│   └── msc_{timestamp}.txt  # Saved diagrams
└── exports/              # Future: PNG/SVG exports
```

## Use Cases

### 1. System Flow Documentation
```bash
msc_init "Client" "API" "Database" "Cache"
msc_message "Client" "API" "GET /user/123"
msc_message "API" "Cache" "lookup(123)"
msc_message "Cache" "API" "MISS"
msc_message "API" "Database" "SELECT * FROM users WHERE id=123"
msc_message "Database" "API" "user_data"
msc_message "API" "Cache" "store(123, data)"
msc_message "API" "Client" "200 OK"
msc_render
```

### 2. Debug Instrumentation
```bash
# In user creation flow
msc_init "REPL" "Validator" "Database" "API"

# Instrument each step
validate_user() {
    msc_message "REPL" "Validator" "validate_username($1)"
    # ... actual validation ...
    msc_message "Validator" "REPL" "OK"
}

# Render on completion or error
trap 'msc_render > /tmp/user_creation_flow.txt' EXIT
```

### 3. API Testing
```bash
msc_init "Test" "API" "Service"
for endpoint in /users /posts /comments; do
    msc_message "Test" "API" "GET $endpoint"
    msc_message "API" "Service" "query()"
    msc_message "Service" "API" "results"
    msc_message "API" "Test" "200 OK"
done
msc_render
```

## Future Enhancements

- [ ] Export to PNG/SVG via graphviz
- [ ] Interactive mode (click to filter entities)
- [ ] Timing annotations (duration between messages)
- [ ] Activation boxes (visual focus indicators)
- [ ] Multi-line labels with proper wrapping
- [ ] Conditional rendering (show/hide entities)
- [ ] MSC diff (compare two sequences)
- [ ] Real-time streaming (watch live operations)

## References

- **UML Sequence Diagrams**: https://www.uml-diagrams.org/sequence-diagrams.html
- **ITU-T Z.120**: Message Sequence Chart (MSC) standard
- **PlantUML**: Inspiration for DSL syntax
- **Tetra Display System**: bash/tds/README.md

## Version History

- **1.0** (2025-10-23) - Initial implementation
  - Core data structures and state management
  - Hybrid layout algorithm
  - ASCII rendering with entity colors
  - TDS integration
