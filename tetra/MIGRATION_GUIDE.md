# Tetra Module Migration Guide

**Version:** 2.0
**Date:** 2025-10-25

This guide helps you migrate existing Tetra modules to the new standardized REPL and help system. See `bash/repl/TETRA_WAY.md` for the complete specification.

---

## Table of Contents

1. [Overview](#overview)
2. [Breaking Changes](#breaking-changes)
3. [Migration Checklist](#migration-checklist)
4. [Step-by-Step Migration](#step-by-step-migration)
5. [Before & After Examples](#before--after-examples)
6. [Common Issues](#common-issues)

---

## Overview

### What Changed

**REPL System:**
- ✅ Standardized on `repl_run()` pattern
- ✅ Hybrid command routing (`/mod.action` and `/action`)
- ✅ Module registry for cross-module discovery
- ✅ Unified tree-based tab completion

**Help System:**
- ✅ Mandatory tree-based help (`help.MODULE.*` namespace)
- ❌ Deprecated custom help implementations
- ✅ Builder utilities for common patterns

**Completion:**
- ✅ Tree-based completion (static + dynamic)
- ✅ Shell completions auto-generated from tree
- ❌ Deprecated custom readline bindings

### Why Migrate?

- **Consistency** - All modules work the same way
- **Features** - Get `/help`, `/mode`, `/theme`, `/history`, `/clear` for free
- **Completions** - TAB works everywhere, automatically
- **Hybrid routing** - Support both `/mod.action` and `/action`
- **Less code** - Use builders and unified systems

---

## Breaking Changes

### 1. Custom REPL Loops Forbidden

**Before:**
```bash
while true; do
    read -e -p "$PROMPT" input
    process_input "$input" || break
done
```

**After:**
```bash
repl_build_prompt() { _my_build_prompt; }
repl_process_input() { _my_process_input "$@"; }
export -f repl_build_prompt repl_process_input
repl_run
unset -f repl_build_prompt repl_process_input
```

### 2. Custom Help Systems Deprecated

**Before:**
```bash
my_module_help() {
    cat <<EOF
Help text...
EOF
}
```

**After:**
```bash
source "$TETRA_SRC/bash/tree/builders.sh"

tree_build_category "help.mymodule" "My Module" "Module description"
tree_build_command "help.mymodule.action" "Action" "Help" "synopsis" "examples" "handler"
```

### 3. Custom Readline Bindings Forbidden

**Before:**
```bash
_my_complete() {
    # Custom completion logic
}
bind -x '"\t": _my_complete'
```

**After:**
```bash
# Use tree-based completion
tree_repl_enable_completion "help.mymodule"

# For dynamic values, provide completion function
tree_build_action "help.mymodule.select" \
    "Select" "Description" "handler" "completion_fn"
```

### 4. Manual History Management Forbidden

**Before:**
```bash
history -s "$input"
```

**After:**
```bash
# Handled automatically by repl_run()
# No manual history management needed
```

---

## Migration Checklist

Use this checklist for each module:

### Phase 1: Structure
- [ ] Create `MODULE_help.sh` if it doesn't exist
- [ ] Ensure `MODULE_repl.sh` exists
- [ ] Move help logic to `MODULE_help.sh`
- [ ] Remove custom help functions

### Phase 2: Help System
- [ ] Source `bash/tree/builders.sh`
- [ ] Define `_module_build_help_tree()` function
- [ ] Use `tree_build_*` functions for all help
- [ ] Follow `help.MODULE.*` namespace
- [ ] Add `handler` metadata for actions
- [ ] Add `completion_fn` or `completion_values` for completions
- [ ] Test help with `tree_help_show "help.module"`

### Phase 3: REPL Pattern
- [ ] Remove custom `while` loop
- [ ] Implement `_module_repl_build_prompt()`
- [ ] Implement `_module_repl_process_input()`
- [ ] Use callback overrides in main function
- [ ] Call `repl_run()`
- [ ] Clean up with `unset -f`

### Phase 4: Completion
- [ ] Remove custom `bind -x` commands
- [ ] Remove custom completion functions
- [ ] Add `tree_repl_enable_completion "help.module"`
- [ ] Add `tree_repl_disable_completion` in cleanup
- [ ] Test TAB completion

### Phase 5: Registration
- [ ] Add `repl_register_module()` call
- [ ] Add `repl_set_module_context()` call
- [ ] Test `/mod.action` routing
- [ ] Test `/action` routing

### Phase 6: Testing
- [ ] Test REPL startup
- [ ] Test help system (`help`, `help topic`)
- [ ] Test TAB completion (commands and values)
- [ ] Test mode switching (`/mode`)
- [ ] Test hybrid routing

---

## Step-by-Step Migration

### Step 1: Create Help Tree File

Create `bash/MODULE/MODULE_help.sh`:

```bash
#!/usr/bin/env bash
# bash/MODULE/MODULE_help.sh

source "$TETRA_SRC/bash/tree/builders.sh"

_module_build_help_tree() {
    # Module root
    tree_build_category "help.module" \
        "Module Name" \
        "Module description"

    # Add categories and commands
    tree_build_category "help.module.category" \
        "Category Name" \
        "Category description"

    tree_build_command "help.module.category.action" \
        "Action Name" \
        "Action description" \
        "module action [OPTIONS]" \
        "module action --example" \
        "module_action_handler"
}

# Build on source
_module_build_help_tree
```

### Step 2: Update REPL File

Modify `bash/MODULE/MODULE_repl.sh`:

```bash
#!/usr/bin/env bash
# bash/MODULE/MODULE_repl.sh

# Source dependencies
source "$TETRA_SRC/bash/repl/repl.sh"
source "$TETRA_SRC/bash/color/repl_colors.sh"
source "$TETRA_SRC/bash/tree/tree_repl_complete.sh"
source "$TETRA_SRC/bash/MODULE/MODULE_help.sh"  # ← Add this

# Configuration
REPL_HISTORY_BASE="${TETRA_DIR}/MODULE/MODULE_repl_history"

# State
MODULE_REPL_STATE=0

# ============================================================================
# PROMPT BUILDER
# ============================================================================

_module_repl_build_prompt() {
    local tmpfile
    tmpfile=$(mktemp /tmp/module_prompt.XXXXXX) || return 1

    printf "%smodule%s ▶ " "$(text_color "FFFFFF")" "$(reset_color)" >> "$tmpfile"

    REPL_PROMPT=$(<"$tmpfile")
    rm -f "$tmpfile"
}

# ============================================================================
# INPUT PROCESSOR
# ============================================================================

_module_repl_process_input() {
    local input="$1"

    [[ -z "$input" ]] && return 0

    if [[ "$input" == !* ]]; then
        eval "${input:1}"
        return 0
    fi

    case "$input" in
        exit|quit|q)
            return 1
            ;;
        help|h|\?)
            module_repl_show_help "${input#* }"
            return 0
            ;;
        # Your commands here
        action1)
            module_action1
            return 0
            ;;
        *)
            echo "Unknown: $input (try 'help')" >&2
            return 0
            ;;
    esac
}

# ============================================================================
# HELP FUNCTION
# ============================================================================

module_repl_show_help() {
    local topic="${1:-module}"

    if [[ "$topic" != help.* ]]; then
        topic="help.module.$topic"
    fi

    if ! tree_exists "help.module" 2>/dev/null; then
        _module_build_help_tree
    fi

    tree_help_show "$topic"
}

# ============================================================================
# MAIN ENTRY POINT
# ============================================================================

module_repl_run() {
    echo ""
    text_color "00AAFF"
    echo "⚡ MODULE REPL"
    reset_color
    echo ""

    # Register module
    repl_register_module "module" "action1 action2" "help.module"
    repl_set_module_context "module"

    # Cleanup trap
    trap 'module_cleanup 2>/dev/null' EXIT

    # Override callbacks
    repl_build_prompt() { _module_repl_build_prompt "$@"; }
    repl_process_input() { _module_repl_process_input "$@"; }
    export -f repl_build_prompt repl_process_input

    # Enable completion
    tree_repl_enable_completion "help.module"

    # Run
    repl_run

    # Cleanup
    tree_repl_disable_completion
    unset -f repl_build_prompt repl_process_input

    echo ""
    text_color "00AAFF"
    echo "⚡ Goodbye"
    reset_color
    echo ""
}

export -f module_repl_run
```

### Step 3: Test

```bash
# Source tetra
source ~/tetra/tetra.sh

# Run your module
module_repl_run

# Test help
help
help category
help category.action

# Test TAB
<TAB>           # Shows commands
action<TAB>     # Completes
action <TAB>    # Shows arguments

# Test routing
/module.action  # Explicit
/action         # Context-aware
```

---

## Before & After Examples

### Example 1: Estoface REPL (Fixed)

**Before (Custom Loop):**
```bash
estoface_game_repl_run() {
    # ... setup ...

    _estoface_setup_completion

    while true; do
        _estoface_repl_build_prompt
        read -e -p "$REPL_PROMPT" input
        [[ -n "$input" ]] && history -s "$input"
        _estoface_repl_process_input "$input" || break
    done

    bind -r "\t" 2>/dev/null
}
```

**After (Standard Pattern):**
```bash
estoface_game_repl_run() {
    # ... setup ...

    trap 'estoface_repl_cleanup 2>/dev/null' EXIT

    repl_build_prompt() { _estoface_repl_build_prompt "$@"; }
    repl_process_input() { _estoface_repl_process_input "$@"; }
    export -f repl_build_prompt repl_process_input

    tree_repl_enable_completion "help.estoface"

    repl_run

    tree_repl_disable_completion
    unset -f repl_build_prompt repl_process_input
}
```

### Example 2: Help System Migration

**Before (Custom Help):**
```bash
pulsar_repl_show_help() {
    case "$1" in
        start)
            echo "Start engine: pulsar start [grid_w] [grid_h]"
            ;;
        spawn)
            echo "Spawn sprite: spawn <type> <x> <y> ..."
            ;;
        *)
            cat <<EOF
PULSAR Commands:
  start   - Start engine
  spawn   - Spawn sprite
  kill    - Kill sprite
EOF
            ;;
    esac
}
```

**After (Tree-Based):**
```bash
_pulsar_build_help_tree() {
    tree_build_category "help.game.pulsar" \
        "Pulsar Engine" \
        "Sprite animation engine"

    tree_build_command "help.game.pulsar.start" \
        "Start Engine" \
        "Start the Pulsar animation engine" \
        "start [grid_w] [grid_h]" \
        "start 80 24" \
        "pulsar_repl_start"

    tree_build_command "help.game.pulsar.spawn" \
        "Spawn Sprite" \
        "Create a new animated sprite" \
        "spawn <type> <x> <y> <w> <h> ..." \
        "spawn pulse 10 10 5 3 0.5 0.8" \
        "pulsar_repl_spawn"

    tree_build_command "help.game.pulsar.kill" \
        "Kill Sprite" \
        "Remove a sprite by ID" \
        "kill <sprite_id>" \
        "kill 1" \
        "pulsar_repl_kill" \
        "pulsar_get_sprite_ids"  # ← Dynamic completion
}

pulsar_repl_show_help() {
    local topic="${1:-pulsar}"

    if [[ "$topic" != help.* ]]; then
        topic="help.game.pulsar.$topic"
    fi

    tree_help_show "$topic"
}
```

### Example 3: Completion Migration

**Before (Custom Completion):**
```bash
_my_complete() {
    local line="${READLINE_LINE}"
    local words=($line)

    # Complex completion logic...
    echo ""
    echo "  Options: opt1 opt2 opt3"
    echo ""
}

bind -x '"\t": _my_complete'
```

**After (Tree-Based):**
```bash
# Static completions
tree_build_action "help.module.select" \
    "Select Option" \
    "Select from available options" \
    "module_select_handler" \
    "" \
    "opt1 opt2 opt3"  # ← Static values

# Dynamic completions
module_get_options() {
    # Runtime logic
    ls /path/to/items 2>/dev/null
}

tree_build_action "help.module.load" \
    "Load Item" \
    "Load an item from disk" \
    "module_load_handler" \
    "module_get_options"  # ← Dynamic function
```

---

## Common Issues

### Issue 1: "Command not found: tree_build_category"

**Cause:** Not sourcing `bash/tree/builders.sh`

**Fix:**
```bash
source "$TETRA_SRC/bash/tree/builders.sh"
```

### Issue 2: "REPL_PROMPT not updating"

**Cause:** Not returning code 2 from input processor

**Fix:**
```bash
_my_repl_process_input() {
    case "$input" in
        theme)
            theme_set "$2"
            return 2  # ← Signal prompt rebuild
            ;;
    esac
}
```

### Issue 3: "TAB completion not working"

**Cause:** Not enabling tree completion

**Fix:**
```bash
module_repl_run() {
    # ... setup ...

    tree_repl_enable_completion "help.module"  # ← Enable

    repl_run

    tree_repl_disable_completion  # ← Cleanup
}
```

### Issue 4: "Unknown command: /action"

**Cause:** Module not registered

**Fix:**
```bash
module_repl_run() {
    # Register before calling repl_run
    repl_register_module "mymodule" "action1 action2" "help.mymodule"
    repl_set_module_context "mymodule"

    # ... rest of setup
}
```

### Issue 5: "Help shows wrong namespace"

**Cause:** Not following `help.MODULE.*` convention

**Fix:**
```bash
# WRONG
tree_build_category "mymodule" "Title" "Help"

# RIGHT
tree_build_category "help.mymodule" "Title" "Help"
```

### Issue 6: "/mode command not available"

**Cause:** Using custom loop instead of `repl_run()`

**Fix:**
Remove custom loop, use standard pattern:
```bash
repl_build_prompt() { _my_build_prompt; }
repl_process_input() { _my_process_input "$@"; }
export -f repl_build_prompt repl_process_input
repl_run  # ← Provides /mode, /help, /theme, etc.
unset -f repl_build_prompt repl_process_input
```

---

## Migration Order

Recommended order for migrating modules:

1. **Games** (simpler, good practice)
   - ✅ estoface (done)
   - formant
   - pulsar

2. **Core Modules** (most used)
   - rag
   - org
   - melvin

3. **Utilities** (less critical)
   - tdoc
   - logs
   - tmod

---

## Need Help?

- See `bash/repl/TETRA_WAY.md` for the complete specification
- See `bash/game/games/estoface/core/estoface_repl.sh` for a migrated example
- See `bash/game/games/pulsar/pulsar_repl.sh` for a best-practice example

---

**Happy Migrating! 🚀**
