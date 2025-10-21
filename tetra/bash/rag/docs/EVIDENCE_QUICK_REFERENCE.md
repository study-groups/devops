# Evidence Management - Quick Reference

## Overview

The RAG system provides interactive evidence management with Anthropic-inspired semantics. Evidence files form the context that gets assembled and sent to AI agents.

## Evidence Commands

### `/e add` - Add Evidence

Add files or file ranges to your flow context.

**Syntax:** `/e add <file[::range][#tags]>`

**Examples:**
```bash
/e add core/flow.sh                      # Whole file
/e add core/flow.sh::100,200             # Lines 100-200
/e add core/flow.sh::100                 # From line 100 to EOF
/e add core/flow.sh::100c,500c           # Bytes 100-500
/e add core/flow.sh#flow,manager         # Whole file with tags
/e add core/flow.sh::100,200#important   # Range with tags
```

**Feedback:**
```
✓ Added evidence: 100_flow_sh.evidence.md
  Range: lines=100:200
  Tags: important
```

### `/e list` - List Evidence

Show all evidence files with status, sizes, and variables.

**Syntax:** `/e list`

**Output:**
```
Evidence Files
═══════════════════════════════════════════════════════════════

✓ $e1  [100] flow_sh                                       1523 bytes (~380 tokens)
✓ $e2  [110] assembler_sh                                  2341 bytes (~585 tokens)
○      [200] test_flow_sh                                   892 bytes (skipped)
✓ $e3  [300] readme_md                                      456 bytes (~114 tokens)

───────────────────────────────────────────────────────────────
Active: 3 files, 4320 bytes (~1080 tokens)
Skipped: 1 files, 892 bytes (~223 tokens)
Total: 4 files, 5212 bytes (~1303 tokens)

Use evidence variables: cat $e1, grep pattern $e2, diff $e1 $e3
```

**Key Features:**
- ✓ = Active evidence (included in context)
- ○ = Skipped evidence (excluded from context)
- `$e1, $e2, $e3` = Shell variables for easy access

### `/e status` - Context Budget

Show full context breakdown with token budget visualization.

**Syntax:** `/e status [token_limit]`

**Output:**
```
Context Status
═══════════════════════════════════════════════════════════════

System:   234 bytes (~58 tokens)
User:     187 bytes (~46 tokens)
Evidence: 4320 bytes (~1080 tokens) - active
Skipped:  892 bytes (~223 tokens)

───────────────────────────────────────────────────────────────
Active:   4741 bytes (~1185 tokens)

Token Budget: 1185 / 10000 tokens (11%)
[█████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]

```

**Budget Indicators:**
- Green: < 50% of budget
- Orange: 50-80% of budget
- Red: > 80% of budget
- ⚠ Warning at > 90%

### `/e toggle` - Toggle Evidence

Enable/disable evidence files in context.

**Syntax:** `/e toggle <target>`

**Targets:**
- By rank: `/e toggle 100`
- By pattern: `/e toggle flow_sh`
- By range: `/e toggle 200-299`

**Examples:**
```bash
/e toggle 200_test        # Disable test file
○ Skipped: 200_test_flow_sh.evidence.md

/e toggle 200_test        # Re-enable test file
✓ Activated: 200_test_flow_sh.evidence.md

/e toggle 300-399         # Disable entire range
Toggled 5 files in range 300-399
```

**Use Cases:**
- Stay within token budgets
- Focus on relevant evidence
- Temporarily exclude large files
- Test different context combinations

### `/e remove` - Remove Evidence

Permanently delete evidence files.

**Syntax:** `/e remove <target>`

**Example:**
```bash
/e remove 400_example
✗ Removed: 400_example_config.evidence.md
```

### `/e rebase` - Renumber Evidence

Renumber evidence files sequentially with consistent spacing.

**Syntax:** `/e rebase`

**Output:**
```
Rebasing evidence files...
  105 -> 100: flow_sh.evidence.md
  117 -> 110: assembler_sh.evidence.md
  243 -> 120: state_manager_sh.evidence.md

Rebase complete! 3 files renumbered.
```

**When to Use:**
- After removing files (to fill gaps)
- When rank numbers become inconsistent
- To create space for new evidence

## Working with Evidence Variables

After adding evidence, use shell variables for quick access:

```bash
# View evidence
cat $e1

# Search within evidence
grep "function" $e2

# Compare evidence files
diff $e1 $e3

# Count lines
wc -l $e1 $e2 $e3

# Use in loops
for file in $e1 $e2 $e3; do
    echo "=== $(basename $file) ==="
    head -20 "$file"
done
```

## Asking Questions About Context

### Current Context
```bash
/e list           # What's loaded?
/e status         # How much context am I using?
```

### Toggle Strategy
```bash
/e status         # Check token usage
/e toggle 300-399 # Disable peripheral evidence
/e status         # Verify reduction
/e list           # See what's active
```

### Context Assembly
```bash
/e list           # Review evidence
/e rebase         # Clean up numbering
/flow assemble    # Build context
```

## Evidence States

Evidence files exist in three states:

1. **Active** - `*.evidence.md`
   - Included in context assembly
   - Accessible via $e variables
   - Shown with ✓ in listings

2. **Skipped** - `*.evidence.md.skip`
   - Excluded from context assembly
   - Not in $e variables
   - Shown with ○ in listings

3. **Linked** - `*.evidence.link`
   - Symlinks to external files
   - Auto-updates when source changes
   - Always active (cannot skip)

## Evidence Ranking

Evidence ranks control assembly order:

- `000-099` - System context (policies, constraints)
- `100-199` - Critical evidence (core functionality)
- `200-299` - Supporting evidence (tests, docs)
- `300-399` - Peripheral evidence (examples, config)
- `400-499` - Optional context (related files)

**Strategy:** Start with low ranks for critical files, higher ranks for supporting material. Toggle off high-rank evidence to stay within budget.

## Anthropic-Inspired Design

The evidence system mirrors Claude's API structure:

### Role Hierarchy

1. **System** (`*.system.md`) - Sets constraints and behavior
   - `000_policy.system.md` - Output contract, constraints

2. **User** (`*.user.md`) - Provides intent and requests
   - `010_request.user.md` - What you want to accomplish

3. **Evidence** (`*.evidence.md`) - Extended context
   - Code files, documentation, test files
   - Ranked by importance
   - Togglable to manage budget

### Metadata

Evidence files preserve provenance:

```markdown
## Evidence: core/flow.sh
<!-- source_uri=file://core/flow.sh; cid=sha256:abc123...; span=lines=100:200; tags=flow,manager -->

```bash
# ... file content ...
\`\`\`
```

### Assembly Process

```
Select → Rank → Toggle → Assemble → Submit
  (add)  (100+)  (skip)   (mdctx)   (agent)
```

## Tips & Best Practices

### 1. Start Focused, Expand Gradually
```bash
# Add core files first
/e add core/flow.sh
/e add core/assembler.sh

# Check context usage
/e status

# Add supporting files
/e add tests/test_flow.sh
/e add docs/README.md
```

### 2. Use Ranges for Relevant Code
```bash
# Don't include entire files when you need specific sections
/e add core/flow.sh::45,150#flow_create
/e add core/assembler.sh::85,160#assemble_ctx
```

### 3. Tag Everything
```bash
# Tags help you remember why evidence was added
/e add config/app.yaml#config,prod
/e add lib/auth.sh::100,250#auth,security,bug
```

### 4. Monitor Your Budget
```bash
# Check before adding large files
/e status

# Add the file
/e add large_file.js

# Check again
/e status

# Toggle off if needed
/e toggle large_file
```

### 5. Iterate on Context
```bash
# Try with core evidence
/e list
/flow assemble
/flow submit

# If agent needs more context
/e add additional_file.sh
/flow assemble
/flow submit
```

### 6. Clean Up After Flows
```bash
# Remove unnecessary evidence
/e remove 400_example

# Renumber for next flow
/e rebase

# Or start fresh
/flow create "New task"
```

## Advanced Patterns

### Focus Mode (Manual)
```bash
# Disable all non-critical evidence
/e toggle 200-499

# Re-enable specific files
/e toggle 250_important_test

# Check what's active
/e list
```

### Evidence Dependencies (Manual)
```bash
# When one file references another, add both
/e add core/flow.sh#main
/e add core/state_manager.sh#dependency

# Note dependencies in tags
/e add lib/utils.sh#utils,required-by-flow
```

### Progressive Loading
```bash
# Start minimal
/e add core/main.sh

# Submit and get feedback
/flow assemble && /flow submit

# Agent says "need to see the config"
/e add config/app.yaml

# Reassemble and resubmit
/flow assemble && /flow submit
```

## Troubleshooting

### Evidence not showing in $e variables
```bash
# Refresh variables
/e list  # This automatically refreshes
```

### Context too large
```bash
# Check status
/e status

# Toggle off peripheral evidence
/e toggle 300-499

# Or use ranges instead of full files
/e remove 100_large_file
/e add large_file.sh::1,100#just-the-important-part
```

### Lost track of what's in context
```bash
# Full status
/e list
/e status

# Review assembled context
cat $FLOW_DIR/build/prompt.mdctx
```

### Need to reorder evidence
```bash
# Remove and re-add with desired rank
/e remove 150_file
/e add file.sh  # Will get next available rank

# Or rebase to clean up
/e rebase
```

## Integration with Flow

Evidence integrates with the full RAG flow:

```bash
# 1. Create flow
/flow create "Fix authentication bug"

# 2. Add evidence
/e add lib/auth.sh::100,250#auth,bug
/e add tests/test_auth.sh#test
/e add config/auth.yaml#config

# 3. Review context
/e list
/e status

# 4. Toggle if needed
/e toggle 300_config

# 5. Assemble context
/flow assemble

# 6. Submit to agent
/flow submit
```

## Summary

Evidence management gives you:

✓ **Visibility** - See what's loaded, how much context, token usage
✓ **Control** - Toggle files in/out, manage budget
✓ **Feedback** - Clear confirmation of actions, state changes
✓ **Interactivity** - Ask questions, check status, iterate on context
✓ **Anthropic-inspired** - Role-based structure (system/user/evidence)

Use `/e` commands to build, explore, and refine your context before sending to AI agents.
