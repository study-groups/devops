# RAG Flow Walkthrough - Complete Guide

This guide walks you through the complete evidence-to-flow workflow using the new `/e` and `/f` aliases.

## Prerequisites

1. Start the RAG REPL:
   ```bash
   source ~/tetra/tetra.sh
   cd /path/to/your/project
   rag repl
   ```

## Step-by-Step Workflow

### Step 1: View the Flow Help

The first thing you should do is view the beautiful flow guide:

```bash
/f help
# or
/flow help
```

This will show you:
- A color-coded table of all flow stages
- What each stage means
- What to do next at each stage
- Complete workflow example
- Tips and file locations

### Step 2: Create a New Flow

Create a flow with a descriptive name:

```bash
/f create "Fix bug in parser module"
# or
/flow create "Fix bug in parser module"
```

You'll see:
- Flow ID generated
- Directory structure created
- Next steps suggested

### Step 3: Add Evidence

Use the `/e` alias to add evidence files:

```bash
# Add a whole file
/e add core/parser.sh

# Add specific lines from a file
/e add core/parser.sh::100,200

# Add lines with tags
/e add core/parser.sh::100,200#bug

# Add a test file
/e add tests/parser_test.sh

# Add more context
/e add docs/PARSER.md
```

Evidence selector formats:
- `file.sh` - Whole file
- `file.sh::100,200` - Lines 100-200
- `file.sh::100` - From line 100 to EOF
- `file.sh::100c,500c` - Bytes 100-500 (character mode)
- `file.sh#tag1,tag2` - Whole file with tags
- `file.sh::100,200#bug` - Range with tags

### Step 4: List Evidence

Verify what evidence you've added:

```bash
/e list
# or
/evidence list
```

This shows:
- All evidence files
- Their $e variable names ($e1, $e2, $e3, etc.)
- Source file paths
- Total count

### Step 5: Inspect Evidence (Optional)

You can use the $e variables to inspect evidence:

```bash
# View evidence file
cat $e1

# Search in evidence
grep "function" $e2

# Compare evidence files
diff $e1 $e3

# Count lines
wc -l $e1 $e2 $e3
```

### Step 6: Check Flow Status

See where you are in the flow:

```bash
/f status
# or
/flow status
```

You'll see:
- Flow ID
- Description
- Current stage (with color in prompt)
- Iteration number
- Agent being used
- Context digest
- Last update time
- Directory location

### Step 7: List All Flows (Optional)

See all flows in the project:

```bash
/f list
# or
/flow list
```

Shows:
- All flow IDs
- Their stages
- Descriptions
- Active flow marked with →

### Step 8: Get Help

At any time, you can get help:

```bash
# General help
/help

# Flow-specific help with beautiful table
/f help

# Evidence help
/e

# Main help
/help
```

## Complete Example Session

```bash
# Start REPL
rag repl

# View the flow guide
/f help

# Create a flow
/f create "Fix bug in query parser"

# Add evidence
/e add core/parser.sh::1,50#header
/e add core/parser.sh::200,350#bug-location
/e add tests/test_parser.sh
/e add docs/QUERY_SYNTAX.md

# List evidence to verify
/e list

# Inspect evidence
cat $e1
grep "parse" $e2

# Check status
/f status

# View all flows
/f list

# Get help again if needed
/f help
```

## Tips & Tricks

### 1. Evidence Variables
After adding evidence, you get automatic variables:
- `$e1`, `$e2`, `$e3`, etc. point to evidence files
- `$e_count` contains the total number of evidence files
- Variables are refreshed when you add/remove evidence

### 2. Evidence Organization
- Evidence files are ranked: `100_filename.evidence.md`, `110_filename.evidence.md`
- Use `/e rebase` to renumber them cleanly
- Evidence directory: `.rag/flows/active/ctx/evidence/`

### 3. Flow State Tracking
- State file: `.rag/flows/active/state.json`
- Events log: `.rag/flows/active/events.ndjson`
- View events: `cat .rag/flows/active/events.ndjson | jq`

### 4. Prompt Color Coding
The prompt shows your current stage with colors:
- Blue = NEW (fresh flow)
- Purple = SELECT (gathering evidence)
- Dark Purple = ASSEMBLE (building context)
- Orange = SUBMIT (sending to agent)
- Bright Orange = APPLY (applying changes)
- Red = VALIDATE (running tests)
- Green = DONE (success!)
- Red = FAIL (needs attention)

### 5. Tab Completion
Use TAB to complete:
- Commands: `/f<TAB>` → `/flow`
- Subcommands: `/f cr<TAB>` → `/f create`
- Files: `/e add core/<TAB>` → shows files

### 6. Keyboard Shortcuts
- `Ctrl+P` - Toggle prompt mode (minimal/normal/twoline)
- `Ctrl+R` - Reverse search history
- `Ctrl+D` - Exit REPL
- `TAB` - Auto-complete

## Common Questions

**Q: How do I switch between flows?**
```bash
/f list          # See all flows
/f resume flow-id-123  # Switch to specific flow
```

**Q: How do I add more evidence to an existing flow?**
```bash
/e add new-file.sh    # Just add more evidence
/e list               # Verify it's there
```

**Q: Can I remove evidence?**
```bash
# Currently, manually delete from evidence directory:
rm .rag/flows/active/ctx/evidence/110_*.evidence.md
# Then use /e rebase to renumber
```

**Q: What's the difference between /e and /evidence?**
```bash
# They're identical - /e is just a shortcut
/e add file.sh
/evidence add file.sh  # Same thing
```

**Q: How do I see the full flow process?**
```bash
/f help    # Beautiful color-coded table with all stages
```

## Next Steps

After gathering evidence, you would typically:

1. **Assemble Context**: `/flow assemble` (builds MULTICAT from evidence)
2. **Submit to Agent**: `/flow submit` (sends to AI agent)
3. **Apply Changes**: `/flow apply` (applies agent's changes)
4. **Validate**: `/flow validate` (runs tests)
5. **Complete or Iterate**: Flow becomes DONE or use `/flow fold` to iterate

For the complete flow lifecycle, see `/f help` for the detailed stage table!

## Troubleshooting

**Evidence not adding?**
- Check that flow exists: `/f status`
- Verify file path is correct: `ls -la <file>`
- Check active flow: `ls -la .rag/flows/active`

**Colors not showing?**
- Check `$COLOR_ENABLED` is 1
- Verify color modules loaded: `ls $TETRA_SRC/bash/color/`

**Functions not found?**
- Ensure flow_manager.sh is loaded: `type flow_create`
- Source the module: `source $RAG_SRC/core/flow_manager.sh`
