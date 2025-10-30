# TMC Usage Guide

## The Tetra Way

TMC follows Tetra's module conventions:

```bash
# Load the MIDI module
tmod load midi

# Start interactive REPL
midi repl
```

That's it! The module system handles everything else.

## Quick Workflow

### 1. Load and Start

```bash
# In your shell
tmod load midi

# Start MIDI REPL
midi repl
```

### 2. Inside the REPL

```
TMC - Tetra MIDI Controller REPL
=================================

Type /help for commands, /start to begin, Ctrl+D to exit

⚠ TMC service not running. Start with: /start

midi ready > /start
Starting TMC service...
✓ Started service: tmc (TSM ID: 0)

midi ready > /devices
Available MIDI Devices:

Input Devices:
  [0] Arturia KeyStep 37 - CoreMIDI
  [2] IAC Driver Bus 1 - CoreMIDI

Output Devices:
  [0] Arturia KeyStep 37 - CoreMIDI
  [2] IAC Driver Bus 1 - CoreMIDI

midi ready > /learn VOLUME p1 0.0 1.0
Learning mode: Move or press control 'p1' now...
(Waiting 5s...)
(move pot 1 on your controller)

Detected: CC channel 1 controller 7 (value: 64)
✓ Learned: p1 → VOLUME
  Hardware: CC ch1 cc7
  Range: 0.0 - 1.0

Use '/save' to save this mapping

midi ready > /list
TMC Mappings (Device: none)
==================================================

Hardware Mappings (1):
-----------------------------------
SYNTAX   TYPE   CH   CC
p1       CC     1    7

Semantic Mappings (1):
------------------------------------
SYNTAX   SEMANTIC             MIN      MAX
p1       VOLUME               0.0      1.0

Broadcast Mode: all

midi ready > /save my-controller
Saved hardware map: /Users/you/tetra/midi/sessions/my-controller/hardware_map.txt
Saved semantic map: /Users/you/tetra/midi/sessions/my-controller/semantic_map.txt
Saved session: my-controller

midi ready > /monitor
Starting MIDI monitor...
✓ Started service: midi-monitor (TSM ID: 1)

View logs: tail -f /Users/you/tetra/midi/logs/midi_events.log

midi ready > (move pot 1)
12:34:56.789 ALL
  Raw:      CC ch1 cc7 = 127
  Syntax:   p1
  Semantic: VOLUME = 1.0

midi ready > ^D
Exiting MIDI REPL...
```

## REPL Commands

```
/start              Start TMC service
/stop               Stop TMC service
/status             Show status

/learn VOLUME p1 0.0 1.0
                    Learn a mapping
/learn-all pots     Learn all pots
/wizard             Learning wizard

/list               Show all mappings
/mode semantic      Set broadcast mode
/save my-setup      Save session
/load my-setup      Load session

/monitor            Start event monitor
/devices            List MIDI devices
/help               Show help
```

## Non-REPL Usage

You can also use direct commands:

```bash
# Load module
tmod load midi

# Use commands directly
midi start
midi learn VOLUME p1 0.0 1.0
midi list
midi save my-setup
```

## Module Loading

The MIDI module is lazy-loaded via Tetra's module system:

```bash
# First use loads the module automatically
tmod load midi
# or
midi  # Auto-loads on first use

# Check loaded modules
tmod list
```

## Configuration

All config is stored under `$TETRA_DIR/midi/`:

```
$TETRA_DIR/midi/
├── devices/          # Per-device configs
├── sessions/         # Saved sessions
├── colors/           # Color table
├── logs/             # Event logs
└── repl/             # REPL history
    └── history.repl
```

## Integration with TSM

TMC runs as a TSM-managed service:

```bash
# Start via REPL
midi repl
> /start

# Or directly
tsm start bash ~/tetra/bash/midi/core/socket_server.sh tmc

# Check status
tsm list

# View logs
tsm logs tmc

# Stop
tsm stop tmc
```

## Environment Variables

Optional configuration:

```bash
# Set MIDI device IDs before starting service
export TMC_INPUT_DEVICE=0   # Your controller input
export TMC_OUTPUT_DEVICE=0  # Your controller output

# Then start
midi start
# or in REPL: /start
```

## Examples

### Complete Setup from Scratch

```bash
# 1. Load module
tmod load midi

# 2. Enter REPL
midi repl

# 3. In REPL:
/start                          # Start service
/devices                        # Find your device
/learn VOLUME p1 0.0 1.0       # Learn volume knob
/learn PAN p2 -1.0 1.0         # Learn pan knob
/learn BRIGHTNESS s1 0 127      # Learn brightness slider
/learn TRIGGER_KICK b1a         # Learn kick button
/list                           # Check mappings
/save my-controller             # Save it
/monitor                        # Start monitor
```

Now move controls and watch events!

### Load Existing Setup

```bash
tmod load midi
midi repl

/start
/load my-controller
/list
/monitor
```

### Command-Line Workflow

```bash
# Load module
tmod load midi

# Start service
midi start

# Learn controls
midi learn VOLUME p1 0.0 1.0
midi learn-all pots

# Check
midi list
midi status

# Save
midi save my-setup
```

## Building tmc Binary

Required for actual MIDI hardware:

```bash
# One-time build
cd ~/tetra/bash/midi
make

# Or via command
midi build

# Test
./tmc -l
```

## Troubleshooting

**"tmod: command not found"**
```bash
source ~/tetra/tetra.sh
```

**"MIDI module not found"**
```bash
# Module should be registered in boot_modules.sh
# Check:
grep midi ~/tetra/bash/boot/boot_modules.sh
```

**"TMC service won't start"**
```bash
# Build binary first
midi build

# Check TSM processes directory
echo $TSM_PROCESSES_DIR
ls -la $TSM_PROCESSES_DIR

# Try manual start
tsm start bash ~/tetra/bash/midi/core/socket_server.sh tmc
```

**"No MIDI devices found"**
```bash
# Install PortMIDI
brew install portmidi  # macOS

# List devices
./tmc -l
```

## See Also

- Full README: `~/tetra/bash/midi/README.md`
- Quick Start: `~/tetra/bash/midi/QUICKSTART.md`
- TSM Docs: `~/tetra/bash/tsm/README.md`
- Tetra Modules: `tmod help`
