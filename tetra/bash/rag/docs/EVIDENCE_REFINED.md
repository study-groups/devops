# Refined Evidence System Design

## Philosophy

Evidence is **curated source material with intent and justification**. Unlike raw source files, evidence items explicitly encode:
- **What** - The source content (span)
- **Why** - Justification for inclusion
- **How** - Relationship to other evidence and the task
- **Relevance** - Semantic importance to current flow

## Core Concepts

### Sources vs Evidence

**Source** - Raw material from the codebase
- Neutral, informational content
- Just "what exists"

**Evidence** - Curated selection with purpose
- Intentional, justified inclusion
- "Why this matters for the current task"

### Evidence Hierarchy

```
Source Pool (codebase)
    ↓ selection + justification
Evidence Collection (ctx/evidence/)
    ↓ ranking + filtering
Active Evidence Set
    ↓ assembly
Context (build/prompt.mdctx)
```

## Evidence Metadata Schema

### Core Fields

```yaml
# Required
evidence_id: "100"                    # Unique rank/ID
source_uri: "file://core/flow.sh"     # Where content came from
span: "lines=100:200"                 # What portion
content_digest: "sha256:abc123..."    # Content fingerprint

# Semantic
evidence_type: "bug_investigation"    # What kind of evidence
relevance: "high"                     # How important (high/medium/low)
justification: "Shows auth bypass"    # Why included
tags: ["auth", "security", "bug"]     # Semantic labels

# Relational
relates_to: ["110", "120"]           # IDs of related evidence
supersedes: []                        # Evidence this replaces
context_note: "Line 150 critical"    # Additional context

# Temporal
added: "2025-01-16T14:30:00Z"        # When added
last_used: "2025-01-16T15:00:00Z"    # When last in active set
```

## Evidence Types

### 1. bug_investigation
Evidence showing problematic code
- Tags: bug, error, issue
- Typical justifications: "Shows where X fails", "Demonstrates race condition"

### 2. feature_implementation
Code implementing desired functionality
- Tags: feature, implementation, example
- Typical justifications: "Shows how X is done", "Reference implementation"

### 3. context_definition
Core concepts, interfaces, types
- Tags: interface, type, model, schema
- Typical justifications: "Defines contract for X", "Core abstraction"

### 4. test_specification
Tests showing expected behavior
- Tags: test, spec, behavior
- Typical justifications: "Shows expected behavior", "Test case for X"

### 5. configuration
Config files, settings, parameters
- Tags: config, settings, env
- Typical justifications: "Shows how X is configured", "Environment setup"

### 6. documentation
README, design docs, comments
- Tags: docs, readme, design
- Typical justifications: "Explains architecture", "Design rationale"

### 7. dependency
Required context for understanding other evidence
- Tags: dependency, required, prerequisite
- Typical justifications: "Required to understand E110", "Called by main function"

### 8. example
Usage examples, patterns
- Tags: example, pattern, usage
- Typical justifications: "Example usage of X", "Common pattern"

## Evidence File Format

### Filename Convention
```
<rank>_<descriptive_name>.evidence.md
```

Examples:
- `100_auth_bypass_bug.evidence.md`
- `110_user_authentication_impl.evidence.md`
- `200_auth_test_spec.evidence.md`

### File Structure

```markdown
## Evidence: Authentication Bypass in core/flow.sh

<!--evidence
evidence_id: 100
evidence_type: bug_investigation
source_uri: file://core/flow.sh
span: lines=145:165
content_digest: sha256:abc123...
relevance: high
tags: [auth, security, bug, critical]
relates_to: [110, 120]
justification: |
  Line 150 shows token validation bypassed when user=null.
  authenticate() should reject null users but returns success.
  Critical security issue related to issue #42.
added: 2025-01-16T14:30:00Z
-->

```bash
function authenticate(user, token) {
    if (!token) {
        return false;
    }

    // BUG: Should check user != null here
    if (validateToken(token)) {
        return true;  // Line 150 - bypass!
    }

    return checkUserPermissions(user);
}
```

### Context Note

This function is called from:
- login_handler() in auth.sh:45
- api_middleware() in middleware.sh:23

Related evidence:
- E110: Test showing exploit
- E120: User model definition
```

## Evidence Commands

### Add Evidence

```bash
/e add <source> [options]

Options:
  --type, -t <type>           Evidence type (bug_investigation, etc.)
  --why, -w <text>            Justification for inclusion
  --tags <tag1,tag2>          Semantic tags
  --relates <id1,id2>         Related evidence IDs
  --relevance <high|med|low>  Importance level
  --note <text>               Additional context note
  --rank <number>             Custom rank (default: auto)

Examples:
  /e add core/flow.sh::145,165 \
    --type bug_investigation \
    --why "Shows auth bypass when user=null" \
    --tags auth,security,bug,critical \
    --relates 110,120 \
    --relevance high

  /e add tests/auth_test.sh \
    --type test_specification \
    --why "Test demonstrating the bypass" \
    --tags auth,test \
    --relates 100
```

### List Evidence

```bash
/e list [filter]

Filters:
  --by-type <type>            Show only specific type
  --by-tag <tag>              Show evidence with tag
  --by-relevance <level>      Show by importance
  --related-to <id>           Show related to evidence ID
  --active                    Show only active (not skipped)
  --inactive                  Show only skipped

Examples:
  /e list                     # All evidence
  /e list --by-type bug_investigation
  /e list --by-tag auth
  /e list --related-to 100
  /e list --by-relevance high
```

### Query Evidence

```bash
/e why <id>                   # Show justification
/e related <id>               # Show related evidence
/e context <id>               # Show full metadata
/e graph                      # Visualize relationships

Examples:
  /e why 100                  # Why was this added?
  /e related 100              # What's related?
  /e context 100              # Full metadata
```

### Semantic Search

```bash
/e find <query>               # Semantic search

Query syntax:
  auth                        # Tag match
  auth+bug                    # AND (both tags)
  auth|security               # OR (either tag)
  type:bug_investigation      # By type
  relevance:high              # By relevance
  "shows auth bypass"         # Text search in justification

Examples:
  /e find auth+bug
  /e find type:bug_investigation
  /e find "token validation"
  /e find auth+high
```

### Update Evidence

```bash
/e update <id> [options]

Options:
  --why <text>                Update justification
  --tags <tag1,tag2>          Replace tags
  --add-tags <tag1,tag2>      Add tags
  --remove-tags <tag1,tag2>   Remove tags
  --relates <id1,id2>         Replace relations
  --add-relates <id1,id2>     Add relations
  --relevance <level>         Update importance
  --note <text>               Update context note

Examples:
  /e update 100 --why "Updated: shows null user bypass"
  /e update 100 --add-tags critical
  /e update 100 --add-relates 130
  /e update 100 --relevance high
```

## Evidence Relationships

### Relationship Types

Evidence can relate to other evidence in several ways:

1. **relates_to** - General relationship
   - "These pieces are connected"

2. **depends_on** - Dependency relationship
   - "E100 requires understanding E110"
   - Creates ordering constraint

3. **supports** - Supporting evidence
   - "E110 provides context for E100"
   - "E120 is an example of E100"

4. **contradicts** - Conflicting evidence
   - "E100 and E110 show conflicting patterns"
   - Useful for debugging

5. **supersedes** - Replacement
   - "E100 is newer version of E90"
   - Old evidence can be archived

### Relationship Visualization

```bash
/e graph

Evidence Relationships
═══════════════════════════════════════

[100] auth_bypass_bug
  ├─ supports: [110] auth_test_spec
  ├─ depends_on: [120] user_model_def
  └─ relates_to: [130] middleware_impl

[110] auth_test_spec
  └─ supports: [100] auth_bypass_bug

[120] user_model_def
  ├─ supports: [100] auth_bypass_bug
  └─ supports: [130] middleware_impl
```

## Evidence Lifecycle

### States

1. **draft** - Being prepared, not yet active
2. **active** - Included in context assembly
3. **inactive** - Toggled off (.skip extension)
4. **archived** - Superseded, kept for history
5. **deleted** - Removed from flow

### State Transitions

```bash
/e draft core/flow.sh::100,200    # Create as draft
/e activate 100                   # Draft → Active
/e toggle 100                     # Active ↔ Inactive
/e archive 100                    # Active → Archived
/e delete 100                     # Any → Deleted
/e restore 100                    # Archived → Active
```

## Smart Features

### 1. Relevance Scoring

Evidence gets relevance scores based on:
- Explicitly set relevance (high/medium/low)
- How many other pieces relate to it
- How recently it was used
- Tag overlap with flow context

```bash
/e list --by-score              # Sort by computed score
/e suggest                      # Suggest evidence to toggle off
```

### 2. Dependency-Aware Toggle

```bash
/e toggle 120

Warning: Evidence E100 depends on E120
  Options:
  1. Toggle both E100 and E120 off
  2. Keep E120 active
  3. Cancel

Choose [1/2/3]:
```

### 3. Auto-tagging

Suggest tags based on:
- File path (auth.sh → tag:auth)
- Evidence type
- Content analysis
- Existing tags in related evidence

```bash
/e add core/auth.sh --auto-tag

Suggested tags: auth, security, core
Accept? [Y/n]:
```

### 4. Evidence Templates

Create evidence from templates:

```bash
/e template bug                 # Use bug investigation template
/e template feature             # Use feature implementation template

# Templates prompt for required fields
Evidence Type: bug_investigation
Source File: core/flow.sh
Span (lines): 145,165
Justification: Shows auth bypass when user=null
Tags: auth,security,bug
Related To (IDs): 110,120
```

## Context Assembly with Evidence

### Filtering During Assembly

```bash
/flow assemble [options]

Options:
  --type <types>              Include only these types
  --tags <tags>               Include only these tags
  --min-relevance <level>     Include only high/medium/low+
  --max-evidence <n>          Limit number of evidence items
  --exclude-tags <tags>       Exclude these tags

Examples:
  /flow assemble --type bug_investigation,test_specification
  /flow assemble --tags auth,critical
  /flow assemble --min-relevance high
  /flow assemble --max-evidence 10
```

### Smart Assembly

```bash
/flow assemble --smart

Smart assembly:
1. Includes all high relevance evidence
2. Includes dependencies of included evidence
3. Respects token budget
4. Suggests evidence to exclude if over budget
```

## Implementation Priority

### Phase 1: Core Schema
- [ ] Define evidence metadata structure
- [ ] Implement enhanced evidence_add()
- [ ] Support YAML frontmatter in evidence files
- [ ] Parse and validate metadata

### Phase 2: Semantic Commands
- [ ] Implement /e why, /e related, /e context
- [ ] Implement filtering in /e list
- [ ] Implement /e find semantic search
- [ ] Implement /e update commands

### Phase 3: Relationships
- [ ] Implement relationship tracking
- [ ] Implement dependency detection
- [ ] Implement /e graph visualization
- [ ] Dependency-aware toggle

### Phase 4: Smart Features
- [ ] Relevance scoring
- [ ] Auto-tagging suggestions
- [ ] Evidence templates
- [ ] Smart assembly

## File Changes

### New Files
- `core/evidence_metadata.sh` - Metadata parsing and validation
- `core/evidence_relations.sh` - Relationship tracking
- `core/evidence_search.sh` - Semantic search
- `docs/EVIDENCE_TYPES.md` - Evidence type definitions

### Modified Files
- `core/evidence_selector.sh` - Enhanced evidence_add()
- `core/evidence_manager.sh` - New commands
- `core/assembler.sh` - Smart assembly
- `docs/EVIDENCE_QUICK_REFERENCE.md` - Updated commands

## Example Workflow

```bash
# Create flow for auth bug
/flow create "Fix authentication bypass bug"

# Add bug evidence
/e add core/auth.sh::145,165 \
  --type bug_investigation \
  --why "Shows null user bypass" \
  --tags auth,security,bug,critical \
  --relevance high

# Add supporting test
/e add tests/auth_test.sh::50,75 \
  --type test_specification \
  --why "Test demonstrating exploit" \
  --tags auth,test \
  --relates 100

# Add required context
/e add models/user.sh::20,45 \
  --type context_definition \
  --why "User model definition needed for understanding" \
  --tags auth,model \
  --relates 100,110

# Review what we have
/e list
/e graph

# Check relationships
/e related 100

# Assemble with just critical evidence
/flow assemble --tags critical

# Submit to agent
/flow submit
```

## Migration Notes

### From Old Evidence

Old evidence files without metadata get:
- `evidence_type: "legacy"`
- `relevance: "medium"`
- `justification: "Migrated from old format"`
- Auto-generated tags from filename/path

### Conversion Tool

```bash
/e migrate                      # Convert all old evidence
/e migrate 100                  # Convert specific evidence
```
