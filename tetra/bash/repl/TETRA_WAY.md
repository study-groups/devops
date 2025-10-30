# The Tetra Way: REPL & Module Standards

**Version:** 2.0
**Date:** 2025-10-25
**Status:** ✅ Official Standard

This document defines the official "Tetra Way" for building interactive REPLs and modules. Following these standards ensures consistency, feature parity, and excellent user experience across all Tetra modules.

---

## Table of Contents

1. [Core Principles](#core-principles)
2. [Module Structure](#module-structure)
3. [REPL Implementation](#repl-implementation)
4. [Help Tree System](#help-tree-system)
5. [Command Routing](#command-routing)
6. [Tab Completion](#tab-completion)
7. [Module Registration](#module-registration)
8. [Testing & Validation](#testing--validation)

---

## Core Principles

### 1. **TETRA_SRC is Sacred**
- `TETRA_SRC` MUST be set and point to the Tetra source directory
- All modules MUST use `$TETRA_SRC/bash/modulename` for their source
- Never use relative paths or hardcoded absolute paths

### 2. **Consistency Over Customization**
- Use the standard `repl_run()` pattern - never implement custom loops
- Use tree-based help - never implement custom help systems
- Use unified completion - never use custom readline bindings

### 3. **Progressive Disclosure**
- CLI mode: Explicit module prefixes (`/mod.action`)
- REPL mode: Context-aware shortcuts (`action`)
- TAB shows what's available at every level

### 4. **Tetra Always Runs in Bash 5.2+**
- Source `~/tetra/tetra.sh` at startup
- Use modern bash features (associative arrays, etc.)
- Test with `bash --version` to ensure 5.2+

---

## Module Structure

### Standard Directory Layout

```
bash/MODULE/
├── MODULE.sh               # Main entry, exports, module loader
├── MODULE_help.sh          # Tree-based help definitions
├── MODULE_repl.sh          # REPL implementation (if applicable)
├── includes.sh             # Sources all components
├── handlers/               # Action/command implementations
│   ├── action1.sh
│   ├── action2.sh
│   └── ...
└── README.md               # Module documentation
```

### File Naming Conventions

| File Pattern | Purpose | Example |
|--------------|---------|---------|
| `MODULE.sh` | Main module file, exports API | `rag.sh`, `org.sh` |
| `MODULE_help.sh` | Help tree definitions | `rag_help.sh` |
| `MODULE_repl.sh` | REPL implementation | `rag_repl.sh` |
| `MODULE_*.sh` | Sub-components | `rag_flow.sh`, `rag_txn.sh` |
| `includes.sh` | Sources all module files | Always named `includes.sh` |

### Function Naming Conventions

| Pattern | Visibility | Purpose | Example |
|---------|------------|---------|---------|
| `module_action()` | Public | Exported API functions | `rag_flow_create()` |
| `_module_internal()` | Private | Internal helpers (leading underscore) | `_rag_validate_flow()` |
| `module_repl_action()` | REPL | REPL-specific handlers | `rag_repl_show_help()` |
| `_module_repl_*()` | Private | Private REPL overrides | `_rag_repl_build_prompt()` |

### Variable Naming Conventions

| Pattern | Scope | Purpose | Example |
|---------|-------|---------|---------|
| `MODULE_VAR` | Global | Module-wide state | `RAG_FLOW_ACTIVE` |
| `MODULE_REPL_VAR` | REPL | REPL-specific state | `RAG_REPL_ENGINE_RUNNING` |
| `_MODULE_INTERNAL` | Private | Internal state (leading underscore) | `_RAG_TMP_DIR` |

---

## REPL Implementation

### The Standard Pattern (REQUIRED)

```bash
#!/usr/bin/env bash
# bash/MODULE/MODULE_repl.sh

# Source unified REPL system
source "$TETRA_SRC/bash/repl/repl.sh"
source "$TETRA_SRC/bash/color/repl_colors.sh"
source "$TETRA_SRC/bash/tree/tree_repl_complete.sh"

# REPL Configuration
REPL_HISTORY_BASE="${TETRA_DIR}/MODULE/MODULE_repl_history"
MODULE_REPL_OUTPUT_LOG="$TETRA_DIR/MODULE/MODULE_repl_output.log"

# REPL State
MODULE_REPL_ENGINE_RUNNING=0

# ============================================================================
# PROMPT BUILDER (Private Override)
# ============================================================================

_module_repl_build_prompt() {
    local status_symbol="●"
    local status_color="666666"

    if [[ "$MODULE_REPL_ENGINE_RUNNING" == "1" ]]; then
        status_symbol="●"
        status_color="00FF88"
    fi

    # Build prompt
    local tmpfile
    tmpfile=$(mktemp /tmp/module_repl_prompt.XXXXXX) || return 1

    printf "%s%s%s " "$(text_color "$status_color")" "$status_symbol" "$(reset_color)" >> "$tmpfile"
    printf "%smodule%s" "$(text_color "FFFFFF")" "$(reset_color)" >> "$tmpfile"
    printf " %s▶%s " "$(text_color "FFAA00")" "$(reset_color)" >> "$tmpfile"

    REPL_PROMPT=$(<"$tmpfile")
    rm -f "$tmpfile"
}

# ============================================================================
# INPUT PROCESSOR (Private Override)
# ============================================================================

_module_repl_process_input() {
    local input="$1"

    # Empty input
    [[ -z "$input" ]] && return 0

    # Shell command escape
    if [[ "$input" == !* ]]; then
        eval "${input:1}"
        return 0
    fi

    # Exit commands
    case "$input" in
        exit|quit|q)
            return 1  # Signal exit
            ;;
    esac

    # Parse command
    local cmd_args=($input)
    local cmd="${cmd_args[0]}"

    case "$cmd" in
        # Help system
        help|h|\?)
            module_repl_show_help "${cmd_args[1]}"
            return 0
            ;;

        # Module-specific commands
        action1)
            module_action1 "${cmd_args[@]:1}"
            return 0
            ;;
        action2)
            module_action2 "${cmd_args[@]:1}"
            return 0
            ;;

        # Unknown
        *)
            echo "Unknown command: $cmd (try 'help' or TAB)" >&2
            return 0
            ;;
    esac
}

# ============================================================================
# MAIN ENTRY POINT
# ============================================================================

module_game_repl_run() {
    echo ""
    text_color "00AAFF"
    echo "⚡ MODULE REPL v1.0"
    reset_color
    echo ""

    # Set cleanup trap
    trap 'module_repl_cleanup 2>/dev/null' EXIT

    # Override REPL callbacks
    repl_build_prompt() { _module_repl_build_prompt "$@"; }
    repl_process_input() { _module_repl_process_input "$@"; }
    export -f repl_build_prompt repl_process_input

    # Enable tree-based tab completion
    tree_repl_enable_completion "help.module"

    # Run unified REPL loop
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

export -f module_game_repl_run
```

### Key Requirements

1. **MUST use `repl_run()`** - Never implement custom `while` loops
2. **MUST override via callbacks** - Define private `_module_repl_*()` functions, then assign to `repl_build_prompt` and `repl_process_input`
3. **MUST export and cleanup** - Use `export -f` for overrides, `unset -f` in cleanup
4. **MUST handle signals** - Use `trap` for cleanup (EXIT, TERM, etc.)
5. **MUST use tree completion** - Call `tree_repl_enable_completion` and `tree_repl_disable_completion`

### Anti-Patterns (FORBIDDEN)

❌ **Custom Loops**
```bash
# WRONG - Never do this
while true; do
    read -e -p "$PROMPT" input
    process "$input" || break
done
```

❌ **Custom Readline Bindings**
```bash
# WRONG - Don't use custom bind
bind -x '"\t": my_custom_complete'
```

❌ **Direct History Management**
```bash
# WRONG - Don't manage history manually
history -s "$input"
```

✅ **Use Standard Pattern Instead**
```bash
# RIGHT - Use unified REPL
repl_build_prompt() { _my_build_prompt; }
repl_process_input() { _my_process_input "$@"; }
export -f repl_build_prompt repl_process_input
repl_run
unset -f repl_build_prompt repl_process_input
```

---

## Help Tree System

### Standard Tree Structure

ALL modules MUST use this namespace pattern:

```
help.MODULE[.CATEGORY].ACTION
```

Examples:
```
help.rag                    # Module root
help.rag.flow               # Category
help.rag.flow.create        # Action
help.rag.flow.list          # Action
help.game                   # Module root
help.game.play              # Action
help.org.add                # Action
help.org.project.create     # Nested action
```

### Building Help Trees

Use the builder utilities from `bash/tree/builders.sh`:

```bash
#!/usr/bin/env bash
# bash/MODULE/MODULE_help.sh

source "$TETRA_SRC/bash/tree/builders.sh"

_module_build_help_tree() {
    # Module root
    tree_build_category "help.module" \
        "Module Title" \
        "Module description"

    # Category
    tree_build_category "help.module.category" \
        "Category Title" \
        "Category description"

    # Command with handler
    tree_build_command "help.module.category.action" \
        "Action Title" \
        "Action description" \
        "module action [OPTIONS] ARGS" \
        "module action --flag value" \
        "module_action_handler" \
        "module_action_completions"

    # Simple action
    tree_build_action "help.module.do" \
        "Do Something" \
        "Performs an action" \
        "module_do_handler" \
        "module_do_completions"
}

# Build tree on source
_module_build_help_tree
```

### Required Metadata

| Key | Required | Description | Example |
|-----|----------|-------------|---------|
| `title` | ✅ Yes | Short display name | "Create Flow" |
| `help` | ✅ Yes | Brief description | "Create a new RAG flow" |
| `synopsis` | Commands only | Usage string | "flow create DESC [AGENT]" |
| `examples` | Recommended | Code examples | "flow create 'Fix auth'" |
| `handler` | Actions only | Function name | "rag_flow_create" |
| `completion_fn` | Optional | Dynamic completions | "get_available_agents" |
| `completion_values` | Optional | Static completions | "dev staging prod" |

### Help Display Function

Every module MUST provide a `module_repl_show_help()` function:

```bash
module_repl_show_help() {
    local topic="${1:-module}"

    # Normalize topic to full path
    if [[ "$topic" != help.* ]]; then
        topic="help.module.$topic"
    fi

    # Ensure tree is built
    if ! tree_exists "help.module" 2>/dev/null; then
        _module_build_help_tree
    fi

    # Show help using unified tree system
    tree_help_show "$topic"
}
```

---

## Command Routing

### Hybrid Routing System

The Tetra Way supports BOTH explicit and context-aware routing:

#### In CLI Mode (Augment)
- Shell commands by default
- `/mod.action` - Explicit module.action
- `/action` - Searches current context, then all modules
- `/help` - Built-in meta commands

#### In REPL Mode (Takeover)
- Module commands by default
- `action` - Uses current module context
- `/mod.action` - Explicit module.action (also works)
- `!cmd` - Shell command escape

### Command Resolution Priority

When user types `/action` or `/mod.action`:

1. **Explicit handler** - `REPL_MODULE_HANDLERS[mod.action]`
2. **Slash command** - `REPL_SLASH_HANDLERS[action]`
3. **Built-in meta** - `/help`, `/mode`, `/theme`, etc.
4. **Tree-based handler** - Check tree for `handler` metadata
5. **Action system** - Legacy `tetra_dispatch_action`
6. **Unknown** - Show error with suggestions

### Module Registration

Register your module at REPL startup:

```bash
module_game_repl_run() {
    # Register module with command list
    repl_register_module "module" "action1 action2 action3" "help.module"

    # Set as active module context
    repl_set_module_context "module"

    # ... rest of REPL setup
}
```

This enables:
- Hybrid routing (`/action` and `/mod.action` both work)
- Cross-module command discovery
- Auto-generated completions

---

## Tab Completion

### Three-Tier Completion System

1. **REPL Completion** (Tree-based, readline)
2. **Shell Completion** (Bash completions for CLI)
3. **Dynamic Values** (Runtime value completion)

### REPL Completion (Required)

Enable in your module REPL:

```bash
module_game_repl_run() {
    # ... setup ...

    # Enable tree-based completion
    tree_repl_enable_completion "help.module"

    repl_run

    # Disable on exit
    tree_repl_disable_completion
}
```

### Shell Completion (Recommended)

Generate bash completions for CLI mode:

```bash
# In your module's setup or install script
tree_register_shell_completion "module" "help.module"
```

Or generate standalone completion file:

```bash
tree_generate_completion_script "module" "help.module" > ~/.bash_completion.d/module
```

### Dynamic Completions

For runtime values (files, IDs, etc.), provide a completion function:

```bash
# Completion function (one value per line)
module_get_available_items() {
    # Example: list active items
    ls "$MODULE_DIR/items" 2>/dev/null | sed 's/\.json$//'
}

# Register in tree
tree_build_action "help.module.select" \
    "Select Item" \
    "Select an item from available items" \
    "module_select_handler" \
    "module_get_available_items"  # ← Dynamic completion function
```

When user presses TAB, `module_get_available_items` is called to get current values.

### Static Completions

For fixed values, use `completion_values`:

```bash
tree_build_action "help.module.env" \
    "Set Environment" \
    "Set deployment environment" \
    "module_env_handler" \
    "" \
    "dev staging production"  # ← Static completion values
```

---

## Module Registration

### Registration API

```bash
# Register module with commands
repl_register_module "module_name" "cmd1 cmd2 cmd3" ["namespace"]

# Register command handler
repl_register_module_handler "module.command" "handler_function"

# Set module context
repl_set_module_context "module_name"

# Get current context
current=$(repl_get_module_context)
```

### Full Registration Example

```bash
module_game_repl_run() {
    # Register this module
    repl_register_module "mymodule" "create list delete show" "help.mymodule"

    # Set as active context
    repl_set_module_context "mymodule"

    # Register individual handlers (optional - tree handles this)
    repl_register_module_handler "mymodule.create" "mymodule_create_handler"

    # ... continue with REPL setup
}
```

Benefits:
- `/create` works (searches mymodule first)
- `/mymodule.create` works (explicit)
- `/othermodule.action` works (cross-module)
- TAB completion shows available commands

---

## Testing & Validation

### Module Checklist

Before submitting a module, verify:

- [ ] Uses standard directory structure
- [ ] Follows naming conventions (functions, variables, files)
- [ ] Uses `repl_run()` pattern (no custom loops)
- [ ] Implements `_module_repl_build_prompt()` and `_module_repl_process_input()`
- [ ] Uses tree-based help (`tree_build_*` functions)
- [ ] Help tree follows `help.MODULE.*` namespace
- [ ] Registers module with `repl_register_module()`
- [ ] Enables tree completion with `tree_repl_enable_completion()`
- [ ] Cleans up on exit (`unset -f`, `tree_repl_disable_completion`)
- [ ] Exports main REPL function
- [ ] Provides `module_repl_show_help()` function
- [ ] Documents all public API functions
- [ ] Includes README.md with usage examples

### Validation Tests

Test your module REPL:

```bash
# Test basic startup
bash -c "source ~/tetra/tetra.sh && module_repl"

# Test help system
# In REPL: help
# In REPL: help category
# In REPL: help category.action

# Test tab completion
# In REPL: <TAB>              # Shows all commands
# In REPL: act<TAB>           # Completes to action
# In REPL: action <TAB>       # Shows action arguments

# Test hybrid routing
# In CLI: /module.action      # Explicit routing
# In CLI: /action             # Context-aware routing

# Test mode switching
# In REPL: /mode              # Toggle shell/repl mode
```

---

## Summary: The Tetra Way

1. **Structure** - Standard directory layout, consistent naming
2. **REPL** - Use `repl_run()`, override callbacks, never custom loops
3. **Help** - Tree-based, `help.MODULE.*` namespace, builder utilities
4. **Routing** - Hybrid `/mod.action` and `/action` support
5. **Completion** - Tree-based, static + dynamic values
6. **Registration** - Register module, set context, enable features

Following these standards ensures your module is:
- ✅ Consistent with other Tetra modules
- ✅ Easy to use and discover
- ✅ Feature-complete (help, completion, routing)
- ✅ Maintainable and testable

---

**Questions?** See `bash/repl/README.md` or examples in `bash/game/games/pulsar/`
