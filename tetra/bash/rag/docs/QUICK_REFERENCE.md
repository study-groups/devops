# RAG REPL Quick Reference

## Starting the REPL

```bash
# Basic start
rag repl

# With logging for debugging
rag repl 2>&1 | tee /tmp/rag_session.log
```

## Command Types

| Prefix | Type | Example |
|--------|------|---------|
| `/` | RAG command | `/evidence add file.sh` |
| none | Shell command | `ls -la` |

## Evidence Commands

```bash
# Add evidence
/evidence add <selector>

# Selector formats
/evidence add file.sh                    # Whole file
/evidence add file.sh::100,200           # Lines 100-200
/evidence add file.sh::100               # From line 100 to EOF
/evidence add file.sh::100c,500c         # Bytes 100-500
/evidence add file.sh#tag1,tag2          # With tags
/evidence add file.sh::100,200#bug       # Range + tags

# List evidence
/evidence list
```

## Flow Commands

```bash
# Create flow
rag flow create "description"

# Show status
rag flow status
/status

# List flows
rag flow list

# Resume flow
rag flow resume <flow-id>
```

## MULTICAT Commands

```bash
/mc <files...>         # Create MULTICAT
/mc -r src/            # Recursive directory
/ms <file.mc>          # Split MULTICAT
/mi <file.mc>          # Show info
/example               # Generate example
```

## Utility Commands

```bash
/status                # System status
/help                  # Show help
/functions             # List rag_* functions
/exit                  # Exit REPL
/quit                  # Exit REPL
/q                     # Exit REPL
```

## Flow Stages

| Stage | Color | Meaning |
|-------|-------|---------|
| NEW | Blue | Fresh flow, ready to add evidence |
| SELECT | Light Purple | Gathering evidence |
| ASSEMBLE | Dark Purple | Building context |
| SUBMIT | Orange | Submitting to agent |
| APPLY | Bright Orange | Applying changes |
| VALIDATE | Red | Validating results |
| DONE | Green | Successfully completed |
| FAIL | Red | Failed, needs attention |

## Prompt Colors

```bash
[flow-name:NEW] rag>        # Blue stage = starting
[flow-name:SELECT] rag>     # Purple stage = gathering
[flow-name:ASSEMBLE] rag>   # Purple stage = building
[flow-name:DONE] rag>       # Green stage = success!
```

## Shell Integration

```bash
# Run any shell command directly
ls -la
wc -l *.sh
cat file.sh
grep "pattern" *.sh

# Mix with RAG commands
/evidence add core/flow.sh
ls -la .rag/flows/active/ctx/evidence
/evidence list
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Tab | Auto-complete |
| Up/Down | History |
| Ctrl+R | Reverse search |
| Ctrl+C | Cancel command |
| Ctrl+D | Exit REPL |

## File Locations

```bash
# Per-project flows
./rag/flows/                    # Flow directories
./.rag/flows/active             # Active flow symlink

# Global RAG storage
~/.tetra/rag/                   # User RAG directory
~/.tetra/rag/state/             # State tracking
~/.tetra/rag/state/projects/    # Project contexts
```

## Tips & Tricks

### 1. Quick Evidence Add
```bash
# Multiple files at once
for f in core/*.sh; do
  /evidence add "$f"::1,50#header
done
```

### 2. Check Flow State
```bash
# View state JSON
cat .rag/flows/active/state.json | jq '.'
```

### 3. List Evidence Files
```bash
# Shell command to see evidence
ls -1 .rag/flows/active/ctx/evidence/
```

### 4. Monitor Flow Events
```bash
# Watch events log
tail -f .rag/flows/active/events.ndjson | jq '.'
```

### 5. Export Context
```bash
# Create MULTICAT of all evidence
/mc .rag/flows/active/ctx/evidence/*.md
```

## Color Reference

| Element | Color | Hex |
|---------|-------|-----|
| Headings | Cyan | #00D4AA |
| Commands | Blue | #7AA2F7 |
| Sections | Purple | #BB9AF7 |
| Success | Green | #9ECE6A |
| Warning | Orange | #E0AF68 |
| Error | Red | #F7768E |
| Secondary | Gray | #565F89 |

## Common Workflows

### Add Evidence Workflow
```bash
1. /evidence add file.sh::100,200
2. /evidence list
3. Shell commands to verify
```

### Create Flow Workflow
```bash
1. rag flow create "Fix bug in parser"
2. /evidence add parser.sh::50,150#bug
3. /evidence add tests/parser_test.sh
4. Continue to next stage...
```

### Debug Workflow
```bash
1. Start: rag repl 2>&1 | tee /tmp/session.log
2. Run commands
3. Check logs: tail /tmp/session.log
```

## Exit Safely

```bash
/exit              # Normal exit
/quit              # Normal exit
/q                 # Normal exit
Ctrl+D             # Normal exit
Ctrl+C             # Cancel current command (stays in REPL)
Ctrl+C Ctrl+C      # Force exit
```

## Getting Help

```bash
/help              # Full help
/help evidence     # Evidence help
/functions         # List functions
/status            # Check system
```

## Troubleshooting

### Colors not working?
```bash
# Check COLOR_ENABLED
echo $COLOR_ENABLED

# Check color modules loaded
ls $TETRA_SRC/bash/color/
```

### Evidence not adding?
```bash
# Check flow is active
cat .rag/flows/active/state.json

# Verify file exists
ls -la <file-path>
```

### Flow not found?
```bash
# List all flows
rag flow list

# Check .rag directory
ls -la .rag/flows/
```
