# TDOCS - Tetra Document System

A TCS 3.0-compliant Tetra module for managing and categorizing LLM-generated markdown documentation with color-coded previews, interactive tagging, and RAG evidence integration.

## Features

- **Authority-Based Taxonomy** - Grade documents by authority level (canonical, established, working, ephemeral)
- **Color-Coded Previews** - Beautiful markdown rendering using TDS (Tetra Display System)
- **Interactive Tagging** - Easy tag management with visual color feedback
- **Timestamp Database** - TCS 3.0-compliant timestamped metadata storage
- **RAG Integration** - Provides weighted evidence lists to improve RAG query context
- **Auto-Detection** - Suggests metadata based on filename, location, and content
- **Module-Aware** - Automatically detects and organizes module-specific documentation
- **Specification Tracking** - Track module specifications and completeness levels
- **Temporal Classification** - Auto-identifies temporal documents for archival

## Installation

The tdocs module is part of the Tetra system. Source it via:

```bash
source $TETRA_SRC/bash/tdocs/includes.sh
```

Or let the Tetra module system auto-discover it.

## Quick Start

### Initialize a Document

```bash
# Interactive mode (recommended for first-time use)
tdocs init bash/rag/docs/NEW_FEATURE.md

# Non-interactive mode
tdocs init docs/API_SPEC.md --core --type spec
```

### View a Document

```bash
# Color preview with metadata
tdocs view bash/rag/docs/REPL_FIXES_20251016.md

# With pager
tdocs view --pager docs/guide.md

# Metadata only
tdocs view --meta-only report.md
```

### List Documents

```bash
# All documents
tdocs ls

# Core documents only
tdocs ls --core

# By module
tdocs ls --module rag

# By tags
tdocs ls --tags bug-fix,repl

# With metadata preview
tdocs ls --preview
```

### Interactive Tagging

```bash
tdocs tag bash/rag/docs/REPL_FIXES_20251016.md
```

Interactive editor allows adding/removing tags with color preview:

```
┌─ Tag Editor: REPL_FIXES_20251016.md
│
│ Category: [other]  Type: [bug-fix]
│ Module: [rag]
│
│ Current tags:
│   ◆ bug-fix  ◆ rag  ◆ repl  ◆ 2025-10-16
│
│ Commands:
│   +<tag>  - Add tag
│   -<tag>  - Remove tag
│   done    - Save and exit
└─

Command: +completion
```

### Search

```bash
# Full-text search
tdocs search "bash completion"

# Get evidence for RAG
tdocs evidence "repl history system"

# Primary evidence only (core docs)
tdocs evidence --primary "tetra architecture"
```

### Module Commands

```bash
# Show all documentation for a module
tdocs module tubes

# View module specification
tdocs spec tubes

# Audit all module specifications
tdocs audit-specs

# Show only modules without specifications
tdocs audit-specs --missing
```

### Audit

```bash
# Find documents without metadata
tdocs audit

# Rebuild indexes
tdocs index --rebuild
```

## Document Taxonomy

### Authority Levels

TDOCS uses an authority-based classification for documentation retrieval:

**CANONICAL** (Evidence Weight: 1.0)
- System-wide standards and specifications (TCS, TAS, TRS, etc.)
- Core architectural documentation
- Manually curated, strictly version controlled
- Location: `$TETRA_SRC/docs/reference/`, `/specifications/`

**ESTABLISHED** (Evidence Weight: 0.8)
- Module specifications and integration guides
- Stable API references and contracts
- Proven patterns and best practices
- Location: Module docs marked as `--core`

**WORKING** (Evidence Weight: 0.5)
- Active development documentation
- Implementation summaries
- Module-local guides
- Location: `bash/<module>/docs/` (non-core)

**EPHEMERAL** (Evidence Weight: 0.2)
- Temporal documents (bug fixes, investigations)
- Session-specific LLM responses
- Time-sensitive implementation notes
- Automatically tagged for archival

This gradient replaces the binary "core/other" distinction with a continuous authority scale that better reflects document reliability for RAG evidence ranking.

### Document Types

**System Types** (auto-detected):
- `standard` - System-wide standards (TCS, TAS, TRS, etc.)
- `specification` - Module specifications (e.g., TUBES_SPECIFICATION.md)
- `example` - Integration examples (e.g., TUBES_INTEGRATION_EXAMPLE.md)

**Core Types**:
- `spec` - Specifications and contracts
- `guide` - How-to guides and tutorials
- `reference` - API references and lookups

**Temporal Types** (auto-detected for archival):
- `temporal` - Time-sensitive documents (bug fixes, refactors, summaries, etc.)
- `plan` - Planning documents
- `investigation` - Problem analysis

### Tags

Tags are free-form but follow conventions:

**Temporal Tags**: `YYYY-MM-DD` format (auto-detected from filenames)

**Purpose Tags**: `bug-fix`, `refactor`, `plan`, `summary`, `investigation`

**Scope Tags**: Module names (`rag`, `tsm`, `tmod`), feature areas

**Custom Tags**: Any descriptive tags relevant to the document

## Metadata Schema

Documents can have YAML frontmatter:

```yaml
---
category: other
type: specification
tags: [architecture, tubes, level-4]
module: tubes
completeness_level: 4
implements: [TCS, TAS, TRS]
integrates: [rag, tdocs, tmod]
created: 2025-10-16
updated: 2025-10-16
status: stable
evidence_weight: primary
---
```

**New Module-Aware Fields**:
- `completeness_level` - 0 (None) to 4 (Exemplar)
- `implements` - Array of standards implemented (TCS, TAS, etc.)
- `integrates` - Array of modules integrated with

## Database Structure

TCS 3.0-compliant timestamp-based database:

```
$TETRA_DIR/tdocs/
├── db/
│   ├── 1760229927.meta       # JSON metadata
│   ├── 1760229927.tags       # Tag list (for grep)
│   └── ...
├── config/
└── cache/
```

Each `.meta` file contains:

```json
{
  "timestamp": 1760229927,
  "doc_path": "/path/to/doc.md",
  "category": "core",
  "type": "specification",
  "tags": ["architecture", "tubes", "level-4"],
  "module": "tubes",
  "evidence_weight": "primary",
  "created": "2025-10-16T03:40:00Z",
  "updated": "2025-10-16T03:40:00Z",
  "status": "stable",
  "hash": "abc123...",
  "completeness_level": "4",
  "implements": ["TCS", "TAS", "TRS"],
  "integrates": ["rag", "tdocs", "tmod"]
}
```

## RAG Integration

### Evidence Provider

tdocs provides weighted document lists to RAG queries:

```bash
# In RAG module
tdocs evidence "bash completion system"
```

Output:

```
1.0 /path/to/Tetra_Core_Specification.md [core/spec] ["architecture", "core"]
0.7 /path/to/bash/rag/docs/REPL_FIXES_20251016.md [other/bug-fix] ["bug-fix", "completion"]
0.5 /path/to/bash/rag/docs/HISTORY_COMPLETION_GUIDE.md [other/guide] ["guide", "completion"]
```

### Integration Example

```bash
# In bash/rag/core/evidence_selector.sh
local doc_list=$(tdocs evidence "$query" --tags "${relevant_tags}")

# Use doc_list as evidence for RAG context assembly
for doc in $doc_list; do
    # Extract path and weight
    # Add to evidence bundle
done
```

## Color System

tdocs uses TDS (Tetra Display System) for color-coded output:

- **Category badges**: Blue (CORE), Orange (OTHER)
- **Type tags**: Semantic colors based on type
- **Status indicators**: Green (stable), Gray (draft), Red (deprecated)
- **Module tags**: Accent colors
- **Markdown rendering**: Full TDS semantic color tokens

## TUI Integration

Minimal read-only actions for demo 014:

- `list:docs` - List core documentation
- `view:doc` - Preview document with colors
- `list:module_docs` - List module-specific docs
- `search:docs` - Search documentation

## CLI Reference

```
tdocs init <file> [OPTIONS]       Initialize document with metadata
tdocs view <file> [OPTIONS]       Preview with color rendering
tdocs tag <file>                  Interactive tag editor
tdocs ls [OPTIONS]                List documents
tdocs search <query>              Full-text search
tdocs evidence <query> [OPTIONS]  Get evidence list for RAG
tdocs audit                       Find docs without metadata
tdocs discover [--auto-init]      Discover undocumented files
tdocs index [--rebuild]           Manage indexes
tdocs module <name>               Show all docs for a module
tdocs spec <module>               View module specification
tdocs audit-specs [--missing]     Audit module specifications
tdocs browse                      Launch interactive REPL
tdocs help                        Show help
```

## Completeness Levels

Modules are tracked with completeness levels 0-4:

- **L0 - None**: No documentation or basic files only
- **L1 - Minimal**: Basic README, minimal docs
- **L2 - Working**: Functional with basic integration
- **L3 - Complete**: Full documentation, tests, examples
- **L4 - Exemplar**: Gold standard with specifications, examples, full integration

## Module Interface

tdocs implements the standard Tetra module interface:

```bash
tdoc_module_init()        # Initialize module
tdoc_module_actions()     # List available actions
tdoc_module_properties()  # List managed properties
tdoc_module_info()        # Show module status
```

## Dependencies

- **TDS** (`bash/tds/`) - For color rendering
- **Tetra Color System** (`bash/color/`) - Via TDS
- **Bash 5.2+** - For associative arrays
- **Standard Unix tools** - grep, sed, awk, date, shasum

## Examples

### Example 1: Document a Bug Fix

```bash
# Create fix document
vim bash/rag/docs/COMPLETION_FIX_20251017.md

# Initialize with metadata
tdocs init bash/rag/docs/COMPLETION_FIX_20251017.md

# Interactive prompts:
# Category: other
# Type: bug-fix (auto-detected)
# Tags: bug-fix,rag,completion,2025-10-17 (suggested)
# Module: rag (auto-detected)

# View result
tdocs view bash/rag/docs/COMPLETION_FIX_20251017.md
```

### Example 2: Add Core Specification

```bash
# Create spec
tdocs init docs/reference/Module_System_Spec.md \
  --core \
  --type spec \
  --tags architecture,modules,tcs-3.0

# Verify
tdocs ls --core
```

### Example 3: Find Related Docs for RAG Query

```bash
# Get evidence for a query
tdocs evidence "tab completion" --tags rag

# Outputs weighted list of relevant docs
# Use in RAG context assembly
```

## Best Practices

1. **Initialize early** - Run `tdocs init` on new docs immediately
2. **Use auto-detection** - Let tdocs suggest metadata in interactive mode
3. **Tag consistently** - Use established tag conventions
4. **Authority levels** - Grade documents by their authority (canonical > established > working > ephemeral)
5. **Update regularly** - Use `tdocs audit` to find missing metadata
6. **Rebuild indexes** - Run `tdocs index --rebuild` after bulk changes

## Troubleshooting

**No color output?**
- Check TDS is loaded: `echo $TDS_LOADED`
- Source TDS: `source $TETRA_SRC/bash/tds/tds.sh`

**Metadata not found?**
- Run `tdocs audit` to find untracked docs
- Check database: `ls $TETRA_DIR/tdocs/db/`

**Search not working?**
- Rebuild index: `tdocs index --rebuild`
- Check permissions on `$TETRA_DIR/tdocs/`

## Version

tdocs 1.0.0 - TCS 3.0 Compliant

## License

Part of the Tetra system.
