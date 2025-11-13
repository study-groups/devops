# MIDI Mapping & OSC Integration - Implementation Summary

## What Was Built

### 1. Quick OSC Sender Tool ✅
**File:** `osc_send_raw.sh`

Send ad-hoc OSC messages for testing:
```bash
# Send to MIDI multicast (default)
osc_send_raw.sh /tau/filter/cutoff 0.5

# Send to specific host
osc_send_raw.sh -t localhost:5000 /tau/trigger note
```

**Integrated into REPL:**
```bash
midi repl
> osc /tau/filter/cutoff 0.5
> osc -t 192.168.1.100:9000 /synth/play 440
```

---

### 2. Map Visualization Commands ✅
**Files:**
- `core/map_display.sh` - Display functions
- `core/repl.sh` - Integrated commands

**New REPL Commands:**
```bash
map                  # Show current map overview
map list             # List all hardware controls
map show p1          # Show detailed info for control p1
map variant a        # Show all mappings for variant a
map search volume    # Search for semantic name
```

**Example Output:**
```
> map

═══ Map Overview ═══
Controller: vmx8[0]
Description: 8-track MIDI controller

Hardware:
  buttons: 32
  pots: 8
  sliders: 8
  Total: 48 controls

Variants:
  a: mixer (24/48 mapped, 50%)
     8-track mixer mode
  b: synth (16/48 mapped, 33%)
     Synthesizer control mode
```

---

### 3. C OSC Listener Example ✅
**File:** `docs/OSC_C_EXAMPLE.md`

Complete working example for integrating OSC into C applications (like tau-audio-engine):

- Uses liblo (lightweight OSC library)
- Subscribes to multicast 239.1.1.1:1983
- Handles raw MIDI and mapped semantic events
- Includes compilation instructions and Makefile
- Shows 3 integration patterns (thread, poll, event loop)
- Example mapping semantic names to audio parameters

**Quick Start:**
```c
// Subscribe to multicast and handle events
server_thread = lo_server_thread_new_multicast("239.1.1.1", "1983", error_handler);
lo_server_add_method(server, "/midi/mapped/*/*", "f", handle_mapped, NULL);
lo_server_thread_start(server_thread);
```

---

### 4. OSC Protocol Documentation ✅
**File:** `docs/OSC_PROTOCOL.md`

Comprehensive reference covering:

- **Network configuration** (239.1.1.1:1983, UDP multicast)
- **All message types** with examples:
  - Raw MIDI events (`/midi/raw/cc`, `/midi/raw/note`, etc.)
  - Mapped semantic events (`/midi/mapped/{variant}/{semantic}`)
  - State metadata (`/midi/state/*`)
  - Control messages (`/midi/control/*`)
- **Message flow examples**
- **Listening examples** (Node.js, Python, C)
- **Map file structure** explanation
- **Timing considerations**
- **Debugging techniques**
- **Best practices**

---

## How It Works Together

### Architecture
```
MIDI Hardware
    ↓
midi.js (TSM service)
    ├─ Reads MIDI input
    ├─ Loads map file (JSON)
    ├─ Applies 2-layer mapping:
    │    1. MIDI (CC40) → Syntax (p1)
    │    2. Syntax (p1) → Semantic (VOLUME_1)
    └─ Broadcasts OSC
        ↓
    239.1.1.1:1983 (multicast)
        ↓
    ┌─────────┬──────────────────┬──────────┐
    │         │                  │          │
  REPL   tau-audio-engine   Game     Custom App
    │         │
    ├─ map commands (visualize)
    └─ osc command (send ad-hoc)
```

### Mapping Flow

**Without Map Loaded:**
```
MIDI CC40=64 → /midi/raw/cc/1/40 64
```

**With Map Loaded (variant 'a'):**
```
MIDI CC40=64 → /midi/raw/cc/1/40 64                   (always)
             → /midi/mapped/a/VOLUME_1 0.503937       (if mapped)
```

**Value Normalization:**
```
Input: MIDI value 64 (0-127)
Map: {"semantic": "VOLUME_1", "min": 0.0, "max": 1.0}
Output: 0.0 + (64/127) * (1.0-0.0) = 0.503937
```

---

## Usage Examples

### Example 1: Quick OSC Testing

You want to test tau-audio-engine without MIDI hardware:

```bash
# Send test messages
osc_send_raw.sh /tau/filter/cutoff 0.75
osc_send_raw.sh /tau/envelope/attack 0.1
osc_send_raw.sh /tau/trigger note
```

### Example 2: Understanding Your Map

You forgot which controls are mapped:

```bash
midi repl
> map                    # Overview
> map list               # All controls
> map show p1            # Detail for p1
> map variant a          # All variant 'a' mappings
> map search filter      # Find filter-related controls
```

### Example 3: Integrating tau-audio-engine

1. **Add liblo to your build:**
   ```bash
   brew install liblo  # macOS
   ```

2. **Copy code from `docs/OSC_C_EXAMPLE.md`:**
   - OSC server setup
   - Message handlers
   - Integrate into your main loop

3. **Map semantic names to audio parameters:**
   ```c
   if (strcmp(semantic, "FILTER_CUTOFF") == 0) {
       tau_set_filter_cutoff(value * 20000.0f);
   }
   ```

4. **Test with REPL:**
   ```bash
   # Terminal 1: Run tau-audio-engine
   ./tau-audio-engine

   # Terminal 2: Send OSC from REPL
   midi repl
   > osc /midi/mapped/a/FILTER_CUTOFF 0.5
   ```

### Example 4: Creating Custom Mappings

You want tau-specific controls:

1. **Edit map file** (`~/tetra/midi/maps/vmx8[0].json`):
   ```json
   "b": {
     "name": "tau-synth",
     "mappings": {
       "p1": {"semantic": "TAU_FILTER_CUTOFF", "min": 20.0, "max": 20000.0},
       "p2": {"semantic": "TAU_RESONANCE", "min": 0.0, "max": 1.0},
       "s1": {"semantic": "TAU_MASTER_VOLUME", "min": 0.0, "max": 1.0}
     }
   }
   ```

2. **Reload in REPL:**
   ```bash
   midi repl
   > reload
   > variant b    # Switch to tau-synth variant
   ```

3. **Update tau-audio-engine handlers:**
   ```c
   if (strcmp(semantic, "TAU_FILTER_CUTOFF") == 0) {
       tau_set_filter_cutoff(value);  // Already in Hz
   }
   ```

4. **Test:**
   - Turn p1 on MIDI controller
   - tau-audio-engine receives `/midi/mapped/b/TAU_FILTER_CUTOFF 10523.5`
   - Filter updates in real-time

---

## Files Created

```
bash/midi/
├── osc_send_raw.sh              # Quick OSC sender
├── core/
│   ├── repl.sh                  # (modified) Added map + osc commands
│   └── map_display.sh           # Map visualization functions
└── docs/
    ├── OSC_PROTOCOL.md          # Complete protocol reference
    ├── OSC_C_EXAMPLE.md         # C integration guide
    └── MAPPING_AND_OSC_SUMMARY.md  # This file
```

---

## Key Decisions

### Why OSC Instead of TSM stdin?
- ✅ **Multicast** - One sender, many receivers
- ✅ **Decoupled** - Services don't need to know about each other
- ✅ **Standard** - Well-supported libraries in all languages
- ✅ **Proven** - Already working for MIDI broadcast
- ✅ **Low latency** - UDP is fast enough for real-time control

### Why Not Modify TSM?
- No need - OSC handles all inter-process communication
- Simpler - No stdin piping complexity
- More flexible - Can send to any host, not just TSM processes
- Scalable - Add new consumers without changing TSM

### Map Visualization vs Map Editor
- **Phase 1: Visualization** (✅ completed)
  - Understand existing maps
  - Debug mapping issues
  - Find controls by semantic name

- **Phase 2: Editor** (future)
  - Interactive learn mode
  - Real-time mapping creation
  - Validation and testing

---

## Next Steps (Optional Enhancements)

### 1. Interactive Map Learn Mode
Add REPL command to create mappings by moving controls:
```bash
> map learn
Move control to assign...
[p1 detected]
Enter semantic name: FILTER_CUTOFF
Enter min value [0.0]: 20.0
Enter max value [1.0]: 20000.0
✓ Saved: p1 → FILTER_CUTOFF [20.0, 20000.0]
```

### 2. Map Validation Tool
```bash
> map validate
✓ All hardware controls defined
✗ Warning: p3 has no mapping in variant 'a'
✓ All semantic names are unique
✗ Error: Invalid range in variant 'b': min > max
```

### 3. Live Mapping Display
```bash
> map live
[Live View - Touch controls to see mappings]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
p1 (CC40) → FILTER_CUTOFF [20.0-20000.0]
  Raw: 64 | Normalized: 10023.5 Hz
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 4. OSC Message Templates
Save and replay OSC command sequences:
```bash
> osc record tau_test
Recording OSC commands...
> osc /tau/filter/cutoff 0.5
> osc /tau/envelope/attack 0.1
> osc stop
Saved to: ~/tetra/midi/osc_templates/tau_test.osc

> osc replay tau_test
Playing back 2 commands...
```

### 5. TSM stdin (If Really Needed)
If you later decide OSC isn't sufficient:
- Add named pipe per TSM process
- Create `tsm send <service> <command>` wrapper
- Integrate into service startup scripts

But for MIDI/audio use cases, OSC is the better solution.

---

## Testing Checklist

- [x] Can send ad-hoc OSC messages from command line
- [x] Can send OSC messages from REPL
- [x] Can view map overview
- [x] Can list all controls
- [x] Can see detailed control info
- [x] Can view variant mappings
- [x] Can search for semantic names
- [x] C example compiles and runs
- [x] Documentation is complete and accurate

---

## Resources

- **OSC Specification:** http://opensoundcontrol.org/spec-1_0
- **liblo (C/C++):** http://liblo.sourceforge.net/
- **node-osc:** https://github.com/MylesBorins/node-osc
- **python-osc:** https://github.com/attwad/python-osc

---

## Support

Questions or issues:
1. Check `docs/OSC_PROTOCOL.md` for protocol reference
2. See `docs/OSC_C_EXAMPLE.md` for C integration
3. Use `map` commands in REPL to debug mappings
4. Test with `osc_send_raw.sh` before integrating
5. Review MIDI service logs: `tsm logs midi-1983 -f`
