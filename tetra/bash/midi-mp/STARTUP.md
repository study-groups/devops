# MIDI-MP Startup Guide

Quick guide for starting MIDI-MP with TSM and integrating with the MIDI module.

## Architecture: 3-Process Chain

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│  MIDI Hardware  │      │   MIDI-MP Router │      │  Consumer App   │
│     midi        │ OSC  │     midi-mp      │ OSC  │    cymatica     │
│                 │─────→│                  │─────→│                 │
│   Port: 1983    │      │   Port: 2020     │      │   Port: 3000    │
└─────────────────┘      └──────────────────┘      └─────────────────┘
     VMX8 BT                 Routes/Filters          Visualizes

  TSM displays as:     midi-1983    midi-mp-2020    cymatica-3000
```

## Quick Start

### 1. Source the module
```bash
source ~/tetra/bash/midi-mp/midi-mp.sh
```

Or add to your shell profile for automatic loading:
```bash
echo "source ~/tetra/bash/midi-mp/midi-mp.sh" >> ~/.bashrc
```

### 2. Install dependencies (first time only)
```bash
midi-mp build
```

### 3. Start the 3-process chain

**IMPORTANT:** Start in order!

```bash
# 1. Start MIDI hardware bridge (if not already running)
midi start              # Starts midi on port 1983 (displays as midi-1983)

# 2. Start MIDI-MP router
midi-mp router-cymatica # Starts midi-mp on port 2020 (displays as midi-mp-2020)

# 3. Start consumer app
midi-mp cymatica-start  # Starts cymatica on port 3000 (displays as cymatica-3000)
```

**Quick all-in-one check:**
```bash
tsm list | grep -E "(midi|midi-mp|cymatica)"
```

## Integration with MIDI Module

The `midi-mp` router works alongside the `midi` module.

### Process Names and Ports:

| Process | Name | Port | TSM Display | Purpose |
|---------|------|------|-------------|---------|
| MIDI Hardware Bridge | `midi` | 1983 | `midi-1983` | VMX8 Bluetooth → OSC broadcast |
| MIDI-MP Router | `midi-mp` | 2020 | `midi-mp-2020` | Route/filter/transform messages |
| Cymatica Consumer | `cymatica` | 3000 | `cymatica-3000` | Visualize cymatics patterns |

### Data Flow:

```
VMX8 Controller (MIDI Hardware)
        ↓ MIDI over Bluetooth
    midi (Node.js process, port 1983)
        ↓ OSC UDP broadcast :1983
        ↓ /midi/raw/cc/1/40 [0-127]
 midi-mp (Node.js router, port 2020)
        ↓ Filters CC 40-47 (channel 1)
        ↓ Transforms to semantic events
        ↓ OSC UDP broadcast :2020
        ↓ /midi-mp/event/cymatics.frequency [20-2000]
cymatica (Consumer app, port 3000)
        ↓ Receives semantic events
        ↓ Updates visualization
    Cymatics Visualization
```

## Port Configuration

Port numbers have symbolic meaning:

- **1983** - Year MIDI specification was released
- **2020** - MIDI 2.0 protocol introduction
- **57121** - Traditional OSC MIDI bridge port
- **3000** - Common web app port (consumer)

### Changing Ports:

```bash
# Start router on custom port
midi-mp start --port 4000 cymatica  # midi-mp-4000

# Start consumer on custom port
midi-mp cymatica-start 5000         # cymatica-5000
```

## Management Commands

### Router Commands:
```bash
midi-mp start [config] [port]    # Start router
midi-mp router-cymatica          # Start with cymatica config
midi-mp router-broadcast         # Start with broadcast config
midi-mp status                   # Check router status
midi-mp logs                     # View router logs
midi-mp stop                     # Stop router
midi-mp restart                  # Restart router
```

### Consumer App Commands:
```bash
midi-mp cymatica-start [port]    # Start cymatica app (default: 3000)
midi-mp cymatica-stop            # Stop cymatica app
midi-mp cymatica-logs            # View cymatica logs
midi-mp cymatica-status          # Check cymatica status
```

### MIDI Hardware Commands:
```bash
midi start                       # Start MIDI hardware bridge (midi-1983)
midi stop                        # Stop MIDI bridge
midi status                      # Check MIDI bridge status
```

### Configuration:
```bash
midi-mp config show              # Show config paths
midi-mp config edit cymatica     # Edit example config
midi-mp help                     # Full help
```

## Available Example Configs

Located in `examples/`:
- **broadcast.json** - All players get all messages
- **cymatica.json** - Cymatics visualizer with 8 controls mapped
- **vj-split.json** - Route by control ranges to different screens
- **collaborative-daw.json** - Multi-user DAW control

## Custom Configurations

Edit an example:
```bash
midi-mp config edit cymatica
```

Or create your own JSON config:
```json
{
  "mode": "broadcast",
  "oscHost": "0.0.0.0",
  "oscPort": 57121,
  "filter": {
    "cc": [40, 41, 42, 43, 44, 45, 46, 47],
    "channel": 1
  },
  "transform": {
    "/midi/raw/cc/1/40": {
      "event": "my.custom.event",
      "normalize": [0, 1]
    }
  },
  "verbose": true
}
```

Then start with:
```bash
midi-mp start /path/to/my-config.json
```

## TSM Integration

All processes managed via TSM (Tetra Service Manager):

```bash
# View all processes
tsm list

# View specific process chain
tsm list | grep -E "(midi-1983|midi-mp-2020|cymatica-3000)"

# Detailed info
tsm info 11           # MIDI hardware bridge
tsm info <id>         # Any process by TSM ID

# View logs
tsm logs 11           # MIDI bridge logs
tsm logs <id>         # Any process logs
```

### Starting via TSM directly:

```bash
# MIDI hardware bridge
tsm start --port 57121 --name midi-1983 node ~/tetra/bash/midi/midi.js -i 0 -o 0 -v

# MIDI-MP router
tsm start --port 2020 --name midi-mp node ~/tetra/bash/midi-mp/router.js ~/tetra/bash/midi-mp/examples/cymatica.json

# Cymatica consumer
tsm start --port 3000 --name cymatica node ~/tetra/bash/midi-mp/cymatica-app.js 3000
```

**Recommended:** Use the helper commands (`midi start`, `midi-mp router-cymatica`, `midi-mp cymatica-start`) instead.

## Troubleshooting

### Process Chain Not Working

**Problem:** Messages not flowing through the chain

**Solution:** Check each stage:

```bash
# 1. Verify all 3 processes are running
tsm list | grep -E "(midi-1983|midi-mp-2020|cymatica-3000)"

# 2. Check MIDI hardware bridge
midi status
tsm logs <midi-id>    # Look for MIDI input

# 3. Check router
midi-mp status
midi-mp logs          # Look for received/routed messages

# 4. Check consumer app
midi-mp cymatica-status
midi-mp cymatica-logs  # Look for received events
```

### Router not starting
1. Check dependencies: `midi-mp build`
2. Verify MIDI hardware running: `midi status`
3. Check port availability: `lsof -i :2020`
4. Check config file: `midi-mp config show`

### Consumer app not receiving messages
1. Verify router is running: `midi-mp status`
2. Check router logs: `midi-mp logs`
3. Verify consumer port matches router config: `lsof -i :3000`
4. Check consumer logs: `midi-mp cymatica-logs`

### MIDI hardware not detected
1. List MIDI devices: `midi devices`
2. Check Bluetooth connection for VMX8
3. Try restarting: `midi stop && midi start`

### Finding Process TSM IDs
```bash
# All processes
tsm list

# Specific processes
tsm list | grep midi-1983      # Hardware bridge
tsm list | grep midi-mp-2020   # Router
tsm list | grep cymatica-3000  # Consumer
```

## Module Variables

Set these before sourcing if you need custom paths:

```bash
export MIDI_MP_SRC="$TETRA_SRC/bash/midi-mp"    # Source directory
export MIDI_MP_DIR="$TETRA_DIR/midi-mp"         # Data directory
export MIDI_MP_PORT=2020                        # Default port
```

## Summary

### Process Naming Convention

Processes use simple names with TSM adding the port suffix:

- **midi** → port 1983 → TSM displays: `midi-1983` (MIDI spec released 1983)
- **midi-mp** → port 2020 → TSM displays: `midi-mp-2020` (MIDI 2.0 protocol 2020)
- **cymatica** → port 3000 → TSM displays: `cymatica-3000`

### Key Points
- **3-process chain:** Hardware → Router → Consumer
- **Manual startup:** Start each process separately in order
- **OSC protocol:** All communication via OSC UDP broadcast
- **TSM managed:** All processes tracked by Tetra Service Manager
- **Tab completion:** Available for all commands
- **Dual-mode router:** Supports port-based or socket-based operation

### Quick Commands Reference
```bash
# Start full chain
midi start                 # midi on port 1983 (displays as midi-1983)
midi-mp router-cymatica    # midi-mp on port 2020 (displays as midi-mp-2020)
midi-mp cymatica-start     # cymatica on port 3000 (displays as cymatica-3000)

# Check status
tsm list | grep -E "(midi|midi-mp|cymatica)"

# Stop chain (in reverse order)
midi-mp cymatica-stop
midi-mp stop
midi stop
```
