#!/usr/bin/env bash
#
# Run Pulsar in OSC mode - listens to MIDI via OSC multicast
# No TGP sockets, no fragile connections!
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENGINE_BIN="$SCRIPT_DIR/../../engine/bin/pulsar"

echo "╔════════════════════════════════════════════════════════╗"
echo "║  Pulsar - OSC Mode                                     ║"
echo "║  Listening on: 224.0.0.1:1983 (OSC multicast)          ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "Requirements:"
echo "  1. midi.js must be running with --map option"
echo "  2. MIDI controller must be connected"
echo ""
echo "Example midi.js command:"
echo "  node midi.js -i \"Your MIDI Device\" \\"
echo "    --map midi/maps/pulsar[0].json -v"
echo ""
echo "Controls (mapped via midi.js):"
echo "  CC 40 (k1): Speed (rotation)"
echo "  CC 41 (k2): Intensity (pulse frequency)"
echo "  CC 42 (k3): X position"
echo "  CC 43 (k4): Y position"
echo "  CC 44 (k5): Size (amplitude)"
echo ""
echo "Keyboard controls:"
echo "  q: Quit"
echo "  p: Pause/Resume"
echo "  h: Toggle help"
echo ""
echo "Starting pulsar in OSC mode..."
echo ""

# Run pulsar in OSC mode
exec "$ENGINE_BIN" --osc
