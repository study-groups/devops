# TDOCS Context Guide

## The Problem We're Solving

You have two scenarios:
1. **Working on Tetra itself** - Need access to tetra's global documentation database
2. **Working on other projects** - Want local docs (CAPITAL_LETTERS.md files) tracked separately

## Simple Mental Model

```
GLOBAL context = Tetra project docs
  - Database: ~/tetra/tdocs/db/
  - For: bash/rag/, bash/tdocs/, etc.
  - Use when: Working on tetra itself

LOCAL context = Current project docs
  - Database: ./.tdocs/db/
  - For: Whatever project you're in
  - Use when: Working on any non-tetra project
```

## How Context Detection Works

### Automatic Detection
```bash
cd ~/projects/my-app     # Some project
tdocs browse             # Auto-detects LOCAL (creates .tdocs if needed)

cd ~/src/devops/tetra    # Tetra source
tdocs browse             # Auto-detects GLOBAL (you're in $TETRA_SRC)
```

### Detection Rules
1. If `.tdocs/` exists → LOCAL
2. If inside `$TETRA_SRC/*` → GLOBAL
3. Otherwise → GLOBAL (default fallback)

## Commands in REPL

```bash
# Show current context
context
# Output:
#   Current context: local (my-app)
#   Database: /Users/you/projects/my-app/.tdocs/db

# Switch context manually
context local     # Force local context
context global    # Force global context

# Initialize local context (if not auto-created)
init-local
```

## The ls Confusion - SIMPLIFIED DESIGN

### Original Plan (TOO COMPLEX)
- `ls` → context-aware
- `ls .` → force local + scan current dir only
- `ls docs/` → force local + scan docs/
- `ls global` → force global
- `ls local` → force local

### SIMPLIFIED DESIGN (BETTER)
- `ls` → list docs in current context (normal behavior)
- Context switching is EXPLICIT via `context` command
- No magic directory-based switching

## Typical Workflows

### Workflow 1: Working on a project
```bash
cd ~/projects/my-app/src/components/
tdocs browse
# Prompt: [local:components 0 {*} ()] [] 0 >

scan                    # Index *.md in current dir
ls                      # List local docs
view 1                  # View first doc
```

### Workflow 2: Working on Tetra
```bash
cd ~/src/devops/tetra
tdocs browse
# Prompt: [global:tetra 92 {*} ()] [W:92] 92 >

ls                      # List tetra docs
find rag spec           # Find rag specs
view 1                  # View first doc
```

### Workflow 3: Switching contexts
```bash
# In a project dir, but want to reference tetra docs
cd ~/projects/my-app
tdocs browse            # Starts in local
# [local:my-app 5 {*} ()] [W:5] 5 >

context global          # Switch to tetra docs
# [global:tetra 92 {*} ()] [W:92] 92 >

ls                      # Now seeing tetra docs
find rag                # Search tetra rag docs

context local           # Back to project docs
# [local:my-app 5 {*} ()] [W:5] 5 >
```

## What Gets Scanned Where

### GLOBAL Context (tetra)
- Scans: `$TETRA_SRC/bash/**/*.md`
- Examples: bash/rag/docs/, bash/tdocs/docs/, etc.
- Stored: `~/tetra/tdocs/db/*.meta`

### LOCAL Context (project)
- Scans: Current directory `*.md` (NOT recursive by user choice)
- Examples: REFACTOR_PLAN.md, API_DESIGN.md, etc.
- Stored: `./.tdocs/db/*.meta`

## FAQ

**Q: Why doesn't `ls .` auto-switch to local?**
A: That was the original plan but adds confusion. Context switching should be explicit.

**Q: How do I work with both contexts?**
A: Use `context global` and `context local` to switch. Prompt always shows which context you're in.

**Q: What if I'm in tetra but want to test local docs?**
A: Use `context local` to force local context, even in tetra directory.

**Q: Can I have multiple local contexts?**
A: Yes! Each directory with `.tdocs/` is its own local context. Switch by cd'ing and running tdocs browse.

**Q: Why .tdocs directory?**
A: Like .git, it's a blessed dotfile that signals "this directory has doc metadata".

## Key Takeaway

**Context is EXPLICIT, not magical**
- Prompt always shows context: `[local:name ...]` or `[global:name ...]`
- Switch with `context` command
- Auto-detection only happens at REPL start
- Keep it simple!
