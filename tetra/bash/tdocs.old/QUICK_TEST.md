# Quick Test Guide - TDOCS Local Context

## Current Status: Phase 1 Complete

**What works:**
- Context detection (global vs local)
- Context switching via `context` command
- Prompt shows current context
- `.tdocs` initialization

**What doesn't work yet:**
- `ls` fails if no docs indexed (normal - need Phase 2)
- `ls .` semantic (Phase 5)
- Content-based tracking (Phase 2)
- RAG integration (Phase 4)

## Test in Tetra (Global Context)

```bash
cd ~/src/devops/tetra
source ~/tetra/tetra.sh
tdocs browse

# Should see: [global:tetra 92 {*} ()] [W:92] 92 >
# Commands work:
ls                    # Lists tetra docs
context               # Shows global context
```

## Test in Project (Local Context)

```bash
cd /tmp
mkdir test-project
cd test-project

# Create some test docs
echo "# API Design" > API_DESIGN.md
echo "# Refactor Plan" > REFACTOR_PLAN.md

source ~/tetra/tetra.sh
tdocs browse

# Should see: [local:test-project 0 {*} ()] [] 0 >
# Context detected as local

context               # Shows local context
ls                    # No docs yet (not indexed)

# Need to manually add docs (Phase 2 will automate this)
init-local            # Already done auto
context global        # Switch to tetra
ls                    # Now sees tetra docs
context local         # Back to project
```

## Why ls "doesn't work" in local

The `ls` command itself works fine. The issue is:

1. **No docs indexed yet** - Local context starts empty
2. **Need scan command** - But scan isn't context-aware yet (Phase 2)
3. **Solution for now** - Use global context to test, or manually add docs

## Next Immediate Fixes Needed

1. **Make scan context-aware** - Scan current directory in local mode
2. **Auto-scan on init** - When creating .tdocs, auto-scan *.md
3. **Better error messages** - "No docs found. Run: scan"

## Simplified User Flow (Target)

```bash
# User navigates to project
cd ~/projects/my-app/src

# Starts REPL
tdocs browse
# Auto-detects local, creates .tdocs, scans *.md

# Lists docs with numbers
ls
#  1. API_DESIGN.md     [W] plan   5KB  1d ago
#  2. REFACTOR.md       [W] notes  3KB  2d ago

# Views doc
view 1

# Quick Q&A with RAG
qa "what's the API change?" 1

# Done!
exit
```

## What You Should Test Now

**Test 1: Context Detection**
```bash
cd /tmp/test && tdocs browse
# Verify prompt shows [local:test ...]

cd $TETRA_SRC && tdocs browse
# Verify prompt shows [global:tetra ...]
```

**Test 2: Context Switching**
```bash
tdocs browse
context              # Show current
context global       # Switch
context local        # Switch back
```

**Test 3: Init Local**
```bash
cd /tmp/test2
init-local
ls -la .tdocs/       # Should see db/, config.json, index.json
```

The foundation is solid! Next step: Make scan context-aware so local docs actually get indexed.
