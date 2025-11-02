# TAB Completion Survey - Tree Integration

## Current Status

✅ **Native TAB completion is WORKING!**
- You press TAB, it completes
- Currently showing "ls" because that's the first alphabetic match in the static word list

## What We Have

### 1. Native Readline with TAB Support ✅
**File**: `bash/tcurses/tcurses_readline.sh`

- Character-by-character input
- Calls `repl_handle_tab()` from `tcurses_completion.sh`
- Works perfectly!

### 2. Completion Infrastructure ✅
**File**: `bash/tcurses/tcurses_completion.sh`

Key functions:
- `repl_set_completion_generator(fn)` - Register word generator
- `repl_handle_tab()` - Handle TAB press, cycle through matches
- `repl_reset_completion()` - Reset on non-TAB keys
- `_repl_find_completions(prefix)` - Filter matches

### 3. Tree-Based Completion System ✅
**Files**:
- `bash/tree/core.sh` - Tree data structure
- `bash/tree/complete.sh` - Tree completion functions
- `bash/tree/shell_complete.sh` - Bash completion generator

**Key Functions**:
```bash
tree_complete(path, current_word)              # Get child nodes
tree_complete_by_type(path, type, word)        # Filter by type
tree_complete_values(path)                     # Dynamic/static values
tree_complete_interactive(path)                # Show with descriptions
```

**Tree Metadata** supports:
- `completion_fn` - Dynamic completion function
- `completion_values` - Static comma-separated values
- `handler` - Command handler function
- `aliases` - Alternative names
- `type` - node type (command, category, parameter)

### 4. Org Integration ✅
**Files**:
- `bash/org/org_tree.sh` - Defines help.org tree
- `bash/org/org_completion.sh` - Tree-based completion for CLI
- `bash/org/org_repl.sh` - REPL with static generator

**Current REPL Generator**: `_org_generate_completions()`
- Returns **static list** of commands and actions
- Does NOT use tree system
- Works, but misses dynamic completions

Example from `org_tree.sh`:
```bash
tree_insert "help.org.switch" "command" \
    title="Switch active organization" \
    completion_fn="org_completion_orgs"  # Dynamic!
```

## The Disconnect

### CLI Mode (working great!)
```bash
$ org sw<TAB>
switch

$ org switch <TAB>
pixeljam devops staging  # Dynamic from org_completion_orgs()
```

### REPL Mode (static only!)
```bash
org> sw<TAB>
list  # Just first alphabetic match from static list
```

## The Problem

**Current REPL completion flow**:
```
User presses TAB
    ↓
tcurses_readline detects TAB
    ↓
Calls repl_handle_tab()
    ↓
Calls REPL_COMPLETION_GENERATOR="_org_generate_completions"
    ↓
Returns STATIC word list:
    - ls, list, active, switch, create...
    - All org names (at generation time)
    - All actions (at generation time)
    ↓
Matches prefix and cycles
```

**What we WANT**:
```
User presses TAB
    ↓
Parse input to build tree path: "help.org.switch"
    ↓
Call tree_complete("help.org.switch", current_word)
    ↓
Returns DYNAMIC completions from tree:
    - Calls completion_fn="org_completion_orgs"
    - Gets CURRENT list of orgs
    - Plus tree children (subcommands)
    ↓
Filter and cycle through matches
```

## The Solution

### Option 1: Replace Static Generator with Tree Generator

**File**: `bash/org/org_repl.sh` line 50

Change from:
```bash
_org_generate_completions() {
    # Static list of commands
    cat <<'EOF'
env
e
mode
...
EOF
    # etc
}
```

To:
```bash
_org_generate_completions() {
    # Parse current input to determine tree path
    local input="$REPL_INPUT"
    local cursor="$REPL_CURSOR_POS"

    # Extract current word
    local word_info=$(_repl_get_current_word)
    IFS='|' read -r word_start word_end current_word <<< "$word_info"

    # Extract command part (before current word)
    local prefix="${input:0:$word_start}"
    prefix="${prefix## }"  # Strip leading spaces

    # Build tree path from prefix
    local tree_path="help.org"
    if [[ -n "$prefix" ]]; then
        # Split on spaces, build path
        local words=($prefix)
        for word in "${words[@]}"; do
            # Skip special chars
            [[ "$word" == [!a-zA-Z0-9_-]* ]] && continue
            tree_path="$tree_path.$word"
        done
    fi

    # Get completions from tree
    tree_complete "$tree_path" "$current_word" 2>/dev/null

    # Also try dynamic values
    tree_complete_values "$tree_path" 2>/dev/null
}
```

### Option 2: Create Tree-Aware REPL Completion Module

**New File**: `bash/repl/tree_completion.sh`

```bash
#!/usr/bin/env bash
# REPL Tree Completion Integration

# Generate completions from tree based on REPL input
repl_tree_complete() {
    local tree_namespace="$1"  # e.g., "help.org"
    local input="$REPL_INPUT"
    local cursor="$REPL_CURSOR_POS"

    # Parse input to determine context
    local word_info=$(_repl_get_current_word)
    IFS='|' read -r word_start word_end current_word <<< "$word_info"

    # Build tree path from input
    local path=$(repl_tree_build_path "$tree_namespace" "$input" "$word_start")

    # Get completions
    tree_complete "$path" "$current_word" 2>/dev/null
    tree_complete_values "$path" 2>/dev/null
}

# Register tree-based completion for a REPL
repl_register_tree_completion() {
    local tree_namespace="$1"

    # Create generator that uses tree
    eval "
    _repl_tree_generator_${tree_namespace//\./_}() {
        repl_tree_complete \"$tree_namespace\"
    }
    "

    repl_set_completion_generator "_repl_tree_generator_${tree_namespace//\./_}"
}
```

Then in org_repl.sh:
```bash
source "$TETRA_SRC/bash/repl/tree_completion.sh"
repl_register_tree_completion "help.org"
```

### Option 3: Hybrid Approach (Recommended)

Keep static fallbacks, add tree for specific contexts:

```bash
_org_generate_completions() {
    local input="$REPL_INPUT"
    local cursor="$REPL_CURSOR_POS"

    # Get context
    local word_info=$(_repl_get_current_word)
    IFS='|' read -r word_start word_end current_word <<< "$word_info"
    local prefix="${input:0:$word_start}"

    # If input starts with a known command, use tree
    local first_word="${prefix%% *}"
    first_word="${first_word## }"

    if tree_exists "help.org.$first_word" 2>/dev/null; then
        # Use tree completion
        local tree_path="help.org"
        for word in $prefix; do
            [[ "$word" =~ ^[a-zA-Z0-9_-]+$ ]] && tree_path="$tree_path.$word"
        done
        tree_complete "$tree_path" "$current_word" 2>/dev/null
        tree_complete_values "$tree_path" 2>/dev/null
    fi

    # Always include base commands (fallback)
    cat <<'EOF'
env
mode
action
help
list
active
switch
...
EOF
}
```

## Implementation Plan

### Phase 1: Quick Win (15 min)
1. Source tree modules in org_repl.sh
2. Modify `_org_generate_completions()` to check tree
3. Test with: `org> switch <TAB>` should show org names

### Phase 2: Full Integration (1 hour)
1. Create `bash/repl/tree_completion.sh`
2. Add `repl_register_tree_completion()` function
3. Update org_repl.sh to use it
4. Update tdocs_repl.sh to use it
5. Test all commands

### Phase 3: Advanced Features (future)
1. Show completion hints with descriptions
2. Add fuzzy matching
3. Add completion menu/popup
4. Multi-level TAB (once for completion, twice for help)

## Testing

### Test 1: Basic Command Completion
```bash
org> l<TAB>
# Should cycle: list, ls

org> sw<TAB>
# Should show: switch
```

### Test 2: Dynamic Argument Completion
```bash
org> switch <TAB>
# Should show actual org names from org_completion_orgs()

org> import nh <TAB>
# Should show NH directories from org_completion_nh_dirs()
```

### Test 3: Nested Commands
```bash
org> import <TAB>
# Should show: nh, json, env

org> import nh <TAB>
# Should show NH directory names
```

## Key Files to Modify

1. **bash/org/org_repl.sh** line 50 - `_org_generate_completions()`
2. **bash/tdocs/tdocs_repl.sh** line 33 - `_tdocs_generate_completions()`
3. **bash/repl/tree_completion.sh** (NEW) - Tree integration module

## Benefits

✅ **Dynamic completions** - Always up-to-date
✅ **Reuses existing tree** - No duplication
✅ **Same as CLI mode** - Consistent experience
✅ **Extensible** - Add new commands in tree, completion works
✅ **Metadata-rich** - Can show descriptions, help hints

## Next Steps

Ready to implement! Which option would you prefer?

1. **Quick hack** - Modify org's generator directly (15 min)
2. **Proper module** - Create repl/tree_completion.sh (1 hour)
3. **Guide me** - You tell me which approach you want
