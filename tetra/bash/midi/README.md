# TMC - Tetra MIDI Controller

A sophisticated bidirectional MIDI mapping system with socket-based pub/sub architecture, integrated with Tetra's service management and color systems.

## The Tetra Way

TMC is a proper Tetra module. Use it like this:

```bash
tmod load midi    # Load the module
midi repl         # Start interactive REPL
```

See [USAGE.md](USAGE.md) for the tmod workflow and [QUICKSTART.md](QUICKSTART.md) for detailed setup.

## Overview

TMC (Tetra MIDI Controller) provides:

- **Two-layer mapping**: Hardware → Syntax → Semantic
- **Interactive learning**: Capture CC/NOTE mappings on the fly
- **Socket-based pub/sub**: Broadcast MIDI events to multiple subscribers
- **TDS color integration**: Map semantic colors to MIDI RGB for LED feedback
- **TSM managed**: Run as a service with process management
- **Portable C bridge**: Uses PortMIDI for cross-platform MIDI I/O

## Architecture

```
┌─────────────────┐
│ MIDI Controller │
└────────┬────────┘
         │ USB/MIDI
         ↓
┌─────────────────┐
│   tmc.c (C)     │ ← PortMIDI bridge
│  Read/Write     │
└────────┬────────┘
         │ Unix Socket
         ↓
┌─────────────────────────────────────┐
│  socket_server.sh (Bash)            │
│  ┌───────────────────────────────┐  │
│  │  mapper.sh                    │  │
│  │  ┌─────────────────────────┐  │  │
│  │  │ Layer 1: Hardware→Syntax│  │  │
│  │  │  CC 1 7 → p1           │  │  │
│  │  └─────────────────────────┘  │  │
│  │  ┌─────────────────────────┐  │  │
│  │  │ Layer 2: Syntax→Semantic│  │  │
│  │  │  p1 → VOLUME (0.0-1.0) │  │  │
│  │  └─────────────────────────┘  │  │
│  └───────────────────────────────┘  │
│                                     │
│  learn.sh ← Interactive learning    │
└────────┬────────────────────────────┘
         │ Broadcast
         ↓
┌─────────────────┐  ┌──────────────┐
│  Subscriber 1   │  │ Subscriber N │
└─────────────────┘  └──────────────┘
```

## Control Layout

### 8 Control Paths (48 controls)

Each path has:
- 1 pot (rotary knob): `p1-p8`
- 1 slider (fader): `s1-s8`
- 4 buttons: `b1a-b1d`, `b2a-b2d`, ..., `b8a-b8d`

### Transport (13 buttons)

`play`, `pause`, `stop`, `back`, `fwd`, `fback`, `ffwd`, `up`, `down`, `left`, `right`

**Total: 61 controls**

## Quick Start

### 1. Build the tmc binary

```bash
cd ~/tetra/bash/midi
tmc build

# Or manually:
gcc -o tmc tmc.c -lportmidi -lpthread
```

**Dependencies:**
- macOS: `brew install portmidi`
- Linux: `apt-get install libportmidi-dev`

### 2. List MIDI devices

```bash
tmc devices
# or
./tmc -l
```

Note the device IDs for your controller.

### 3. Start TMC service

```bash
# Set device IDs (optional - uses defaults if omitted)
export TMC_INPUT_DEVICE=0   # Your MIDI input device ID
export TMC_OUTPUT_DEVICE=0  # Your MIDI output device ID

# Start service via TSM
tsm start bash ~/tetra/bash/midi/core/socket_server.sh tmc
```

### 4. Learn mappings

```bash
source ~/tetra/bash/midi/midi.sh

# Interactive learning
tmc learn VOLUME p1 0.0 1.0
# (now move pot 1 on your controller)

# Learn all pots
tmc learn-all pots

# Use wizard for guided setup
tmc wizard
```

### 5. Check status

```bash
tmc status
tmc list
```

## Configuration

### Directory Structure

```
$TETRA_DIR/midi/
├── devices/
│   └── <device-id>/
│       ├── hardware_map.txt   # Syntax → CC/NOTE
│       └── semantic_map.txt   # Syntax → Semantic + ranges
├── sessions/
│   └── <session-name>/
│       ├── hardware_map.txt
│       └── semantic_map.txt
└── colors/
    └── color_table.txt        # TDS colors → MIDI RGB
```

### Hardware Map Format

```
# syntax|type|channel|controller_or_note
p1|CC|1|7
s1|CC|1|0
b1a|NOTE|1|60
play|NOTE|1|90
```

### Semantic Map Format

```
# syntax|semantic|min|max
p1|VOLUME|0.0|1.0
s1|BRIGHTNESS|0|127
b1a|TRIGGER_KICK|0|1
play|TRANSPORT_PLAY|0|1
```

### Color Table Format

```
# tds_color|hex_rgb|midi_r|midi_g|midi_b|notes
success|#00FF00|0|127|0|Green
error|#FF0000|127|0|0|Red
warning|#FFA500|127|65|0|Orange
```

## Mapping Layers

### Layer 1: Hardware → Syntax

Maps physical MIDI messages to standardized syntax names.

**Why?** Different controllers use different CC numbers. This layer normalizes them.

Example:
```
Controller A: Pot 1 = CC 7
Controller B: Pot 1 = CC 21

Both map to: p1
```

### Layer 2: Syntax → Semantic

Maps syntax names to application-specific semantic names with value ranges.

**Why?** Applications care about "VOLUME", not "p1". Value ranges normalize MIDI (0-127) to application ranges (e.g., 0.0-1.0).

Example:
```
p1 → VOLUME (0.0-1.0)
p2 → PAN (-1.0-1.0)
s1 → FADER_CH1 (0-127)
```

## Broadcast Modes

Control what gets sent to subscribers:

```bash
tmc mode raw       # Only raw MIDI: "CC 1 7 127"
tmc mode syntax    # Only syntax: "p1 127"
tmc mode semantic  # Only semantic: "VOLUME 1.0"
tmc mode all       # All three: "ALL CC 1 7 127 p1 VOLUME 1.0"
```

## Session Management

Save and load complete mapping sets:

```bash
# Save current mappings
tmc save my-setup

# Load saved mappings
tmc load my-setup

# Sessions are stored in: $TETRA_DIR/midi/sessions/
```

## Device Management

Support multiple MIDI controllers:

```bash
# Load device-specific mappings
tmc device my-akai-mpk

# Device configs stored in: $TETRA_DIR/midi/devices/
```

## Learning Mode

### Interactive Single Control

```bash
tmc learn VOLUME p1 0.0 1.0
# Move pot 1 → learns CC mapping + semantic name
```

### Batch Learning

```bash
tmc learn-all pots       # Learn p1-p8
tmc learn-all sliders    # Learn s1-s8
tmc learn-all buttons    # Learn b1a-b8d
tmc learn-all transport  # Learn play, pause, stop, etc.
```

### Wizard

Step-by-step guided learning:

```bash
tmc wizard
```

## Subscribers

Subscribe to MIDI events via sockets:

```bash
# Create subscriber socket
mkfifo /tmp/my_subscriber.sock

# Subscribe
echo "SUBSCRIBE /tmp/my_subscriber.sock" | nc -U $TSM_PROCESSES_DIR/sockets/tmc.sock

# Listen for events
while read line; do
    echo "MIDI Event: $line"
done < /tmp/my_subscriber.sock
```

## Color Control (Bidirectional)

Send colors to MIDI controller LEDs:

```bash
# Using TDS semantic colors
echo "SET_COLOR b1a success" | nc -U $TSM_PROCESSES_DIR/sockets/tmc.sock

# Direct hex color
echo "SET_COLOR b1a #FF0000" | nc -U $TSM_PROCESSES_DIR/sockets/tmc.sock
```

Color mappings defined in `$TETRA_DIR/midi/colors/color_table.txt`.

## Commands Reference

### Service Commands

```bash
tmc start          # Start TMC service
tmc stop           # Stop TMC service
tmc status         # Show status
```

### Learning Commands

```bash
tmc learn <semantic> [syntax] [min] [max]
tmc learn-all <pots|sliders|buttons|transport>
tmc wizard
tmc unlearn <name>
tmc clear
```

### Mapping Commands

```bash
tmc list           # Show all mappings
tmc mode <raw|syntax|semantic|all>
```

### Session Commands

```bash
tmc save [name]
tmc load [name]
```

### Device Commands

```bash
tmc device <id>
tmc devices        # List MIDI devices
```

### Config Commands

```bash
tmc config show
tmc config edit <hardware|semantic|colors>
tmc config templates
```

### Build Commands

```bash
tmc build
```

## Socket Protocol

### Commands to TMC Service

```
LEARN <semantic> [syntax] [min] [max]
LIST
MODE <raw|syntax|semantic|all>
SAVE [session]
LOAD [session]
LOAD_DEVICE <device-id>
SUBSCRIBE <socket-path>
UNSUBSCRIBE <socket-path>
SEND <MIDI-command>
SET_COLOR <syntax> <color>
STATUS
HEALTH
STOP
```

### Events from TMC Service

Depending on broadcast mode:

```
RAW CC 1 7 127
SYNTAX p1 127
SEMANTIC VOLUME 1.0
ALL CC 1 7 127 p1 VOLUME 1.0
```

## Integration Examples

### With TSM

```bash
# Start TMC as managed service
tsm start bash ~/tetra/bash/midi/core/socket_server.sh tmc

# Check running services
tsm list

# View logs
tsm logs tmc
```

### With TDS Colors

TMC automatically maps TDS semantic colors to MIDI RGB:

```bash
# In your application using TDS colors
success_color=$(tds_semantic_color "success")

# Set MIDI button LED to match
echo "SET_COLOR b1a success" | nc -U $TMC_SOCKET
```

### Custom Subscriber Service

```bash
#!/usr/bin/env bash
# midi_logger.sh - Log all MIDI events

SERVICE_NAME="midi-logger"
SOCKET_PATH="$TSM_PROCESSES_DIR/sockets/${SERVICE_NAME}.sock"
TMC_SOCKET="$TSM_PROCESSES_DIR/sockets/tmc.sock"
LOG_FILE="$TETRA_DIR/logs/midi_events.log"

# Subscribe to TMC
echo "SUBSCRIBE $SOCKET_PATH" | nc -U "$TMC_SOCKET"

# Listen for events
while true; do
    nc -l -U "$SOCKET_PATH" | while read -r event; do
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] $event" >> "$LOG_FILE"
    done
done
```

## Troubleshooting

### tmc binary not found

```bash
cd ~/tetra/bash/midi
tmc build
```

### No MIDI devices detected

```bash
# macOS: Check MIDI devices in Audio MIDI Setup
# Linux: Check with `aconnect -l` or `amidi -l`

# List with tmc
./tmc -l
```

### Service won't start

```bash
# Check if socket already exists
ls -l $TSM_PROCESSES_DIR/sockets/

# Remove stale socket
rm $TSM_PROCESSES_DIR/sockets/tmc.sock

# Check TSM logs
tsm logs tmc
```

### Mappings not persisting

```bash
# Make sure to save
tmc save my-setup

# Check save location
ls -l $TETRA_DIR/midi/sessions/
```

## Advanced Usage

### Value Normalization

MIDI CC values are 0-127. TMC normalizes to custom ranges:

```bash
# Volume: 0-127 → 0.0-1.0
tmc learn VOLUME p1 0.0 1.0

# Pan: 0-127 → -1.0-1.0 (center at 64)
tmc learn PAN p2 -1.0 1.0

# Custom: 0-127 → 100-500
tmc learn FREQUENCY s1 100 500
```

### Multiple Devices

Use device-specific configs:

```bash
# Create device configs
mkdir -p $TETRA_DIR/midi/devices/akai-mpk
mkdir -p $TETRA_DIR/midi/devices/novation-launchpad

# Learn mappings for each
tmc device akai-mpk
tmc learn-all pots
tmc save

tmc device novation-launchpad
tmc learn-all buttons
tmc save
```

### Conditional Broadcasting

Modify `socket_server.sh` to add filtering:

```bash
# Only broadcast values > 64
if [[ $value -gt 64 ]]; then
    broadcast "$event"
fi
```

## Files Reference

```
bash/midi/
├── midi.sh                     # Main entry point
├── tmc.c                       # PortMIDI bridge (C)
├── tmc                         # Compiled binary
├── core/
│   ├── mapper.sh               # Two-layer mapping engine
│   ├── learn.sh                # Interactive learning
│   └── socket_server.sh        # Socket server (TSM service)
├── config/
│   ├── hardware_map_template.txt
│   ├── semantic_map_template.txt
│   └── color_table_template.txt
├── services/
│   └── (example subscriber services)
└── README.md                   # This file
```

## Contributing

To extend TMC:

1. **Add control types**: Modify learning validation in `learn.sh`
2. **Add commands**: Extend `handle_command()` in `socket_server.sh`
3. **Add broadcast modes**: Extend `tmc_map_event()` in `mapper.sh`
4. **Add color mappings**: Edit `$TETRA_DIR/midi/colors/color_table.txt`

## License

Part of Tetra - see main Tetra LICENSE

## See Also

- TSM Documentation: `~/tetra/bash/tsm/README.md`
- TDS Documentation: `~/tetra/bash/tds/README.md`
- PortMIDI: http://portmedia.sourceforge.net/portmidi/
