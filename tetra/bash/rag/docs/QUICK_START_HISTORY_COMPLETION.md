# Quick Start: History & Tab Completion

## What's New

Two major features added to RAG REPL:

1. **Separate REPL History** - Your shell history stays clean!
2. **Recursive Tab Completion** - Like doctl, complete commands at any depth!

## Quick Demo

```bash
# Start the REPL
rag repl

# Try tab completion (press TAB after typing):
rag> /<TAB>
# Shows all top-level commands

rag> /e<TAB>
# Completes to /evidence or /e

rag> /evidence <TAB>
# Shows: add list ls toggle on off status remove rebase

rag> /evidence add <TAB>
# Shows files in current directory

rag> /flow <TAB>
# Shows: create status list resume help

# Try history commands
rag> /evidence list
rag> /flow status
rag> /history list
# Shows your last commands

# Use Up arrow to browse history
rag> <UP>
# Brings back previous command

# Search history
rag> /history search evidence
# Shows all commands containing "evidence"
```

## Key Benefits

### History
- ✅ REPL commands don't pollute `~/.bash_history`
- ✅ Separate history file: `~/.tetra/rag/history`
- ✅ Automatic duplicate filtering
- ✅ Up/Down arrow navigation
- ✅ Ctrl+R search
- ✅ Export/import for sharing

### Tab Completion
- ✅ Complete commands at any depth
- ✅ Context-aware: `/evidence <TAB>` shows evidence subcommands
- ✅ Smart file completion: `/mc --agent <TAB>` shows agent names
- ✅ Flag completion: `/mc --<TAB>` shows all flags
- ✅ Alias support: `/e <TAB>` same as `/evidence <TAB>`

## Common Patterns

### Exploring Commands
```bash
# What can I do?
rag> /<TAB>

# What are evidence options?
rag> /evidence <TAB>

# What are flow options?
rag> /flow <TAB>

# What flags does mc have?
rag> /mc --<TAB>
```

### Using History
```bash
# List recent commands
rag> /history list 20

# Find that evidence command I ran earlier
rag> /history search evidence

# Export my workflow
rag> /history export ~/my-rag-workflow.txt

# Share with team
rag> /history import ~/team-workflow.txt
```

### Combining Both
```bash
# Type partial command
rag> /evid<TAB>
# Completes to: /evidence

# Add subcommand
rag> /evidence a<TAB>
# Completes to: /evidence add

# Browse history while typing
rag> /evidence add <UP><UP>
# Shows previous /evidence add commands
```

## File Locations

- History: `~/.tetra/rag/history`
- Implementation: `bash/rag/bash/rag_history.sh`
- Completion: `bash/rag/bash/rag_completion_tree.sh`
- Guide: `bash/rag/docs/HISTORY_COMPLETION_GUIDE.md`

## Try It Now!

```bash
cd ~/src/devops/tetra/bash/rag
source rag.sh
rag repl

# Then try:
# - Press TAB after /
# - Type /e and press TAB
# - Run some commands and use /history list
# - Press Up arrow to browse history
```

## Need Help?

```bash
# In REPL:
rag> /help           # General help
rag> /history help   # History help

# Read full guide:
cat bash/rag/docs/HISTORY_COMPLETION_GUIDE.md
```
