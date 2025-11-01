---
category: core
type: index
tags: [org, documentation, tdoc, viewing]
module: org
created: 2025-10-31
updated: 2025-10-31
status: complete
evidence_weight: primary
---

# Reading Org Documentation with tdoc

The org module refactoring documentation can be viewed with **tdoc** (Tetra Documentation Manager) for enhanced formatting, metadata display, and better navigation.

## Quick Start

```bash
# Load tetra and tdoc
source ~/tetra/tetra.sh
tmod load tdoc

# View any document
tdoc view bash/org/TAB_COMPLETION_GUIDE.md
tdoc view bash/org/REFACTORING_NOTES.md
tdoc view bash/org/INTEGRATION_SUMMARY.md
```

## Using the VIEW_DOCS.sh Helper

For convenience, use the included viewer script:

```bash
# Show menu
./bash/org/VIEW_DOCS.sh

# View specific document
./bash/org/VIEW_DOCS.sh 1    # REFACTORING_NOTES.md
./bash/org/VIEW_DOCS.sh 2    # TAB_COMPLETION_GUIDE.md
./bash/org/VIEW_DOCS.sh 3    # INTEGRATION_SUMMARY.md

# List all org documentation
./bash/org/VIEW_DOCS.sh all
```

## Available Documentation

### 1. REFACTORING_NOTES.md
**Type**: Technical Documentation
**Tags**: org, tree, completion, repl, thelp, integration

**Contains**:
- Architecture and design decisions
- File modifications and changes
- Integration points with bash/tree, bash/repl, bash/thelp
- Circular dependency handling
- Implementation details

**View with**:
```bash
tdoc view bash/org/REFACTORING_NOTES.md
# or
./bash/org/VIEW_DOCS.sh 1
```

### 2. TAB_COMPLETION_GUIDE.md
**Type**: User Guide
**Tags**: org, tab-completion, tree, usage, examples

**Contains**:
- How to use tab completion
- Command hierarchy
- Examples for all command types
- Dynamic completions (orgs, envs, files)
- Tips and tricks
- Troubleshooting

**View with**:
```bash
tdoc view bash/org/TAB_COMPLETION_GUIDE.md
# or
./bash/org/VIEW_DOCS.sh 2
```

### 3. INTEGRATION_SUMMARY.md
**Type**: Summary
**Tags**: org, tree, integration, completion, status

**Contains**:
- Status and verification
- What was fixed (tab completion issue)
- Files modified and created
- Testing commands
- Features implemented

**View with**:
```bash
tdoc view bash/org/INTEGRATION_SUMMARY.md
# or
./bash/org/VIEW_DOCS.sh 3
```

### 4. docs/README.md
**Type**: Index
**Tags**: org, documentation, index

**Contains**:
- Documentation overview
- Quick access commands
- Tree structure
- Troubleshooting

**View with**:
```bash
tdoc view bash/org/docs/README.md
# or
./bash/org/VIEW_DOCS.sh 4
```

## tdoc Features

### Color-Coded Display

tdoc renders markdown with syntax highlighting and metadata badges:

```bash
tdoc view bash/org/TAB_COMPLETION_GUIDE.md
```

Shows:
- 🏷️ **Badges**: Category (CORE/OTHER), Type, Module
- 🎨 **Colors**: Headers, code blocks, lists
- 📊 **Metadata**: Tags, status, dates

### Metadata-Only View

See just the document metadata:

```bash
tdoc view bash/org/REFACTORING_NOTES.md --meta-only
```

Output:
```
CORE | refactor | org
Tags: org, tree, completion, repl, thelp, integration
Created: 2025-10-31  Updated: 2025-10-31
Status: complete  Evidence: primary
```

### Paged Viewing

For long documents, use a pager:

```bash
tdoc view bash/org/REFACTORING_NOTES.md --pager
```

### List All Org Documentation

```bash
tdoc list --module org
```

Shows all documents tagged with `module: org`.

### Search Documentation

Find specific topics across all org docs:

```bash
tdoc search "tab completion"
tdoc search "tree integration"
tdoc search "circular dependency"
```

## Document Metadata Schema

Each document has YAML frontmatter:

```yaml
---
category: core          # core = reference, other = working doc
type: guide             # guide, refactor, summary, index
tags: [org, tree, ...]  # Searchable tags
module: org             # Module association
created: 2025-10-31     # Creation date
updated: 2025-10-31     # Last update
status: complete        # draft, complete, deprecated
evidence_weight: primary # primary, secondary, tertiary (for RAG)
---
```

## Integration with RAG

The org documentation is weighted for RAG evidence:

```bash
# When asking RAG about org module
rag "How does org tab completion work?"
```

Documents with `evidence_weight: primary` (like our core docs) will be prioritized in the context.

## Workflow Examples

### Read Before Implementing

```bash
# Start with the summary
tdoc view bash/org/INTEGRATION_SUMMARY.md

# If you need details, read the technical doc
tdoc view bash/org/REFACTORING_NOTES.md

# For usage, read the guide
tdoc view bash/org/TAB_COMPLETION_GUIDE.md
```

### Search for Specific Topics

```bash
# Find all mentions of completion
tdoc search "completion" | grep org

# Find tree-related content
tdoc search "tree structure"
```

### Keep Documentation Current

When making changes:

```bash
# Edit the doc
vim bash/org/TAB_COMPLETION_GUIDE.md

# Update the frontmatter date
# Change: updated: 2025-10-31

# View to verify
tdoc view bash/org/TAB_COMPLETION_GUIDE.md --meta-only
```

## Alternative Viewing Methods

### Without tdoc

Use standard tools if tdoc isn't available:

```bash
# Plain markdown
less bash/org/TAB_COMPLETION_GUIDE.md

# With bat (syntax highlighting)
bat bash/org/REFACTORING_NOTES.md

# With glow (terminal markdown renderer)
glow bash/org/INTEGRATION_SUMMARY.md
```

### With Tree Help

Since org integrates with tree, you can also use tree help:

```bash
source ~/tetra/tetra.sh
tmod load org

# View command help from tree
tree_help_show help.org.list
tree_help_show help.org.import.nh
```

### With thelp

Quick command lookup:

```bash
thelp org.list
thelp org.import.nh
thelp --list org
```

## Summary

**Best for reading full docs**: `tdoc view <file>`
**Best for quick lookup**: `thelp org.<command>`
**Best for search**: `tdoc search <query>`
**Best for listing**: `tdoc list --module org`

All org documentation is:
- ✅ Tagged with metadata
- ✅ Categorized as `core` (stable reference)
- ✅ Module-tagged as `org`
- ✅ Weighted as `primary` for RAG
- ✅ Viewable with tdoc
- ✅ Searchable with tdoc search

---

**Quick Access**:
```bash
./bash/org/VIEW_DOCS.sh         # Interactive menu
tdoc list --module org          # List all docs
tdoc view bash/org/docs/README.md  # Start here
```
