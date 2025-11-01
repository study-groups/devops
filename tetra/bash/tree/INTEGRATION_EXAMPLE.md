# Integration Example: Adding Tab Completion to Game REPL

This shows exactly how to add tab completion to an existing REPL like the game module.

## Your Request

```
tmod load game
game repl
> <tab>          # should show possible actions
> play <tab>     # should show possibilities
```

## Implementation

### Step 1: Add Tab Completion to game_repl.sh

Edit `bash/game/game_repl.sh`:

```bash
# At the top, after sourcing repl.sh:
source "$TETRA_SRC/bash/tree/tree_repl_complete.sh"

# In the main game_repl_run() function, BEFORE repl_run:
game_repl_run() {
    # ... existing banner/setup code ...

    # Enable tab completion
    tree_repl_enable_completion "help.game"

    # Override REPL callbacks
    repl_build_prompt() { _game_repl_build_prompt "$@"; }
    repl_process_input() { _game_repl_process_input "$@"; }
    export -f repl_build_prompt repl_process_input

    # Run main loop
    repl_run

    # Cleanup
    tree_repl_disable_completion
    unset -f repl_build_prompt repl_process_input

    # ... existing cleanup code ...
}
```

### Step 2: Create game_help.sh Tree Structure

Create `bash/game/game_help.sh`:

```bash
#!/usr/bin/env bash
# game_help.sh - Help tree for game REPL

source "$TETRA_SRC/bash/tree/core.sh"

# Build help tree
game_build_help_tree() {
    # Root
    tree_insert "help.game" "category" \
        title="Game REPL" \
        help="Tetra game launcher and manager"

    # Main commands
    tree_insert "help.game.play" "action" \
        help="Launch a game" \
        detail="Usage: play <game-name>"

    tree_insert "help.game.ls" "action" \
        help="List available games" \
        detail="Usage: ls [all]"

    tree_insert "help.game.status" "action" \
        help="Show current session status" \
        detail="Displays org, user, and active game"

    tree_insert "help.game.org" "action" \
        help="Switch organization" \
        detail="Usage: org <org-name>"

    # User commands (category with subcommands)
    tree_insert "help.game.user" "category" \
        help="User management commands"

    tree_insert "help.game.user.list" "action" \
        help="List all users" \
        detail="Shows all user accounts"

    tree_insert "help.game.user.new" "action" \
        help="Create new user" \
        detail="Usage: user new <name>"

    tree_insert "help.game.user.status" "action" \
        help="Show user details" \
        detail="Usage: user status <name>"

    # Utility commands
    tree_insert "help.game.help" "action" \
        help="Show help" \
        detail="Usage: help [topic]"

    tree_insert "help.game.exit" "action" \
        help="Exit REPL" \
        detail="Aliases: quit, q"
}

# Build on load
game_build_help_tree
```

### Step 3: Source in game_repl.sh

Add to `bash/game/game_repl.sh`:

```bash
# After sourcing game_registry.sh:
source "$GAME_SRC/game_help.sh"
```

## Result

Now when you run:

```bash
tmod load game
game repl
```

You get tab completion:

```
[tetra x none x lobby] > <TAB>
play      ls        status    org       user      help      exit

[tetra x none x lobby] > pl<TAB>
[tetra x none x lobby] > play <TAB>
pulsar         estoface       formant

[tetra x none x lobby] > play pu<TAB>
[tetra x none x lobby] > play pulsar

[tetra x none x lobby] > user <TAB>
list           new            status

[tetra x none x lobby] > user n<TAB>
[tetra x none x lobby] > user new
```

## Dynamic Completions

For dynamic completions (like listing actual games), add completion functions:

```bash
# In game_help.sh:

# Completion function for play command
_game_complete_play() {
    # Get games for current org
    local org="${GAME_ACTIVE_ORG:-tetra}"
    game_registry_list "$org" | awk '{print $1}'
}

# Register completion function
tree_insert "help.game.play" "action" \
    help="Launch a game" \
    detail="Usage: play <game-name>" \
    completion_fn="_game_complete_play"
```

Now `play <TAB>` shows actual available games!

## Advanced: Context-Aware Completions

For org switching:

```bash
# Completion function for org command
_game_complete_org() {
    # List available orgs
    echo "tetra"
    echo "pixeljam-arcade"
    # Could read from config file:
    # cat "$GAME_DIR/orgs.conf"
}

tree_insert "help.game.org" "action" \
    help="Switch organization" \
    completion_fn="_game_complete_org"
```

## Full Pattern

The complete pattern:

1. **Create help tree** - Define command structure
2. **Source tree_repl_complete.sh** - Load completion system
3. **Enable completion** - `tree_repl_enable_completion "help.game"`
4. **Run REPL** - `repl_run`
5. **Disable on exit** - `tree_repl_disable_completion`

## Testing

```bash
# Test basic completion
bash bash/tree/demo_tree_repl.sh

# Test with actual tree structure
source ~/tetra/tetra.sh
source "$TETRA_SRC/bash/game/game_help.sh"
source "$TETRA_SRC/bash/tree/tree_repl_complete.sh"

# Check tree exists
tree_exists "help.game"

# Get completions
tree_complete "help.game"
# Output: play, ls, status, org, user, help, exit

tree_complete "help.game.user"
# Output: list, new, status
```

## Next Steps

Apply this pattern to other modules:

- `bash/org/org_repl.sh` → `help.org`
- `bash/rag/rag_repl.sh` → `help.rag`
- `bash/melvin/melvin_repl.sh` → `help.melvin`
- `bash/tdocs/tdoc.sh` → `help.tdoc`

Each gets tab completion by:
1. Creating `module_help.sh`
2. Sourcing `tree_repl_complete.sh`
3. Calling `tree_repl_enable_completion "help.module"`
