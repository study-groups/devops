# MIDI Module Architecture Diagrams

## Overview

The MIDI module is the **unified real-time input hub** for tetra. All physical controls (MIDI controllers, gamepads) route through it, broadcast via OSC on port 1983, and are consumed by games, animations, and audio engines.

---

## REPL ↔ Server Communication

```
┌─────────────────┐     OSC multicast      ┌──────────────────┐
│   MIDI REPL     │ ←──────────────────────│  midi.js Bridge  │
│   (bash client) │      :1983             │  (Node.js server)│
│                 │ ─────────────────────→ │                  │
│ osc_repl_       │   /midi/control/*      │  reads hardware  │
│ listener.js     │                        │  broadcasts OSC  │
└─────────────────┘                        └──────────────────┘
```

---

## Full Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            PHYSICAL HARDWARE                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                    │
│  │ MIDI         │    │ USB Gamepad  │    │ Keyboard     │                    │
│  │ Controller   │    │ (Xbox/PS)    │    │ (Terminal)   │                    │
│  └──────┬───────┘    └──────┬───────┘    └──────────────┘                    │
└─────────┼───────────────────┼────────────────────────────────────────────────┘
          │ CoreMIDI         │ HID
          ▼                   ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                    MIDI BRIDGE (midi.js or midi_bridge)                       │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  • Connects to hardware MIDI devices (easymidi library)                 │ │
│  │  • Reads raw MIDI events (CC, Note On/Off, Program Change, Pitch Bend)  │ │
│  │  • Loads semantic mappings from JSON map files                          │ │
│  │  • Normalizes raw MIDI values to semantic ranges                        │ │
│  │  • Broadcasts via OSC (UDP multicast) on port 1983                      │ │
│  │  • Listens for control commands (variant switch, map reload)            │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                          │
│                      OSC Multicast 239.1.1.1:1983                             │
└────────────────────────────────────┼─────────────────────────────────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         │                           │                           │
         ▼                           ▼                           ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   MIDI REPL     │      │     GAMES       │      │  Other OSC      │
│                 │      │                 │      │  Subscribers    │
│ osc_repl_       │      │ controls.fifo   │      │  (DAW, viz)     │
│ listener.js     │      │                 │      │                 │
│      │          │      │ trax, estoface  │      │                 │
│      ▼          │      │ pulsar          │      │                 │
│ Terminal prompt │      │                 │      │                 │
│ [device:variant]│      │                 │      │                 │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

---

## OSC Message Types

### Output (Broadcast from Bridge)

```
Raw MIDI events (all listeners receive):
  /midi/raw/cc/{channel}/{controller} {value}
  /midi/raw/note/{channel}/{note} {velocity}
  /midi/raw/program/{channel} {value}
  /midi/raw/pitchbend/{channel} {value}

Mapped events (when map is loaded):
  /midi/mapped/{variant}/{semantic} {normalized_value}

State metadata (broadcasts on startup and state changes):
  /midi/state/controller {name}
  /midi/state/instance {number}
  /midi/state/variant {letter}
  /midi/state/variant_name {name}
  /midi/state/input_device {name}
  /midi/state/output_device {name}
```

### Input (Control Commands to Bridge)

```
Control messages:
  /midi/control/variant {a|b|c|d}        - Switch variant
  /midi/control/load-map {name}          - Load map file
  /midi/control/reload                   - Reload current map
  /midi/control/reload-config            - Reload config
  /midi/control/device {id|name}         - Switch MIDI device
  /midi/control/status                   - Request state broadcast

MIDI output commands (from REPL):
  /midi/out/note {channel} {note} {velocity}
  /midi/out/cc {channel} {controller} {value}
  /midi/out/program {channel} {number}
```

---

## REPL State Flow

```
User Input in REPL Terminal
         │
         ├─ CLI mode command (e.g., "variant a")
         │     ↓
         ├─> _midi_repl_handle_variant() [repl_handlers.sh]
         │     ↓
         ├─> midi_osc_send("/midi/control/variant", "a")
         │     ↓
         │
         └─ OR: Key mode keystroke (e.g., 'a' for variant A)
               ↓
           input_mode_handle_key()
               ↓
           midi_osc_send(...)
               ↓

┌─────────────────────────────────────────────────────────────┐
│        OSC MESSAGE SENT (UDP multicast 239.1.1.1:1983)      │
│            /midi/control/variant "a"                         │
└────────────────────┬────────────────────────────────────────┘
                     │
    ┌────────────────┴───────────────────┐
    │                                    │
    ▼ (received by midi.js)              ▼ (received by REPL listener)
┌──────────────────────────┐  ┌────────────────────────┐
│   MIDI Bridge Service    │  │  OSC REPL Listener     │
│   (midi.js)              │  │  (osc_repl_listener.js)│
│                          │  │                        │
│ handleOSCControl()       │  │ (ignores control msgs) │
│   ↓                      │  └────────────────────────┘
│ switchVariant("a")       │
│   ↓                      │
│ Load variant mappings    │
│   ↓                      │
│ broadcastState()         │
│   ↓                      │
│ OSC: /midi/state/variant │
└──────────────────────────┘
           │
           ▼ (broadcast received by REPL listener)

┌─────────────────────────────────────────────────────────────┐
│  OSC REPL Listener (now receives state update)              │
│  /midi/state/variant "a"                                     │
│    ↓                                                         │
│  handleStateMessage("variant", "a")                          │
│    ↓                                                         │
│  Output: __STATE__ controller=vmx8 ... variant=a ...         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼ (piped to REPL bash loop)
            ┌────────────────────────┐
            │ REPL State Update      │
            │ → REPL_STATE_FILE      │
            │ → Prompt refresh       │
            │ [device:a] [CC=val] >  │
            └────────────────────────┘
```

---

## MIDI Hardware Input Flow

```
MIDI Hardware Input (e.g., knob turn on controller)
    │
    ├─> midi.js reads via easymidi
    │
    ├─> handleMidiEvent()
    │     ├─ Convert to raw OSC message
    │     │   /midi/raw/cc/1/7 {value}
    │     │
    │     ├─ Broadcast raw via UDP
    │     │
    │     ├─ If map loaded, look up semantic mapping
    │     │   hardwareToSyntax.get("1:7") → "f1"
    │     │   syntaxMapping.get("f1") → {semantic: "VOLUME_1", min, max}
    │     │
    │     ├─ Normalize value (0-127 → 0.0-1.0)
    │     │
    │     └─ Broadcast mapped OSC
    │         /midi/mapped/a/VOLUME_1 {0.503937}
    │
    ├─> OSC REPL Listener receives both messages
    │     │
    │     ├─ handleRawMessage()
    │     │   Output: __EVENT__ id delta elapsed raw CC 1 7 64
    │     │
    │     └─ handleMappedMessage()
    │         Output: __EVENT__ id delta elapsed mapped a VOLUME_1 0.503937
    │
    └─> REPL displays events based on log mode (off/raw/semantic/both)
```

---

## Key Files

| File | Purpose |
|------|---------|
| `midi.js` | MIDI Bridge Service - core I/O |
| `midi.sh` | Module entry point / TSM integration |
| `core/repl.sh` | REPL client - interactive interface |
| `core/repl_handlers.sh` | REPL command handlers |
| `core/state.sh` | State management containers |
| `osc_repl_listener.js` | OSC listener helper - formats events |
| `osc_send.js` | Simple OSC message sender |
| `maps/*.json` | Semantic mapping definitions |

---

## Ports & Protocols

| Port | Protocol | Direction | Purpose |
|------|----------|-----------|---------|
| 1983 | OSC/UDP | Multicast out | Raw MIDI, mapped events, state |
| 1983 | OSC/UDP | Unicast in | Control commands |
| /tmp/midi_gamepad.sock | Unix socket | Local | Binary gamepad protocol |

---

*Generated: 2024-12-16*
