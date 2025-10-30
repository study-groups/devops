# thelp - Tree Help Quick Lookup

Quick help access from regular shell without entering interactive mode.

## Purpose

Provides fast command help lookup for modules using bash/tree help system, designed for use in **augment mode** (CLI-first) where you want quick reference without leaving the shell.

**New in Phase 2:** thelp now integrates with the module registry for auto-discovery and supports dynamic completions.

## Usage

```bash
# Show help for a command
thelp flow
thelp evidence.add

# Show help with full path
thelp rag.flow.create

# List all registered modules
thelp --modules

# List all commands for a module
thelp --list rag
thelp --list org

# Get dynamic completions for scripting
thelp --complete rag.flow.list
thelp --complete game.play pul

# Get usage
thelp
```

## Examples

```bash
# Quick reference while working
$ thelp flow.create
■ Create Flow
Create a new RAG flow with a description

USAGE:
  /flow create "description" [agent]

DESCRIPTION:
  Creates a new flow with the given description. Optionally specify
  an agent profile (base, claude-code, openai).

EXAMPLES:
  /flow create "Fix authentication timeout"
  /flow create "Add new feature" claude-code

# List available commands
$ thelp --list rag
Available commands in rag:

  create               Create Flow
  status               Flow Status
  list                 List Flows
  add                  Add Evidence
  toggle               Toggle Evidence
  ...
```

## Tab Completion

```bash
thelp fl<TAB>          # Completes to 'flow'
thelp flow.<TAB>       # Shows: create status list resume
thelp rag.<TAB>        # Shows all rag subcommands
```

## Integration with RAG REPL

### Augment Mode (default)
- Use `thelp` from regular shell or within REPL
- Complements `/help` command
- No interactive takeover

### Takeover Mode
- Not needed (use `help` directly)
- `thelp` still works if you prefer

## New Features (Phase 2)

### Module Registry Integration

thelp now automatically discovers registered modules from `REPL_MODULE_REGISTRY`:

```bash
$ thelp --modules
Available modules:

  rag          Retrieval-Augmented Generation
  game         Game REPL launcher
  org          Organization management

Use: thelp --list <module> to see commands
```

When you type `thelp flow`, it will:
1. Check registry to see which module owns "flow"
2. Use the correct namespace (e.g., `help.rag`)
3. Show help without needing to specify the module

### Dynamic Completion Support

thelp can now call `completion_fn` from tree nodes:

```bash
# Get available flow IDs
$ thelp --complete rag.flow.list
active-flow-1
active-flow-2
completed-flow-3

# Get available games
$ thelp --complete game.play
pulsar
formant
estoface

# Filter by current word
$ thelp --complete game.play pul
pulsar
```

This is useful for:
- Shell scripts that need completion data
- Testing completion functions
- Debugging help tree metadata

### Enhanced --list Command

The `--list` command now validates modules against the registry:

```bash
$ thelp --list unknown
Module not found: unknown

Available modules:
  rag          Retrieval-Augmented Generation
  game         Game REPL launcher
```

## Comparison with /help

| Feature | thelp | /help |
|---------|-------|-------|
| Mode | CLI command | REPL slash command |
| Output | Always text | Text by default, optional interactive |
| Location | Works anywhere | Only in REPL |
| Completion | Yes (bash) | Yes (REPL) |
| Interactive | No | Yes (with --interactive) |
| Module Discovery | Registry + tree | Registry + tree |
| Dynamic Completions | Yes (--complete) | Yes (automatic) |

**When to use thelp vs /help:**
- Use **thelp** when working in shell mode or outside a REPL
- Use **/help** when inside a REPL for integrated experience
- Both access the same help tree and respect module registration

## How It Works

1. Loads bash/tree help system
2. Loads command_processor for registry access
3. Queries help tree for command path
4. Uses module registry to resolve ambiguous commands
5. Calls dynamic completion functions when requested
6. Provides bash completion via `complete -F`

## Requirements

- bash/tree module loaded
- bash/repl/command_processor.sh (for registry, optional)
- Help tree initialized (done by module REPLs)

## Implementation

Location: `bash/thelp/thelp.sh`

Key functions:
- `thelp()` - Main command
- `_thelp_get_completions()` - Dynamic completion support
- `_thelp_list_modules()` - Module discovery
- `_thelp_list_commands()` - List module commands
- `_thelp_complete()` - Tab completion handler

For building help trees, see: [bash/repl/TETRA_WAY.md](../repl/TETRA_WAY.md)
