# MIDI OSC API Documentation

## Overview

The MIDI bridge (`midi.js`) broadcasts MIDI events via OSC (UDP) for networked, multi-consumer architectures. Maps are first-class citizens supporting multiple semantic variants for different compositional contexts.

## Architecture

```
VMX8 Controller (Bluetooth)
      ↓ MIDI
midi.js (Node.js Bridge)
  ├─ Loads JSON map file: vmx8[0].json
  ├─ Current variant: a/b/c/d
  └─ Broadcasts OSC UDP :1983
      ↓
  [Multiple OSC Subscribers]
    - REPL (bash + osc_repl_listener.js)
    - Game engines
    - Web visualizers
    - DAWs / Music apps
```

## OSC Message Format

### Raw MIDI (Always Broadcast)

```
/midi/raw/cc/{channel}/{controller} {value:int}
/midi/raw/note/{channel}/{note} {velocity:int}
/midi/raw/program/{channel} {program:int}
/midi/raw/pitchbend/{channel} {value:int}
```

**Examples:**
```
/midi/raw/cc/1/40 127          # Pot 1 moved to max
/midi/raw/note/1/42 127        # Button pressed
/midi/raw/note/1/42 0          # Button released
```

### Mapped Semantics (Only When Map Loaded)

```
/midi/mapped/{variant}/{semantic} {normalized_value:float}
```

**Examples:**
```
/midi/mapped/a/VOLUME_1 0.503937      # Variant 'a', pot mapped to VOLUME_1
/midi/mapped/b/REVERB_MIX 0.850394    # Variant 'b', same pot, different semantic
/midi/mapped/a/MUTE_1 1               # Button mapped to MUTE_1, pressed
```

**NULL Semantics (Unmapped Controls):**
- If a control has NO mapping in the current variant, it broadcasts ONLY raw OSC
- No `/midi/mapped/...` message is sent
- This represents the "mute" or NULL semantic

### State Metadata

Broadcast on startup and when variant changes:

```
/midi/state/controller {name:string}           # "vmx8"
/midi/state/instance {num:int}                 # 0
/midi/state/variant {letter:string}            # "a"
/midi/state/variant_name {name:string}         # "mixer"
```

### Control Messages (Send to Bridge)

```
/midi/control/variant {a|b|c|d:string}    # Switch to variant
/midi/control/reload                       # Reload map file
/midi/control/status                       # Request state broadcast
```

## Map File Format

### Location
`~/tetra/midi/maps/{controller_name}[{instance}].json`

Example: `vmx8[0].json`

### Structure

```json
{
  "controller": "vmx8",
  "instance": 0,
  "description": "VMX8 8-track controller",

  "profile": {
    "pots": ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"],
    "sliders": ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"],
    "buttons": {
      "1": ["b1a", "b1b", "b1c", "b1d"],
      "2": ["b2a", "b2b", "b2c", "b2d"]
    }
  },

  "hardware": {
    "p1": {"channel": 1, "cc": 40, "type": "pot"},
    "s1": {"channel": 1, "cc": 48, "type": "slider"},
    "b1a": {"channel": 1, "note": 40, "type": "button"}
  },

  "variants": {
    "a": {
      "name": "mixer",
      "description": "8-track mixer mode",
      "mappings": {
        "p1": {"semantic": "VOLUME_1", "min": 0.0, "max": 1.0},
        "s1": {"semantic": "FADER_1", "min": 0.0, "max": 1.0},
        "b1a": {"semantic": "MUTE_1"}
      }
    },
    "b": {
      "name": "effects",
      "description": "Effects control",
      "mappings": {
        "p1": {"semantic": "REVERB_MIX", "min": 0.0, "max": 1.0},
        "s1": {"semantic": "DELAY_TIME", "min": 0.0, "max": 2000.0}
      }
    }
  },

  "default_variant": "a"
}
```

### Variant Design Principles

1. **Profile** - Physical hardware layout (pots, sliders, buttons)
2. **Hardware** - MIDI CC/note mappings for each control
3. **Variants** - Different semantic contexts (a/b/c/d)
4. **Omission = NULL** - Unmapped controls don't appear in variant mappings

## Value Normalization

For continuous controls (CC):
```
normalized = min + (midi_value / 127.0) * (max - min)
```

For buttons (Note On/Off):
```
value = pressed ? 1 : 0
```

## Usage Examples

### Start MIDI Bridge (Raw Only)

```bash
node midi.js -i "VMX8 Bluetooth" -o "VMX8 Bluetooth" -v
```

### Start MIDI Bridge with Map

```bash
node midi.js -i "VMX8 Bluetooth" --map ~/tetra/midi/maps/vmx8[0].json -v
```

### Start with Specific Variant

```bash
node midi.js -i "VMX8 Bluetooth" --map vmx8[0].json --variant b -v
```

### Start MIDI REPL

```bash
# Local
midi repl

# Remote bridge
midi repl --osc-host 192.168.1.100 --osc-port 1983
```

### Switch Variant from REPL

```
/variant b
```

### Subscribe to OSC (External App)

```javascript
// Node.js example
const osc = require('osc');

const udpPort = new osc.UDPPort({
    localAddress: "0.0.0.0",
    localPort: 1983
});

// Listen to raw MIDI
udpPort.on("message", (oscMsg) => {
    if (oscMsg.address.startsWith('/midi/raw/')) {
        console.log('Raw MIDI:', oscMsg.address, oscMsg.args);
    }
});

// Listen to semantic values (variant 'a')
udpPort.on("message", (oscMsg) => {
    if (oscMsg.address.startsWith('/midi/mapped/a/')) {
        const semantic = oscMsg.address.split('/')[4];
        const value = oscMsg.args[0].value;
        console.log(`${semantic} = ${value}`);
    }
});

udpPort.open();
```

## Multi-Consumer Architecture

### Scenario: Networked Composition

**Machine A: MIDI Bridge**
```bash
node midi.js -i "VMX8 Bluetooth" --map vmx8[0].json --variant a -v
# Broadcasts to network 255.255.255.255:1983
```

**Machine B: REPL Consumer**
```bash
midi repl --osc-host 192.168.1.100
# Displays events, switches variants
```

**Machine C: Game Engine**
```javascript
// Subscribe to player volume control
osc.on('/midi/mapped/a/VOLUME_1', (value) => {
    setPlayerVolume(value);
});
```

**Machine D: Web Visualizer**
```javascript
// Subscribe to all raw CC for visual feedback
osc.on('/midi/raw/cc/+/+', (channel, cc, value) => {
    updateKnobVisual(cc, value);
});
```

## REPL Prompt Format

```
[controller[instance]:variant name][CC#][val]>
```

**Example:**
```
[vmx8[0]:a mixer][CC40][127]>
```

Shows:
- Controller: `vmx8`
- Instance: `0`
- Current variant: `a`
- Variant name: `mixer`
- Last CC: `40`
- Last value: `127`

## Files

- `midi.js` - MIDI bridge with OSC broadcasting
- `osc_repl_listener.js` - OSC subscriber for REPL
- `osc_send.js` - Simple OSC message sender
- `core/repl.sh` - OSC-based REPL
- `maps/vmx8[0].json` - Example map file
- `OSC_API.md` - This documentation

## See Also

- VMX8 controller documentation
- OSC specification: http://opensoundcontrol.org
- easymidi: https://github.com/dinchak/node-easymidi
- osc library: https://github.com/colinbdclark/osc.js
