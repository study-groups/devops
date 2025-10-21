# TSM Systemd Daemon Setup Guide

This guide explains how to set up the Tetra Service Manager as a systemd daemon that runs at boot on Linux systems.

## Overview

The TSM daemon feature allows you to:
- Run Tetra as a system service managed by systemd
- Auto-start Tetra services on system boot
- Manage services with standard systemd commands
- View logs through journalctl
- Support multiple deployment environments (@dev, @production)

## Environments

### @dev Environment
- **User**: `root:root`
- **Paths**:
  - `TETRA_DIR=/root/tetra`
  - `TETRA_SRC=/root/src/devops/tetra`
- **Service**: Starts `node server/server.js --env dev` on port 4444
- **systemd Service**: `tetra-dev.service`

### @production Environment
- **User**: `tetra:tetra` (dedicated system user)
- **Paths**:
  - `TETRA_DIR=/var/lib/tetra`
  - `TETRA_SRC=/opt/tetra`
- **Service**: Starts production services
- **systemd Service**: `tetra.service`

## Installation

### Step 1: Deploy Files to Target System

For **@dev** environment (as root):

```bash
# Copy systemd service file
sudo cp /path/to/tetra/templates/systemd/tetra@dev.service \
        /etc/systemd/system/tetra-dev.service

# Copy service definition to /root/tetra
sudo mkdir -p /root/tetra/tsm/services-available
sudo cp /path/to/tetra/templates/services/tetra-dev.tsm \
        /root/tetra/tsm/services-available/tetra.tsm

# Ensure tetra.sh is sourced in root's environment
sudo cp ~/tetra/tetra.sh /root/tetra/tetra.sh
```

### Step 2: Enable Service Definition

```bash
# Source tetra environment as root
sudo -i
source /root/tetra/tetra.sh

# Enable the tetra service for auto-start
tsm enable tetra
```

### Step 3: Install and Enable Systemd Service

```bash
# Reload systemd to recognize new service
sudo systemctl daemon-reload

# Enable service to start at boot
sudo systemctl enable tetra-dev.service

# Start service now
sudo systemctl start tetra-dev.service
```

## TSM Daemon Commands

Once TSM is loaded, you can use these commands:

### Install Daemon
```bash
# Install for @dev environment
tsm daemon install @dev

# Install for production
tsm daemon install @production
```

### Control Daemon
```bash
# Enable daemon for boot
tsm daemon enable

# Start daemon
tsm daemon start

# Stop daemon
tsm daemon stop

# Restart daemon
tsm daemon restart

# Check status
tsm daemon status

# View logs (last 50 lines)
tsm daemon logs

# Follow logs in real-time
tsm daemon logs 50 -f
```

### Uninstall Daemon
```bash
tsm daemon uninstall
```

## How It Works

### Service Lifecycle

1. **Boot**: systemd starts `tetra-dev.service`
2. **Initialization**: Service sources `/root/tetra/tetra.sh`
3. **Service Start**: Executes `tsm start tetra`
4. **Process Management**: TSM loads service definition from `tetra.tsm`
5. **Server Launch**: Node.js server starts on port 4444

### Service Definition (`tetra.tsm`)

```bash
TSM_NAME="tetra"
TSM_CWD="/root/src/devops/tetra"
TSM_ENV_FILE="env/dev.env"
TSM_PORT="4444"
TSM_COMMAND="node server/server.js --env dev"
TSM_DESCRIPTION="Tetra unified orchestration server (@dev environment)"
TSM_AUTOSTART="true"
```

### Systemd Unit File (`tetra@dev.service`)

Key features:
- Runs as `root:root` for @dev environment
- Sets `TETRA_SRC` and `TETRA_DIR` environment variables
- Sources `tetra.sh` before starting services
- Automatically restarts on failure
- Logs to systemd journal

## Verification

### Check Service Status
```bash
sudo systemctl status tetra-dev.service
```

Expected output:
```
● tetra-dev.service - Tetra Service Manager Daemon (@dev environment)
   Loaded: loaded (/etc/systemd/system/tetra-dev.service; enabled)
   Active: active (running) since ...
```

### View Logs
```bash
# Last 50 lines
sudo journalctl -u tetra-dev.service -n 50

# Follow logs
sudo journalctl -u tetra-dev.service -f
```

### Check Tetra Server
```bash
# Check if port 4444 is listening
sudo lsof -i :4444

# Test server endpoint
curl http://localhost:4444/health
```

### List Managed Services
```bash
# As root, list TSM-managed services
sudo -i
source /root/tetra/tetra.sh
tsm list
```

## Troubleshooting

### Service Won't Start

1. **Check service file exists**:
   ```bash
   ls -la /etc/systemd/system/tetra-dev.service
   ```

2. **Verify tetra.sh exists**:
   ```bash
   sudo ls -la /root/tetra/tetra.sh
   ```

3. **Check service definition**:
   ```bash
   sudo cat /root/tetra/tsm/services-available/tetra.tsm
   ```

4. **View detailed errors**:
   ```bash
   sudo journalctl -u tetra-dev.service -n 100 --no-pager
   ```

### Port Already in Use

```bash
# Find what's using port 4444
sudo lsof -i :4444

# Kill the process if needed
sudo kill -9 <PID>

# Restart daemon
sudo systemctl restart tetra-dev.service
```

### Permission Issues

```bash
# Ensure directories exist and have correct permissions
sudo mkdir -p /root/tetra/logs /root/tetra/tsm/runtime/processes
sudo chmod 755 /root/tetra /root/tetra/logs

# Check TETRA_SRC exists
sudo ls -la /root/src/devops/tetra
```

## Advanced Configuration

### Custom Environment Variables

Edit the systemd service file to add environment variables:

```bash
sudo nano /etc/systemd/system/tetra-dev.service
```

Add under `[Service]` section:
```ini
Environment=CUSTOM_VAR=value
Environment=NODE_OPTIONS=--max-old-space-size=2048
```

Reload and restart:
```bash
sudo systemctl daemon-reload
sudo systemctl restart tetra-dev.service
```

### Resource Limits

Modify systemd service file:
```ini
MemoryMax=1G        # Maximum memory
LimitNOFILE=65536   # Max open files
LimitNPROC=4096     # Max processes
```

### Multiple Instances

Run multiple environments simultaneously:
```bash
# Install both dev and production
tsm daemon install @dev
tsm daemon install @production

# They use different service names:
# - tetra-dev.service (port 4444)
# - tetra.service (port 4445)
```

## Integration with CI/CD

### Deployment Script Example

```bash
#!/bin/bash
# deploy-tetra-dev.sh

# Stop existing service
sudo systemctl stop tetra-dev.service

# Update code
cd /root/src/devops/tetra
git pull origin main

# Update systemd service if changed
sudo cp templates/systemd/tetra@dev.service \
        /etc/systemd/system/tetra-dev.service
sudo systemctl daemon-reload

# Restart service
sudo systemctl start tetra-dev.service

# Wait and verify
sleep 5
sudo systemctl status tetra-dev.service
curl -f http://localhost:4444/health || exit 1
```

## Security Considerations

### @dev Environment
- Runs as root (relaxed security for development)
- Private temporary directories (`PrivateTmp=yes`)
- No new privileges (`NoNewPrivileges=yes`)

### @production Environment (Recommended)
- Runs as dedicated `tetra` user (not root)
- Strict filesystem protections
- Read-only system directories
- Limited resource usage

## References

- **Service Files**: `templates/systemd/`
- **Service Definitions**: `templates/services/`
- **Integration Code**: `bash/tsm/integrations/systemd.sh`
- **Main TSM**: `bash/tsm/tsm.sh`

## Quick Reference

```bash
# Installation
tsm daemon install @dev
tsm daemon enable
tsm daemon start

# Management
tsm daemon status
tsm daemon restart
tsm daemon logs 50 -f

# Cleanup
tsm daemon stop
tsm daemon disable
tsm daemon uninstall
```
