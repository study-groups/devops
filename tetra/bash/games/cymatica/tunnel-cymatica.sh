#!/usr/bin/env bash

###############################################################################
# Cymatica SSH Tunnel
#
# Creates persistent SSH tunnel from local MIDI-MP (:2020) to cloud server
# Managed by TSM for automatic restart on connection loss
#
# Usage:
#   ./tunnel-cymatica.sh
#
# TSM Usage:
#   tsm start --port 2020 --name midi-mp-tunnel bash/midi-mp/tunnel-cymatica.sh
#
# Environment Variables:
#   TETRA_REMOTE_USER - SSH username (default: devops)
#   TETRA_REMOTE      - SSH host (default: ssh.nodeholder.com)
#   TETRA_DIR         - Tetra directory (default: ~/tetra)
#   MIDI_MP_PORT      - Local MIDI-MP port to tunnel (default: 2020)
###############################################################################

# Source tetra environment if available
if [[ -f "$HOME/tetra/tetra.sh" ]]; then
  source "$HOME/tetra/tetra.sh"
fi

# Configuration
REMOTE_USER="${TETRA_REMOTE_USER:-devops}"
REMOTE_HOST="${TETRA_REMOTE:-ssh.nodeholder.com}"
LOCAL_PORT="${MIDI_MP_PORT:-2020}"
REMOTE_PORT="${MIDI_MP_PORT:-2020}"

# Autossh environment
export AUTOSSH_GATETIME=0
export AUTOSSH_LOGLEVEL=7
export AUTOSSH_LOGFILE="${TETRA_DIR:-$HOME/tetra}/midi-mp/logs/autossh-tunnel-$REMOTE_PORT.log"

# Create log directory if needed
mkdir -p "$(dirname "$AUTOSSH_LOGFILE")"

# Log startup
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting MIDI-MP tunnel" >> "$AUTOSSH_LOGFILE"
echo "  Local:  localhost:$LOCAL_PORT" >> "$AUTOSSH_LOGFILE"
echo "  Remote: $REMOTE_USER@$REMOTE_HOST:$REMOTE_PORT" >> "$AUTOSSH_LOGFILE"
echo "" >> "$AUTOSSH_LOGFILE"

# Check if autossh is installed
if ! command -v autossh &> /dev/null; then
  echo "ERROR: autossh not found. Install with: brew install autossh" >&2
  exit 1
fi

# Check if SSH key is available
if ! ssh-add -l &> /dev/null; then
  echo "WARNING: No SSH keys loaded. You may need to run: ssh-add" >&2
fi

# Start tunnel with autossh
# -M 0: Disable autossh monitoring port (use ServerAlive instead)
# -N: Don't execute remote command
# -R: Reverse tunnel (remote port → local port)
# ServerAliveInterval: Send keepalive every 30 seconds
# ServerAliveCountMax: Disconnect after 3 failed keepalives
# ExitOnForwardFailure: Exit if port forwarding fails
exec autossh -M 0 -N \
  -o "ServerAliveInterval=30" \
  -o "ServerAliveCountMax=3" \
  -o "ExitOnForwardFailure=yes" \
  -o "StrictHostKeyChecking=accept-new" \
  -R "${REMOTE_PORT}:localhost:${LOCAL_PORT}" \
  "${REMOTE_USER}@${REMOTE_HOST}"
