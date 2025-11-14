# Cymatica Cloud Setup Guide

**Date:** 2025-11-05
**Status:** ✅ Implementation Complete

## Overview

This guide walks through setting up Cymatica with a cloud-based architecture:
- **Local machine**: MIDI hardware → midi.js → midi-mp router
- **SSH tunnel**: Forwards local MIDI-MP port to cloud
- **Cloud server**: Runs Cymatica web server behind nginx
- **Browser**: WebGL visualization with bidirectional control

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ LOCAL MACHINE (with MIDI hardware)                             │
│                                                                 │
│  MIDI Controller                                                │
│       ↓                                                         │
│  midi.js (:1983) - Raw MIDI OSC broadcast                      │
│       ↓                                                         │
│  midi-mp router (:2020) - Transform/filter/route               │
│       ↓                                                         │
│  SSH Tunnel (autossh)                                          │
│       ↓                                                         │
└───────┼─────────────────────────────────────────────────────────┘
        │
        │ SSH Tunnel (port 2020)
        │
┌───────▼─────────────────────────────────────────────────────────┐
│ CLOUD SERVER                                                    │
│                                                                 │
│  localhost:2020 ← SSH tunnel endpoint                          │
│       ↓                                                         │
│  cymatica-server.js (:3400)                                    │
│    • OSC/UDP listener (receives from :2020)                    │
│    • WebSocket server (sends to browser)                       │
│    • Bidirectional bridge                                      │
│       ↓                                                         │
│  nginx (:443 HTTPS)                                            │
│    • SSL termination                                           │
│    • Reverse proxy                                             │
│    • WebSocket upgrade                                         │
│       ↓                                                         │
└───────┼─────────────────────────────────────────────────────────┘
        │
        │ HTTPS/WSS
        │
┌───────▼─────────────────────────────────────────────────────────┐
│ BROWSER (anywhere on internet)                                 │
│                                                                 │
│  WebSocket client                                              │
│       ↓                                                         │
│  WebGL cymatics visualization                                  │
│       ↓                                                         │
│  Interactive controls (bidirectional)                          │
└─────────────────────────────────────────────────────────────────┘
```

## Port Assignments

| Component | Port | Protocol | Location | Purpose |
|-----------|------|----------|----------|---------|
| midi.js | 1983 | OSC/UDP | Local | Raw MIDI broadcast |
| midi-mp router | 2020 | OSC/UDP | Local | Transform/route MIDI |
| SSH tunnel | 2020 | SSH | Both | Forward local :2020 to cloud |
| cymatica-server | 3400 | HTTP/WS | Cloud | Web server + WebSocket bridge |
| nginx | 443 | HTTPS | Cloud | Public HTTPS endpoint |

## Local Machine Setup

### 1. Start MIDI Services

```bash
# Start MIDI hardware bridge (broadcasts raw MIDI)
tsm start --port 1983 --name midi node $TETRA_SRC/bash/midi/midi.js

# Start MIDI-MP router with cymatica config
tsm start --port 2020 --name midi-mp-cymatica \
  node $TETRA_SRC/bash/midi-mp/router.js \
  $TETRA_SRC/bash/midi-mp/examples/cymatica.json
```

### 2. Configure SSH Tunnel

Set environment variables for your cloud server:

```bash
# In ~/.bashrc or ~/.zshrc
export TETRA_REMOTE_USER="devops"
export TETRA_REMOTE="your-cloud-server.com"
export MIDI_MP_PORT="2020"
```

### 3. Start SSH Tunnel

```bash
# Start persistent tunnel (managed by TSM)
tsm start --port 2020 --name midi-mp-tunnel \
  bash $TETRA_SRC/bash/midi-mp/tunnel-cymatica.sh

# Check tunnel status
tsm ls | grep tunnel

# View tunnel logs
tail -f ~/tetra/midi-mp/logs/autossh-tunnel-2020.log
```

### 4. Verify Local Setup

```bash
# Check all services are running
tsm ls

# Should see:
#   midi-1983 (online)
#   midi-mp-cymatica-2020 (online)
#   midi-mp-tunnel-2020 (online)

# Test MIDI-MP is receiving
node $TETRA_SRC/bash/midi/osc_listener_test.js
# Move MIDI controls 40-47, you should see events
```

## Cloud Server Setup

### 1. Install Dependencies

```bash
# SSH into cloud server
ssh devops@your-cloud-server.com

# Install Node.js (if not already)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install required packages
cd ~/tetra
npm install express ws osc
```

### 2. Deploy Cymatica Files

```bash
# From local machine, rsync files to cloud
rsync -avz $TETRA_SRC/bash/midi-mp/cymatica-server.js \
  devops@your-cloud-server.com:~/tetra/bash/midi-mp/

rsync -avz $TETRA_SRC/bash/midi-mp/public/ \
  devops@your-cloud-server.com:~/tetra/bash/midi-mp/public/
```

### 3. Start Cymatica Server

```bash
# On cloud server
tsm start --port 3400 --name cymatica-ui \
  node ~/tetra/bash/midi-mp/cymatica-server.js

# Check status
tsm ls | grep cymatica

# View logs
tsm logs cymatica-ui

# Test locally on cloud
curl http://localhost:3400/health
```

### 4. Configure Nginx

```bash
# Install nginx and certbot (if not already)
sudo apt-get install -y nginx certbot python3-certbot-nginx

# Copy nginx config
sudo cp ~/tetra/bash/midi-mp/nginx-cymatica.conf \
  /etc/nginx/sites-available/cymatica

# Edit config to replace 'cymatica.yourdomain.com' with your domain
sudo nano /etc/nginx/sites-available/cymatica

# Enable site
sudo ln -s /etc/nginx/sites-available/cymatica \
  /etc/nginx/sites-enabled/

# Test config
sudo nginx -t

# Get SSL certificate
sudo certbot --nginx -d cymatica.yourdomain.com

# Reload nginx
sudo systemctl reload nginx
```

### 5. Verify Cloud Setup

```bash
# Check nginx status
sudo systemctl status nginx

# Check cymatica server
curl http://localhost:3400/health

# Check public HTTPS
curl https://cymatica.yourdomain.com/health

# Should return:
# {"status":"ok","server":"cymatica","oscPort":2020,"wsClients":0,"uptime":...}
```

## Using Cymatica

### 1. Access Web Interface

Open browser to: `https://cymatica.yourdomain.com`

You should see:
- Black canvas with green border
- "CYMATICA v1.0" header
- WebSocket status indicator (should be green "Connected")
- Control panel on right with 8 parameters
- Info panel on bottom left with MIDI mapping

### 2. Control Via MIDI Hardware

On your local machine with MIDI controller:

- **CC 40**: Frequency (20-2000 Hz)
- **CC 41**: Amplitude (0-1)
- **CC 42**: Pattern (0-1)
- **CC 43**: Particle Density (100-10000)
- **CC 44**: Damping (0-1)
- **CC 45**: Phase (0-6.28 radians)
- **CC 46**: Resonance (0-1)
- **CC 47**: Waveform (0-4: Sine/Square/Saw/Triangle/Noise)

Move controls → See real-time visualization in browser!

### 3. Control Via Browser

Click and drag sliders in control panel → Sends OSC back through tunnel to local MIDI-MP.

### 4. Load Presets

Click preset buttons:
- **Chladni**: Classic Chladni plate patterns
- **Ripple**: Water ripple effect
- **Chaos**: High-frequency chaotic patterns

## Data Flow

### MIDI → Browser (Visualization)

```
MIDI Hardware
  → midi.js (:1983)
  → midi-mp router (:2020)
  → SSH tunnel
  → Cloud localhost:2020
  → cymatica-server.js OSC listener
  → WebSocket broadcast
  → Browser receives parameter update
  → WebGL re-renders cymatics pattern
```

### Browser → MIDI (Control)

```
Browser UI (slider change)
  → WebSocket send
  → cymatica-server.js receives
  → Sends OSC to localhost:2020
  → SSH tunnel (reverse)
  → Local midi-mp (:2020)
  → Can trigger MIDI output or update internal state
```

## Monitoring & Debugging

### Check SSH Tunnel

```bash
# On local machine
tsm logs midi-mp-tunnel

# Should see autossh keepalive messages every 30s

# Manually test tunnel
ssh -L 2020:localhost:2020 devops@your-cloud-server.com
# Then test: nc -u localhost 2020
```

### Check OSC Messages

```bash
# On cloud server, listen to incoming OSC
node ~/tetra/bash/midi/osc_listener_test.js

# Move MIDI controls locally, should see events on cloud
```

### Check WebSocket Connection

```bash
# In browser console (F12)
# Should see:
console.log('WebSocket connected')

# Check messages
# Should see parameter updates when moving MIDI controls
```

### Common Issues

**SSH tunnel disconnects:**
- Check `~/tetra/midi-mp/logs/autossh-tunnel-2020.log`
- Verify SSH key is loaded: `ssh-add -l`
- Test manual connection: `ssh devops@your-cloud-server.com`

**WebSocket won't connect:**
- Check cymatica-server is running: `tsm ls | grep cymatica`
- Check nginx config: `sudo nginx -t`
- Check browser console for errors
- Verify SSL certificate: `sudo certbot certificates`

**No visualization updates:**
- Check MIDI is sending: Move controls and watch `midi-mp` logs
- Check tunnel is forwarding: Monitor OSC on cloud with listener
- Check WebSocket is receiving: Browser console should show messages
- Check WebGL is rendering: Look for canvas errors in console

**Bidirectional control not working:**
- Check cymatica-server OSC send functionality
- Verify midi-mp is listening on :2020 (both local and cloud)
- Check tunnel allows reverse direction

## Security Considerations

### SSH Tunnel
- Uses public key authentication (no password)
- Reverse tunnel binds to localhost only (not exposed to internet)
- Automatic reconnection with autossh
- Connection monitoring with ServerAlive

### Web Server
- HTTPS only (HTTP redirects to HTTPS)
- SSL certificates from Let's Encrypt
- WebSocket origin validation (same-origin policy)
- No authentication (add if needed for production)

### Nginx
- Modern SSL configuration via Certbot
- Security headers (X-Frame-Options, X-Content-Type-Options, etc.)
- Rate limiting (can be added if needed)

### OSC/UDP
- Not encrypted (runs over SSH tunnel)
- Localhost-only binding on cloud (not exposed)
- Consider adding message authentication if untrusted networks

## Performance Optimization

### Network
- SSH tunnel adds ~20-50ms latency (depending on location)
- WebSocket compression enabled
- UDP packet size ~100 bytes per OSC message
- Expected bandwidth: <1 KB/s for typical MIDI traffic

### Rendering
- WebGL runs at 60 FPS target
- Particle count affects performance (100-10000)
- Lower density for slower devices
- Canvas size: 800x800 (can be adjusted)

### Server
- Node.js single-threaded (sufficient for this use)
- OSC UDP non-blocking
- WebSocket broadcasts to all clients
- Minimal CPU usage (<1% typical)

## Scaling Considerations

### Multiple Clients
- Server broadcasts to all WebSocket clients
- All see the same visualization (synchronized)
- No per-client state (except WebSocket connection)
- Can handle 10s-100s of concurrent viewers

### Multiple MIDI Sources
- Current setup: single MIDI source on local machine
- To add more: Run multiple tunnel instances with different ports
- Update router config to merge/split sources

### Geographic Distribution
- Deploy cymatica-server in multiple regions
- Use GeoDNS to route to nearest server
- Each region needs its own SSH tunnel from local machine

## Maintenance

### Update Cymatica Code

```bash
# Local machine - edit files
cd $TETRA_SRC/bash/midi-mp/public/cymatica
nano cymatica.js

# Deploy to cloud
rsync -avz $TETRA_SRC/bash/midi-mp/public/ \
  devops@your-cloud-server.com:~/tetra/bash/midi-mp/public/

# Restart server (not needed for static file changes, only server.js)
ssh devops@your-cloud-server.com "tsm restart cymatica-ui"
```

### Renew SSL Certificates

Certbot auto-renews, but to manually renew:

```bash
sudo certbot renew
sudo systemctl reload nginx
```

### Backup Configuration

```bash
# Backup nginx config
sudo cp /etc/nginx/sites-available/cymatica ~/cymatica-nginx.conf.bak

# Backup tetra files
rsync -avz devops@your-cloud-server.com:~/tetra/ ~/tetra-cloud-backup/
```

## Next Steps

1. **Add Authentication**: Implement JWT or OAuth for access control
2. **Recording**: Add server-side recording of MIDI performances
3. **Presets**: Create database of user-saveable presets
4. **Multi-user**: Support collaborative sessions with multiple users
5. **Mobile**: Optimize UI for mobile browsers
6. **Analytics**: Add usage tracking and performance monitoring

## References

- **MIDI-MP Protocol**: `$TETRA_SRC/bash/midi-mp/README.md`
- **Port Assignments**: `$TETRA_SRC/bash/midi/PORTS.md`
- **TSM Documentation**: `$TETRA_SRC/bash/tsm/README.md`
- **Nginx Config**: `$TETRA_SRC/bash/midi-mp/nginx-cymatica.conf`
- **WebSocket API**: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
- **WebGL Tutorial**: https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API

---

**Status:** ✅ Cloud setup complete
**Local Port:** 2020 (MIDI-MP via SSH tunnel)
**Cloud Port:** 3400 (Cymatica web server)
**Public URL:** https://cymatica.yourdomain.com
