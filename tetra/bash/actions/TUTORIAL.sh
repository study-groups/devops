#!/usr/bin/env bash
# Tetra Action Registry - Interactive Tutorial
# Follow along to learn how to use and extend the action system

set -e

TUTORIAL_DIR="${TETRA_DIR:-$HOME/tetra}/tutorial"
mkdir -p "$TUTORIAL_DIR"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     Tetra Action Registry - Interactive Tutorial            ║"
echo "║     Learn by doing: discover, use, and extend actions       ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

pause() {
    echo ""
    read -p "Press ENTER to continue... " -r
    echo ""
}

section() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  $1"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
}

step() {
    echo "▶ $1"
    echo ""
}

# Setup
section "STEP 1: Setup and Initialization"

step "First, let's source the tetra environment"
cat << 'EOF'
# Set up environment variables
export TETRA_SRC="${TETRA_SRC:-/Users/mricos/src/devops/tetra}"
export TETRA_DIR="${TETRA_DIR:-$HOME/tetra}"

# Source tetra.sh if available
source ~/tetra/tetra.sh 2>/dev/null || echo "Note: Running without tetra.sh"
EOF
pause

echo "Executing..."
export TETRA_SRC="${TETRA_SRC:-/Users/mricos/src/devops/tetra}"
export TETRA_DIR="${TETRA_DIR:-$HOME/tetra}"

if [[ -f ~/tetra/tetra.sh ]]; then
    source ~/tetra/tetra.sh 2>/dev/null && echo "✓ Tetra environment loaded from ~/tetra/tetra.sh"
else
    echo "ℹ️  Note: ~/tetra/tetra.sh not found, using direct paths"
    echo "   TETRA_SRC=$TETRA_SRC"
    echo "   TETRA_DIR=$TETRA_DIR"
fi
echo "✓ Environment ready"

# Discovery
section "STEP 2: Discovering Available Actions"

step "Load the action registry and a module (org)"
cat << 'EOF'
source $TETRA_SRC/bash/actions/registry.sh
source $TETRA_SRC/bash/org/includes.sh 2>/dev/null
EOF
pause

echo "Executing..."
source $TETRA_SRC/bash/actions/registry.sh
source $TETRA_SRC/bash/org/includes.sh 2>/dev/null
echo "✓ Registry and org module loaded"

step "List all actions in the org module"
cat << 'EOF'
action_list org
EOF
pause

echo "Executing..."
action_list org
echo ""
echo "💡 Notice: Green=module, Red/Orange=action, Blue=parameters"

step "Count registered actions"
cat << 'EOF'
grep -c '^org\.' $TETRA_DIR/actions.registry
EOF
pause

echo "Executing..."
org_count=$(grep -c '^org\.' $TETRA_DIR/actions.registry)
echo "Found: $org_count org actions"

# Inspection
section "STEP 3: Inspecting Action Details"

step "Get detailed info about a specific action"
cat << 'EOF'
action_info org.validate.toml
EOF
pause

echo "Executing..."
action_info org.validate.toml

step "Check if an action is TES-capable (needs @endpoint)"
cat << 'EOF'
if action_is_tes_capable org.compile.toml; then
    echo "✓ org.compile.toml requires a TES endpoint like @dev"
else
    echo "✗ org.compile.toml is local-only"
fi
EOF
pause

echo "Executing..."
if action_is_tes_capable org.compile.toml; then
    echo "✓ org.compile.toml requires a TES endpoint like @dev"
else
    echo "✗ org.compile.toml is local-only"
fi

step "View the raw registry file"
cat << 'EOF'
head -5 $TETRA_DIR/actions.registry
EOF
pause

echo "Executing..."
head -5 $TETRA_DIR/actions.registry
echo ""
echo "💡 Format: module.action:description:params:tes_capable"

# Tab Completion
section "STEP 4: Tab Completion"

step "Get completion suggestions for a module"
cat << 'EOF'
repl_complete_actions org | head -5
EOF
pause

echo "Executing..."
source $TETRA_SRC/bash/repl/action_completion.sh
repl_complete_actions org | head -5
echo ""
echo "💡 These are what you'd see when pressing TAB in a REPL"

step "Show the full colored action menu"
cat << 'EOF'
repl_show_action_menu org | head -15
EOF
pause

echo "Executing..."
repl_show_action_menu org | head -15

# Execution
section "STEP 5: Executing Actions"

step "Let's create a simple test action to demonstrate execution"
cat << 'EOF'
# Register a test action
action_register "demo" "greet" "Say hello to someone" "<name>" "no"

# Create the implementation
demo_greet() {
    local name="${1:-World}"
    echo "👋 Hello, $name! Welcome to the Tetra action system."
}

# Execute it
action_exec demo.greet "Tutorial User"
EOF
pause

echo "Executing..."
source $TETRA_SRC/bash/actions/executor.sh
action_register "demo" "greet" "Say hello to someone" "<name>" "no"

demo_greet() {
    local name="${1:-World}"
    echo "👋 Hello, $name! Welcome to the Tetra action system."
}

action_exec demo.greet "Tutorial User"

# Multiple Modules
section "STEP 6: Working with Multiple Modules"

step "Load all modules and see the full registry"
cat << 'EOF'
source $TETRA_SRC/bash/rag/includes.sh 2>/dev/null
source $TETRA_SRC/bash/tsm/includes.sh 2>/dev/null

echo "Total actions: $(grep -c '^[^#]' $TETRA_DIR/actions.registry)"
EOF
pause

echo "Executing..."
source $TETRA_SRC/bash/rag/includes.sh 2>/dev/null
source $TETRA_SRC/bash/tsm/includes.sh 2>/dev/null

total=$(grep -c '^[^#]' $TETRA_DIR/actions.registry)
echo "Total actions: $total"

step "List actions from each module"
cat << 'EOF'
echo "=== ORG Actions ==="
action_list org | head -3

echo ""
echo "=== RAG Actions ==="
action_list rag | head -3

echo ""
echo "=== TSM Actions ==="
action_list tsm | head -3
EOF
pause

echo "Executing..."
echo "=== ORG Actions ==="
action_list org | head -3

echo ""
echo "=== RAG Actions ==="
action_list rag | head -3

echo ""
echo "=== TSM Actions ==="
action_list tsm | head -3

# Custom Module
section "STEP 7: Create Your Own Custom Module with Actions"

step "Let's create a simple custom module called 'mytool'"
cat << 'EOF'
# Create module directory
mkdir -p $TUTORIAL_DIR/mytool

# Create action implementations
cat > $TUTORIAL_DIR/mytool/actions.sh << 'ACTIONS'
#!/usr/bin/env bash

# Action: mytool.status - Check system status
mytool_status() {
    echo "📊 System Status:"
    echo "  • Uptime: $(uptime | awk '{print $3,$4}' | sed 's/,//')"
    echo "  • Date: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "  • User: $USER"
}

# Action: mytool.version - Show version
mytool_version() {
    echo "🔖 MyTool v1.0.0"
    echo "   Tetra Action Registry Tutorial"
}

# Action: mytool.hello - Greet with custom message
mytool_hello() {
    local name="${1:-Friend}"
    local emoji="${2:-👋}"
    echo "$emoji Hello, $name! This is a custom action."
}
ACTIONS

# Create includes file that registers actions
cat > $TUTORIAL_DIR/mytool/includes.sh << 'INCLUDES'
#!/usr/bin/env bash

MYTOOL_SRC="$TUTORIAL_DIR/mytool"

# Source implementations
source "$MYTOOL_SRC/actions.sh"

# Register actions
if [[ -f "$TETRA_SRC/bash/actions/registry.sh" ]]; then
    source "$TETRA_SRC/bash/actions/registry.sh"

    action_register "mytool" "status" "Check system status" "" "no"
    action_register "mytool" "version" "Show mytool version" "" "no"
    action_register "mytool" "hello" "Greet with custom message" "<name> [emoji]" "no"
fi
INCLUDES

chmod +x $TUTORIAL_DIR/mytool/*.sh
EOF
pause

echo "Executing..."
mkdir -p $TUTORIAL_DIR/mytool

cat > $TUTORIAL_DIR/mytool/actions.sh << 'ACTIONS'
#!/usr/bin/env bash

# Action: mytool.status - Check system status
mytool_status() {
    echo "📊 System Status:"
    echo "  • Uptime: $(uptime | awk '{print $3,$4}' | sed 's/,//')"
    echo "  • Date: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "  • User: $USER"
}

# Action: mytool.version - Show version
mytool_version() {
    echo "🔖 MyTool v1.0.0"
    echo "   Tetra Action Registry Tutorial"
}

# Action: mytool.hello - Greet with custom message
mytool_hello() {
    local name="${1:-Friend}"
    local emoji="${2:-👋}"
    echo "$emoji Hello, $name! This is a custom action."
}
ACTIONS

cat > $TUTORIAL_DIR/mytool/includes.sh << 'INCLUDES'
#!/usr/bin/env bash

MYTOOL_SRC="$TUTORIAL_DIR/mytool"

# Source implementations
source "$MYTOOL_SRC/actions.sh"

# Register actions
if [[ -f "$TETRA_SRC/bash/actions/registry.sh" ]]; then
    source "$TETRA_SRC/bash/actions/registry.sh"

    action_register "mytool" "status" "Check system status" "" "no"
    action_register "mytool" "version" "Show mytool version" "" "no"
    action_register "mytool" "hello" "Greet with custom message" "<name> [emoji]" "no"
fi
INCLUDES

chmod +x $TUTORIAL_DIR/mytool/*.sh
echo "✓ Custom module created at: $TUTORIAL_DIR/mytool/"

step "Load your custom module"
cat << 'EOF'
source $TUTORIAL_DIR/mytool/includes.sh
EOF
pause

echo "Executing..."
source $TUTORIAL_DIR/mytool/includes.sh
echo "✓ mytool module loaded and registered"

step "List your new actions"
cat << 'EOF'
action_list mytool
EOF
pause

echo "Executing..."
action_list mytool

step "Execute your custom actions"
cat << 'EOF'
action_exec mytool.version
action_exec mytool.status
action_exec mytool.hello "Tutorial User" "🎉"
EOF
pause

echo "Executing..."
action_exec mytool.version
echo ""
action_exec mytool.status
echo ""
action_exec mytool.hello "Tutorial User" "🎉"

# TES-Capable Actions
section "STEP 8: Understanding TES-Capable Actions"

step "TES-capable actions require an @endpoint parameter"
cat << 'EOF'
# Example: Create a TES-capable action
action_register "mytool" "deploy" "Deploy to endpoint" "<config>" "yes"

mytool_deploy() {
    local endpoint="$1"
    local config="$2"
    echo "🚀 Deploying $config to $endpoint..."
    echo "   (This would create a TTS transaction)"
}

# Execute with @endpoint
action_exec mytool.deploy @dev myapp.conf
EOF
pause

echo "Executing..."
action_register "mytool" "deploy" "Deploy to endpoint" "<config>" "yes"

mytool_deploy() {
    local endpoint="$1"
    local config="$2"
    echo "🚀 Deploying $config to $endpoint..."
    echo "   (This would create a TTS transaction if TTM available)"
}

action_exec mytool.deploy @dev myapp.conf

step "Show the TES endpoint indicator in action info"
cat << 'EOF'
action_info mytool.deploy
EOF
pause

echo "Executing..."
action_info mytool.deploy
echo ""
echo "💡 Notice the @<endpoint> suffix in magenta"

# Summary
section "TUTORIAL COMPLETE! 🎉"

echo "You've learned how to:"
echo ""
echo "  ✓ Discover available actions with action_list"
echo "  ✓ Inspect action details with action_info"
echo "  ✓ Execute actions with action_exec"
echo "  ✓ Use tab completion with repl_complete_actions"
echo "  ✓ Create custom modules with registered actions"
echo "  ✓ Understand TES-capable actions with @endpoints"
echo ""
echo "📚 Next Steps:"
echo ""
echo "  1. Read the full documentation:"
echo "     less $TETRA_SRC/bash/actions/README.md"
echo ""
echo "  2. Explore existing module actions:"
echo "     action_list org"
echo "     action_list rag"
echo "     action_list tsm"
echo ""
echo "  3. Your custom module is ready to use:"
echo "     source $TUTORIAL_DIR/mytool/includes.sh"
echo "     action_exec mytool.status"
echo ""
echo "  4. Try integration with TTS transactions (see docs/TTS_TETRA_TRANSACTION_STANDARD.md)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Save a cheat sheet
cat > $TUTORIAL_DIR/CHEATSHEET.md << 'CHEATSHEET'
# Tetra Action Registry - Quick Reference

## Discovery
```bash
action_list [module]              # List all actions (or filter by module)
action_info module.action         # Show detailed info
action_exists module.action       # Check if action exists
action_is_tes_capable module.action  # Check if needs @endpoint
```

## Execution
```bash
action_exec module.action [args...]           # Execute local action
action_exec module.action @endpoint [args...] # Execute TES-capable action
```

## Tab Completion
```bash
repl_complete_actions [module]    # Get completion list
repl_show_action_menu [module]    # Show colored menu
```

## Registration (in module's includes.sh)
```bash
action_register MODULE ACTION DESCRIPTION PARAMS TES_CAPABLE

# Examples:
action_register "mymod" "status" "Show status" "" "no"
action_register "mymod" "deploy" "Deploy to endpoint" "<file>" "yes"
```

## Implementation Pattern
```bash
# Convention: module_action or module_action_impl
mymod_status() {
    echo "Status info here..."
}

mymod_deploy_impl() {
    local endpoint="$1"  # For TES-capable actions
    local file="$2"
    echo "Deploying $file to $endpoint..."
}
```

## Color Coding (TDS)
- Module name (noun): Green
- Action name (verb): Red/Orange
- Parameters: Blue
- TES endpoint: Magenta
- Separator (.): Gray

## Files
- Registry: ~/.tetra/actions.registry
- Core: $TETRA_SRC/bash/actions/registry.sh
- Executor: $TETRA_SRC/bash/actions/executor.sh
- Completion: $TETRA_SRC/bash/repl/action_completion.sh
CHEATSHEET

echo "💾 Cheat sheet saved to: $TUTORIAL_DIR/CHEATSHEET.md"
echo ""
echo "Happy hacking! 🚀"
