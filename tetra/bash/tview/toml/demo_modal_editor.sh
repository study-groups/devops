#!/usr/bin/env bash

# Demo Modal TOML Editor
# Tests the awsd navigation and drill in/out functionality

# Setup
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export TETRA_SRC="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"
export TETRA_BASH="$TETRA_SRC/bash"

# Create demo TOML file
DEMO_TOML="/tmp/modal_demo.toml"
cat > "$DEMO_TOML" << 'EOF'
[database]
server = "192.168.1.1"
port = 5432
username = "admin"
password = "secret"
ssl = true

[servers]
[servers.web]
ip = "10.0.1.100"
port = 80
role = "frontend"

[servers.api]
ip = "10.0.1.200"
port = 8080
role = "backend"

[cache]
redis_host = "10.0.2.100"
redis_port = 6379
ttl = 3600

[logging]
level = "info"
file = "/var/log/app.log"
rotate = true
EOF

export ACTIVE_TOML="$DEMO_TOML"

echo "🎮 Modal TOML Editor Demo"
echo "========================="
echo "Demo file: $DEMO_TOML"
echo ""

# Load modal editor
source "$SCRIPT_DIR/modal_editor.sh"

echo "📋 Demo Commands to Try:"
echo ""
echo "1. Basic Navigation:"
echo "   modal_handle_key \"s\"     # Move down"
echo "   modal_handle_key \"w\"     # Move up"
echo ""
echo "2. Drill Operations:"
echo "   modal_handle_key \"d\"     # Drill into current section"
echo "   modal_handle_key \"a\"     # Drill out to parent"
echo ""
echo "3. Edit Mode:"
echo "   modal_handle_key \"\"      # Enter edit mode (from drill view)"
echo "   modal_handle_key \"q\"     # Quit/exit"
echo ""
echo "4. Refresh View:"
echo "   modal_refresh_view        # Refresh the display"
echo ""

# Initialize the modal editor
echo "🚀 Initializing Modal Editor..."
echo "================================"
init_modal_editor "$ACTIVE_TOML"

echo ""
echo ""
echo "🎯 Try these commands in sequence:"
echo ""
echo "# Navigate to database section"
echo "modal_handle_key \"s\"          # Move down to database"
echo "modal_handle_key \"d\"          # Drill into database section"
echo "modal_handle_key \"\"           # Enter edit mode"
echo "modal_handle_key \"a\"          # Drill out"
echo "modal_handle_key \"q\"          # Quit"
echo ""

echo "💡 Or run interactive mode:"
echo "modal_interactive_loop"

# Cleanup function
cleanup_modal_demo() {
    rm -f "$DEMO_TOML"
    echo ""
    echo "Demo file cleaned up."
}

trap cleanup_modal_demo EXIT