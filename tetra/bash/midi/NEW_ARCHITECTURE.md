# MIDI Module - Clean TSM Architecture

## Overview

Complete refactor to clean separation of concerns:
- **TSM Service**: Background daemon managed by TSM
- **CLI**: All management via `midi` commands
- **REPL**: Pure monitor, no commands, just displays events

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ User CLI Commands                                           │
├─────────────────────────────────────────────────────────────┤
│ midi start          # Start TSM service                     │
│ midi stop           # Stop service                          │
│ midi status         # Show status                           │
│ midi load-map NAME  # Hot-reload map                        │
│ midi variant a      # Switch variant                        │
│ midi repl [mode]    # Start monitor                         │
└─────────────────────────────────────────────────────────────┘
          │
          ↓ (sends OSC control messages)
┌─────────────────────────────────────────────────────────────┐
│ TSM Background Service: midi-bridge                         │
├─────────────────────────────────────────────────────────────┤
│ Process: node midi.js -v                                    │
│ Config: ~/tetra/midi/config.toml (auto-loaded)            │
│ Listens: OSC control messages on :1983                     │
│ Broadcasts: OSC multicast 239.1.1.1:1983                   │
│ - /midi/raw/cc/{ch}/{cc} {val}                            │
│ - /midi/mapped/{variant}/{semantic} {norm_val}            │
│ - /midi/state/{key} {value}                                │
└─────────────────────────────────────────────────────────────┘
          │
          ↓ (OSC multicast)
┌─────────────────────────────────────────────────────────────┐
│ MIDI Monitor (Pure Display)                                │
├─────────────────────────────────────────────────────────────┤
│ Command: midi repl [mode]                                   │
│ Modes:                                                      │
│  - raw:      CC1.40=127                                    │
│  - semantic: VOLUME_1=0.503                                │
│  - both:     CC1.40=127 → VOLUME_1=0.503                   │
│  - silent:   [vmx8:a][CC40=127] (prompt only)             │
│ No commands, Ctrl+C to exit                                │
└─────────────────────────────────────────────────────────────┘
```

## Configuration File

Location: `~/tetra/midi/config.toml`

```toml
[service]
device_input = "VMX8 Bluetooth"
device_output = "VMX8 Bluetooth"
default_map = "vmx8[0]"
default_variant = "a"
osc_port = 1983
osc_multicast = "239.1.1.1"
auto_reload_maps = true
verbose = true

[maps]
paths = ["*.json", "controllers/*.json"]

[repl]
default_mode = "both"
show_timestamps = false
color = true
```

## Workflow

### 1. Start Service

```bash
midi start
```

This:
- Starts `midi.js` as TSM-managed service
- Loads `config.toml`
- Auto-loads default map (`vmx8[0]`)
- Sets default variant (`a`)
- Begins broadcasting OSC

### 2. Monitor Events

```bash
# Show both raw and semantic
midi repl

# Show only semantic values
midi repl semantic

# Show only raw MIDI
midi repl raw

# Silent mode (prompt only, no event display)
midi repl silent
```

### 3. Manage Maps

```bash
# Load different map
midi load-map akai[0]

# Reload current map (after editing JSON)
midi reload-map

# Reload config.toml
midi reload-config
```

### 4. Switch Variants

```bash
# Switch to variant 'b' (effects mode)
midi variant b

# Switch to variant 'c' (synth mode)
midi variant c
```

### 5. Check Status

```bash
midi status
```

### 6. Stop Service

```bash
midi stop
```

## OSC Control API

Send to `localhost:1983`:

```
/midi/control/load-map {map_name}     # Load map
/midi/control/reload                   # Reload current map
/midi/control/reload-config            # Reload config.toml
/midi/control/variant {a|b|c|d}        # Switch variant
/midi/control/status                   # Request state broadcast
```

## Key Changes

### Before (Hybrid/Confusing)
- REPL had slash commands
- Service management mixed with interactive mode
- Unclear separation of concerns

### After (Clean/Clear)
- **Service**: TSM-managed daemon
- **CLI**: All management via `midi` commands
- **REPL**: Pure monitor, no commands
- **Config**: Centralized in TOML file
- **OSC**: Control channel for remote management

## Files

**Core:**
- `midi.js` - Service (enhanced with config loading, OSC control)
- `midi.sh` - CLI commands (completely rewritten)
- `config.toml` - Configuration
- `maps/*.json` - Map files

**Monitoring:**
- `core/repl_monitor.sh` - Pure monitor REPL
- `osc_repl_listener.js` - OSC subscriber

**Helpers:**
- `osc_send.js` - Send OSC control messages

**Deprecated:**
- `midi.sh.old` - Old hybrid version (backup)
- `core/repl.sh` - Old REPL with commands

## Benefits

1. **Clean Separation**: Service, CLI, Monitor are independent
2. **TSM Integration**: Proper daemon management
3. **Hot Reload**: Change maps/config without restart
4. **Multi-Consumer**: Multiple monitors can run simultaneously
5. **Networked**: OSC allows remote control and monitoring
6. **Configurable**: TOML config for all settings
7. **Maintainable**: Clear responsibilities, no hybrid modes
