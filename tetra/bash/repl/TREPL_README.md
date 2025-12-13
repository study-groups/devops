# trepl - Universal Tetra REPL Launcher

**Version:** 1.0
**Status:** Stable

## Overview

`trepl` (Tetra REPL) is a universal launcher for all module REPLs in the tetra ecosystem. Instead of remembering individual REPL commands for each module, use `trepl` to launch any REPL from a single interface.

## Quick Start

### Interactive Selector

```bash
# Launch interactive selector
trepl

# Or
repl
```

This shows a numbered menu of all available REPLs. Enter the number or module name to launch.

### Direct Launch

```bash
# Launch specific module REPL
trepl org
trepl rag
trepl tdocs
trepl qa
```

### List Available REPLs

```bash
# See all available REPLs with status
trepl list
```

## Available REPLs

| Module | Description |
|--------|-------------|
| **org** | Organization management and deployment |
| **rag** | Retrieval-Augmented Generation |
| **tdocs** | Interactive document browser |
| **qa** | Question-Answering system |
| **tmod** | Module system management |
| **tsm** | Tetra Service Manager |
| **logs** | Log management and analysis |
| **game** | Game development REPL |
| **vox** | Voice synthesis |
| **tkm** | Tetra Key Manager |
| **pbase** | Polybase integration |
| **melvin** | AI assistant |
| **midi** | MIDI sequencer |
| **tcurses** | Terminal UI components |
| **tds** | Terminal Display System |
| **deploy** | Deployment automation |
| **tree** | Tree-based help system |

## Commands

```bash
# Interactive selector (default)
trepl
trepl select
trepl menu

# Launch specific REPL
trepl <module>

# List all REPLs
trepl list
trepl ls

# Discover REPLs
trepl discover

# Help
trepl help
trepl --help
trepl -h
```

## Examples

### Example 1: Organization Management

```bash
# Launch org REPL
trepl org

# In the REPL:
org> list
org> active
org> help
```

### Example 2: Document Browser

```bash
# Launch tdocs REPL
trepl tdocs

# In the REPL:
tdocs> ls
tdocs> search "API"
tdocs> view README.md
```

### Example 3: RAG Workflow

```bash
# Launch RAG REPL
trepl rag

# In the REPL:
rag> /flow create "Add authentication"
rag> /stage evidence
rag> /help
```

## REPL Features

All tetra REPLs share common features:

### Tab Completion
- Press `Tab` to complete commands
- Context-aware suggestions
- Tree-based completion for help topics

### Command History
- Press `↑`/`↓` to navigate history
- Press `Ctrl-R` for reverse search
- History persists across sessions

### Slash Commands
Common across all REPLs:
- `/help` - Module help
- `/exit` or `/quit` - Exit REPL
- `/meta` - Show REPL metadata
- `/history` - Show command history

### Keyboard Shortcuts
- `Tab` - Completion
- `Ctrl-R` - History search
- `Ctrl-C` - Cancel current input
- `Ctrl-D` - Exit REPL
- `Ctrl-L` - Clear screen (in some REPLs)

## Architecture

### REPL Registry

`trepl` maintains a registry of module REPLs:

```bash
TREPL_REGISTRY=(
    [org]="$TETRA_SRC/bash/org/org_repl.sh"
    [rag]="$TETRA_SRC/bash/rag/rag_repl.sh"
    [tdocs]="$TETRA_SRC/bash/tdocs/tdocs_repl.sh"
    # ...
)
```

### Module Integration

Modules integrate with the universal REPL system (`bash/repl/repl.sh`):

```bash
# In <module>_repl.sh
source "$TETRA_SRC/bash/repl/repl.sh"

# Register module
repl_register_module "mymodule" \
    "command1 command2 command3" \
    "help.mymodule"

# Define entry point
mymodule_repl() {
    repl_run
}
```

### Universal REPL System

The universal REPL (`bash/repl/`) provides:
- Input handling (readline, raw mode)
- Command processing
- History management
- Tab completion framework
- Tree-based help integration
- Prompt management
- Mode switching

## Module-Specific Features

### org REPL
- Environment/mode navigation (DEV/APP/USER)
- TUI integration
- Action execution
- Tree-based help

### rag REPL
- Flow management
- Stage progression
- Evidence collection
- TDS markdown rendering

### tdocs REPL
- Document browsing
- Full-text search
- Tag filtering
- Preview mode

### qa REPL
- Question answering
- Context management
- Evidence linking

## Adding New REPLs

To add a new module REPL to `trepl`:

1. **Create the REPL script**:
   ```bash
   # bash/mymodule/mymodule_repl.sh
   source "$TETRA_SRC/bash/repl/repl.sh"

   mymodule_repl() {
       repl_run
   }
   ```

2. **Register in trepl**:
   Edit `bash/repl/trepl.sh`:
   ```bash
   TREPL_REGISTRY[mymodule]="$TETRA_SRC/bash/mymodule/mymodule_repl.sh"
   TREPL_DESCRIPTIONS[mymodule]="My module description"
   ```

3. **Test**:
   ```bash
   trepl mymodule
   ```

## Troubleshooting

### REPL not found

```bash
# Check if module is registered
trepl list

# If not listed, the module may not have a REPL
# Check for <module>_repl.sh in bash/<module>/
```

### Entry point not found

```bash
Error: No REPL entry point found
Expected: mymodule_repl, mymodule_repl_main, or repl_run
```

**Fix**: Ensure your REPL script defines one of these functions:
- `<module>_repl`
- `<module>_repl_main`
- `repl_run`

### Tab completion not working

Most REPLs use tree-based completion. Ensure:
1. Module has defined tree structure
2. Module called `tree_insert` to register commands
3. REPL sourced `bash/nav/nav.sh` (or `bash/tree/core.sh` for backwards compat)

### History not saving

Check:
1. `$TETRA_DIR/repl/history/` directory exists
2. History file is writable
3. REPL set `REPL_HISTORY_BASE` variable

## Development

### Testing trepl

```bash
# Test discovery
trepl discover

# Test list
trepl list

# Test selector
trepl select

# Test direct launch
trepl org
```

### Debugging

```bash
# Enable debug mode
export REPL_DEBUG=1
trepl <module>

# Check REPL script path
echo "${TREPL_REGISTRY[org]}"

# Check if script exists
test -f "${TREPL_REGISTRY[org]}" && echo "exists"
```

## References

- [bash/repl/README.md](README.md) - Universal REPL system
- [bash/repl/repl.sh](repl.sh) - Core REPL library
- [bash/nav/](../nav/) - Navigation/tree system (nav.sh, nav_help.sh, nav_builders.sh)
- [bash/org/org_repl.sh](../org/org_repl.sh) - Org REPL (reference implementation)
- [bash/rag/rag_repl.sh](../rag/rag_repl.sh) - RAG REPL (TDS integration)

## Version History

- **1.0** (2025-11-03) - Initial release
  - Universal REPL launcher
  - Interactive selector
  - Registry of 17 module REPLs
  - List and discover commands
  - Help system
