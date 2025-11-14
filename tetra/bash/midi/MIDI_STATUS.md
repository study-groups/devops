# MIDI REPL Status - Session Summary

## Current State: WORKING ✅

### Architecture: OSC Multicast Broadcast
```
node midi.js → Broadcasts OSC → 239.1.1.1:1983
                     ↓
    ┌────────────────┼────────────────┐
    ↓                ↓                ↓
midi repl       midi repl         game.sh
(listener 1)    (listener 2)    (listener 3)
```

**Single service, multiple subscribers - pub/sub over multicast UDP**

## Fixed Issues ✅

1. **Multicast Address Bug** - Changed hardcoded `224.0.0.1` → `239.1.1.1` in midi.js
2. **Socket Options** - Added `reuseAddr: true` for multiple listeners on same port
3. **ANSI Colors** - Sourced color module, added `-e` flag to echo
4. **Port Sharing** - Multiple REPLs can now listen simultaneously
5. **TUI Mode** - Added instant keystroke capture (user implemented!)

## Running the MIDI Service

### Option 1: Manual (Current)
```bash
node ~/src/devops/tetra/bash/midi/midi.js \
  -i "VMX8 Bluetooth" \
  --map ~/tetra/midi/maps/vmx8[0].json \
  -v
```

### Option 2: Via TSM (Recommended)
Edit `midi.sh:167` to use your controller:
```bash
# Current (uses first device):
tsm start --name midi node "$MIDI_SRC/midi.js" -i 0 -o 0 -v

# For your setup:
tsm start --name midi node "$MIDI_SRC/midi.js" \
  -i "VMX8 Bluetooth" \
  --map ~/tetra/midi/maps/vmx8[0].json \
  -v
```

Then use:
```bash
midi start   # Starts service via TSM
midi status  # Check if running
midi stop    # Stop service
```

### Option 3: With Config File
Create `~/tetra/midi/config.toml`:
```toml
[service]
device_input = "VMX8 Bluetooth"
device_output = "VMX8 Bluetooth"
default_map = "vmx8[0]"
default_variant = "a"
osc_port = 1983
osc_multicast = "239.1.1.1"
verbose = true
```

Then:
```bash
node midi.js --config ~/tetra/midi/config.toml
```

## MIDI REPL Features

### Pure TUI Mode (User Added!)
- **Instant keystroke capture** - no enter key needed
- **Color-coded CC values** - green/yellow/red by range
- **Log mode cycling** - off/raw/semantic/both
- **Variant switching** - single keypress a/b/c/d
- **Clean prompt** - `[device:variant] [CC#=val] [log:mode] host:port >`

### Key Bindings
```
a b c d    Switch variant
l          Cycle log mode (off/raw/semantic/both)
s          Show status
h ?        Help
q Ctrl+D   Quit
```

### Starting the REPL
```bash
midi repl   # Connects to default 239.1.1.1:1983
```

## Adding Joystick Support

To add joystick to your setup:

### 1. Find Your Devices
```bash
node ~/src/devops/tetra/bash/midi/midi.js -l
```

### 2. Run Multiple MIDI Services
```bash
# VMX8 (existing)
tsm start --name midi-vmx8 node "$MIDI_SRC/midi.js" \
  -i "VMX8 Bluetooth" \
  --map ~/tetra/midi/maps/vmx8[0].json \
  --osc-port 1983 -v

# Joystick (new)
tsm start --name midi-joystick node "$MIDI_SRC/midi.js" \
  -i "Joystick" \
  --map ~/tetra/midi/maps/joystick[0].json \
  --osc-port 1983 -v
```

Both broadcast to same multicast address → single REPL receives both!

### 3. Or: Single Process Multiple Devices
**TODO**: midi.js currently only supports one input device. Would need to:
- Accept `-i` multiple times
- Open multiple `easymidi.Input` instances
- Tag events with device ID in OSC messages

## File Locations

```
~/src/devops/tetra/bash/midi/
├── midi.js                    # Main service (broadcasts OSC)
├── midi.sh                    # CLI wrapper (midi start/stop)
├── osc_repl_listener.js       # OSC client (receives broadcasts)
├── core/
│   └── repl.sh               # REPL UI with TUI mode
└── maps/
    └── vmx8[0].json          # Your controller mapping

~/tetra/midi/
├── maps/                     # User map files
└── config.toml              # Optional config file
```

## Next Steps

1. **Make `midi start` use your controller**:
   ```bash
   # Edit ~/src/devops/tetra/bash/midi/midi.sh line 167
   tsm start --name midi node "$MIDI_SRC/midi.js" \
     -i "VMX8 Bluetooth" \
     --map ~/tetra/midi/maps/vmx8[0].json \
     -v
   ```

2. **Add joystick**:
   - Create map file: `~/tetra/midi/maps/joystick[0].json`
   - Start second service with different name
   - Both broadcast to 1983, REPL sees both

3. **Optional: Config file**:
   - Create `~/tetra/midi/config.toml`
   - Add `--config` to start command
   - Easier device/map management

## Known Working
- ✅ OSC multicast broadcasting
- ✅ Multiple REPL clients
- ✅ Port sharing (SO_REUSEADDR)
- ✅ TUI mode with instant feedback
- ✅ Color-coded values
- ✅ Log mode cycling
- ✅ Variant switching via OSC control

## User's TUI Improvements
The user added excellent features:
- Instant keystroke capture (no enter needed)
- Dense event logging with timing
- Status display
- Clean help system
- Color-coded value ranges

This is a great foundation for multi-device MIDI control!
