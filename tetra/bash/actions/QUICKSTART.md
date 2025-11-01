# Action Registry - Quick Start Guide

## Run the Interactive Tutorial

```bash
bash $TETRA_SRC/bash/actions/TUTORIAL.sh
```

The tutorial is interactive and will walk you through:
1. ✅ Setup and initialization
2. 🔍 Discovering available actions
3. 📋 Inspecting action details
4. ⌨️  Tab completion
5. ▶️  Executing actions
6. 📦 Working with multiple modules
7. 🛠️  Creating your own custom module
8. 🚀 Understanding TES-capable actions

**Time: ~10-15 minutes**

---

## Manual Quick Start (No Tutorial)

### 1. Load the System

```bash
source ~/tetra/tetra.sh
source $TETRA_SRC/bash/actions/registry.sh
source $TETRA_SRC/bash/org/includes.sh
```

### 2. Discover Actions

```bash
# List all org actions
action_list org

# Get info about specific action
action_info org.validate.toml
```

### 3. Execute an Action

```bash
# Execute a local action
action_exec demo.greet "Your Name"

# Execute a TES-capable action (requires @endpoint)
action_exec org.compile.toml @dev
```

---

## 30-Second Test

Copy and paste this entire block:

```bash
# Setup
source ~/tetra/tetra.sh
source $TETRA_SRC/bash/actions/registry.sh
source $TETRA_SRC/bash/actions/executor.sh
source $TETRA_SRC/bash/org/includes.sh

# Create a test action
action_register "test" "hello" "Say hello" "[name]" "no"
test_hello() { echo "👋 Hello, ${1:-World}!"; }

# List and execute
action_list test
action_exec test.hello "Tetra User"
```

Expected output:
```
test.hello           [name]              Say hello
test.hello
👋 Hello, Tetra User!
```

---

## Common Commands Cheat Sheet

| Task | Command |
|------|---------|
| List all actions in a module | `action_list org` |
| Show action details | `action_info org.validate.toml` |
| Execute local action | `action_exec module.action [args]` |
| Execute TES action | `action_exec module.action @endpoint [args]` |
| Check if action exists | `action_exists module.action` |
| Check if TES-capable | `action_is_tes_capable module.action` |
| Get tab completions | `repl_complete_actions org` |
| View registry file | `cat $TETRA_DIR/actions.registry` |

---

## Example Workflows

### Workflow 1: Explore Org Actions

```bash
# Load org module
source $TETRA_SRC/bash/org/includes.sh

# See what's available
action_list org | head -10

# Get details on validation
action_info org.validate.toml

# Execute it
action_exec org.validate.toml --strict
```

### Workflow 2: Create Custom Action

```bash
# Register
action_register "mytool" "status" "Show status" "" "no"

# Implement
mytool_status() {
    echo "Status: All systems operational"
    echo "Time: $(date)"
}

# Execute
action_exec mytool.status
```

### Workflow 3: TES-Capable Action

```bash
# Register with TES capability
action_register "deploy" "app" "Deploy application" "<config>" "yes"

# Implement (endpoint is first param)
deploy_app() {
    local endpoint="$1"
    local config="$2"
    echo "Deploying $config to $endpoint..."
}

# Execute with @endpoint
action_exec deploy.app @staging myapp.toml
```

---

## Troubleshooting

### "Command not found: action_list"

```bash
source $TETRA_SRC/bash/actions/registry.sh
```

### "Action not found: module.action"

```bash
# Check if module is loaded
source $TETRA_SRC/bash/MODULE/includes.sh

# Verify registration
grep module.action $TETRA_DIR/actions.registry
```

### Colors not showing

```bash
# Load TDS first
source $TETRA_SRC/bash/tds/tds.sh
```

---

## File Locations

| File | Path |
|------|------|
| Registry database | `~/.tetra/actions.registry` |
| Tutorial script | `$TETRA_SRC/bash/actions/TUTORIAL.sh` |
| Full documentation | `$TETRA_SRC/bash/actions/README.md` |
| Cheat sheet (after tutorial) | `~/tetra/tutorial/CHEATSHEET.md` |

---

## Next Steps

1. **Run the full tutorial**: `bash $TETRA_SRC/bash/actions/TUTORIAL.sh`
2. **Read the docs**: `less $TETRA_SRC/bash/actions/README.md`
3. **Explore modules**: Try `action_list org`, `action_list rag`, `action_list tsm`
4. **Create your own**: Follow the custom module example in the tutorial

Happy exploring! 🚀
