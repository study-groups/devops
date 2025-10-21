# RAG REPL Features

## Overview

The RAG REPL is an interactive shell interface for the RAG (Retrieval-Augmented Generation) workflow system. It provides a user-friendly command-line experience with visual feedback and intuitive commands.

## Core Features

### 1. Dynamic Colored Prompt

The prompt shows your current flow state with semantic colors:

```bash
[first-flow:NEW] rag>        # Starting a new flow
[first-flow:SELECT] rag>     # Gathering evidence
[first-flow:ASSEMBLE] rag>   # Building context
[first-flow:SUBMIT] rag>     # Submitting to agent
```

Colors indicate progress through the workflow stages.

### 2. Evidence Management with :: Selector

Add files or file ranges to your flow using intuitive syntax:

```bash
/evidence add file.sh                      # Whole file
/evidence add file.sh::100,200             # Lines 100-200
/evidence add file.sh::100                 # From line 100 to EOF
/evidence add file.sh::100c,500c           # Bytes 100-500
/evidence add file.sh#tag1,tag2            # Whole file with tags
/evidence add file.sh::100,200#bug         # Range with tags
/evidence list                             # Show all evidence
```

### 3. Shell Command Passthrough

Commands without `/` prefix run as shell commands:

```bash
wc -l rag.sh          # Shell command
ls -la                # Shell command
cat core/flow.sh      # Shell command
```

### 4. Local .rag/ Directories

Each project gets its own flow storage (like `.git`):

```
project/
├── .rag/
│   └── flows/
│       ├── active -> first-flow-20241016T123456
│       └── first-flow-20241016T123456/
│           ├── state.json
│           ├── events.ndjson
│           └── ctx/
│               ├── evidence/
│               │   ├── 100_flow_manager_sh.evidence.md
│               │   └── 200_evidence_selector_sh.evidence.md
│               ├── 000_policy.system.md
│               └── 010_request.user.md
```

### 5. Flow State Management

Track workflow progress through finite state machine stages:

```
NEW → SELECT → ASSEMBLE → SUBMIT → APPLY → VALIDATE → (FOLD | DONE | FAIL)
```

Each stage has specific actions and visual indicators.

### 6. MULTICAT Integration

Create, split, and inspect MULTICAT files:

```bash
/mc -r src/           # Create MULTICAT from directory
/ms file.mc           # Split MULTICAT back to files
/mi file.mc           # Show MULTICAT info
/example              # Generate example MULTICAT
```

### 7. Colored Status Display

Visual feedback for system health:

```bash
/status

RAG Tools Status:
═════════════════
RAG_DIR: /path/to/.tetra/rag
RAG_SRC: /path/to/tetra/bash/rag

Available tools:
  ✓ mc
  ✓ ms
  ✓ mi
  ✗ missing-tool

Storage directories:
  ✓ /path/to/.tetra/rag
```

### 8. Interactive Help System

Context-aware help with examples:

```bash
/help                 # Show all commands
/help evidence        # Help for evidence commands
```

### 9. Tab Completion

Auto-completion for:
- RAG commands (`/evidence`, `/mc`, `/status`, etc.)
- File paths for evidence selectors
- MULTICAT files (`.mc` extension)

### 10. Command History

Full readline support:
- Up/down arrows for history
- Ctrl+R for reverse search
- History persistence across sessions

## Workflow Example

```bash
# 1. Start REPL with logging
rag repl 2>&1 | tee /tmp/rag_session.log

# 2. Add evidence
[first-flow:NEW] rag> /evidence add core/flow_manager.sh::200,250#flow

# 3. List evidence
[first-flow:SELECT] rag> /evidence list
Evidence files:
  • 100_flow_manager_sh.evidence.md

# 4. Check status
[first-flow:SELECT] rag> /status

# 5. Run shell commands
[first-flow:SELECT] rag> wc -l core/*.sh

# 6. Get help
[first-flow:SELECT] rag> /help

# 7. Exit
[first-flow:SELECT] rag> /exit
```

## Visual Design

### Color Coding
- **Cyan**: Primary elements (headings, flow names)
- **Blue**: Commands and labels
- **Purple**: Section headers and gathering phase
- **Green**: Success, enabled, valid
- **Orange**: Warnings, submission phase
- **Red**: Errors, validation phase, disabled
- **Gray**: Secondary text, punctuation

### Symbols
- `✓` Success/enabled
- `✗` Failure/disabled
- `⚠` Warning
- `•` List item
- `→` Active/selected
- `🔧` Tool/system

## Debugging Support

Enable collaborative debugging with logging:

```bash
# Terminal 1: Run REPL with logging
rag repl 2>&1 | tee /tmp/rag_session.log

# Terminal 2: Monitor logs
tail -f /tmp/rag_session.log

# Or use background monitoring
rag repl 2>&1 | tee /tmp/rag_session.log &
# Use BashOutput tool to read logs
```

## Accessibility

- Graceful degradation without colors
- Plain text mode for accessibility
- Screen reader friendly output
- No color-only information encoding

## Future Enhancements

- Tab completion for file ranges (`::`syntax)
- Context-aware suggestions based on flow stage
- Flow templates for common workflows
- Interactive evidence browser with preview
- Integrated diff viewer for changes
- Real-time validation feedback
- Agent selection within REPL
- Multi-flow management
