# TDOCS Context System

## Overview

TDOCS supports two contexts for document management:

| Context | Database | Use Case |
|---------|----------|----------|
| **GLOBAL** | `~/tetra/tdocs/db/` | Tetra project documentation |
| **LOCAL** | `./.tdocs/db/` | Project-specific documentation |

## Context Detection

At REPL startup:
1. If `$PWD == $HOME` → GLOBAL (safeguard against home scans)
2. If `.tdocs/` exists → LOCAL
3. If inside `$TETRA_SRC/*` → GLOBAL
4. Otherwise → GLOBAL (default)

## Commands

| Command | Description |
|---------|-------------|
| `context` | Show current context |
| `context local` | Switch to local context |
| `context global` | Switch to global context |
| `scan` | Index docs in current context |

## Prompt Format

```
[local:myproject 15 {*} ()] [W:15] 15 >
 ^^^^^            ^^
 context          total docs
```

## Workflows

### Working on a project
```bash
cd ~/projects/my-app
tdocs repl              # Auto-detects local (if .tdocs exists)
scan                    # Index local markdown files
ls                      # List project docs
```

### Working on Tetra
```bash
cd ~/src/devops/tetra
tdocs repl              # Auto-detects global
ls                      # List tetra docs
```

### Switching contexts
```bash
context global          # Switch to tetra docs
ls                      # See tetra docs
context local           # Back to project docs
```

## File Structure

```
Your Project/
├── src/
├── NOTES.md           ← Your docs
├── API_DESIGN.md
└── .tdocs/            ← Local metadata (created by tdocs init)
    ├── db/
    ├── config.json
    └── index.json

Tetra/
├── bash/rag/
├── bash/tdocs/
└── ~/tetra/tdocs/     ← Global metadata
    └── db/
```

## Key Principles

1. **Context is EXPLICIT** - Shown in prompt, switched manually
2. **Auto-detection at start only** - When running `tdocs repl`
3. **Safeguards prevent accidents** - Won't scan from $HOME
4. **Commands respect context** - `ls`, `scan`, etc. use active context
