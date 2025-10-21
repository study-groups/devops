# RAG Flow - Quick Reference Card

## Essential Commands

### Flow Commands (use `/f` alias)
```bash
/f help                    # Show beautiful flow guide table
/f create "description"    # Create new flow
/f status                  # Show current flow status
/f list                    # List all flows
/f resume [flow-id]        # Resume a flow
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
| VALIDATE | Red           | `/f fold` or DONE                   |
| DONE     | Green         | Success! Flow complete              |
| FAIL     | Red           | `/f resume` to retry                |

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

## Common Workflow

```bash
# 1. Start
rag repl

# 2. View guide
/f help

# 3. Create flow
/f create "Fix parser bug"

# 4. Add evidence
/e add core/parser.sh::100,200#bug
/e add tests/parser_test.sh

# 5. Verify
/e list
cat $e1

# 6. Check status
/f status

# 7. Continue with flow stages...
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
