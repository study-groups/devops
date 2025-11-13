# Using Tetra Tree Help in External Projects

**Guide for building REPLs with tree-based tab completion and help system**

## Overview

This guide shows how an external project can use Tetra's tree system for:
- Tab completion (no filesystem pollution)
- Hierarchical help system
- Dynamic value completion
- Consistent UX with other Tetra tools

**Assumes**: Your project has `$TETRA_SRC` and `$TETRA_DIR` set (e.g., by sourcing `~/tetra/tetra.sh`)

---

## Quick Start Template

Here's a minimal example for a project called "myapp":

```bash
#!/usr/bin/env bash
# myapp_repl.sh - REPL with tree-based completion

# === 1. SETUP ===
# Source tetra (sets $TETRA_SRC, $TETRA_DIR)
source ~/tetra/tetra.sh

# Source required systems
source "$TETRA_SRC/bash/repl/repl.sh"           # REPL core
source "$TETRA_SRC/bash/tree/core.sh"            # Tree system
source "$TETRA_SRC/bash/tree/complete.sh"        # Tree completion
source "$TETRA_SRC/bash/repl/tree_completion.sh" # Integration

# === 2. BUILD HELP TREE ===
myapp_build_help_tree() {
    local ns="help.myapp"

    # Root
    tree_set "$ns" "desc" "MyApp commands"

    # Commands
    tree_set "$ns.start" "desc" "Start the service"
    tree_set "$ns.start" "usage" "start [--port PORT]"
    tree_set "$ns.start" "aliases" "run"

    tree_set "$ns.stop" "desc" "Stop the service"
    tree_set "$ns.stop" "aliases" "halt"

    tree_set "$ns.status" "desc" "Show status"
    tree_set "$ns.status" "aliases" "s"

    # Command with arguments
    tree_set "$ns.config" "desc" "Configure setting"
    tree_set "$ns.config" "usage" "config <key> <value>"
    tree_set "$ns.config" "completion_values" "port host timeout debug"

    # Command with dynamic completion
    tree_set "$ns.load" "desc" "Load a profile"
    tree_set "$ns.load" "completion_fn" "myapp_complete_profiles"

    tree_set "$ns.help" "desc" "Show help"
    tree_set "$ns.help" "aliases" "h ?"

    tree_set "$ns.exit" "desc" "Exit REPL"
    tree_set "$ns.exit" "aliases" "quit q"
}

# Dynamic completion function
myapp_complete_profiles() {
    # Return available profiles (one per line)
    ls -1 ~/.myapp/profiles/*.profile 2>/dev/null | xargs -n1 basename | sed 's/\.profile$//'
}

# Static fallback (when tree not available)
_myapp_static_completions() {
    cat <<'EOF'
start
run
stop
halt
status
s
config
load
help
h
?
exit
quit
q
port
host
timeout
debug
EOF

    # Add dynamic completions
    myapp_complete_profiles
}

# === 3. COMMAND PROCESSOR ===
_myapp_process_input() {
    local input="$1"

    [[ -z "$input" ]] && return 0

    local cmd="${input%% *}"
    local args="${input#* }"
    [[ "$args" == "$cmd" ]] && args=""

    case "$cmd" in
        start|run)
            echo "Starting MyApp..."
            # Your start logic here
            ;;
        stop|halt)
            echo "Stopping MyApp..."
            # Your stop logic here
            ;;
        status|s)
            echo "Status: Running"
            # Your status logic here
            ;;
        config)
            echo "Config: $args"
            # Your config logic here
            ;;
        load)
            echo "Loading profile: $args"
            # Your load logic here
            ;;
        help|h|\?)
            myapp_show_help "$args"
            ;;
        exit|quit|q)
            return 1  # Exit REPL
            ;;
        *)
            echo "Unknown command: $cmd"
            echo "Type 'help' for available commands"
            ;;
    esac

    return 0
}

# === 4. HELP DISPLAY (Optional) ===
myapp_show_help() {
    local topic="${1:-myapp}"

    # Build full path
    if [[ "$topic" != help.* ]]; then
        topic="help.myapp.$topic"
    fi

    # Check if exists
    if ! tree_exists "$topic"; then
        echo "Unknown topic: $1"
        echo "Press TAB to see available options"
        return 1
    fi

    # Get and display metadata
    local desc=$(tree_get "$topic" "desc")
    local usage=$(tree_get "$topic" "usage")
    local aliases=$(tree_get "$topic" "aliases")

    echo ""
    echo "$desc"
    [[ -n "$usage" ]] && echo "Usage: $usage"
    [[ -n "$aliases" ]] && echo "Aliases: $aliases"
    echo ""

    # Show children
    local children
    children=$(tree_children "$topic")
    if [[ -n "$children" ]]; then
        echo "Available commands:"
        for child in $children; do
            local leaf="${child##*.}"
            local child_desc=$(tree_get "$child" "desc")
            printf "  %-12s %s\n" "$leaf" "$child_desc"
        done
        echo ""
    fi
}

# === 5. MAIN ENTRY POINT ===
myapp_repl() {
    # Initialize tree
    myapp_build_help_tree

    # Register tree completion
    repl_register_tree_completion "help.myapp" "_myapp_static_completions"

    # Set history location
    REPL_HISTORY_BASE="${TETRA_DIR}/myapp/repl_history"

    # Register prompt builder
    repl_register_prompt_builder "_myapp_build_prompt"

    # Register input processor
    repl_register_input_processor "_myapp_process_input"

    # Run REPL
    repl_run
}

_myapp_build_prompt() {
    REPL_PROMPT="myapp> "
}

# Start REPL
myapp_repl
```

---

## Step-by-Step Guide

### Step 1: Source Required Files

```bash
# Core tetra
source ~/tetra/tetra.sh

# REPL system (provides repl_run, repl_register_*, etc.)
source "$TETRA_SRC/bash/repl/repl.sh"

# Tree system (provides tree_set, tree_get, tree_exists, etc.)
source "$TETRA_SRC/bash/tree/core.sh"
source "$TETRA_SRC/bash/tree/complete.sh"

# Tree completion integration (provides repl_register_tree_completion)
source "$TETRA_SRC/bash/repl/tree_completion.sh"
```

### Step 2: Build Your Help Tree

The tree structure defines your commands, their descriptions, and completion behavior.

```bash
myapp_build_help_tree() {
    local ns="help.myapp"  # Your namespace

    # Root node
    tree_set "$ns" "desc" "MyApp REPL commands"

    # Simple command
    tree_set "$ns.start" "desc" "Start the service"
    tree_set "$ns.start" "usage" "start"
    tree_set "$ns.start" "aliases" "run"

    # Command with static completion values
    tree_set "$ns.log" "desc" "Set log level"
    tree_set "$ns.log" "completion_values" "debug info warn error"

    # Command with dynamic completion
    tree_set "$ns.connect" "desc" "Connect to server"
    tree_set "$ns.connect" "completion_fn" "myapp_complete_servers"
}

# Dynamic completion function
myapp_complete_servers() {
    # Return one value per line
    echo "localhost"
    echo "dev-server"
    echo "prod-server"
    # Or from file/database:
    # cat ~/.myapp/servers.txt
}
```

### Step 3: Provide Static Fallback

When the tree system fails or for performance, provide a static list:

```bash
_myapp_static_completions() {
    # Static commands
    cat <<'EOF'
start
stop
status
config
help
exit
EOF

    # Add dynamic completions
    myapp_complete_servers
}
```

### Step 4: Register Tree Completion

**This is the magic line** that enables tree-based completion and blocks filesystem paths:

```bash
repl_register_tree_completion "help.myapp" "_myapp_static_completions"
```

This single call:
- Sets up tree-based completion
- Blocks filesystem path completion
- Provides fallback to static completions
- Integrates with tcurses_completion system

### Step 5: Process Commands

```bash
_myapp_process_input() {
    local input="$1"

    # Parse command and arguments
    local cmd="${input%% *}"
    local args="${input#* }"

    case "$cmd" in
        start) myapp_start ;;
        stop) myapp_stop ;;
        help) myapp_show_help "$args" ;;
        exit|quit) return 1 ;;  # Exit REPL
        *) echo "Unknown: $cmd" ;;
    esac

    return 0  # Continue REPL
}
```

### Step 6: Register and Run

```bash
myapp_repl() {
    # Build tree
    myapp_build_help_tree

    # Register completion
    repl_register_tree_completion "help.myapp" "_myapp_static_completions"

    # Register processors
    repl_register_input_processor "_myapp_process_input"
    repl_register_prompt_builder "_myapp_build_prompt"

    # Set history
    REPL_HISTORY_BASE="${TETRA_DIR}/myapp/repl_history"

    # Run!
    repl_run
}
```

---

## Tree Structure Examples

### Flat Commands
```bash
help.myapp.start
help.myapp.stop
help.myapp.status
help.myapp.exit
```

### Hierarchical Commands
```bash
help.myapp.server/
  ├── start
  ├── stop
  ├── restart
  └── status

help.myapp.db/
  ├── connect
  ├── disconnect
  └── query
```

### With Arguments
```bash
help.myapp.config/
  ├── port (completion_values: "8000 8080 3000")
  ├── host (completion_values: "localhost 0.0.0.0")
  └── debug (completion_values: "true false")
```

---

## Tree Metadata Reference

### Common Fields

```bash
# Required
tree_set "help.myapp.cmd" "desc" "Command description"

# Optional
tree_set "help.myapp.cmd" "usage" "cmd <arg1> [arg2]"
tree_set "help.myapp.cmd" "aliases" "c cmd-alias"
tree_set "help.myapp.cmd" "detail" "Longer explanation"

# Completion
tree_set "help.myapp.cmd" "completion_values" "val1 val2 val3"
tree_set "help.myapp.cmd" "completion_fn" "my_function_name"

# Categories (for visual grouping)
tree_set "help.myapp.cmd" "category" "Server Management"
```

---

## Tab Completion Behavior

### Auto-Complete from Tree

```bash
# User types: st<TAB>
# Tree returns children of help.myapp starting with "st"
# Shows: start stop status

# User types: start <TAB>
# Tree returns children of help.myapp.start
# Shows: whatever start has as children

# User types: config <TAB>
# Tree returns completion_values for help.myapp.config
# Shows: port host debug
```

### Dynamic Completion

```bash
tree_set "help.myapp.load" "completion_fn" "myapp_complete_files"

myapp_complete_files() {
    ls -1 ~/.myapp/*.conf 2>/dev/null | xargs -n1 basename
}

# User types: load <TAB>
# System calls myapp_complete_files()
# Shows: app.conf database.conf server.conf
```

---

## Help System Integration

The same tree structure can power your help command:

```bash
myapp_show_help() {
    local topic="${1:-myapp}"

    # Normalize to tree path
    if [[ "$topic" != help.* ]]; then
        topic="help.myapp.$topic"
    fi

    # Check existence
    if ! tree_exists "$topic"; then
        echo "Unknown topic: $1"
        return 1
    fi

    # Display metadata
    echo ""
    echo "$(tree_get "$topic" "desc")"
    echo "Usage: $(tree_get "$topic" "usage")"
    echo ""

    # Show children
    local children=$(tree_children "$topic")
    if [[ -n "$children" ]]; then
        echo "Sub-commands:"
        for child in $children; do
            local name="${child##*.}"
            local desc=$(tree_get "$child" "desc")
            printf "  %-15s %s\n" "$name" "$desc"
        done
    fi
}
```

---

## Project Structure

Recommended file organization:

```
myproject/
├── myapp.sh              # Main entry point
├── myapp_repl.sh         # REPL implementation
├── myapp_help_tree.sh    # Tree definitions
├── myapp_commands.sh     # Command implementations
└── myapp_completions.sh  # Dynamic completion functions
```

---

## Real-World Examples in Tetra

### bash/midi/core/repl_dual.sh
```bash
# Sources tree system
source "$TETRA_SRC/bash/tree/core.sh"
source "$TETRA_SRC/bash/tree/complete.sh"
source "$TETRA_SRC/bash/repl/tree_completion.sh"

# Builds tree
midi_init_help_tree()

# Registers completion
repl_register_tree_completion "help.midi" "_midi_static_completions"
```

### bash/tdocs/tdocs_repl.sh (line 127)
```bash
# Builds tree
_tdocs_build_help_tree

# Registers
repl_register_tree_completion "help.tdocs" "_tdocs_static_completions"
```

### bash/tree/demo_tree_repl.sh
Complete working example showing all features.

---

## Troubleshooting

### Problem: Filesystem paths still appear

**Solution**: Make sure you're calling `repl_register_tree_completion()`, not trying to set completion manually.

```bash
# ❌ Wrong
dual_mode_get_completions() { ... }

# ✅ Right
repl_register_tree_completion "help.myapp" "_myapp_static_completions"
```

### Problem: No completions at all

**Check**:
1. Tree initialized? `tree_exists "help.myapp"`
2. Function loaded? `command -v repl_register_tree_completion`
3. Completion registered? `echo $REPL_COMPLETION_GENERATOR`

### Problem: Tree not found

**Solution**: Call your `build_help_tree()` function before `repl_register_tree_completion()`.

---

## Advanced: Multi-Level Completion

For commands like `server start prod --debug`:

```bash
# Tree structure
help.myapp.server/
  ├── start/
  │   ├── dev (completion_fn: "myapp_complete_dev_options")
  │   └── prod (completion_fn: "myapp_complete_prod_options")
  ├── stop
  └── restart

# User types: server <TAB>
# Shows: start stop restart

# User types: server start <TAB>
# Shows: dev prod

# User types: server start prod <TAB>
# Calls: myapp_complete_prod_options
# Shows: --debug --verbose --quiet
```

---

## Best Practices

1. **Namespace**: Use `help.yourapp` as root
2. **Fallback**: Always provide static completions
3. **Dynamic**: Use `completion_fn` for file lists, database queries
4. **Help**: Use same tree for help and completion
5. **Aliases**: Define in tree, not separately
6. **Test**: Run `tree_exists "help.yourapp"` to verify

---

## Summary

**To use Tetra tree help in your project:**

1. Source: `repl.sh`, `tree/core.sh`, `tree/complete.sh`, `tree_completion.sh`
2. Build tree: `tree_set "help.yourapp.cmd" "desc" "..."`
3. Register: `repl_register_tree_completion "help.yourapp" "fallback_fn"`
4. Process: Implement `_yourapp_process_input()`
5. Run: `repl_run`

**One magic function**: `repl_register_tree_completion` does everything.

---

## See Also

- `bash/tree/demo_tree_repl.sh` - Complete working example
- `bash/repl/tree_completion.sh` - Implementation details
- `bash/repl/TREE_COMPLETION_COMPLETE.md` - Full documentation
- `bash/midi/core/repl_dual.sh` - Real-world usage
- `bash/tdocs/tdocs_repl.sh` - Another real example
