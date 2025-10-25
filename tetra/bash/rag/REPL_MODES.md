# RAG REPL Modes

## Two Orthogonal Mode Systems

### Input Mode (how input is read)
Controls the input mechanism and features like history, completion, and editing.

- **basic**: Simple `read` command (fallback)
- **enhanced**: tcurses with history, completion, line editing (default)
- **tui**: Full-screen TUI mode (future)

Set via: `repl_run <mode>` (currently: `repl_run enhanced`)

### Execution Mode (how commands are interpreted)
Controls whether you're in CLI mode or REPL mode.

- **augment** (default): CLI-first mode
  - Shell commands by default
  - `/cmd` for RAG commands
  - **Blue brackets** `[...]` indicate you need `/` prefix
  - Example: `ls -la` (shell) vs `/flow create` (RAG)

- **takeover**: REPL-first mode
  - RAG commands by default
  - `!cmd` for shell escape
  - **Standard brackets** `[...]`
  - Example: `flow create` (RAG) vs `!ls -la` (shell)

Switch via: `/mode` command

## Visual Indicators

### Prompt Format
```
[flow x stage x evidence] >
```

**Bracket colors indicate execution mode**:
- **Blue brackets** = Augment mode (use `/cmd` for RAG commands)
- **Standard brackets** = Takeover mode (RAG commands work directly)

### Stage Colors
- NEW: dim gray (not started)
- SELECT/ASSEMBLE: yellow/orange (gathering context)
- EXECUTE: blue (LLM processing)
- VALIDATE/DONE: green (success)
- FAIL: red (error)

## Quick Help Access

### Augment Mode (CLI-first)
```bash
# From regular shell:
thelp flow              # Quick help without entering REPL
thelp rag.evidence.add  # Specific command help
thelp --list rag        # List all commands

# From REPL:
/help                   # Show main help (non-interactive)
/help flow              # Show flow commands
/help --interactive     # Browse help tree (interactive mode)
```

### Takeover Mode (REPL-first)
```bash
# RAG commands work directly:
help                    # Show main help
help flow               # Show flow commands
flow create "question"  # No slash needed
!ls -la                 # Shell escape
```

## Tab Completion

### Augment Mode
- Shell completion by default
- `thelp <TAB>` - Complete help topics
- `/cmd<TAB>` - Complete RAG commands (future)

### Takeover Mode
- RAG command completion by default
- Explores command space via bash/tree help
- `help <TAB>` - Complete help topics

## Workflow Examples

### CLI-First Workflow (Augment Mode)
```bash
# Start REPL
rag repl

# Regular shell commands work
ls bash/rag/
git status

# Use / for RAG commands
/flow create "fix authentication timeout"
/e add src/auth.sh
/assemble
/submit @qa

# Quick help from shell (before/during REPL)
thelp flow.create
```

### REPL-First Workflow (Takeover Mode)
```bash
# Start REPL and switch mode
rag repl
/mode takeover

# RAG commands work directly
flow create "fix authentication timeout"
e add src/auth.sh
assemble
submit @qa

# Shell escape with !
!git status
!cat output.log
```

## Mode Switching

### To Takeover Mode
```bash
/mode takeover
# or
/mode repl
```

### To Augment Mode
```bash
/mode augment
# or
/mode shell
```

### Toggle
```bash
/mode toggle
# or
/mode
```

## Design Rationale

**Default to Augment Mode** because:
1. Most users start from regular CLI
2. Shell commands are frequent (ls, git, cat, grep)
3. RAG commands are occasional but powerful
4. `/cmd` is clear and intentional
5. Blue brackets remind you to use `/`

**Takeover Mode available** for:
1. Extended RAG sessions
2. Users who prefer REPL-first
3. Reduced typing for frequent RAG commands
4. Tab completion exploration of commands

## Implementation Details

### Prompt Builder
Location: `bash/rag/rag_repl.sh:_rag_repl_build_prompt()`

- Reads execution mode via `repl_is_augment()`
- Sets bracket color based on mode
- Displays flow, stage, evidence count
- Updates dynamically on each prompt

### Help System
- **Non-interactive by default**: `/help` shows text
- **Interactive opt-in**: `/help --interactive` for tree navigation
- **Shell access**: `thelp cmd` for quick lookup from CLI

### Tab Completion
- Augment mode: delegates to bash default, thelp completes help
- Takeover mode: (future) use bash/tree to explore command space

## Future Enhancements

1. **Smart tab completion** in takeover mode
2. **Context-aware suggestions** based on flow stage
3. **TUI mode** for full-screen interface
4. **Persistent mode preference** per user/project
