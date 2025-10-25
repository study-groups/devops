# Tab Completion Quick Reference

## Installation (One Time)

```bash
# Already included in bash/tree/
# No installation needed - just source it
```

## Usage (3 Steps)

### 1. Source Module

```bash
source "$TETRA_SRC/bash/tree/tree_repl_complete.sh"
```

### 2. Build Tree

```bash
tree_insert "help.myapp.start" "action" help="Start service"
tree_insert "help.myapp.stop" "action" help="Stop service"
tree_insert "help.myapp.user" "category" help="User commands"
tree_insert "help.myapp.user.create" "action" help="Create user"
```

### 3. Enable in REPL

```bash
myapp_repl_run() {
    tree_repl_enable_completion "help.myapp"
    repl_run
    tree_repl_disable_completion
}
```

Done! Tab completion now works.

## Functions

### Enable/Disable

```bash
tree_repl_enable_completion "help.myapp"   # Turn on
tree_repl_disable_completion                # Turn off
```

### Get Completions

```bash
tree_complete "help.myapp"                 # Get all children
tree_complete "help.myapp" "st"            # Filter by prefix
tree_complete_values "help.myapp.--env"    # Get metadata values
```

### Register Command

```bash
tree_register_completion "myapp" "help.myapp"
# Now: myapp <TAB> works in shell
```

## Node Types

```bash
category   # Has children (e.g., "user", "config")
action     # Executable command (e.g., "start", "stop")
command    # Alias for action
```

## Tree Operations

```bash
# Insert
tree_insert "path" "type" key=value...

# Query
tree_get "path" "key"
tree_children "path"
tree_exists "path"
tree_type "path"

# Special
tree_complete "path" [word]
```

## Examples

### Basic REPL

```bash
source "$TETRA_SRC/bash/tree/tree_repl_complete.sh"

tree_insert "help.app.start" "action" help="Start"
tree_insert "help.app.stop" "action" help="Stop"

tree_repl_enable_completion "help.app"
```

### With Categories

```bash
tree_insert "help.app.user" "category" help="User ops"
tree_insert "help.app.user.create" "action" help="Create user"
tree_insert "help.app.user.delete" "action" help="Delete user"

# TAB navigation:
# > user <TAB>
# create  delete
```

### Dynamic Completions

```bash
_list_users() {
    ls "$USER_DIR"
}

tree_insert "help.app.user.delete" "action" \
    help="Delete user" \
    completion_fn="_list_users"

# TAB shows actual users!
```

## Common Patterns

### Pattern 1: External Help

```bash
# myapp_help.sh
source "$TETRA_SRC/bash/tree/core.sh"
tree_insert "help.myapp.cmd" "action" help="Description"

# myapp_repl.sh
source "$MYAPP_SRC/myapp_help.sh"
source "$TETRA_SRC/bash/tree/tree_repl_complete.sh"
tree_repl_enable_completion "help.myapp"
```

### Pattern 2: In REPL

```bash
myapp_repl_run() {
    # Setup
    tree_insert "help.myapp.start" "action" help="Start"
    tree_repl_enable_completion "help.myapp"

    # Run
    repl_run

    # Cleanup
    tree_repl_disable_completion
}
```

### Pattern 3: Command Line

```bash
# For use outside REPL
tree_register_completion "myapp" "help.myapp"

# Now in bash:
myapp st<TAB>
myapp start
```

## Testing

```bash
# Test completion functions
bash bash/tree/test_tree_completion.sh

# Interactive demo
bash bash/tree/demo_tree_repl.sh
```

## Troubleshooting

### TAB not working?

```bash
# Check namespace is set
echo "$TREE_REPL_NAMESPACE"

# Check tree exists
tree_exists "$TREE_REPL_NAMESPACE"

# Check binding
bind -p | grep '"\t"'
```

### No completions showing?

```bash
# Check tree has children
tree_children "help.myapp"

# Enable debug
set -x
tree_complete "help.myapp"
set +x
```

### Colors not working?

```bash
# Load color module
source "$TETRA_SRC/bash/color/color.sh"
```

## Complete Template

```bash
#!/usr/bin/env bash

# Source dependencies
source ~/tetra/tetra.sh
source "$TETRA_SRC/bash/repl/repl.sh"
source "$TETRA_SRC/bash/tree/tree_repl_complete.sh"

# Build tree
_myapp_build_tree() {
    tree_insert "help.myapp" "category" title="My App"
    tree_insert "help.myapp.start" "action" help="Start service"
    tree_insert "help.myapp.stop" "action" help="Stop service"
    tree_insert "help.myapp.status" "action" help="Show status"
}

# Process input
_myapp_process_input() {
    local input="$1"
    case "$input" in
        exit|quit) return 1 ;;
        start) echo "Starting..." ;;
        stop) echo "Stopping..." ;;
        status) echo "Running" ;;
        *) echo "Unknown: $input" ;;
    esac
}

# Main REPL
myapp_repl_run() {
    _myapp_build_tree

    # Enable tab completion
    tree_repl_enable_completion "help.myapp"

    # Override callbacks
    repl_process_input() { _myapp_process_input "$@"; }
    export -f repl_process_input

    # Run REPL
    repl_run

    # Cleanup
    tree_repl_disable_completion
    unset -f repl_process_input
}

# Run
myapp_repl_run
```

## Resources

- **TAB_COMPLETION_GUIDE.md** - Full documentation
- **INTEGRATION_EXAMPLE.md** - Step-by-step integration
- **README.md** - Overview
- **demo_tree_repl.sh** - Working demo

## Status

✅ Implemented and tested
📍 Location: `bash/tree/tree_repl_complete.sh`
🎯 Demo: `bash bash/tree/demo_tree_repl.sh`
