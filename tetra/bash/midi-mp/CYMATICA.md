# Cymatica - Browser-Based Cymatics Visualization

**Port:** 3400
**Protocol:** HTTP/WebSocket
**Status:** ✅ Complete

## Overview

Cymatica is a real-time cymatics visualization system that renders sound patterns in the browser based on MIDI control input. It supports both local and cloud deployment with bidirectional control.

## Features

- **WebGL Rendering**: Real-time cymatics patterns using GPU acceleration
- **8 MIDI Parameters**: Full control via MIDI CC 40-47
- **Bidirectional Control**: Control parameters from browser OR MIDI hardware
- **Cloud-Ready**: Deploy behind nginx with SSH tunnel support
- **WebSocket Bridge**: Low-latency OSC ↔ WebSocket translation
- **Preset System**: Built-in presets (Chladni, Ripple, Chaos)

## Quick Start

### Local Mode (Simplest)

```bash
# Start everything locally
cd $TETRA_SRC/bash/midi-mp
./start-cymatica.sh local

# Open browser
open http://localhost:3400
```

Services started:
- `midi-1983`: MIDI hardware bridge
- `midi-mp-cymatica-2020`: Router with cymatica config
- `cymatica-ui-3400`: Web server + WebSocket bridge

### Cloud Mode

```bash
# 1. On local machine (with MIDI hardware)
cd $TETRA_SRC/bash/midi-mp
./start-cymatica.sh cloud

# 2. On cloud server
ssh devops@your-cloud-server.com
tsm start --port 3400 --name cymatica-ui \
  node ~/tetra/bash/midi-mp/cymatica-server.js

# 3. Configure nginx (one-time setup)
sudo cp ~/tetra/bash/midi-mp/nginx-cymatica.conf \
  /etc/nginx/sites-available/cymatica
# Edit domain name, enable site, get SSL cert
# See CLOUD_SETUP.md for details

# 4. Open browser
open https://cymatica.yourdomain.com
```

## Architecture

```
MIDI Controller (Local)
    ↓
midi.js :1983 (OSC broadcast)
    ↓
midi-mp router :2020 (transform/filter)
    ↓
[Local Mode]              [Cloud Mode]
    ↓                          ↓
cymatica-server :3400    SSH Tunnel → Cloud :2020
    ↓                          ↓
Browser (localhost)      cymatica-server :3400 (cloud)
                              ↓
                         nginx :443 (HTTPS)
                              ↓
                         Browser (internet)
```

## MIDI Mapping

Control cymatica with MIDI CC 40-47:

| CC  | Parameter        | Range      | Description |
|-----|------------------|------------|-------------|
| 40  | Frequency        | 20-2000 Hz | Oscillator frequency |
| 41  | Amplitude        | 0-1        | Wave amplitude |
| 42  | Pattern          | 0-1        | Pattern selection |
| 43  | Particle Density | 100-10000  | Number of particles |
| 44  | Damping          | 0-1        | Wave damping coefficient |
| 45  | Phase            | 0-6.28 rad | Phase offset |
| 46  | Resonance        | 0-1        | Resonance filter |
| 47  | Waveform         | 0-4        | Sine/Square/Saw/Triangle/Noise |

## Files

```
bash/midi-mp/
├── cymatica-server.js        # Express + WebSocket server
├── tunnel-cymatica.sh        # SSH tunnel (autossh)
├── start-cymatica.sh         # Quick start script
├── nginx-cymatica.conf       # Nginx reverse proxy config
├── CYMATICA.md              # This file
├── CLOUD_SETUP.md           # Detailed cloud deployment guide
├── public/cymatica/
│   ├── index.html           # Browser UI
│   └── cymatica.js          # WebGL visualization engine
└── examples/
    └── cymatica.json        # MIDI-MP routing config
```

## Configuration

### Server Environment Variables

```bash
# HTTP server port (default: 3400)
export HTTP_PORT=3400

# OSC port to listen on (default: 2020)
export OSC_PORT=2020

# OSC bind address (default: 0.0.0.0)
export OSC_HOST=0.0.0.0
```

### SSH Tunnel Environment Variables

```bash
# Cloud server hostname
export TETRA_REMOTE="your-cloud-server.com"

# SSH username (default: devops)
export TETRA_REMOTE_USER="devops"

# MIDI-MP port (default: 2020)
export MIDI_MP_PORT=2020
```

## API Endpoints

### HTTP

- `GET /` - Web UI (index.html)
- `GET /health` - Health check (JSON)
- `GET /api/state` - Current parameter state (JSON)

### WebSocket

- `ws://localhost:3400/ws` - WebSocket endpoint

**Client → Server Messages:**

```json
{"type": "control", "data": {"parameter": "frequency", "value": 440}}
{"type": "preset", "data": {"presetId": "chladni"}}
{"type": "ping"}
```

**Server → Client Messages:**

```json
{"type": "state", "data": {...all parameters...}}
{"type": "parameter", "data": {"parameter": "frequency", "value": 440, "timestamp": 1234567890}}
{"type": "pong"}
```

## Browser Compatibility

- **Chrome/Edge**: ✅ Full support
- **Firefox**: ✅ Full support
- **Safari**: ✅ Full support (WebGL may vary)
- **Mobile**: ⚠️  Works but may be slow (high particle counts)

## Performance

- **Target FPS**: 60
- **Typical CPU**: <5% (depends on particle count)
- **Network**: <1 KB/s (MIDI messages only)
- **Latency**: 20-80ms (local: 20ms, cloud: 50-80ms)

### Optimization Tips

1. **Lower particle density** for slower devices (100-2000 particles)
2. **Reduce canvas size** if needed (edit canvas width/height)
3. **Use simpler waveforms** (sine/square vs noise)
4. **Disable damping/resonance** if not needed (fewer calculations)

## Troubleshooting

### WebSocket won't connect

```bash
# Check server is running
tsm ls | grep cymatica

# Check server logs
tsm logs cymatica-ui

# Test health endpoint
curl http://localhost:3400/health
```

### No visualization updates

```bash
# Check MIDI is sending
tsm logs midi

# Check midi-mp is routing
tsm logs midi-mp-cymatica

# Check OSC is arriving (in browser console)
# Should see messages logged
```

### SSH tunnel disconnects

```bash
# Check tunnel logs
tail -f ~/tetra/midi-mp/logs/autossh-tunnel-2020.log

# Verify SSH key
ssh-add -l

# Test manual connection
ssh devops@your-cloud-server.com
```

### Performance issues

1. Lower particle density (slider or CC 43)
2. Close other browser tabs
3. Check GPU acceleration: chrome://gpu
4. Try different waveform (sine is fastest)

## Development

### Run server manually

```bash
# Start with custom port
HTTP_PORT=8080 node cymatica-server.js

# Start with custom OSC port
OSC_PORT=3000 node cymatica-server.js
```

### Edit visualization

Browser client is pure HTML/JS - just edit and refresh:

```bash
cd public/cymatica
nano cymatica.js  # Edit WebGL shaders, rendering logic
# Refresh browser (no server restart needed)
```

### Add new parameters

1. Update `cymatica.json` with new CC mapping
2. Add parameter to `currentState` in `cymatica-server.js`
3. Add shader uniform in `cymatica.js`
4. Add UI control in `index.html`

## Next Steps

- [ ] Add recording/playback of MIDI performances
- [ ] Save/load user presets
- [ ] Multi-user collaborative sessions
- [ ] Audio synthesis (generate sound from parameters)
- [ ] Export visualization as video/GIF
- [ ] Mobile-optimized UI
- [ ] VR/AR support

## References

- **Cloud Setup Guide**: `CLOUD_SETUP.md`
- **MIDI-MP Protocol**: `README.md`
- **Port Assignments**: `../midi/PORTS.md`
- **Example Config**: `examples/cymatica.json`

---

**Status:** ✅ Ready to use
**Local URL:** http://localhost:3400
**Cloud URL:** https://cymatica.yourdomain.com (after setup)
