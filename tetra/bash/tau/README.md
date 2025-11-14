# TAU - Tetra Audio Module

TAU is a real-time audio synthesis engine integrated into the Tetra service management system, following the same pattern as the MIDI module.

## Quick Start

### 1. Setup Environment

```bash
# Set strong global (required)
export TETRA_SRC=~/src/devops/tetra/bash

# Source the module
source $TETRA_SRC/tau/tau.sh
```

### 2. Start TAU Service

```bash
tau start
```

This will:
- Start the tau audio engine as a TSM-managed service
- Create Unix socket at `~/tau/runtime/tau.sock`
- Enable real-time audio output

### 3. Quick Audio Test

```bash
# Play 440Hz test tone
tau test

# Stop the sound
tau voice 1 off
```

## Usage

### Service Management

```bash
tau start      # Start tau audio engine (TSM-managed)
tau stop       # Stop tau service
tau restart    # Restart service
tau status     # Show service status
```

### Voice Control (8 voices available)

```bash
# Set voice 1 to 440Hz, 30% volume, and enable
tau voice 1 freq 440
tau voice 1 gain 0.3
tau voice 1 on

# Change frequency
tau voice 1 freq 880

# Disable voice
tau voice 1 off
```

### Channel Control (4 channels)

```bash
# Set channel 1 volume
tau channel 1 gain 0.8

# Pan channel 1 (0=left, 0.5=center, 1=right)
tau channel 1 pan 0.5
```

### Master Controls

```bash
# Set master volume
tau master volume 0.7
```

## Architecture

```
┌─────────────────────────────────────────┐
│  tau CLI (bash)                         │
│  - Service management                   │
│  - Audio control commands               │
└───────────────┬─────────────────────────┘
                │ Unix Socket
                │ ~/tau/runtime/tau.sock
┌───────────────▼─────────────────────────┐
│  tau Service (C binary, TSM-managed)    │
│  - Real-time audio engine               │
│  - 8 synth voices                       │
│  - 4 mixer channels                     │
│  - OSC listener (MIDI integration)      │
└─────────────────────────────────────────┘
```

## Integration

### TSM Service Management

TAU runs as a TSM-managed service, just like other tetra modules:

```bash
# Check running services
tsm ls

# See tau in the list
# 16  tau-8009    port    78984 8009  online  pid  18m
```

### MIDI Integration

TAU listens for OSC messages from MIDI-1983 on multicast `239.1.1.1:1983`, enabling hardware MIDI control of audio parameters.

See `OSC_QUICKSTART.md` in the tau source directory for MIDI integration details.

## Directory Structure

```
~/tau/                          # TAU_DIR (strong global)
├── runtime/
│   └── tau.sock               # Unix socket for IPC
├── config.toml                # Configuration (future)
├── samples/                   # Audio samples (future)
└── sessions/                  # Session files (future)
```

## Configuration

### Environment Variables

- `TAU_SRC` - Source directory (default: `$TETRA_SRC/bash/tau`)
- `TAU_DIR` - Data directory (default: `~/tau`)
- `TAU_CONFIG` - Config file (default: `$TAU_DIR/config.toml`)

### Binary Location

The tau module looks for the tau binary in:
1. `$TAU_SRC/tau`
2. `~/src/mricos/demos/tau/tau`

To build the tau binary:
```bash
cd ~/src/mricos/demos/tau
./build.sh
```

## Examples

### Simple Synthesis

```bash
# Start service
tau start

# Create 440Hz sine wave
tau voice 1 freq 440
tau voice 1 gain 0.3
tau voice 1 on

# Add harmony (major third)
tau voice 2 freq 550
tau voice 2 gain 0.2
tau voice 2 on

# Adjust mix
tau channel 1 gain 0.8
tau master volume 0.6

# Stop
tau voice 1 off
tau voice 2 off
```

### Multiple Voices

```bash
# Create chord (C major: 264, 330, 396 Hz)
tau voice 1 freq 264 && tau voice 1 gain 0.25 && tau voice 1 on
tau voice 2 freq 330 && tau voice 2 gain 0.25 && tau voice 2 on
tau voice 3 freq 396 && tau voice 3 gain 0.25 && tau voice 3 on

# Stop all
tau voice 1 off && tau voice 2 off && tau voice 3 off
```

## Comparison with MIDI Module

| Feature | MIDI Module | TAU Module |
|---------|-------------|------------|
| Service Type | OSC broadcaster | Audio engine |
| TSM Managed | ✅ Yes | ✅ Yes |
| Unix Socket | N/A | ✅ ~/tau/runtime/tau.sock |
| OSC Port | 1983 (multicast) | 1983 (listener) |
| REPL | ✅ Interactive TUI | ⏳ Planned |
| Strong Global | MIDI_SRC, MIDI_DIR | TAU_SRC, TAU_DIR |

## Future Enhancements

- Interactive REPL (like midi repl)
- Sample playback management
- Session save/load
- Configuration file support
- Pattern sequencing
- Recording/export

## See Also

- MIDI Module: `$TETRA_SRC/bash/midi`
- TSM Documentation: `$TETRA_SRC/bash/tsm`
- TAU Architecture: `~/src/mricos/demos/tau/ARCHITECTURE.md`
- OSC Integration: `~/src/mricos/demos/tau/OSC_QUICKSTART.md`
