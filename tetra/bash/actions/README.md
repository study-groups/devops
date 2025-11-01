# Tetra Action Registry System

## Overview

The Tetra Action Registry provides a lightweight, file-based system for registering and discovering module actions across the tetra ecosystem. It enables:

- **Cross-module action discovery** - Find what actions are available from any module
- **Semantic coloring via TDS** - Visual clarity using the Tetra Design System
- **TTS transaction integration** - Automatic transaction wrapping for TES-capable actions
- **Tab completion** - Colored, interactive action menus in REPL mode

## Architecture

```
bash/actions/
├── registry.sh          # Core registry (file-based, grep-able)
├── executor.sh          # TTS transaction wrapper
└── action_completion.sh # Tab completion with TDS colors
```

### File-Based Registry

Actions are stored in `~/.tetra/actions.registry` with the format:

```
module.action:description:params:tes_capable
```

Example:
```
org.validate.toml:Validate organization TOML structure:[--strict]:no
org.compile.toml:Compile TOML to TES endpoint configs::yes
rag.query.ulm:Search codebase using ULM semantic ranking:<query> [path]:no
```

This format is:
- **Lightweight** - Plain text, no memory overhead
- **Grep-able** - Fast searching with standard tools
- **Human-readable** - Easy to debug and inspect

## Action Syntax

Actions follow the pattern: `module.action [@endpoint] [args]`

### Examples

```bash
# Local action (no TES endpoint)
org.list.templates

# TES-capable action with endpoint
org.compile.toml @dev

# Action with parameters
rag.query.ulm "semantic search" src/

# Service management
tsm.start.service myapp dev.env
```

## TDS Color Coding

Actions use semantic colors from the Tetra Design System:

| Component | Color | Palette | Meaning |
|-----------|-------|---------|---------|
| Module name | Green | `env:0` | Nouns/data containers |
| Separator (`.`) | Gray | `mode:6` | Visual structure |
| Action name | Red/Orange | `verbs:0` | Verbs/operations |
| Parameters | Blue | `mode:1` | Configuration |
| TES prefix (`@`) | Orange | `verbs:3` | Action marker |
| TES endpoint | Magenta | `nouns:1` | Target location |

Example colored output:
```
org.validate.toml [--strict]
└─┬─┴──────┬──────┘ └────┬───┘
  │        │             └─ Blue parameters
  │        └─ Red/orange action
  └─ Green module

org.compile.toml @dev
                 └─┬─┘
                   └─ Magenta endpoint
```

## Integration Guide

### Registering Actions in Your Module

Add to your module's `includes.sh`:

```bash
# In bash/yourmodule/includes.sh

# Register actions with action registry
if [[ -f "$TETRA_SRC/bash/actions/registry.sh" ]]; then
    source "$TETRA_SRC/bash/actions/registry.sh"

    # Register your actions
    action_register "yourmodule" "do.something" \
        "Description of what this does" \
        "[optional-params]" \
        "no"  # or "yes" if TES-capable

    action_register "yourmodule" "deploy.config" \
        "Deploy configuration to endpoint" \
        "<config-file>" \
        "yes"  # Requires @endpoint
fi
```

### Action Registration Parameters

```bash
action_register MODULE ACTION DESCRIPTION PARAMS TES_CAPABLE
```

- **MODULE** - Module name (e.g., `org`, `rag`, `tsm`)
- **ACTION** - Action name with dots (e.g., `view.toml`, `compile.toml`)
- **DESCRIPTION** - Brief description for help text
- **PARAMS** - Parameter signature:
  - `<required>` - Required parameter
  - `[optional]` - Optional parameter
  - `""` - No parameters
- **TES_CAPABLE** - `"yes"` if action needs `@endpoint`, `"no"` otherwise

### Implementing Action Handlers

Convention: `module_action_impl` or `module_action`

```bash
# In bash/org/actions.sh

# Handler for org.validate.toml
org_validate_toml_impl() {
    local strict="${1:---normal}"

    # Implementation here
    echo "Validating organization TOML..."
}

# Handler for TES-capable action: org.compile.toml @endpoint
org_compile_toml_impl() {
    local endpoint="$1"  # e.g., "@dev"

    # This will be wrapped in TTS transaction automatically
    echo "Compiling for $endpoint..."
}
```

## Using the Action System

### List Actions

```bash
# List all actions
action_list

# List actions for specific module
action_list org
action_list rag
action_list tsm
```

### Get Action Info

```bash
# Show detailed info for an action
action_info org.compile.toml
```

Output:
```
org.compile.toml @<endpoint>
  Compile TOML to TES endpoint configs
```

### Execute Actions

```bash
# Execute via action_exec (with optional transaction wrapper)
action_exec org.compile.toml @dev

# Execute TES-capable action
action_exec org.push.config @staging myconfig.toml
```

### Tab Completion in REPL

When in a module REPL, press Tab to see available actions:

```
[org] Local × Inspect → validate ▶ <TAB>

Available actions for org:
org.view.orgs            View all organizations
org.view.toml            View active organization TOML
org.validate.toml        Validate organization TOML structure
...
```

## TTS Transaction Integration

Actions marked as TES-capable (`tes_capable="yes"`) are automatically wrapped in TTS transactions:

```bash
action_exec org.compile.toml @dev
```

This creates a transaction with FSM stages:
1. **NEW** - Transaction created
2. **EXECUTE** - Action runs
3. **VALIDATE** - Results validated
4. **DONE** - Success, or **FAIL** - Error

Transaction directory: `~/.tetra/org/txns/{txn_id}/`

See: `docs/TTS_TETRA_TRANSACTION_STANDARD.md`

## Registry API

### Core Functions

```bash
# Initialize registry
action_registry_init

# Register an action
action_register MODULE ACTION DESC PARAMS TES_CAPABLE

# Check if action exists
action_exists "module.action"

# Get action metadata
action_info "module.action"

# List actions (with colors)
action_list [module]

# Get completion list
action_complete_list [module]

# Check if TES-capable
action_is_tes_capable "module.action"

# Clear registry (testing)
action_registry_clear
```

### Execution Functions

```bash
# Execute action (with optional transaction)
action_exec MODULE.ACTION [@endpoint] [args...]

# Internal: execute with transaction
_action_exec_with_txn FQN ENDPOINT FUNCTION args...

# Internal: execute directly
_action_exec_direct FQN FUNCTION args...
```

### Completion Functions

```bash
# Get completions for module context
repl_complete_actions [module] [current_word]

# Show colored action menu
repl_show_action_menu [module]

# Bash completion handler
_repl_action_complete  # For use with complete -F

# Tab handler for REPL
repl_action_tab_handler INPUT [module]
```

## Current Registered Actions

As of implementation:

- **27 org actions** - Organization management (view, validate, compile, deploy, etc.)
- **6 rag actions** - RAG queries and agent management
- **9 tsm actions** - Service lifecycle and monitoring

Total: **42 actions** across 3 modules

## Design Principles

### 1. Lightweight

- File-based registry (no in-memory overhead)
- Plain text format (grep-able)
- Only loads when needed

### 2. Progressive Enhancement

- Works without TDS (falls back to plain text)
- Works without TTS (executes directly)
- Works without completion (still callable)

### 3. Semantic Clarity

- Color coding follows verb/noun distinction
- Module = noun (green) - data containers
- Action = verb (red) - operations
- Endpoint = target (magenta) - where to execute

### 4. Convention over Configuration

- Standard naming: `module_action_impl`
- Standard format: `module.action @endpoint`
- Standard registration in `includes.sh`

## See Also

- `docs/TTS_TETRA_TRANSACTION_STANDARD.md` - Transaction system
- `docs/README_DOCS.md` - TES/TCS documentation
- `bash/tds/tokens/color_tokens.sh` - TDS color system
- `bash/repl/README.md` - REPL integration

## Example: Adding a New Module

```bash
# 1. Create your action handlers
# bash/mymod/actions.sh
mymod_fetch_data_impl() {
    local endpoint="$1"
    echo "Fetching from $endpoint..."
}

# 2. Register in includes.sh
# bash/mymod/includes.sh
if [[ -f "$TETRA_SRC/bash/actions/registry.sh" ]]; then
    source "$TETRA_SRC/bash/actions/registry.sh"

    action_register "mymod" "fetch.data" \
        "Fetch data from endpoint" \
        "" \
        "yes"  # TES-capable
fi

# 3. Test it
source bash/mymod/includes.sh
action_list mymod
action_exec mymod.fetch.data @dev
```

---

Generated: 2025-11-01
