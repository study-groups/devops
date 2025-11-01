# 🚀 Tetra Server Access Guide

## Quick Start

### Local Development (Most Common)
```bash
# Start Tetra server locally
tsm start tetra

# Access in browser
open http://localhost:4444
```

### Enable Public Access (Optional)
```bash
# Start tunnel for remote access
$TETRA_SRC/bash/hotrod/tetra-tunnel.sh start

# Public URL (when tunnel active)
open https://dev.pixeljamarcade.com:4444
```

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────────┐
│ Local Machine   │    │ dev.pixeljamarcade  │
│                 │    │                     │
│ Tetra Server    │────│ Port 4444           │
│ localhost:4444  │    │ (via tunnel)        │
└─────────────────┘    └─────────────────────┘
```

## 📋 Service Management

### Core Commands
```bash
# Start/Stop Tetra
tsm start tetra                    # Start locally on :4444
tsm stop tetra                     # Stop tetra server
tsm restart tetra                  # Restart tetra server
tsm logs tetra                     # View logs
tsm info tetra                     # Detailed info

# Public Access (Tunnel)
tetra-tunnel.sh start              # Enable public access
tetra-tunnel.sh stop               # Disable public access
tetra-tunnel.sh status             # Check tunnel status
```

### Service Status
```bash
# Check what's running
tsm list                           # All TSM services
pm2 list | grep tetra             # PM2 processes
```

## 🌍 Access Methods

### 1. Local Development
- **URL**: `http://localhost:4444`
- **Features**: Full SSH bridge, console access, file management
- **Authentication**: Local JWT tokens
- **Use Case**: Primary development interface

### 2. Public Access (via tunnel)
- **URL**: `https://dev.pixeljamarcade.com:4444`
- **Features**: Same as local (tunneled)
- **Authentication**: Same JWT tokens
- **Use Case**: Remote collaboration, demos
- **Requirement**: Active autossh tunnel

## 🔧 Configuration

### Environment Variables
```bash
# Located in: $TETRA_SRC/env/local.env
PORT=4444                          # TSM requires this
TETRA_PORT=4444                    # Server uses this
TETRA_ENV=local                    # Environment mode
TETRA_DIR=$HOME/tetra              # Data directory
NODE_ENV=development               # Node environment
JWT_SECRET=local-dev-secret        # Auth secret
```

### Service Registry
```bash
# TSM service definition (bash/tsm/services.conf)
tetra:node:node server/server.js:4444:$TETRA_SRC:Tetra main server
```

## 🚇 Tunnel Management (VS Code Alternative)

Unlike VS Code's complex port forwarding, Tetra uses a simple autossh tunnel:

### Advantages over VS Code
- **Persistent**: Survives disconnections
- **Simple**: One command to start/stop
- **Reliable**: Auto-reconnects on failure
- **Accessible**: Standard HTTPS URL

### Manual Tunnel Control
```bash
# Check tunnel status
pm2 list | grep tetra-tunnel

# View tunnel logs
pm2 logs tetra-tunnel

# Restart tunnel if needed
tetra-tunnel.sh stop && tetra-tunnel.sh start
```

## 🔍 Troubleshooting

### Tetra Server Issues
```bash
# Check if port is in use
lsof -i :4444

# View server logs
tsm logs tetra

# Check server status
tsm info tetra
```

### Tunnel Issues
```bash
# Check tunnel logs
pm2 logs tetra-tunnel

# Test SSH connection
ssh devops@ssh.nodeholder.com

# Manual tunnel test
ssh -R 4444:localhost:4444 devops@ssh.nodeholder.com
```

### Common Solutions
1. **Port conflict**: `tsm stop tetra && tsm start tetra`
2. **Tunnel down**: `tetra-tunnel.sh restart`
3. **Cannot connect**: Check firewall/network settings
4. **Auth issues**: Restart tetra server to regenerate JWT secret

## 📱 User Instructions

### For Local Developers:
1. Run `tsm start tetra`
2. Open `http://localhost:4444`
3. Use SSH bridge for remote access to servers

### For Remote Collaborators:
1. Ask local developer to run `tetra-tunnel.sh start`
2. Access `https://dev.pixeljamarcade.com:4444`
3. Same features as local access

### For Demo/Presentation:
1. Start both: `tsm start tetra && tetra-tunnel.sh start`
2. Share: `https://dev.pixeljamarcade.com:4444`
3. Stop tunnel after: `tetra-tunnel.sh stop`