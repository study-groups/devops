# MIDI-to-OSC Protocol Reference

Complete reference for the OSC message protocol used by the midi-1983 broadcast system.

## Overview

The MIDI service (`midi-1983`) acts as a bridge between MIDI hardware and Open Sound Control (OSC), broadcasting events to any application on the network.

**Architecture:**
```
MIDI Hardware → midi.js (TSM) → OSC Multicast (239.1.1.1:1983) → Listeners
                                      ↓
                          ┌─────────────┬───────────────┬──────────────┐
                          │             │               │              │
                        REPL      tau-audio-engine   Game Engine   Custom App
```

**Key Features:**
- **One-to-many broadcast** - Multiple apps can receive same MIDI events
- **Dual layer** - Raw MIDI + semantic mappings (when map loaded)
- **Hot-reload** - Change maps without restarting
- **Bidirectional** - Send MIDI out via OSC control messages

## Network Configuration

| Parameter | Value |
|-----------|-------|
| Multicast Address | 239.1.1.1 |
| Port | 1983 |
| Protocol | UDP |
| Message Format | OSC |

## Message Types

### 1. Raw MIDI Events (Always Broadcast)

These are sent for ALL MIDI events, regardless of map configuration.

#### Control Change (CC)
```
/midi/raw/cc/{channel}/{controller} [value:int]
```

**Example:**
```
/midi/raw/cc/1/40 64
```
- Channel: 1
- Controller: 40
- Value: 64 (0-127)

**Use case:** Direct MIDI control without mapping layer

---

#### Note On/Off
```
/midi/raw/note/{channel}/{note} [velocity:int]
```

**Example:**
```
/midi/raw/note/1/60 127    # Note on (C4, velocity 127)
/midi/raw/note/1/60 0      # Note off (velocity 0)
```
- Channel: 1
- Note: 60 (MIDI note number)
- Velocity: 0-127 (0 = note off)

**Use case:** Trigger events, button presses, keyboard input

---

#### Program Change
```
/midi/raw/program/{channel} [program:int]
```

**Example:**
```
/midi/raw/program/1 5
```
- Channel: 1
- Program: 5 (0-127)

**Use case:** Preset/patch selection

---

#### Pitch Bend
```
/midi/raw/pitchbend/{channel} [value:int]
```

**Example:**
```
/midi/raw/pitchbend/1 8192
```
- Channel: 1
- Value: 0-16383 (8192 = center/no bend)

**Use case:** Pitch modulation, smooth parameter control

---

### 2. Mapped Semantic Events (When Map Loaded)

These are broadcast ONLY when a map file is loaded and a control has a semantic mapping.

```
/midi/mapped/{variant}/{semantic} [value:float]
```

**Example:**
```
/midi/mapped/a/FILTER_CUTOFF 0.750000
```
- Variant: a (current active variant)
- Semantic: FILTER_CUTOFF (user-defined name)
- Value: 0.750000 (normalized float, typically 0.0-1.0)

**Value Normalization:**
```
normalized = min + (midi_value / 127.0) * (max - min)
```

Example with custom range:
```json
{
  "p1": {"semantic": "FREQUENCY", "min": 20.0, "max": 20000.0}
}
```
- MIDI value 64 → normalized = 20 + (64/127) * (19980) ≈ 10070 Hz

**Use case:** Application-specific parameter control with meaningful names

---

### 3. State Metadata (Broadcast on Change)

#### Controller Information
```
/midi/state/controller [name:string]
/midi/state/instance [number:int]
```

**Example:**
```
/midi/state/controller "vmx8"
/midi/state/instance 0
```

---

#### Variant Information
```
/midi/state/variant [letter:string]
/midi/state/variant_name [name:string]
```

**Example:**
```
/midi/state/variant "a"
/midi/state/variant_name "mixer"
```

---

#### Device Information
```
/midi/state/input_device [device:string]
/midi/state/output_device [device:string]
```

**Example:**
```
/midi/state/input_device "VMX8A:VMX8A MIDI 1"
/midi/state/output_device "VMX8A:VMX8A MIDI 1"
```

---

### 4. Control Messages (Send to MIDI Service)

These messages control the MIDI bridge behavior. Send to `239.1.1.1:1983`.

#### Variant Switching
```
/midi/control/variant [variant:string]
```

**Example:**
```
/midi/control/variant "b"
```

---

#### Map Management
```
/midi/control/load-map [map_name:string]
/midi/control/reload
/midi/control/reload-config
```

**Example:**
```
/midi/control/load-map "vmx8[0]"    # Load specific map
/midi/control/reload                 # Reload current map
/midi/control/reload-config          # Reload config.toml
```

---

#### Status Request
```
/midi/control/status
```

**Effect:** Triggers broadcast of all `/midi/state/*` messages

---

#### MIDI Output
```
/midi/out/note [channel:int] [note:int] [velocity:int]
/midi/out/cc [channel:int] [controller:int] [value:int]
```

**Example:**
```
/midi/out/note 1 60 127     # Send note on
/midi/out/cc 1 7 64         # Send CC (volume)
```

**Use case:** Control MIDI hardware from software (LED feedback, motorized faders, etc.)

---

## Message Flow Examples

### Example 1: Simple CC Control

```
User turns knob (CC40) on MIDI controller
    ↓
midi.js receives: CC channel=1 controller=40 value=64
    ↓
Broadcasts:
    /midi/raw/cc/1/40 64                    (always)
    /midi/mapped/a/VOLUME_1 0.503937        (if mapped in variant 'a')
    ↓
All listeners receive both messages
```

### Example 2: Variant Switch

```
User sends: /midi/control/variant "b"
    ↓
midi.js switches internal state
    ↓
Broadcasts:
    /midi/state/variant "b"
    /midi/state/variant_name "synth"
    ↓
Future MIDI events use variant 'b' mappings:
    /midi/mapped/b/FILTER_RESONANCE 0.25
```

### Example 3: Hot-Reload Map

```
User edits map file: ~/tetra/midi/maps/vmx8[0].json
User sends: /midi/control/reload
    ↓
midi.js reloads map from disk
    ↓
Broadcasts:
    /midi/state/variant "a"              (re-announces state)
    /midi/state/variant_name "mixer"
    ↓
Next MIDI event uses updated mappings
```

---

## Listening to OSC Broadcasts

### Node.js Example

```javascript
const osc = require('osc');

const udpPort = new osc.UDPPort({
    localAddress: "0.0.0.0",
    localPort: 1983,
    metadata: true
});

udpPort.on('message', (oscMsg) => {
    console.log('Received:', oscMsg.address, oscMsg.args);

    // Handle different message types
    if (oscMsg.address.startsWith('/midi/raw/cc/')) {
        const value = oscMsg.args[0].value;
        console.log('CC value:', value);
    }
    else if (oscMsg.address.startsWith('/midi/mapped/')) {
        const normalizedValue = oscMsg.args[0].value;
        console.log('Mapped value:', normalizedValue);
    }
});

udpPort.on('ready', () => {
    // Join multicast group
    udpPort._dgram.addMembership('239.1.1.1');
    console.log('Listening on 239.1.1.1:1983');
});

udpPort.open();
```

### Python Example

```python
from pythonosc import dispatcher
from pythonosc import osc_server
import struct
import socket

MULTICAST_ADDR = '239.1.1.1'
PORT = 1983

def handle_raw_cc(address, *args):
    # address = "/midi/raw/cc/1/40"
    parts = address.split('/')
    channel = int(parts[3])
    controller = int(parts[4])
    value = args[0]
    print(f"Raw CC: ch={channel} ctrl={controller} val={value}")

def handle_mapped(address, *args):
    # address = "/midi/mapped/a/FILTER_CUTOFF"
    parts = address.split('/')
    variant = parts[2]
    semantic = parts[3]
    value = args[0]
    print(f"Mapped: {semantic} = {value} (variant {variant})")

# Create dispatcher
disp = dispatcher.Dispatcher()
disp.map("/midi/raw/cc/*/*", handle_raw_cc)
disp.map("/midi/mapped/*/*", handle_mapped)

# Create server with multicast
server = osc_server.ThreadingOSCUDPServer(
    (MULTICAST_ADDR, PORT), disp)

# Join multicast group
sock = server.socket
sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
mreq = struct.pack("4sl", socket.inet_aton(MULTICAST_ADDR), socket.INADDR_ANY)
sock.setsockopt(socket.IPPROTO_IP, socket.IP_ADD_MEMBERSHIP, mreq)

print(f"Listening on {MULTICAST_ADDR}:{PORT}")
server.serve_forever()
```

### C Example

See [OSC_C_EXAMPLE.md](OSC_C_EXAMPLE.md) for complete liblo example.

---

## Sending OSC Messages

### From Command Line

```bash
# Using osc_send_raw.sh
osc_send_raw.sh /midi/control/variant b
osc_send_raw.sh /midi/out/note 1 60 127

# Using REPL
midi repl
> osc /tau/filter/cutoff 0.5
> osc /midi/control/reload
```

### From Node.js

```javascript
const osc = require('osc');

const udpPort = new osc.UDPPort({
    localAddress: "0.0.0.0",
    localPort: 0
});

udpPort.open();

// Send to multicast
udpPort.send({
    address: "/midi/control/variant",
    args: [{ type: 's', value: 'b' }]
}, "239.1.1.1", 1983);

// Send to specific host
udpPort.send({
    address: "/tau/filter/cutoff",
    args: [{ type: 'f', value: 0.5 }]
}, "192.168.1.100", 5000);
```

---

## Map File Structure

Map files define the hardware-to-semantic mapping. Located in `~/tetra/midi/maps/*.json`.

**Basic Structure:**
```json
{
  "controller": "vmx8",
  "instance": 0,
  "description": "8-track mixer controller",

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
        "b1a": {"semantic": "MUTE_1", "min": 0.0, "max": 1.0}
      }
    },
    "b": {
      "name": "synth",
      "mappings": {
        "p1": {"semantic": "FILTER_CUTOFF", "min": 20.0, "max": 20000.0},
        "s1": {"semantic": "RESONANCE", "min": 0.0, "max": 1.0}
      }
    }
  }
}
```

**Two-Layer Mapping:**
1. **Hardware layer:** MIDI → Syntax (e.g., CC40 → p1)
2. **Semantic layer:** Syntax → Meaning (e.g., p1 → VOLUME_1)

**Variant system:** Switch between mappings using `/midi/control/variant`

---

## Timing and Event Ordering

### Event Timestamps

Events are processed in order received, but OSC messages include timing information in REPL listener:

```
__EVENT__ {id} {delta_ms} {elapsed_ms} {type} ...
```

Example:
```
__EVENT__ 1 0 0 raw CC 1 40 64
__EVENT__ 2 15 15 mapped a VOLUME_1 0.503937
```

### UDP Considerations

- **No delivery guarantee** - Some messages may be lost under heavy load
- **No ordering guarantee** - Messages may arrive out of order
- **Multicast is best-effort** - Perfect for real-time control, not reliable messaging

For critical operations requiring reliability, consider:
1. Using TCP OSC (requires separate implementation)
2. Adding acknowledgment protocol
3. Using sequence numbers

---

## Debugging

### View Raw OSC Traffic

```bash
# Use tcpdump to see packets
sudo tcpdump -i any -A dst 239.1.1.1 and port 1983

# Use REPL with log mode
midi repl
> log both    # Show raw + semantic events
```

### Test Message Reception

```bash
# Terminal 1: Start REPL listener
midi repl
> log raw

# Terminal 2: Send test message
osc_send_raw.sh /midi/control/status

# Terminal 1 should show received state messages
```

### Common Issues

| Issue | Solution |
|-------|----------|
| Not receiving messages | Check firewall, verify multicast join |
| Only seeing raw, no mapped | Load a map file with `/midi/control/load-map` |
| Old semantic names | Reload map with `/midi/control/reload` |
| Wrong variant | Switch with `/midi/control/variant <letter>` |

---

## Performance

**Latency:**
- MIDI → OSC: < 1ms (typical)
- Network multicast: < 5ms (local network)
- End-to-end: < 10ms (hardware to application)

**Throughput:**
- Handles continuous CC streams (100+ messages/sec)
- No buffering delays
- Real-time suitable for audio/visual applications

**Resource Usage:**
- Minimal CPU (< 1% on modern hardware)
- Low memory (< 50MB)
- Network bandwidth: negligible (< 1KB/s typical)

---

## Best Practices

1. **Subscribe early** - Join multicast group before MIDI events start
2. **Handle all events** - Process both raw and mapped for flexibility
3. **Don't block handlers** - Keep OSC message handlers fast
4. **Use semantic mappings** - More maintainable than raw CC numbers
5. **Version your maps** - Keep map files in version control
6. **Document semantics** - Comment your semantic names in maps
7. **Test with osc_send_raw.sh** - Quick ad-hoc testing without hardware

---

## Related Documentation

- [OSC_C_EXAMPLE.md](OSC_C_EXAMPLE.md) - Complete C integration example
- [MAPPING_GUIDE.md](MAPPING_GUIDE.md) - How to create and edit map files
- [OSC Specification](http://opensoundcontrol.org/spec-1_0) - Official OSC protocol
- [liblo Documentation](http://liblo.sourceforge.net/) - C/C++ OSC library
