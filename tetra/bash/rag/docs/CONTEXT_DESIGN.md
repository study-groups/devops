# RAG Context Assembly - Anthropic-Inspired Design

## Philosophy

The RAG system uses Anthropic's message role semantics to structure context:

### Role Hierarchy

1. **System** (`*.system.md`) - Constraints, policies, output contracts
2. **User** (`*.user.md`) - Requests, questions, instructions
3. **Evidence** (`*.evidence.md`) - Code, documentation, relevant files

This mirrors Claude's API message structure where system messages set behavior, user messages provide intent, and evidence acts as extended context.

## Context Assembly Pipeline

```
Evidence Selection → Ranking → Toggle → Assembly → Submission
     (ULM)        (rank_)   (active)  (mdctx)   (agent)
```

### 1. Evidence Selection

**Selector Format:** `file[::range][#tags]`

Examples:
- `core/flow.sh` - Whole file
- `core/flow.sh::100,200` - Lines 100-200
- `core/flow.sh::100` - From line 100 to EOF
- `core/flow.sh::100c,500c` - Bytes 100-500
- `core/flow.sh#flow,manager` - Whole file with tags
- `core/flow.sh::100,200#bug` - Range with tags

### 2. Evidence Files

**Naming Convention:** `<rank>_<kind>.<role>.md`
- `rank` - 3-digit number for ordering (100, 110, 120...)
- `kind` - Descriptive name (filename with sanitization)
- `role` - One of: system, user, evidence

**Metadata:** HTML comments preserve provenance
```markdown
## Evidence: core/flow.sh
<!-- source_uri=file://core/flow.sh; cid=sha256:abc123...; span=lines=100:200; tags=flow,manager -->
```

### 3. Evidence States

Evidence can be in three states:

1. **Active** - `*.evidence.md` - Included in context assembly
2. **Inactive** - `*.evidence.md.skip` - Excluded from assembly
3. **Linked** - `*.evidence.link` - Symlink (auto-updates, always active)

### 4. Context Variables

After assembly, evidence is accessible via shell variables:

- `$e1`, `$e2`, `$e3` - Individual evidence files by rank
- `$EVIDENCE_COUNT` - Total number of evidence files
- `$FLOW_DIR/build/prompt.mdctx` - Assembled context
- `$FLOW_DIR/build/ctxplan.json` - Assembly plan with metadata

## Context Budget Management

### Token Estimation

- Rough: 1 token ≈ 4 bytes
- Use `plan_ctx` for dry-run preview
- `ctxplan.json` tracks exact byte counts per part

### Ranking Strategy

Evidence ranks determine assembly order:

- `000-099` - System messages (policies, constraints)
- `100-199` - Critical evidence (core functionality)
- `200-299` - Supporting evidence (tests, docs)
- `300-399` - Peripheral evidence (examples, config)
- `400-499` - Optional context (related files)

### Toggle Strategy

Use evidence toggling to stay within token budgets:

```bash
# Disable peripheral evidence
/evidence toggle off 300-399

# Re-enable specific evidence
/evidence toggle on 300_example

# List toggle state
/evidence status
```

## Assembly Process

### Input: ctx/ directory structure

```
ctx/
├── 000_policy.system.md
├── 010_request.user.md
└── evidence/
    ├── 100_flow_sh.evidence.md
    ├── 110_assembler_sh.evidence.md
    ├── 200_test_flow_sh.evidence.md.skip  # Skipped
    └── 300_example.evidence.link → /path/to/file
```

### Output: build/prompt.mdctx

```markdown
<!-- mdctx:version=1.0; flow_id=fix-parser-20250116T123456; assembly=lexical -->

# System

[Contents of 000_policy.system.md]

# User Request

[Contents of 010_request.user.md]

## Evidence: core/flow.sh
<!-- source_uri=file://ctx/evidence/100_flow_sh.evidence.md; cid=sha256:... -->

[Contents of 100_flow_sh.evidence.md]

## Evidence: core/assembler.sh
<!-- source_uri=file://ctx/evidence/110_assembler_sh.evidence.md; cid=sha256:... -->

[Contents of 110_assembler_sh.evidence.md]
```

### Output: build/ctxplan.json

```json
{
  "version": "1.0",
  "flow_id": "fix-parser-20250116T123456",
  "order_rule": "lexical",
  "parts": [
    {
      "rank": "000",
      "kind": "policy",
      "role": "system",
      "uri": "file://ctx/000_policy.system.md",
      "cid": "sha256:abc123...",
      "bytes": 234,
      "status": "active"
    },
    {
      "rank": "100",
      "kind": "flow_sh",
      "role": "evidence",
      "uri": "file://ctx/evidence/100_flow_sh.evidence.md",
      "cid": "sha256:def456...",
      "bytes": 1523,
      "status": "active"
    },
    {
      "rank": "200",
      "kind": "test_flow_sh",
      "role": "evidence",
      "uri": "file://ctx/evidence/200_test_flow_sh.evidence.md",
      "cid": "sha256:ghi789...",
      "bytes": 892,
      "status": "skipped"
    }
  ],
  "total_bytes": 1757,
  "ctx_digest": "sha256:xyz789..."
}
```

## Interactive Context Management

### Asking Questions About Context

```bash
# What's currently loaded?
/evidence status

# Show assembly plan
/evidence plan

# Show token budget
/evidence budget

# Inspect specific evidence
cat $e1
grep "function" $e2
diff $e1 $e3
```

### Grooming Evidence

```bash
# Renumber evidence files (fill gaps)
/evidence rebase

# Change rank
/evidence rank 100_flow_sh 50  # Move to higher priority

# Toggle individual files
/evidence toggle 200_test_flow_sh

# Toggle by range
/evidence toggle off 300-399

# Remove evidence
/evidence remove 400_example
```

### Context Visibility

Each command should provide feedback:

```
✓ Added evidence: 100_flow_sh.evidence.md
  Bytes: 1523 (~380 tokens)
  Total context: 5234 bytes (~1308 tokens)
  Budget: 13% of 10000 token limit
```

## Advanced Features

### Evidence Queries

Use questions to find relevant evidence:

```bash
# Ask about context
/ask "What evidence covers error handling?"
→ Shows: 110_error_handler_sh.evidence.md, 250_test_errors_sh.evidence.md

# Ask about gaps
/ask "What's missing for authentication?"
→ Suggests: auth/ directory files not yet in evidence

# Ask about redundancy
/ask "What evidence is redundant?"
→ Flags: Similar content in multiple evidence files
```

### Smart Toggle

```bash
# Toggle based on relevance
/evidence focus "error handling"
→ Disables evidence not matching query, keeps relevant active

# Restore full context
/evidence focus off
```

### Evidence Dependencies

Track which evidence is referenced:

```bash
/evidence deps 100_flow_sh
→ Shows: Referenced by 110_assembler_sh.evidence.md:42
→ Shows: Calls functions in 120_state_manager_sh.evidence.md
```

## Implementation Notes

### File Operations

- Rename `.md` → `.md.skip` to deactivate
- Rename `.md.skip` → `.md` to reactivate
- Re-run `assemble_ctx` after toggling
- Update `ctxplan.json` with status field

### Variable Initialization

`init_evidence_vars()` scans evidence directory:

```bash
export EVIDENCE_COUNT=5
export e1="$FLOW_DIR/ctx/evidence/100_flow_sh.evidence.md"
export e2="$FLOW_DIR/ctx/evidence/110_assembler_sh.evidence.md"
export e3="$FLOW_DIR/ctx/evidence/120_state_manager_sh.evidence.md"
# ...
```

### Assembly Filtering

`assemble_ctx()` skips `.skip` files:

```bash
while IFS= read -r -d '' file; do
    # Skip .skip files
    [[ "$file" =~ \.skip$ ]] && continue
    parts+=("$file")
done < <(find "$ctx_dir" -name "*.md" -type f -print0 | sort -z)
```
