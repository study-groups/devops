# TDOCS Context Reference Card

## Two Worlds, One REPL

```
┌─────────────────────────────────────────────────────────┐
│ GLOBAL                    LOCAL                         │
│ Tetra project docs        Your project docs             │
│ ~/tetra/tdocs/db/         ./.tdocs/db/                  │
│ Auto: in $TETRA_SRC/*     Auto: if .tdocs/ exists       │
└─────────────────────────────────────────────────────────┘
```

## Command Quick Reference

| Command | What It Does |
|---------|--------------|
| `context` | Show current context (global or local) |
| `context local` | Switch to local context |
| `context global` | Switch to global context |
| `init-local` | Create .tdocs/ in current directory |
| `ls` | List docs in current context |
| `scan` | Index docs in current context |

## Prompt Decoder

```
[local:components 15 {*} ()] [W:15] 15 >
 ^^^^^           ^^
 context         total docs in context

[global:tetra 92 {rag} (spec)] [W:80 S:12] 64 >
 ^^^^^^       ^^  ^^^    ^^^^
 context      |   filter  filter
              total
```

## Mental Model

**Think of it like git remotes:**
- `global` = like working with `origin` (tetra's docs)
- `local` = like working with your local branch (project docs)
- Switch between them explicitly with `context`

## When to Use Which

| Scenario | Context | Why |
|----------|---------|-----|
| Hacking on tetra modules | `global` | You're documenting tetra code |
| Building an app with Claude Code | `local` | App docs separate from tetra |
| Reading tetra docs while coding | `global` then `local` | Reference then work |
| Quick project notes | `local` | Keep project-specific |

## Common Confusion

❌ **Wrong**: "ls should magically switch contexts"
✅ **Right**: "Context is set at REPL start or via context command"

❌ **Wrong**: "Why doesn't ls show my CAPITAL_LETTERS.md files?"
✅ **Right**: "Did you run scan first? Are you in local context?"

❌ **Wrong**: "How do I reference global while in local?"
✅ **Right**: "Use context global to switch"

## The Rules

1. **Context is EXPLICIT** - Shown in prompt, switched manually
2. **Auto-detection only at start** - When you run `tdocs browse`
3. **Each directory has ONE context** - Based on .tdocs presence
4. **Commands respect context** - ls, scan, etc. use active context

## Quick Workflow

```bash
# Start in project
cd ~/myproject
tdocs browse           # Auto-detects local

# Create test doc
echo "# Notes" > NOTES.md

# Index and list
scan                   # Scans *.md in current dir
ls                     # Shows NOTES.md

# Need tetra docs?
context global         # Switch
ls                     # Now shows tetra docs

# Back to project
context local
```

## File Structure

```
Your Project/
├── src/
├── NOTES.md          ← Your docs
├── API_DESIGN.md     ← Your docs
└── .tdocs/           ← Local metadata
    ├── db/           ← Doc metadata
    ├── config.json   ← Settings
    └── index.json    ← Content tracking (Phase 2)

Tetra/
├── bash/rag/
├── bash/tdocs/
└── ~/tetra/tdocs/    ← Global metadata
    └── db/           ← Tetra doc metadata
```

## Bottom Line

**Keep it simple:**
- Prompt shows context
- Use `context` to switch
- Everything else just works within that context
