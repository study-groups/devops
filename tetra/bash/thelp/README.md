# thelp - Tree Help Quick Lookup

Quick help access from regular shell without entering interactive mode.

## Purpose

Provides fast command help lookup for modules using bash/tree help system, designed for use in **augment mode** (CLI-first) where you want quick reference without leaving the shell.

## Usage

```bash
# Show help for a command
thelp flow
thelp evidence.add

# Show help with full path
thelp rag.flow.create

# List all commands for a module
thelp --list rag
thelp --list org

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

## Comparison with /help

| Feature | thelp | /help |
|---------|-------|-------|
| Mode | CLI command | REPL slash command |
| Output | Always text | Text by default, optional interactive |
| Location | Works anywhere | Only in REPL |
| Completion | Yes (bash) | Yes (REPL) |
| Interactive | No | Yes (with --interactive) |

## How It Works

1. Loads bash/tree help system
2. Queries help tree for command path
3. Uses `tree_help_show()` for formatted output
4. Provides bash completion via `complete -F`

## Requirements

- bash/tree module loaded
- Help tree initialized (done by module REPLs)

## Implementation

Location: `bash/thelp/thelp.sh`

Key functions:
- `thelp()` - Main command
- `_thelp_list_commands()` - List module commands
- `_thelp_complete()` - Tab completion handler
