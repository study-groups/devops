#!/usr/bin/env bash

# Quick test to see panel layout

cd "$(dirname "$0")/engine" || exit 1

# Test commands
cat <<'EOF' | ./bin/pulsar
INIT 80 24
SPAWN_PULSAR 80 48 20 5 1.0 0.5 5
SPAWN_PULSAR 120 48 20 5 1.0 -0.7 4
RENDER
QUIT
EOF

echo ""
echo "Test complete. If you saw rendering output above, the engine is working."
echo "To see panels, press keys 1, 2, 3, 4, or 9 in the actual game."
