# MIDI Module Port Assignments

**Date:** 2025-11-05
**Status:** ✅ Configured

## Port Assignments

### MIDI Core
**Port:** `1983`
**Protocol:** OSC/UDP
**Usage:** Main MIDI event broadcasting

```bash
# Default configuration
export MIDI_OSC_HOST="0.0.0.0"
export MIDI_OSC_PORT="1983"
```

**Services:**
- MIDI REPL OSC listener
- MIDI event broadcasting
- Multi-subscriber pub/sub

**Why 1983?**
- Memorable year
- High enough to avoid conflicts with system services
- Not in common use
- Easy to remember: MIDI = 1983

### MIDI-MP (Multiplayer)
**Port:** `2020`
**Protocol:** TBD
**Usage:** MIDI multiplayer/collaborative features

```bash
export MIDI_MP_PORT="2020"
```

**Why 2020?**
- Future-facing number
- Clear separation from main MIDI (1983)
- Easy to remember: MP = 2020

## Architecture

```
┌─────────────────────────────────────────┐
│ MIDI Controller (USB)                   │
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│ midi_bridge.c (PortMIDI)                │
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│ midi.js (Node.js Bridge)                │
│                                         │
│ OSC Server: 0.0.0.0:1983                │
└──────────────┬──────────────────────────┘
               │ OSC/UDP Broadcast
               ├─────────────────┬─────────────────┬────────────────
               ↓                 ↓                 ↓
         ┌──────────┐      ┌──────────┐     ┌──────────┐
         │   REPL   │      │   Game   │     │    DAW   │
         │  :1983   │      │  :1983   │     │  :1983   │
         └──────────┘      └──────────┘     └──────────┘
```

## Port Configuration

### Default (OSC Mode)

```bash
# In bash/midi/core/repl.sh
REPL_OSC_HOST="${REPL_OSC_HOST:-0.0.0.0}"
REPL_OSC_PORT="${REPL_OSC_PORT:-1983}"
```

### Override

```bash
# Use different port
export MIDI_OSC_PORT=1984
midi repl

# Use different host (localhost only)
export MIDI_OSC_HOST="127.0.0.1"
midi repl
```

## Common Ports Reference

### Tetra System Ports

| Service | Port | Protocol | Status |
|---------|------|----------|--------|
| MIDI Core | 1983 | OSC/UDP | ✅ Active |
| MIDI-MP | 2020 | TBD | 📝 Planned |
| Cymatica | 3400 | OSC/UDP | ✅ Active |
| TSM Services | 4000-9000 | HTTP/TCP | ✅ Active |
| Development | 8000-8999 | HTTP/TCP | ✅ Active |

### Port Conflicts

If port 1983 is in use:

```bash
# Check what's using the port
lsof -i :1983

# Kill the process
kill <PID>

# Or use a different port
export MIDI_OSC_PORT=1984
midi repl
```

## OSC Message Format

All messages broadcast on port 1983:

### Raw MIDI
```
/midi/raw/cc/{channel}/{controller} {value}
/midi/raw/note/{channel}/{note} {velocity}
```

### Mapped Semantics
```
/midi/mapped/{variant}/{semantic} {normalized_value}
```

### State
```
/midi/state/controller {name}
/midi/state/variant {letter}
```

## Testing Ports

### Test MIDI Port

```bash
# Start REPL (listens on 1983)
midi repl

# In another terminal, send test OSC
node bash/midi/osc_send.js /midi/test "hello"

# Or use netcat
echo "/midi/test" | nc -u localhost 1983
```

### Monitor Traffic

```bash
# Listen to all OSC on 1983
node bash/midi/osc_listener_test.js

# Or use tcpdump
sudo tcpdump -i lo0 -n udp port 1983
```

## Security

### Network Exposure

**Default:** `0.0.0.0:1983` - Listens on ALL interfaces (LAN + localhost)

**Secure (localhost only):**
```bash
export MIDI_OSC_HOST="127.0.0.1"
export MIDI_OSC_PORT="1983"
midi repl
```

**Firewall Rules:**
```bash
# macOS: Block external access to 1983
sudo pfctl -e
sudo pfctl -a midi -f - << EOF
block in proto udp from any to any port 1983
pass in proto udp from 127.0.0.1 to any port 1983
EOF
```

## Future: Unix Socket Mode

When Unix socket support is added:

```bash
# Default: Unix socket (no port needed)
midi repl
# Uses: ~/tetra/midi/midi.sock

# Network mode: OSC/UDP
midi repl --network
# Uses: 0.0.0.0:1983
```

## Port Selection Rationale

### Why Not Use Standard MIDI Ports?

Standard MIDI over network uses:
- RTP-MIDI: 5004, 5005 (Apple/iOS)
- MIDI over Ethernet: Various
- WebMIDI: N/A (browser API)

**We use custom ports because:**
1. OSC is not standard MIDI protocol
2. Want to avoid conflicts with system MIDI services
3. Need clear separation between hardware MIDI and OSC broadcast
4. OSC ports are application-specific (not standardized)

### Why 1983 Specifically?

1. **Memorable** - Easy to remember (year)
2. **High range** - Avoids system ports (<1024)
3. **Not common** - Unlikely to conflict
4. **Semantic meaning** - Could stand for "MIDI 83" or just a year
5. **Consistency** - Single port for all MIDI OSC

### Why 2020 for MIDI-MP?

1. **Future-facing** - Modern year
2. **Separated** - Clear gap from 1983
3. **Memorable** - Easy to remember
4. **MP = 2020** - Mnemonic for Multiplayer

## Troubleshooting

### Port Already in Use

```bash
$ midi repl
OSC ERROR: bind EADDRINUSE 0.0.0.0:1983
```

**Solution 1: Kill existing process**
```bash
lsof -i :1983
kill <PID>
```

**Solution 2: Use different port**
```bash
export MIDI_OSC_PORT=1984
midi repl
```

**Solution 3: Use Unix socket (future)**
```bash
export MIDI_TRANSPORT=unix
midi repl
```

### Can't Connect

If subscribers can't connect:

1. **Check port is listening:**
   ```bash
   lsof -i :1983
   ```

2. **Check firewall:**
   ```bash
   # macOS
   sudo pfctl -s rules | grep 1983

   # Linux
   sudo iptables -L | grep 1983
   ```

3. **Test with netcat:**
   ```bash
   nc -u -v localhost 1983
   ```

### Network Not Reachable

If trying to connect from another machine:

1. **Verify host binding:**
   ```bash
   # Should be 0.0.0.0, not 127.0.0.1
   echo $MIDI_OSC_HOST
   ```

2. **Check network:**
   ```bash
   # From other machine
   ping <midi-host-ip>
   nc -u -v <midi-host-ip> 1983
   ```

3. **Check firewall on both machines**

## Port Registry

### Update TSM Named Ports

Add MIDI ports to TSM's port registry:

```bash
# In TSM configuration
tsm ports set midi-osc 1983
tsm ports set midi-mp 2020
```

This ensures TSM is aware of MIDI's port allocations.

## References

- **OSC Specification:** http://opensoundcontrol.org/spec-1_0
- **Port Ranges:** IANA Port Registry
- **Tetra Port Conventions:** See tsm ports documentation

---

**Status:** ✅ Ports configured and documented
**MIDI Core:** 1983 (OSC/UDP)
**MIDI-MP:** 2020 (Reserved)
