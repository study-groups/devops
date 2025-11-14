#!/usr/bin/env bash

###############################################################################
# Cymatica Quick Start Script
#
# Starts all required services for Cymatica visualization
#
# Local Mode:
#   ./start-cymatica.sh local
#   - Starts midi, midi-mp, and cymatica-server locally
#   - Access at http://localhost:3400
#
# Cloud Mode:
#   ./start-cymatica.sh cloud
#   - Starts midi, midi-mp, and SSH tunnel
#   - Server must be running on cloud
#   - Access at https://cymatica.yourdomain.com
###############################################################################

set -euo pipefail

# Source tetra environment
if [[ -f "$HOME/tetra/tetra.sh" ]]; then
  source "$HOME/tetra/tetra.sh"
fi

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Mode
MODE="${1:-local}"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Cymatica Start Script                                    ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check TSM is available
if ! command -v tsm &> /dev/null; then
  echo "ERROR: tsm not found. Make sure TETRA is sourced."
  exit 1
fi

# Start MIDI bridge
echo -e "${BLUE}[1/4]${NC} Starting MIDI bridge (port 1983)..."
if tsm ls | grep -q "midi-1983"; then
  echo "  → Already running"
else
  tsm start --port 1983 --name midi \
    node "$TETRA_SRC/bash/midi/midi.js"
  echo -e "  ${GREEN}✓${NC} Started midi-1983"
fi

# Start MIDI-MP router with cymatica config
echo -e "${BLUE}[2/4]${NC} Starting MIDI-MP router (port 2020)..."
if tsm ls | grep -q "midi-mp-cymatica-2020"; then
  echo "  → Already running"
else
  tsm start --port 2020 --name midi-mp-cymatica \
    node "$TETRA_SRC/bash/midi-mp/router.js" \
    "$TETRA_SRC/bash/midi-mp/examples/cymatica.json"
  echo -e "  ${GREEN}✓${NC} Started midi-mp-cymatica-2020"
fi

if [[ "$MODE" == "local" ]]; then
  # Local mode - start server locally
  echo -e "${BLUE}[3/4]${NC} Starting Cymatica web server (port 3400)..."
  if tsm ls | grep -q "cymatica-ui-3400"; then
    echo "  → Already running"
  else
    tsm start --port 3400 --name cymatica-ui \
      node "$TETRA_SRC/bash/midi-mp/cymatica-server.js"
    echo -e "  ${GREEN}✓${NC} Started cymatica-ui-3400"
  fi

  echo -e "${BLUE}[4/4]${NC} No SSH tunnel needed (local mode)"
  echo ""
  echo "╔════════════════════════════════════════════════════════════╗"
  echo "║  Cymatica Ready (Local Mode)                             ║"
  echo "╚════════════════════════════════════════════════════════════╝"
  echo ""
  echo -e "${GREEN}Web Interface:${NC} http://localhost:3400"
  echo ""

elif [[ "$MODE" == "cloud" ]]; then
  # Cloud mode - start SSH tunnel
  echo -e "${BLUE}[3/4]${NC} No local web server (cloud mode)"

  echo -e "${BLUE}[4/4]${NC} Starting SSH tunnel (port 2020)..."
  if tsm ls | grep -q "midi-mp-tunnel-2020"; then
    echo "  → Already running"
  else
    # Check autossh is installed
    if ! command -v autossh &> /dev/null; then
      echo -e "  ${YELLOW}WARNING:${NC} autossh not found. Install with: brew install autossh"
      exit 1
    fi

    # Check SSH config
    if [[ -z "${TETRA_REMOTE:-}" ]]; then
      echo -e "  ${YELLOW}WARNING:${NC} TETRA_REMOTE not set. Add to ~/.bashrc:"
      echo "    export TETRA_REMOTE=\"your-cloud-server.com\""
      exit 1
    fi

    tsm start --port 2020 --name midi-mp-tunnel \
      bash "$TETRA_SRC/bash/midi-mp/tunnel-cymatica.sh"
    echo -e "  ${GREEN}✓${NC} Started midi-mp-tunnel-2020"
  fi

  echo ""
  echo "╔════════════════════════════════════════════════════════════╗"
  echo "║  Cymatica Ready (Cloud Mode)                             ║"
  echo "╚════════════════════════════════════════════════════════════╝"
  echo ""
  echo -e "${GREEN}SSH Tunnel:${NC} localhost:2020 → ${TETRA_REMOTE:-cloud}:2020"
  echo -e "${YELLOW}Note:${NC} Make sure cymatica-server is running on cloud:"
  echo "  ssh ${TETRA_REMOTE_USER:-devops}@${TETRA_REMOTE:-cloud}"
  echo "  tsm start --port 3400 --name cymatica-ui \\"
  echo "    node ~/tetra/bash/midi-mp/cymatica-server.js"
  echo ""

else
  echo "ERROR: Unknown mode '$MODE'. Use 'local' or 'cloud'"
  exit 1
fi

# Show status
echo "Services running:"
tsm ls | grep -E "midi|cymatica|tunnel" || true
echo ""

echo "Usage:"
echo "  - Move MIDI controls 40-47 to control cymatics parameters"
echo "  - View logs: tsm logs <service-name>"
echo "  - Stop all: tsm stop midi midi-mp-cymatica cymatica-ui midi-mp-tunnel"
echo ""
