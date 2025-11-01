#!/usr/bin/env bash
# Action Registry - Quick Non-Interactive Demo
# Just shows you what it does without requiring input

set -e

# Setup
export TETRA_SRC="${TETRA_SRC:-/Users/mricos/src/devops/tetra}"
export TETRA_DIR="${TETRA_DIR:-$HOME/tetra}"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║        Action Registry System - Live Demo                   ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

sleep 1

# Load system
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  STEP 1: Loading the system"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "▶ Loading action registry..."
source $TETRA_SRC/bash/tds/tds.sh 2>/dev/null || true
source $TETRA_SRC/bash/actions/registry.sh
source $TETRA_SRC/bash/actions/executor.sh
source $TETRA_SRC/bash/repl/action_completion.sh
echo "✓ Registry loaded"
echo ""

sleep 1

echo "▶ Loading org module..."
source $TETRA_SRC/bash/org/includes.sh 2>/dev/null
echo "✓ Org module loaded"
echo ""

sleep 1

# Show stats
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  STEP 2: Registry Statistics"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

org_count=$(grep -c '^org\.' $TETRA_DIR/actions.registry 2>/dev/null || echo "0")
echo "📊 Actions registered:"
echo "  • org module: $org_count actions"
echo ""

sleep 1

# List some actions
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  STEP 3: Sample Actions (colored output)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "▶ Top 5 org actions:"
echo ""
action_list org | head -5
echo ""

sleep 2

# Show action info
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  STEP 4: Action Details"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "▶ Detailed info for org.validate.toml:"
echo ""
action_info org.validate.toml
echo ""

sleep 2

# Show TES capability
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  STEP 5: TES Capability Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "▶ Checking if org.compile.toml is TES-capable..."
if action_is_tes_capable org.compile.toml; then
    echo "✓ Yes! This action requires an @endpoint like @dev or @staging"
else
    echo "✗ No, this is a local-only action"
fi
echo ""

sleep 2

# Tab completion
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  STEP 6: Tab Completion"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "▶ Completion suggestions for 'org.view':"
echo ""
action_complete_list org | grep '^org\.view'
echo ""
echo "💡 These would appear when you press TAB in the REPL"
echo ""

sleep 2

# Create custom action
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  STEP 7: Creating a Custom Action"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "▶ Registering demo.greet action..."
action_register "demo" "greet" "Say hello to someone" "<name>" "no"

echo "▶ Creating implementation..."
demo_greet() {
    local name="${1:-World}"
    echo ""
    echo "    👋 Hello, $name!"
    echo "    Welcome to the Tetra Action Registry System!"
    echo ""
}

echo "✓ Action created"
echo ""

sleep 1

echo "▶ Listing demo actions:"
echo ""
action_list demo
echo ""

sleep 1

# Execute it
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  STEP 8: Executing the Custom Action"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "▶ Running: action_exec demo.greet \"Tutorial User\""
echo ""
action_exec demo.greet "Tutorial User"

sleep 1

# Load more modules
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  STEP 9: Loading More Modules"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "▶ Loading rag and tsm modules..."
source $TETRA_SRC/bash/rag/includes.sh 2>/dev/null || echo "  Note: rag module not loaded"
source $TETRA_SRC/bash/tsm/includes.sh 2>/dev/null || echo "  Note: tsm module not loaded"
echo ""

total=$(grep -c '^[^#]' $TETRA_DIR/actions.registry 2>/dev/null || echo "0")
org_count=$(grep -c '^org\.' $TETRA_DIR/actions.registry 2>/dev/null || echo "0")
rag_count=$(grep -c '^rag\.' $TETRA_DIR/actions.registry 2>/dev/null || echo "0")
tsm_count=$(grep -c '^tsm\.' $TETRA_DIR/actions.registry 2>/dev/null || echo "0")

echo "📊 Total registry now has:"
echo "  • Total: $total actions"
echo "  • org: $org_count actions"
echo "  • rag: $rag_count actions"
echo "  • tsm: $tsm_count actions"
echo ""

sleep 1

echo "▶ Sample rag actions:"
echo ""
action_list rag | head -3
echo ""

sleep 1

echo "▶ Sample tsm actions:"
echo ""
action_list tsm | head -3
echo ""

sleep 2

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Demo Complete! 🎉"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "What you just saw:"
echo ""
echo "  ✅ Loaded the action registry system"
echo "  ✅ Discovered $total available actions"
echo "  ✅ Viewed colored action listings (TDS)"
echo "  ✅ Inspected action details"
echo "  ✅ Checked TES capability"
echo "  ✅ Used tab completion"
echo "  ✅ Created a custom action"
echo "  ✅ Executed actions"
echo "  ✅ Loaded multiple modules"
echo ""

echo "📚 Next steps:"
echo ""
echo "  1. Try it yourself:"
echo "     source $TETRA_SRC/bash/actions/registry.sh"
echo "     action_list org"
echo ""
echo "  2. Run interactive tutorial:"
echo "     bash $TETRA_SRC/bash/actions/TUTORIAL.sh"
echo ""
echo "  3. Read the docs:"
echo "     less $TETRA_SRC/bash/actions/README.md"
echo ""
echo "  4. See quick reference:"
echo "     less $TETRA_SRC/bash/actions/QUICKSTART.md"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Happy hacking! 🚀"
echo ""
