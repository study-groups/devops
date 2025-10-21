# RAG REPL History & Tab Completion Guide

## Overview

The RAG REPL now has two powerful features:
1. **Separate REPL History** - Doesn't corrupt your shell history
2. **Recursive Tab Completion** - Like doctl, completes commands hierarchically

## History System

### Location
- History file: `$TETRA_DIR/rag/history` (default: `~/.tetra/rag/history`)
- Completely separate from `~/.bash_history`

### Features
- **No Shell Pollution**: REPL commands stay in REPL, shell commands stay in shell
- **Duplicate Prevention**: Consecutive duplicate commands are automatically filtered
- **Size Management**: Auto-trims to 1000 commands (configurable via `RAG_HISTORY_SIZE`)
- **Up/Down Arrow Navigation**: Browse previous commands
- **Ctrl+R Search**: Reverse search through REPL history

### Commands

```bash
/history list [n]          # List last N commands (default: 20)
/history ls [n]            # Alias for list
/history search <pattern>  # Search history for pattern
/history clear             # Clear all history
/history export [file]     # Export history to file (default: stdout)
/history import <file>     # Import history from file
/history stats             # Show usage statistics
```

### Examples

```bash
# View recent commands
rag> /history list 10

# Search for evidence commands
rag> /history search evidence

# Export history for backup
rag> /history export ~/rag-history-backup.txt

# View statistics
rag> /history stats
```

## Tab Completion

### Recursive Structure

The completion system works like a tree:

```
/
├── prompt
│   ├── minimal
│   │   ├── flow
│   │   └── global
│   ├── normal
│   ├── twoline
│   └── toggle
├── evidence (alias: /e)
│   ├── add [file]
│   ├── list
│   ├── toggle [rank|pattern|range]
│   ├── on [target]
│   ├── off [target]
│   ├── remove [target]
│   └── rebase
├── flow (alias: /f)
│   ├── create [description]
│   ├── status
│   ├── list
│   ├── resume [flow-id]
│   └── help
├── mc [files...]
│   └── flags: -r, -x, --agent, --ulm-rank, etc.
├── ms [mcfile]
├── mi [mcfile]
├── history
│   ├── list
│   ├── search
│   ├── clear
│   ├── export
│   └── import
└── ...
```

### Smart Completion Types

The system recognizes different argument types:

- **@file**: File path completion
- **@directory**: Directory path completion
- **@mcfile**: .mc file completion only
- **@agent**: Agent name completion (base, openai, claude-code, etc.)
- **@flow_id**: Flow ID completion from recent flows
- **@rank/@pattern/@range**: Evidence target completion
- **@string**: No completion (free-form text)

### Examples

```bash
# Type and press TAB:
rag> /<TAB>
# Shows: /prompt /evidence /e /flow /f /mc /ms /mi...

# Type and press TAB:
rag> /e<TAB>
# Completes to: /evidence  or  /e  (with space)

# Type and press TAB:
rag> /evidence <TAB>
# Shows: add list ls toggle on off status remove rebase

# Type and press TAB:
rag> /evidence add <TAB>
# Shows file list for completion

# Type and press TAB:
rag> /flow <TAB>
# Shows: create status list resume help

# Type and press TAB:
rag> /mc --<TAB>
# Shows: --agent --ulm-rank --ulm-top --dryrun --example...

# Type and press TAB:
rag> /mc --agent <TAB>
# Shows: base openai claude-code chatgpt...

# Type and press TAB:
rag> /history <TAB>
# Shows: list ls search clear export import stats
```

## Implementation Files

### Core Files
- `bash/rag_history.sh` - History management system
- `bash/rag_completion_tree.sh` - Recursive completion engine
- `bash/rag_repl.sh` - REPL integration

### Key Functions

#### History
```bash
rag_history_init()         # Initialize history system
rag_history_add()          # Add command to history
rag_history_search()       # Search history
rag_history_cleanup()      # Restore shell history on exit
```

#### Completion
```bash
rag_completion_init_tree()      # Build completion tree
rag_completion_recursive()      # Main completion function
rag_completion_get_node()       # Get completions for path
```

## Configuration

### Environment Variables

```bash
# History settings
export RAG_HISTORY_FILE="$TETRA_DIR/rag/history"
export RAG_HISTORY_SIZE=1000

# Completion (no config needed - auto-initialized)
```

### Customization

To add new commands to the completion tree:

```bash
# Edit bash/rag_completion_tree.sh
# Add to rag_completion_init_tree():

RAG_COMPLETION_TREE["/mycommand"]="subcommand1 subcommand2"
RAG_COMPLETION_TREE["/mycommand:subcommand1"]="@file"
```

## Benefits

### History Benefits
1. **Clean Separation**: Your shell history stays clean
2. **Context-Aware**: Only RAG commands in RAG history
3. **Portable**: Export/import for team sharing
4. **Analytics**: Built-in stats to see what you use most

### Completion Benefits
1. **Faster Workflow**: Tab through commands quickly
2. **Discovery**: See available subcommands instantly
3. **Type Safety**: Only valid options are suggested
4. **Contextual**: Completions adapt to command depth

## Comparison to Other Tools

Similar to:
- **doctl** (DigitalOcean CLI) - Hierarchical completion
- **kubectl** - Subcommand completion with context
- **aws-cli** - Deep command tree navigation
- **ipython** - Separate REPL history

## Technical Notes

### How History Separation Works
```bash
# On REPL start:
set +o history  # Disable bash history tracking

# On command entry:
rag_history_add "$input"  # Add to RAG history only
# NOT: history -s "$input" # This would pollute shell

# On REPL exit:
set -o history  # Re-enable bash history
```

### How Recursive Completion Works
```bash
# Build path from command words:
/evidence add test.sh
# Path: "/evidence:add"

# Look up in tree:
RAG_COMPLETION_TREE["/evidence:add"]="@file"

# Detect type and provide appropriate completion:
if [[ "$node_value" == *"@file"* ]]; then
    COMPREPLY=($(compgen -f -- "$cur"))
fi
```

## Testing

Run the test suite:
```bash
bash bash/rag/test_history_completion.sh
```

Manual testing:
```bash
# Start REPL
rag repl

# Test history
rag> /evidence list
rag> /flow status
rag> /history list
# Should show your 2 commands

# Test completion
rag> /<TAB>
# Should show all commands

rag> /e<TAB>
# Should complete to /evidence or /e

rag> /evidence <TAB>
# Should show subcommands
```

## Troubleshooting

### History not saving
```bash
# Check history file
ls -la ~/.tetra/rag/history

# Check permissions
ls -ld ~/.tetra/rag
```

### Tab completion not working
```bash
# Verify completion tree loaded
declare -p RAG_COMPLETION_TREE

# Verify function registered
complete -p | grep rag_completion_recursive
```

### Shell history getting polluted
```bash
# Check if history is disabled
set -o | grep history
# Should show: history off

# If not, restart REPL
```

## Future Enhancements

Potential additions:
- [ ] History timestamp tracking
- [ ] History command frequency analysis
- [ ] Fuzzy completion matching
- [ ] Completion suggestions based on history
- [ ] Multi-line command support in history
- [ ] History sharing/sync across sessions
