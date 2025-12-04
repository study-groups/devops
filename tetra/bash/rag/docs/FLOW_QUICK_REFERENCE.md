# RAG Flow - Quick Reference Card

## What is a Flow?

A **flow** is a **mini inquiry** - a lightweight, focused investigation (typically 10-30 minutes):
- **Question** → **Evidence** → **Answer**
- Not a multi-day project tracker
- Curated context with clear outcome
- Captures lessons learned for future reference

Flows track ephemeral inquiries, not long-running workflows.

## Essential Commands

### Flow Commands (use `/f` alias)
```bash
/f help                    # Show beautiful flow guide table
/f create "description"    # Create new flow (mini inquiry)
/f status                  # Show current flow status
/f list                    # List all flows
/f resume [flow-id]        # Resume a flow
/f complete                # Mark flow complete with outcome
```

### Evidence Commands (use `/e` alias)
```bash
/e add file.sh             # Add whole file
/e add file.sh::100,200    # Add lines 100-200
/e add file.sh#tags        # Add file with tags
/e list                    # List all evidence
/e rebase                  # Renumber evidence files
```

## Flow Stages

| Stage    | Color         | What to Do                          |
|----------|---------------|-------------------------------------|
| NEW      | Blue          | `/e add` to gather evidence         |
| SELECT   | Purple        | `/e add` more, then `/f assemble`   |
| ASSEMBLE | Dark Purple   | `/f submit`                         |
| SUBMIT   | Orange        | `/f apply`                          |
| APPLY    | Bright Orange | `/f validate`                       |
| VALIDATE | Red           | `/f fold` or `/f complete`          |
| DONE ✓   | Green         | Inquiry complete with outcome       |
| DONE ⚠   | Yellow        | Partially successful                |
| DONE ○   | Gray          | Abandoned (recorded for reference)  |
| FAIL ✗   | Red           | Failed, `/f resume` to retry        |

## Completing a Flow

When your inquiry is done, capture the outcome and lessons:

```bash
# Simple completion (defaults to success)
/f complete

# With outcome and metadata
/f complete --outcome success \
            --lesson "Token limit was main constraint" \
            --artifact "build/answer.md" \
            --tag "quick-win" \
            --effort 15

# Outcomes: success | partial | abandoned | failed
```

The flow tracks:
- **Outcome**: How it ended (✓ success, ⚠ partial, ○ abandoned, ✗ failed)
- **Lessons**: What you learned (for future inquiries)
- **Artifacts**: Files produced (answers, patches, notes)
- **Tags**: Semantic labels (bug-fix, refactor, etc.)
- **Effort**: Time spent in minutes

## Evidence Selectors

| Format                  | Meaning                    |
|-------------------------|----------------------------|
| `file.sh`               | Whole file                 |
| `file.sh::100,200`      | Lines 100-200              |
| `file.sh::100`          | From line 100 to EOF       |
| `file.sh::100c,500c`    | Bytes 100-500              |
| `file.sh#tag1,tag2`     | Whole file with tags       |
| `file.sh::100,200#bug`  | Lines 100-200 with tags    |

## Evidence Variables

After adding evidence:
- `$e1` = First evidence file
- `$e2` = Second evidence file
- `$e3` = Third evidence file
- `$e_count` = Total count

Use them: `cat $e1`, `grep pattern $e2`, `diff $e1 $e3`

## Common Workflow (Mini Inquiry)

```bash
# 1. Start
rag repl

# 2. Create mini inquiry
/f create "How does the parser handle edge cases?"

# 3. Add evidence (curated context)
/e add core/parser.sh::100,200#parser
/e add tests/parser_test.sh#test

# 4. Verify evidence
/e list
cat $e1

# 5. Review and iterate
/f status                  # Check current state
# ... add more evidence as needed ...

# 6. Complete with outcome
/f complete --outcome success \
            --lesson "Parser uses recursive descent" \
            --artifact "build/answer.md" \
            --tag "architecture" \
            --effort 20

# Result: Flow:first-inquiry-20251124... ✓ (DONE)
```

## Tips

- Use `/f help` to see the full color-coded guide
- Tab completion works: `/f<TAB>`, `/e<TAB>`
- Evidence stored in: `.rag/flows/active/ctx/evidence/`
- Flow state in: `.rag/flows/active/state.json`
- Your prompt shows current stage with color

## Keyboard Shortcuts

- `Ctrl+P` - Toggle prompt mode
- `TAB` - Auto-complete
- `Ctrl+R` - Search history
- `Ctrl+D` - Exit REPL

## Getting Help

```bash
/help      # General help
/f help    # Full flow guide with table (★ RECOMMENDED)
/e         # Evidence help
/status    # System status
```

---

**Most Important Command**: `/f help` - Shows the beautiful flow guide!
