# MIDI Transport Architecture

**Date:** 2025-11-05
**Status:** Analysis
**Decision:** Hybrid approach with Unix socket default

## Current Architecture: OSC/UDP

### What We Have Now

```
VMX8 Controller
     ↓ USB MIDI
tmc.c (PortMIDI bridge)
     ↓ ???
midi.js (Node.js)
     ↓ OSC UDP :1983 (0.0.0.0)
     ├→ osc_repl_listener.js (bash REPL subscriber)
     ├→ Game engines
     ├→ DAWs (Ableton/Logic)
     └→ Web visualizers
```

### Why OSC/UDP was Chosen

**Design Goals:**
1. **Network transparency** - MIDI events over LAN
2. **Standard protocol** - OSC is music-industry standard
3. **Multiple subscribers** - Broadcast to many apps
4. **Cross-platform** - Works everywhere
5. **Low latency** - UDP is fast

**OSC (Open Sound Control):**
- Music-industry standard for control messages
- Supported by DAWs, game engines, VJ software
- Time-tagged, typed messages
- Well-established libraries

### Current Issues

1. **Port conflict** - 1983 might be in use
2. **Overkill for local** - Network stack overhead for local-only use
3. **Security** - Listening on 0.0.0.0 exposes to network
4. **Resource usage** - UDP socket + Node.js process

## Analysis: Unix Socket vs UDP

### Unix Domain Socket

**Path:** `/tmp/midi.sock` or `~/tetra/midi/midi.sock`

**Pros:**
- ✅ **Faster** - No network stack, direct kernel IPC
- ✅ **More secure** - Filesystem permissions (chmod 600)
- ✅ **No port conflicts** - Uses filesystem path
- ✅ **Lower overhead** - Simpler than UDP
- ✅ **Better for local** - Tetra is primarily local

**Cons:**
- ❌ **Local only** - Can't broadcast over network
- ❌ **No OSC** - Loses standard protocol
- ❌ **Single machine** - Can't integrate with remote DAW
- ❌ **Platform-specific** - Less portable (though works on Linux/macOS)

### UDP (Current)

**Address:** `0.0.0.0:1983`

**Pros:**
- ✅ **Network transparency** - Works across machines
- ✅ **Standard OSC** - Music industry compatibility
- ✅ **Multiple subscribers** - Pub/sub pattern
- ✅ **Platform-independent** - Works everywhere
- ✅ **Well-supported** - Libraries for everything

**Cons:**
- ❌ **Port conflicts** - 1983 might be taken
- ❌ **Slower** - Network stack overhead
- ❌ **Less secure** - Network exposure
- ❌ **Overkill** - If only using locally

### Comparison Table

| Feature | Unix Socket | UDP/OSC |
|---------|-------------|---------|
| Speed | Fast (direct IPC) | Slower (network stack) |
| Security | High (filesystem perms) | Medium (network exposed) |
| Network | ❌ Local only | ✅ LAN/WAN capable |
| Conflicts | ❌ None (filesystem) | ❌ Port conflicts |
| Standard | ❌ Custom protocol | ✅ OSC standard |
| Multi-subscriber | ❌ Complex (needs broker) | ✅ Native broadcast |
| Use Case | Local REPL, local apps | Network DAWs, distributed |

## Recommendation: Hybrid Approach

### Default: Unix Socket (Local Mode)

For most Tetra use cases (local REPL, local development):

```bash
# Default behavior
midi repl
# Creates: ~/tetra/midi/midi.sock

# Bash REPL connects directly
# Fast, secure, no port conflicts
```

**Architecture:**
```
VMX8 Controller
     ↓ USB MIDI
midi_bridge (C)
     ↓ Unix Socket: ~/tetra/midi/midi.sock
midi_server (bash/node)
     ↓
Bash REPL (direct socket read)
```

### Optional: Network Mode (OSC/UDP)

For network integration (remote DAW, game engines, visualizers):

```bash
# Enable network mode
midi repl --network
# or
export MIDI_TRANSPORT=osc
midi repl

# Broadcasts: 0.0.0.0:1983 (OSC/UDP)
```

**Architecture:**
```
VMX8 Controller
     ↓ USB MIDI
midi_bridge (C)
     ↓ Unix Socket: ~/tetra/midi/midi.sock
midi_server (bash/node)
     ↓ OSC UDP :1983
     ├→ Bash REPL (osc_repl_listener.js)
     ├→ Remote DAW (192.168.1.x)
     ├→ Game Engine
     └→ Web Visualizer
```

## Implementation Plan

### Phase 1: Add Unix Socket Support

1. **Update midi_bridge.c:**
   ```c
   // Add Unix socket mode
   #define TRANSPORT_UNIX_SOCKET 0
   #define TRANSPORT_UDP_OSC     1

   int transport_mode = TRANSPORT_UNIX_SOCKET; // Default
   const char* socket_path = "/tmp/midi.sock";
   ```

2. **Update midi.js:**
   ```javascript
   // Support both transports
   const transport = process.env.MIDI_TRANSPORT || 'unix';

   if (transport === 'unix') {
       // Unix socket server
       const net = require('net');
       const server = net.createServer(handleConnection);
       server.listen(socketPath);
   } else if (transport === 'osc') {
       // Current OSC/UDP
       const osc = require('osc');
       // ... existing code
   }
   ```

3. **Update repl.sh:**
   ```bash
   # Detect transport mode
   MIDI_TRANSPORT="${MIDI_TRANSPORT:-unix}"

   if [[ "$MIDI_TRANSPORT" == "unix" ]]; then
       # Connect to Unix socket
       socat UNIX-CONNECT:~/tetra/midi/midi.sock -
   else
       # Use OSC listener (existing)
       node osc_repl_listener.js
   fi
   ```

### Phase 2: Configuration

**Environment Variables:**
```bash
# Transport selection
export MIDI_TRANSPORT=unix      # Default: Unix socket
export MIDI_TRANSPORT=osc       # OSC/UDP network mode

# Unix socket path
export MIDI_SOCKET_PATH="~/tetra/midi/midi.sock"

# OSC settings (network mode)
export MIDI_OSC_HOST="0.0.0.0"
export MIDI_OSC_PORT="1983"
```

**Command-line flags:**
```bash
midi repl                    # Default: Unix socket
midi repl --network          # Force network/OSC mode
midi repl --socket /tmp/x    # Custom socket path
midi repl --osc-port 57122   # Custom OSC port
```

### Phase 3: Auto-detection

Smart mode selection:
```bash
# If no network flag and no OSC subscribers detected → Unix socket
# If --network flag → OSC/UDP
# If MIDI_TRANSPORT=osc → OSC/UDP
# If remote subscriber detected → OSC/UDP
```

## Benefits

### Unix Socket (Default)

✅ **No more port conflicts** - Filesystem paths don't conflict
✅ **Faster** - Direct IPC, no network overhead
✅ **More secure** - Filesystem permissions
✅ **Simpler** - No OSC library needed for local use

### OSC/UDP (Optional)

✅ **Network support** - When you need it
✅ **Standard protocol** - DAW/game engine compatibility
✅ **Multi-subscriber** - Broadcast pattern
✅ **Industry standard** - OSC is well-supported

## Migration Strategy

### Backwards Compatibility

Keep OSC as default initially:
```bash
# Default stays OSC for backwards compat
MIDI_TRANSPORT="${MIDI_TRANSPORT:-osc}"

# After testing, switch default:
MIDI_TRANSPORT="${MIDI_TRANSPORT:-unix}"
```

### User Migration

**Announce:**
```
MIDI Transport Change:
- Default is now Unix socket (faster, no port conflicts)
- Use `midi repl --network` for network/OSC mode
- Set MIDI_TRANSPORT=osc for old behavior
```

## Decision Matrix

### When to Use Each

**Use Unix Socket (default):**
- ✅ Local REPL only
- ✅ Local development
- ✅ Single-machine workflow
- ✅ Want speed and security
- ✅ Avoid port conflicts

**Use OSC/UDP (--network):**
- ✅ Multiple machines (DAW on another computer)
- ✅ Multiple subscribers (game + visualizer + REPL)
- ✅ Standard OSC clients (Ableton, Max/MSP, TouchOSC)
- ✅ Network-transparent MIDI routing
- ✅ Need broadcast pattern

## Implementation Priority

### Immediate (Today)

1. **Document current OSC architecture** ✅
2. **Identify why 0.0.0.0:1983** ✅
3. **Explain Unix socket benefits** ✅

### Short-term (Next Week)

1. Add Unix socket support to midi_bridge.c
2. Add transport mode to midi.js
3. Update repl.sh for both modes
4. Test both transports

### Long-term (Future)

1. Make Unix socket the default
2. Deprecate OSC-only mode
3. Add auto-detection
4. Add transport switching in REPL

## Testing Plan

### Unix Socket Mode

```bash
export MIDI_TRANSPORT=unix
midi repl

# In REPL:
devices          # Should work
device vmx8      # Should work
learn            # Should receive MIDI via socket
map              # Should show mappings
```

### OSC Mode (Current)

```bash
export MIDI_TRANSPORT=osc
midi repl

# Should work as before
# Multiple subscribers should work
```

### Network Mode

```bash
# Machine 1 (MIDI controller)
midi repl --network

# Machine 2 (subscriber)
node osc_listener.js --host 192.168.1.100 --port 1983
```

## Questions for User

1. **Primary use case?**
   - Local REPL only? → Unix socket
   - Network DAW integration? → OSC/UDP

2. **Multiple subscribers?**
   - Single REPL? → Unix socket
   - REPL + game + visualizer? → OSC/UDP

3. **Network transparency needed?**
   - Single machine? → Unix socket
   - Multi-machine setup? → OSC/UDP

4. **Port 1983 conflicts?**
   - If yes → Unix socket (no ports)
   - If no → Either works

## Conclusion

**Recommendation:** Implement hybrid approach with Unix socket as default

**Benefits:**
- ✅ Faster and more secure for common case (local REPL)
- ✅ Preserves network capability when needed
- ✅ Eliminates port conflicts
- ✅ Clean architecture

**Implementation:**
- Start with documentation (this file)
- Add Unix socket support to C bridge
- Update Node.js server for dual transport
- Make configurable via environment/flags
- Eventually make Unix socket the default

---

**Status:** Analysis complete, awaiting decision
**Default recommendation:** Unix socket for local, OSC for network
**Breaking change:** No (add new mode, keep OSC working)
