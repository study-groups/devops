# RAG REPL Quick Start Guide

**Complete reference for RAG REPL status indicators, flow stages, and CDP agent**

---

## Status Line Indicators

When using the "twoline" prompt mode (`/cli twoline`), you'll see status indicators in the top-right:

```
                                              ■⁰ ●¹ ◆⁰ ▲⁰ 1f 316L
[first-flow:NEW] >
```

### What Each Symbol Means

| Symbol | Color  | Meaning              | Description                                |
|--------|--------|----------------------|--------------------------------------------|
| **■**  | Orange | **Pinned Documents** | Core documents pinned to flow (high priority) |
| **●**  | Blue   | **Evidence Files**   | Regular evidence files added to context    |
| **◆**  | Purple | **Selections**       | Line/byte range selections (::100,200)     |
| **▲**  | Teal   | **External Links**   | Symlinked files from outside project       |

The superscript numbers show **count** for each type.

### Additional Stats

- **`Nf`** = Total files in context (e.g., `1f` = 1 file)
- **`NL`** or **`Nk`** = Total lines (e.g., `316L` = 316 lines, `2.5k` = 2,500 lines)

### Symbol Brightness

Symbols **dim** when count is zero and **brighten** as count increases:
- 0 items = nearly invisible (merges with background)
- 1-2 items = dim
- 3-5 items = medium
- 6+ items = bright
- 20+ items = very bright

**To toggle prompt modes:**
```bash
/cli minimal     # Simple > prompt
/cli normal      # [flow:stage] rag> prompt
/cli twoline     # Stats line + flow prompt (shows ■●◆▲)
/cli toggle      # Cycle through modes
```

---

## Flow Stages Explained

Every RAG flow progresses through stages. Each stage has a specific purpose and next action:

### Stage Overview

```
NEW → SELECT → ASSEMBLE → SUBMIT → APPLY → VALIDATE → DONE
                                                         ↓
                                                       FAIL
```

### Stage Details

| Stage      | Color         | What It Means                        | Next Action                           |
|------------|---------------|--------------------------------------|---------------------------------------|
| **NEW**    | Blue          | Flow just created, ready for work    | `/e add <file>` to add evidence       |
| **SELECT** | Purple        | Gathering evidence files             | `/e add <more>`, then `/flow assemble`|
| **ASSEMBLE**| Dark Purple  | Building context from evidence       | `/flow submit` to send to AI          |
| **SUBMIT** | Orange        | Submitting to AI agent               | `/flow apply` to apply changes        |
| **APPLY**  | Bright Orange | Applying AI-suggested changes        | `/flow validate` to test changes      |
| **VALIDATE**| Red          | Running tests & validation           | `/flow fold` or complete              |
| **DONE**   | Green         | Successfully completed               | Start new flow or review              |
| **FAIL**   | Red           | Flow failed (see state.json)         | `/flow resume` to retry               |

### Flow Stage Colors in Prompt

The stage name in your prompt is color-coded:
- `[first-flow:NEW]` = Blue (ready to start)
- `[first-flow:SELECT]` = Purple (gathering evidence)
- `[first-flow:SUBMIT]` = Orange (sending to AI)
- `[first-flow:DONE]` = Green (completed)

---

## Starting the CDP Agent

The CDP (Chrome DevTools Protocol) agent enables browser automation for capturing screenshots, extracting HTML, and interacting with web pages.

### Quick Start - 3 Steps

```bash
# 1. Initialize CDP directories
tetra agent init cdp

# 2. Connect to Chrome (launches automatically if needed)
tetra agent connect cdp

# 3. Start using CDP commands
cdp_navigate "https://example.com"
screenshot=$(cdp_screenshot)
```

### Complete Workflow with RAG Flow

```bash
# 1. Create a new RAG flow
/flow create "Analyze example.com homepage"

# 2. Initialize and connect CDP
tetra agent init cdp
tetra agent connect cdp

# 3. Navigate and capture
cdp_navigate "https://example.com"
screenshot=$(cdp_screenshot)
html=$(cdp_get_html)

# 4. Add artifacts as evidence
/e add "$screenshot"
/e add "$html"

# 5. List evidence to verify
/e list

# 6. Assemble context
/flow assemble

# 7. Cleanup
tetra agent disconnect cdp
```

### Key CDP Commands

| Command                          | Purpose                              |
|----------------------------------|--------------------------------------|
| `tetra agent init cdp`           | Initialize CDP directories           |
| `tetra agent connect cdp`        | Launch/connect to Chrome             |
| `cdp_navigate "url"`             | Navigate to URL                      |
| `cdp_screenshot`                 | Capture screenshot (returns path)    |
| `cdp_get_html`                   | Get full page HTML (returns path)    |
| `cdp_extract "selector"`         | Extract text by CSS selector         |
| `cdp_click "selector"`           | Click element                        |
| `cdp_type "selector" "text"`     | Type into input                      |
| `tetra agent disconnect cdp`     | Disconnect from Chrome               |
| `tetra agent status cdp`         | Check CDP agent status               |

### CDP Artifacts Naming

All CDP artifacts use timestamps for correlation:

```
$TETRA_DIR/cdp/db/
├── 1729180425.cdp.screenshot.png    # Screenshot
├── 1729180425.cdp.page.html         # HTML snapshot
├── 1729180428.cdp.screenshot.png    # Another screenshot
└── 1729180430.cdp.action.json       # Action log
```

### Using CDP in REPL

You can use CDP interactively:

```bash
rag repl

# Inside REPL:
> tetra agent connect cdp
> cdp_navigate "https://example.com"
> screenshot=$(cdp_screenshot)
> /e add "$screenshot"
> /e list
> tetra agent disconnect cdp
```

---

## Common Workflows

### 1. Start a New Flow and Add Evidence

```bash
# Create flow
/flow create "Fix bug in parser"

# Add evidence
/e add core/parser.sh
/e add core/parser.sh::100,200
/e add tests/parser_test.sh

# Check what we have
/e list

# Proceed
/flow assemble
```

### 2. Check Context Size

```bash
# View evidence with sizes
/e list

# Check token budget
/e status

# Toggle off large files if needed
/e toggle 200 off      # Toggle by rank
/e toggle parser off   # Toggle by pattern
```

### 3. Browser Testing with CDP

```bash
# Create flow
/flow create "Document UI bug"

# Start CDP
tetra agent init cdp
tetra agent connect cdp

# Capture before
cdp_navigate "http://localhost:3000"
before=$(cdp_screenshot)

# Interact
cdp_click "button#toggle"
sleep 1

# Capture after
after=$(cdp_screenshot)

# Add evidence
/e add "$before"
/e add "$after"

# Cleanup
tetra agent disconnect cdp

# Continue flow
/flow assemble
```

### 4. View Flow Status

```bash
/flow status    # Current flow details
/flow list      # All flows
/e list         # Evidence files
/e status       # Token budget
```

---

## Troubleshooting

### CDP Not Connecting

```bash
# Check if Chrome is running
curl http://localhost:9222/json/version

# Check agent status
tetra agent status cdp

# Cleanup and reconnect
tetra agent cleanup cdp
tetra agent init cdp
tetra agent connect cdp
```

### Evidence Not Showing

```bash
# Check active flow
/flow status

# List evidence explicitly
/e list

# Verify evidence directory
ls -la "$(get_active_flow_dir)/ctx/evidence/"
```

### Context Too Large

```bash
# Check size
/e status

# Toggle off non-essential files
/e toggle 200-299 off    # Toggle range
/e toggle html off       # Toggle by pattern

# Or remove evidence
/e remove 110
```

### Status Line Not Showing

```bash
# Switch to twoline mode
/cli twoline

# Or toggle through modes
/cli toggle
```

---

## Quick Command Reference

### Flow Commands
```bash
/flow create "description"    # Create new flow
/flow status                  # Show current flow
/flow list                    # List all flows
/flow resume [flow-id]        # Resume a flow
/flow help                    # Detailed flow help
```

### Evidence Commands
```bash
/e add <file>                 # Add evidence
/e add file::100,200          # Add line range
/e add file#tag1,tag2         # Add with tags
/e list                       # List evidence
/e status                     # Check token budget
/e toggle <target> [on|off]   # Toggle evidence
/e remove <target>            # Remove evidence
/e rebase                     # Renumber evidence
```

### CLI Prompt Commands
```bash
/cli minimal                  # Minimal prompt: >
/cli normal                   # Normal: [flow:stage] rag>
/cli twoline                  # Two-line with stats
/cli toggle                   # Cycle modes
```

### System Commands
```bash
/status                       # System status
/help [topic]                 # Help (topics: flow, evidence, cli)
/history list [n]             # Show last n commands
/exit                         # Exit REPL
```

### Shell Commands
```bash
# Run any shell command without / prefix:
ls
cat $e1
grep pattern $e2
diff $e1 $e3
```

---

## Files and Directories

### Flow Structure
```
$TETRA_DIR/rag/flows/
├── active -> first-flow-20251017-143022/    # Symlink to active flow
└── first-flow-20251017-143022/
    ├── state.json                           # Flow state
    ├── events.ndjson                        # Event log
    └── ctx/
        └── evidence/
            ├── 100_parser.evidence.md       # Evidence files
            ├── 110_test.evidence.md
            └── .stats.cache                 # Stats cache
```

### CDP Structure
```
$TETRA_DIR/cdp/
├── db/                                      # Artifacts database
│   ├── {timestamp}.cdp.screenshot.png
│   ├── {timestamp}.cdp.page.html
│   └── {timestamp}.cdp.action.json
├── config/                                  # CDP config
│   └── chrome.pid                           # Chrome process ID
└── logs/                                    # Chrome logs
    └── chrome.log
```

---

## Tips & Best Practices

1. **Use Evidence Variables**: After `/e list`, use `$e1`, `$e2`, etc. to reference files
   ```bash
   cat $e1
   grep error $e2
   diff $e1 $e3
   ```

2. **Check Context Size Early**: Use `/e status` before submitting to avoid token limits

3. **Toggle Off Large Files**: HTML files can be large; toggle them off if not needed
   ```bash
   /e toggle html off
   ```

4. **Use Twoline Mode**: Shows stats at a glance
   ```bash
   /cli twoline
   ```

5. **Always Disconnect CDP**: Prevents orphaned Chrome processes
   ```bash
   tetra agent disconnect cdp
   ```

6. **Use Meaningful Flow Names**: Makes it easier to resume later
   ```bash
   /flow create "Fix login validation bug #123"
   ```

7. **Document Your Process**: Add notes to flow context
   ```bash
   cat >> "$(get_active_flow_dir)/ctx/030_notes.user.md" <<EOF
   # Testing Notes
   - Tested on Chrome 120
   - Bug reproduced consistently
   EOF
   ```

---

## See Also

- **Flow Guide**: `/flow help` - Complete flow workflow guide
- **Evidence Guide**: `/e` - Evidence management help
- **CDP Guide**: `$RAG_SRC/cdp/CDP_RAG_FLOW_GUIDE.md` - Complete CDP examples
- **History**: `/history` - REPL command history

---

**You're ready to use RAG REPL!** 🚀

Start with:
```bash
rag repl
/help
/flow create "My first flow"
```
