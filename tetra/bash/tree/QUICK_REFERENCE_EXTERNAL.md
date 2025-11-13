# Tetra Tree Help - Quick Reference for External Projects

## Minimal Working Example (5 minutes)

```bash
#!/usr/bin/env bash
# my_repl.sh

# 1. Source dependencies
source ~/tetra/tetra.sh
source "$TETRA_SRC/bash/repl/repl.sh"
source "$TETRA_SRC/bash/tree/core.sh"
source "$TETRA_SRC/bash/tree/complete.sh"
source "$TETRA_SRC/bash/repl/tree_completion.sh"

# 2. Build tree
_build_tree() {
    tree_set "help.myapp.start" "desc" "Start service"
    tree_set "help.myapp.stop" "desc" "Stop service"
    tree_set "help.myapp.status" "desc" "Show status"
    tree_set "help.myapp.help" "desc" "Show help"
    tree_set "help.myapp.exit" "desc" "Exit"
}

# 3. Static fallback
_static_completions() {
    echo "start"
    echo "stop"
    echo "status"
    echo "help"
    echo "exit"
}

# 4. Process input
_process_input() {
    case "$1" in
        start) echo "Starting..." ;;
        stop) echo "Stopping..." ;;
        status) echo "Running" ;;
        help|h) echo "Commands: start stop status help exit" ;;
        exit|quit|q) return 1 ;;
        *) echo "Unknown: $1" ;;
    esac
    return 0
}

# 5. Run REPL
my_repl() {
    _build_tree
    repl_register_tree_completion "help.myapp" "_static_completions"
    repl_register_input_processor "_process_input"
    REPL_HISTORY_BASE="$TETRA_DIR/myapp/history"
    REPL_PROMPT="myapp> "
    repl_run
}

my_repl
```

---

## Essential Functions

### Tree Building
```bash
tree_set "help.myapp.cmd" "desc" "Description"
tree_set "help.myapp.cmd" "usage" "cmd <args>"
tree_set "help.myapp.cmd" "aliases" "c cmd-alias"
tree_set "help.myapp.cmd" "completion_values" "val1 val2"
tree_set "help.myapp.cmd" "completion_fn" "my_fn"
```

### Tree Queries
```bash
tree_exists "help.myapp.cmd"                  # Check if exists
tree_get "help.myapp.cmd" "desc"              # Get metadata
tree_children "help.myapp"                    # List children
tree_complete "help.myapp" "st"               # Complete "st..."
```

### REPL Integration
```bash
repl_register_tree_completion "help.myapp" "_fallback_fn"  # THE KEY LINE
repl_register_input_processor "_process_fn"
repl_register_prompt_builder "_prompt_fn"
repl_run  # Start the REPL
```

---

## Common Patterns

### Command with Static Options
```bash
tree_set "help.myapp.log" "desc" "Set log level"
tree_set "help.myapp.log" "completion_values" "debug info warn error"

# User types: log <TAB>
# Shows: debug info warn error
```

### Command with Dynamic Options
```bash
tree_set "help.myapp.load" "desc" "Load profile"
tree_set "help.myapp.load" "completion_fn" "list_profiles"

list_profiles() {
    ls -1 ~/.myapp/*.profile | xargs -n1 basename | sed 's/\.profile$//'
}

# User types: load <TAB>
# Shows: dev prod staging (from files)
```

### Hierarchical Commands
```bash
tree_set "help.myapp.server.start" "desc" "Start server"
tree_set "help.myapp.server.stop" "desc" "Stop server"
tree_set "help.myapp.server.restart" "desc" "Restart server"

# User types: server <TAB>
# Shows: start stop restart
```

---

## Cheat Sheet

### Setup (copy-paste)
```bash
source ~/tetra/tetra.sh
source "$TETRA_SRC/bash/repl/repl.sh"
source "$TETRA_SRC/bash/tree/core.sh"
source "$TETRA_SRC/bash/tree/complete.sh"
source "$TETRA_SRC/bash/repl/tree_completion.sh"
```

### Tree Building (copy-paste)
```bash
_myapp_build_tree() {
    local ns="help.myapp"
    tree_set "$ns.start" "desc" "Start"
    tree_set "$ns.stop" "desc" "Stop"
    tree_set "$ns.help" "desc" "Help"
    tree_set "$ns.exit" "desc" "Exit"
}
```

### Fallback (copy-paste)
```bash
_myapp_static() {
    cat <<'EOF'
start
stop
help
exit
EOF
}
```

### Registration (copy-paste)
```bash
_myapp_build_tree
repl_register_tree_completion "help.myapp" "_myapp_static"
repl_register_input_processor "_myapp_process"
REPL_PROMPT="myapp> "
REPL_HISTORY_BASE="$TETRA_DIR/myapp/history"
repl_run
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Filesystem paths appear | Call `repl_register_tree_completion()` |
| No completions | Check `tree_exists "help.myapp"` |
| Wrong completions | Check `tree_get "help.myapp.cmd" "completion_values"` |
| Function not found | Source `tree_completion.sh` |

---

## Examples in Tetra Codebase

```bash
# MIDI REPL
bash/midi/core/repl_dual.sh:532
    repl_register_tree_completion "help.midi" "_midi_static_completions"

# TDocs REPL
bash/tdocs/tdocs_repl.sh:127
    repl_register_tree_completion "help.tdocs" "_tdocs_static_completions"

# Demo REPL
bash/tree/demo_tree_repl.sh
    # Complete working example
```

---

## The One Magic Function

```bash
repl_register_tree_completion "help.yourapp" "fallback_function"
```

**This single call**:
- ✅ Sets up tree-based completion
- ✅ Blocks filesystem paths
- ✅ Provides fallback
- ✅ Integrates with tcurses
- ✅ Just works™

---

## Full Guide

See `EXTERNAL_PROJECT_GUIDE.md` for complete documentation with examples, best practices, and advanced patterns.
