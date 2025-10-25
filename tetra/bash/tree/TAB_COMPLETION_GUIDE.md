# Tree Tab Completion Guide

Tab completion for tree-based REPLs in Tetra.

## Overview

The `tree_repl_complete.sh` module provides intelligent tab completion for any REPL that uses the tree structure for commands/help. Based on the pattern from `bash/game/games/estoface`.

## Quick Start

### 1. Basic Setup (3 steps)

```bash
# In your REPL script:

# 1. Source the completion module
source "$TETRA_SRC/bash/tree/tree_repl_complete.sh"

# 2. Enable completion with your tree namespace
tree_repl_enable_completion "help.mymodule"

# 3. Run your REPL
repl_run
```

That's it! Now TAB completion works.

### 2. Full Example

See `bash/tree/demo_tree_repl.sh` for a complete working example.

```bash
bash bash/tree/demo_tree_repl.sh
```

Then:
- Press TAB to see all commands
- Type `sh` + TAB to complete "show"
- Type `show ` + TAB to see show options
- Type `show st` + TAB to complete "status"

## Integration Patterns

### Pattern 1: Simple REPL (like game)

```bash
#!/usr/bin/env bash
source ~/tetra/tetra.sh
source "$TETRA_SRC/bash/repl/repl.sh"
source "$TETRA_SRC/bash/tree/tree_repl_complete.sh"

# Build your tree structure
tree_insert "help.myapp.start" "action" help="Start the app"
tree_insert "help.myapp.stop" "action" help="Stop the app"
tree_insert "help.myapp.status" "action" help="Show status"

# Define REPL callbacks
my_repl_process_input() {
    local input="$1"
    case "$input" in
        start) echo "Starting..." ;;
        stop) echo "Stopping..." ;;
        status) echo "Status: OK" ;;
        *) echo "Unknown: $input" ;;
    esac
}

# Main function
my_repl_run() {
    # Enable tab completion
    tree_repl_enable_completion "help.myapp"

    # Override callbacks
    repl_process_input() { my_repl_process_input "$@"; }
    export -f repl_process_input

    # Run REPL
    repl_run

    # Cleanup
    tree_repl_disable_completion
}

my_repl_run
```

### Pattern 2: With Help System (like estoface)

```bash
# Source tree help
source "$TETRA_SRC/bash/tree/help.sh"
source "$TETRA_SRC/bash/tree/tree_repl_complete.sh"

# Build help tree (externalize to myapp_help.sh)
source "$MYAPP_SRC/myapp_help.sh"

# Show help with TAB hint
myapp_show_help() {
    local topic="${1:-myapp}"
    topic="help.myapp.$topic"

    if ! tree_exists "$topic"; then
        echo "Unknown: $1 (try TAB)"
        return 1
    fi

    local help_text=$(tree_get "$topic" "help")
    echo "$help_text"

    # Show children as completions
    local children=$(tree_children "$topic")
    if [[ -n "$children" ]]; then
        echo ""
        echo "Topics (TAB):"
        for child in $children; do
            local leaf="${child##*.}"
            printf "  %-14s %s\n" "$leaf" "$(tree_get "$child" "help")"
        done
    fi
}

# Enable in REPL
tree_repl_enable_completion "help.myapp"
```

### Pattern 3: Multi-level Commands

For commands like `show status`, `create node`, etc:

```bash
# Tree structure
tree_insert "help.myapp.show" "category" help="Show information"
tree_insert "help.myapp.show.status" "action" help="Show status"
tree_insert "help.myapp.show.config" "action" help="Show config"
tree_insert "help.myapp.create" "category" help="Create items"
tree_insert "help.myapp.create.node" "action" help="Create node"
tree_insert "help.myapp.create.file" "action" help="Create file"

# Command processor
case "$cmd" in
    show)
        case "$arg1" in
            status) show_status ;;
            config) show_config ;;
        esac
        ;;
    create)
        case "$arg1" in
            node) create_node ;;
            file) create_file ;;
        esac
        ;;
esac
```

TAB completion automatically follows the tree structure:
- `sh<TAB>` → completes to `show `
- `show <TAB>` → shows: status, config
- `show st<TAB>` → completes to `show status`

## How It Works

### 1. Tree Structure

Commands are defined as tree nodes:

```bash
tree_insert "help.myapp.command" "action" help="Description"
#           └─ path ─┘            └type┘   └─ metadata ─┘
```

Types:
- `category` - Has children (e.g., `show`, `create`)
- `action` - Leaf node, executable command
- `command` - Alias for action

### 2. Completion Function

The `_tree_repl_complete()` function:
1. Reads current line from `READLINE_LINE`
2. Parses words to build tree path
3. Gets children from tree
4. Shows completions inline or completes if unique

### 3. Bash Binding

```bash
bind -x '"\t": _tree_repl_complete'
```

This binds TAB key to call `_tree_repl_complete()`.

## API Reference

### Functions

#### `tree_repl_enable_completion <namespace>`
Enable tab completion for a tree namespace.

```bash
tree_repl_enable_completion "help.myapp"
```

#### `tree_repl_disable_completion`
Disable tab completion (restore default TAB).

```bash
tree_repl_disable_completion
```

#### `tree_register_completion <command> <namespace>`
Register completion for a specific command (for use outside REPL).

```bash
tree_register_completion "myapp" "help.myapp"
# Now: myapp st<TAB> works in shell
```

### Environment Variables

#### `TREE_REPL_NAMESPACE`
The tree namespace for completion (set by `tree_repl_enable_completion`).

#### `TREE_REPL_PROMPT`
Optional: Custom prompt string for display in completion output.

## Examples

### Example: Game Module

Add to `bash/game/game_repl.sh`:

```bash
# After sourcing repl.sh, add:
source "$TETRA_SRC/bash/tree/tree_repl_complete.sh"

# In game_repl_run():
game_repl_run() {
    # ... existing setup ...

    # Enable tab completion
    tree_repl_enable_completion "help.game"

    # Run REPL
    repl_run

    # Cleanup
    tree_repl_disable_completion
}
```

Then build your tree:

```bash
# bash/game/game_help.sh
tree_insert "help.game.play" "action" help="Launch a game"
tree_insert "help.game.ls" "action" help="List games"
tree_insert "help.game.org" "action" help="Switch organization"
tree_insert "help.game.user" "category" help="User management"
tree_insert "help.game.user.new" "action" help="Create new user"
tree_insert "help.game.user.list" "action" help="List users"
```

Now in the game REPL:
- `<TAB>` → shows: play, ls, org, user
- `us<TAB>` → completes to `user `
- `user <TAB>` → shows: new, list
- `user n<TAB>` → completes to `user new`

### Example: Simple Action REPL

```bash
#!/usr/bin/env bash
source ~/tetra/tetra.sh
source "$TETRA_SRC/bash/tree/tree_repl_complete.sh"

# Define actions
tree_insert "help.action.start" "action" help="Start process"
tree_insert "help.action.stop" "action" help="Stop process"
tree_insert "help.action.restart" "action" help="Restart process"
tree_insert "help.action.status" "action" help="Show status"

# Enable completion
tree_repl_enable_completion "help.action"

# Simple read loop
while true; do
    read -e -p "> " cmd
    case "$cmd" in
        exit|quit) break ;;
        start) echo "Starting..." ;;
        stop) echo "Stopping..." ;;
        restart) echo "Restarting..." ;;
        status) echo "Running" ;;
        *) echo "Unknown: $cmd" ;;
    esac
done

tree_repl_disable_completion
```

## Features

### 1. Automatic Path Building
Commands are automatically concatenated:
- Input: `show status`
- Path: `help.myapp.show.status`

### 2. Partial Matching
- `st<TAB>` completes to `status` if unique
- Shows all matches if ambiguous

### 3. Multi-level Navigation
```
> show <TAB>
  status    [action]  Show current status
  config    [action]  Show configuration
  tree      [action]  Show tree structure

> show st<TAB>
> show status
```

### 4. Type-aware Display
Shows node types in completions:
- `[category]` - Has subcommands
- `[action]` - Executable leaf

### 5. Colored Output
Uses color functions if available:
- Categories: Blue (`00AAFF`)
- Actions: Green (`00FF88`)
- Descriptions: Gray (`AAAAAA`)

## Testing

### Run Tests

```bash
# Basic functionality
bash bash/tree/test_tree_completion.sh

# Interactive demo
bash bash/tree/demo_tree_repl.sh
```

### Manual Testing

In any REPL with tab completion enabled:

1. **Empty TAB** - Should show all top-level commands
2. **Partial + TAB** - Should complete if unique
3. **Complete + TAB** - Should show next level
4. **Unknown + TAB** - Should show nothing or error

## Troubleshooting

### Tab completion not working

1. Check `TREE_REPL_NAMESPACE` is set:
   ```bash
   echo "$TREE_REPL_NAMESPACE"
   ```

2. Verify tree structure exists:
   ```bash
   tree_exists "$TREE_REPL_NAMESPACE"
   ```

3. Check bind is active:
   ```bash
   bind -p | grep '"\t"'
   ```

### Completions not showing

1. Verify tree has children:
   ```bash
   tree_children "$TREE_REPL_NAMESPACE"
   ```

2. Enable debugging:
   ```bash
   set -x
   tree_complete "help.myapp"
   set +x
   ```

### Colors not working

Check color functions are loaded:
```bash
declare -f text_color reset_color
```

If not found, source:
```bash
source "$TETRA_SRC/bash/color/color.sh"
```

## Best Practices

### 1. Consistent Naming
Use clear, predictable names:
- Good: `show`, `create`, `delete`, `list`
- Avoid: `shw`, `mk`, `rm`, `lst`

### 2. Logical Grouping
Group related commands under categories:
```bash
tree_insert "help.app.user" "category"
tree_insert "help.app.user.create" "action"
tree_insert "help.app.user.delete" "action"
tree_insert "help.app.user.list" "action"
```

### 3. Help Text
Always provide help metadata:
```bash
tree_insert "help.app.cmd" "action" \
    help="Brief description" \
    detail="Longer explanation with examples"
```

### 4. Externalize Help Trees
Put tree definitions in separate `*_help.sh` files:
```bash
# myapp_help.sh
source "$TETRA_SRC/bash/tree/core.sh"

myapp_build_help_tree() {
    tree_insert "help.myapp" "category" title="MyApp"
    tree_insert "help.myapp.start" "action" help="Start app"
    # ... more definitions
}

myapp_build_help_tree
```

Then source in main REPL:
```bash
source "$MYAPP_SRC/myapp_help.sh"
```

## See Also

- `bash/tree/core.sh` - Tree data structure
- `bash/tree/complete.sh` - Completion utilities
- `bash/tree/help.sh` - Help system integration
- `bash/game/games/estoface/core/estoface_repl.sh` - Reference implementation
- `bash/tkm/tkm_completion.sh` - Alternative completion pattern
