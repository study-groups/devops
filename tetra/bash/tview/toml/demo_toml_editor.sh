#!/usr/bin/env bash

# TOML Editor Demo Script
# Demonstrates the integrated TOML editor in TView

# Setup paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export TETRA_SRC="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"
export TETRA_BASH="$TETRA_SRC/bash"

# Create demo TOML file
DEMO_TOML="/tmp/demo_config.toml"
cat > "$DEMO_TOML" << 'EOF'
[database]
server = "192.168.1.1"
port = 5432
connection_max = 5000
ssl = true

[servers.alpha]
ip = "10.0.0.1"
dc = "eqdc10"
role = "primary"

[servers.beta]
ip = "10.0.0.2"
dc = "eqdc10"
role = "secondary"

[clients]
data = [["gamma", "delta"], [1, 2]]
hosts = ["alpha", "omega"]
timeout = 30

[debug]
enabled = true
level = "info"
log_file = "/var/log/app.log"
EOF

export ACTIVE_TOML="$DEMO_TOML"
export CURRENT_MODE="TOML"
export CURRENT_ENV="TETRA"

echo "🚀 TOML Editor Demo"
echo "==================="
echo "Demo file: $DEMO_TOML"
echo ""

# Load required modules
source "$TETRA_SRC/bash/tview/tview_data.sh"
source "$TETRA_SRC/bash/tview/toml/toml_provider.sh"
source "$TETRA_SRC/bash/tview/toml/toml_actions.sh"

echo "📋 Demo Commands:"
echo "1. content_generator \"TOML\" \"TETRA\" \"0\"    # Show TView TOML content"
echo "2. get_toml_items \"TETRA\"                     # Show TOML items"
echo "3. init_toml_cursor \"\$ACTIVE_TOML\"          # Initialize navigation"
echo "4. move_cursor_down; move_cursor_down          # Navigate sections"
echo "5. get_current_selection                       # Show current section"
echo "6. toggle_section_expansion \"database\"       # Expand section"
echo "7. get_section_variables \"database\"          # Show variables"
echo "8. render_toml_tree_visual                     # Full visual tree"
echo "9. handle_toml_search \"server\"               # Search for variable"
echo "10. handle_toml_validate \"TETRA\"             # Validate TOML"
echo ""

# Initialize the editor
init_toml_cursor "$ACTIVE_TOML"

echo "🎯 Current Status:"
echo "  Cursor position: $CURRENT_ITEM"
echo "  Total sections: ${#ACTIVE_MULTISPANS[@]}"
echo "  Current selection: $(get_current_selection)"
echo ""

echo "📄 TView Integration Test:"
echo "=========================="
content_generator "TOML" "TETRA" "0"

echo ""
echo "🎨 Visual Tree Test:"
echo "===================="
render_toml_tree_visual "$ACTIVE_TOML" "1"

echo ""
echo "🔍 Search Test:"
echo "==============="
handle_toml_search "server"

echo ""
echo "✅ Validation Test:"
echo "==================="
handle_toml_validate "TETRA" "$ACTIVE_TOML"

echo ""
echo "🧪 Interactive Commands Available:"
echo "=================================="
echo "# Navigate sections"
echo "toml_j                           # Move down (j key)"
echo "toml_k                           # Move up (k key)"
echo "toml_enter                       # Expand/collapse current section"
echo ""
echo "# Search and edit"
echo "toml_search \"variable_name\"      # Search for variable"
echo "toml_edit \"var\" \"new_value\"      # Edit variable value"
echo ""
echo "# Direct functions"
echo "get_current_selection            # Show current section"
echo "get_current_location             # Show file:line location"
echo "toggle_section_expansion \"db\"   # Toggle section expansion"
echo "get_variable_context \"server\"   # Get variable help"
echo ""
echo "Demo file will be cleaned up automatically."

# Cleanup function
cleanup_demo() {
    rm -f "$DEMO_TOML"
    echo "Demo cleaned up."
}

trap cleanup_demo EXIT