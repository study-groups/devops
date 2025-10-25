# bash/tree - Minimal Tree Library

Generic hierarchical tree data structure for Tetra, providing:
- Tree-based help systems with 18-line pagination
- Tab-completion generation
- Hierarchical indexing for future use (RAG, AST)

## Philosophy

**Keep it simple. Build for today. Extend for tomorrow.**

This library provides a minimal tree data structure that solves immediate needs (help navigation) while remaining flexible for future use cases (RAG indexing, AST trees).

## Structure

```
bash/tree/
  ├── core.sh        # Core tree operations (~150 lines)
  ├── complete.sh    # Tab-completion from tree (~80 lines)
  └── help.sh        # 18-line paginated help (~200 lines)
```

## Quick Start

```bash
# Load the library
source "$TETRA_SRC/bash/tree/core.sh"
source "$TETRA_SRC/bash/tree/complete.sh"
source "$TETRA_SRC/bash/tree/help.sh"

# Build a help tree
tree_insert "help.myapp" category \
    title="My Application" \
    help="Description of my app"

tree_insert "help.myapp.start" command \
    title="Start service" \
    help="Start the application" \
    synopsis="myapp start [OPTIONS]" \
    handler="myapp_start"

tree_insert "help.myapp.start.--port" option \
    title="Port number" \
    help="Specify port" \
    completion_values="3000,8080,8888"

# Show help
tree_help_show "help.myapp"

# Interactive navigation (18-line paginated)
tree_help_navigate "help.myapp"

# Tab-completion
completions=$(tree_complete "help.myapp")
# Returns: start
```

## Core API

### Tree Construction

**tree_insert <path> <type> [key=value...]**

Insert a node into the tree. Auto-creates parent chain.

```bash
tree_insert "help.tdoc.init" command \
    title="Initialize" \
    handler="tdoc_init_doc" \
    synopsis="tdoc init <file>"
```

**Types:**
- `category` - Container node
- `command` - Executable command
- `flag` - Boolean flag (--verbose)
- `option` - Key-value option (--port 3000)
- `param` - Positional parameter
- Custom types for your use case

**Path notation:**
- Dot notation: `help.tdoc.init` (primary)
- Slash notation: `help/tdoc/init` (auto-converted)

### Tree Querying

**tree_get <path> [key]**

Get node metadata.

```bash
title=$(tree_get "help.tdoc.init" "title")
# Returns: "Initialize"
```

**tree_children <path> [--type TYPE] [--limit N]**

Get immediate children.

```bash
children=$(tree_children "help.tdoc")
# Returns: init view tag list search...

commands=$(tree_children "help.tdoc" --type command)
# Returns: only command nodes
```

**tree_exists <path>**

Check if node exists (returns 0/1).

**tree_parent <path>**

Get parent path.

**tree_type <path>**

Get node type.

### Traversal

**tree_breadcrumb <path>**

Get path from root to node.

```bash
tree_breadcrumb "help.tdoc.init.--core"
# Returns:
# help
# help.tdoc
# help.tdoc.init
# help.tdoc.init.--core
```

**tree_descendants <path> [--depth N] [--type TYPE]**

Get all descendants (recursive).

**tree_query [--type TYPE] [--has KEY] [--where KEY=VALUE] [--limit N]**

Query across entire tree.

```bash
# Find all commands
tree_query --type command

# Find nodes with handler
tree_query --has handler

# Find by module
tree_query --where "module=tdoc"
```

## Help System

### Building Help Trees

**Metadata for help nodes:**

| Key | Description | Example |
|-----|-------------|---------|
| `title` | Short display name | "Initialize document" |
| `help` | Brief description | "Add metadata to document" |
| `synopsis` | Usage string | "tdoc init <file> [OPTIONS]" |
| `detail` | Long description | Multi-line detailed help |
| `examples` | Code examples | "tdoc init file.md --core" |
| `handler` | Function name | "tdoc_init_doc" |

### Displaying Help

**tree_help_show <path> [--no-pagination]**

Display formatted help for a path. Auto-paginates at 18 lines.

**tree_help_navigate [path]**

Interactive help navigation with breadcrumbs.

Navigation commands:
- `<topic>` - Dive into topic
- `b` - Back to previous
- `m` - Return to main
- `q` - Quit

**help <path>**

Quick help lookup (convenience wrapper).

```bash
help tdoc.init
# Shows help for tdoc.init command
```

## Tab-Completion

### Generating Completions

**tree_complete <path> [current_word]**

Generate completions for bash.

```bash
# Get all children
completions=$(tree_complete "help.tdoc")

# Filter by prefix
completions=$(tree_complete "help.tdoc" "in")
# Returns: init (if it exists)
```

**tree_complete_by_type <path> <type> [current_word]**

Get completions filtered by type.

```bash
# Only flags
flags=$(tree_complete_by_type "help.tdoc.init" "flag")
```

**tree_complete_values <path>**

Get completion values from metadata.

```bash
tree_insert "help.myapp.--env" option \
    completion_values="dev,staging,prod"

values=$(tree_complete_values "help.myapp.--env")
# Returns: dev staging prod
```

### Bash Completion Integration

Use with bash `complete`:

```bash
_tdoc_complete() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local path=$(tree_build_path_from_words "help.tdoc")

    COMPREPLY=($(compgen -W "$(tree_complete "$path" "$cur")" -- "$cur"))
}

complete -F _tdoc_complete tdoc
```

## Design Decisions

### Single Global Tree

One tree with namespaced paths:
- `help.*` - Help trees
- `files.*` - File indexes
- `rag.*` - RAG indexes (future)
- `ast.*` - AST trees (future)

Enables cross-domain queries without complexity.

### Dot Notation

`help.tdoc.init.--core` vs `help/tdoc/init/--core`

- More compatible with bash function naming
- Natural for API-style paths
- Slash paths auto-convert to dots

### In-Memory + Optional Persistence

Trees rebuild on module load. Fast, simple, no stale cache issues.

Optional: `tree_save`/`tree_load` for caching (not yet implemented).

### No Schemas

Simple key-value metadata. Applications validate their own data.

Flexible, extensible, pragmatic.

## Examples

### Example 1: Module Help Tree

```bash
# In bash/mymodule/mymodule.sh

_mymodule_build_help_tree() {
    tree_insert "help.mymodule" category \
        title="My Module" \
        help="Does amazing things"

    tree_insert "help.mymodule.start" command \
        title="Start service" \
        synopsis="mymodule start [--port PORT]" \
        handler="mymodule_start"

    tree_insert "help.mymodule.start.--port" option \
        title="Port number" \
        completion_values="3000,8080,9000"
}

# Call during module init
mymodule_init() {
    _mymodule_build_help_tree
}

# Use in command
mymodule() {
    case "$1" in
        help)
            tree_help_show "help.mymodule"
            ;;
        *)
            # ... handle commands
            ;;
    esac
}
```

### Example 2: Interactive Help

```bash
# Interactive navigation
tree_help_navigate "help.mymodule"

# User sees:
# ■ My Module
# Does amazing things
#
# COMMANDS:
#   start    Start service
#
# Navigate: [topic] dive | [b]ack | [m]ain | [q]uit:
```

### Example 3: Tab-Completion

```bash
# Setup completion
_mymodule_complete() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"
    local path="help.mymodule"

    # Build path from words
    if [[ ${COMP_CWORD} -gt 1 ]]; then
        for ((i=1; i<${COMP_CWORD}; i++)); do
            [[ "${COMP_WORDS[$i]}" != -* ]] && path="$path.${COMP_WORDS[$i]}"
        done
    fi

    # Get completions
    COMPREPLY=($(compgen -W "$(tree_complete "$path" "$cur")" -- "$cur"))
}

complete -F _mymodule_complete mymodule

# User types: mymodule <TAB>
# Completion shows: start

# User types: mymodule start --<TAB>
# Completion shows: --port
```

## Future Extensions

When new use cases emerge (RAG, AST), extend the library:

```bash
# Future: RAG document indexing
tree_insert "rag.documents.bash.tdoc.README" file \
    path="/path/to/file" \
    tokens="1234" \
    last_indexed="2025-10-25"

# Future: AST tree
tree_insert "ast.file.sh.function.tree_insert" function \
    start_line="43" \
    end_line="88" \
    params="path type"
```

The core tree structure supports this without modification.

## Testing

```bash
# Run core tests
bash bash/tree/test_tree.sh

# Test help integration
bash bash/tree/test_tdoc_help.sh
```

## Tab Completion for REPLs (NEW!)

The tree library now includes full tab completion support for interactive REPLs.

### Quick Integration

```bash
# In your REPL script:
source "$TETRA_SRC/bash/tree/tree_repl_complete.sh"

# Enable completion
tree_repl_enable_completion "help.myapp"

# Run REPL
repl_run

# Cleanup
tree_repl_disable_completion
```

### Example: Game Module

```bash
tmod load game
game repl

> <TAB>
play    ls    status    org    user    help    exit

> pl<TAB>
> play <TAB>
pulsar    estoface    formant

> user <TAB>
list    new    status
```

### Features

- **Auto-completion** - Press TAB to complete commands
- **Multi-level navigation** - `show<TAB>` then `<TAB>` for sub-options
- **Partial matching** - `pl<TAB>` completes to `play`
- **Context-aware** - Shows only valid options at current level
- **Dynamic completions** - Functions can generate completion lists
- **Colored output** - Type-aware display (categories vs actions)

### Documentation

See comprehensive guides:
- [TAB_COMPLETION_GUIDE.md](TAB_COMPLETION_GUIDE.md) - Full documentation
- [INTEGRATION_EXAMPLE.md](INTEGRATION_EXAMPLE.md) - Step-by-step integration
- `demo_tree_repl.sh` - Interactive demo
- `test_tree_completion.sh` - Test suite

### Interactive Demo

```bash
bash bash/tree/demo_tree_repl.sh
```

Try:
- Press TAB to see all commands
- Type `sh` + TAB to complete "show"
- Type `show ` + TAB to see options
- Multi-level: `show st` + TAB

## See Also

- `bash/tdoc/tdoc.sh` - Reference implementation using tree-based help
- `bash/game/games/estoface/core/estoface_repl.sh` - REPL with tab completion
- `bash/repl/command_processor.sh` - Integration with REPL /help
- `bash/tkm/tkm_completion.sh` - Alternative completion pattern
- Future: `bash/rag/` - RAG indexing using trees
