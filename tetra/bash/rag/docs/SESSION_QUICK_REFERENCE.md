# Session Quick Reference

## Hierarchy

```
Session → Flow → Evidence → Answer
  └─ Workspace    └─ Mini inquiry   └─ Context    └─ Result
```

## What is a Session?

A **session** is a workspace containing related flows (mini inquiries).

**Example:**
- Session: "Auth refactor"
  - Flow 1: "How does current auth work?"
  - Flow 2: "What JWT library to use?"
  - Flow 3: "Migration plan"

## Essential Commands

```bash
# Create session
/s create "workspace name"

# List sessions
/s list

# Resume session (by index or ID)
/s resume 1

# Show current session
/s status

# Create flow (auto-added to current session)
/f create "inquiry question"

# Complete flow with outcome
/f complete --outcome success --lesson "what I learned"
```

## Hierarchical Help

```bash
/help              # Overview
/help session      # Session details
/help flow         # Flow details
/help evidence     # Evidence details
```

## Complete Workflow

```bash
# 1. Start workspace
/s create "Auth system investigation"

# 2. First mini inquiry
/f create "How does current auth work?"
/e add src/auth.js
/e add tests/auth_test.js
# ... work through inquiry
/f complete --outcome success

# 3. Second inquiry (same session)
/f create "What JWT library to use?"
# ... investigate
/f complete --outcome partial

# 4. View session progress
/s status
# Shows both flows with outcomes

# 5. Later: resume session
/s list
/s resume 1
```

## Aliases

```
/session  →  /s
/flow     →  /f
/evidence →  /e
/quick    →  /q
```

## Command Summary

| Command | Purpose | Example |
|---------|---------|---------|
| `/s create` | New workspace | `/s create "Auth refactor"` |
| `/s list` | List all sessions | `/s list` |
| `/s resume` | Switch session | `/s resume 1` |
| `/f create` | New inquiry | `/f create "How does X work?"` |
| `/f complete` | Finish inquiry | `/f complete --outcome success` |
| `/e add` | Add context | `/e add file.js::100,200` |

## Tips

- Sessions group related inquiries
- Flows are automatically added to current session
- Use indices for quick resume: `/s resume 1`
- View progress: `/s status` shows all flows
- Keep flows focused (10-30 min)
- Capture outcomes and lessons
