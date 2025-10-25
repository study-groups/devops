# MELVIN

**M**achine **E**lectronics **L**ive **V**irtual **I**ntelligence **N**etwork

MELVIN is tetra's meta-agent for understanding the codebase through precise classification and accounting. MELVIN never misses.

## Purpose

MELVIN helps users understand the "tetra way" by:
- Classifying bash directories into Libraries, Modules, Apps
- Generating health reports and statistics
- Explaining modules in detail
- Tracking tetra patterns and conventions
- Providing intelligent knowledge refresh based on usage

## Quick Start

```bash
# Source tetra first
source ~/tetra/tetra.sh

# Load MELVIN
source "$TETRA_SRC/bash/melvin/includes.sh"

# Get health summary
melvin health summary

# Explain a module
melvin explain rag

# Interactive REPL
melvin repl
```

## Classification Taxonomy

MELVIN classifies bash directories using these rules:

| Type | Detection Rule | Description |
|------|----------------|-------------|
| **LIBRARY** | `includes.sh` only | Pure library (no actions, no TUI) |
| **MODULE** | `actions.sh` exists | Module with actions (usually has REPL) |
| **APP** | `*_tui.sh` exists | TUI application |
| **APP+MODULE** | Both actions and TUI | Both app and module |
| **UNKNOWN** | Doesn't match patterns | Unclassified directory |

## Commands

### Health Check
```bash
melvin health                    # Summary counts
melvin health summary            # Same as above
melvin health unclassified       # List unknown directories
melvin health full               # Full report
melvin health rag                # Detailed report for bash/rag
```

### Module Analysis
```bash
melvin explain rag               # Deep analysis of bash/rag
melvin classify rag              # Show classification reasoning
melvin list MODULE               # List all modules
melvin list LIBRARY              # List all libraries
```

### Knowledge Management
```bash
melvin concepts                  # Show tetra patterns
melvin refresh                   # Rescan codebase
melvin stats                     # Usage statistics
```

### Interactive Mode
```bash
melvin repl                      # Start MELVIN REPL
```

## REPL Commands

Inside the MELVIN REPL:

```
melvin> help                     # Show help
melvin> health summary           # Classification counts
melvin> explain rag              # Analyze bash/rag
melvin> list MODULE              # List modules
melvin> concepts                 # Tetra patterns
melvin> stats                    # Usage stats
melvin> refresh                  # Rebuild knowledge
melvin> exit                     # Exit REPL
```

## The Tetra Way

MELVIN teaches these core patterns:

### 1. Strong Globals
```bash
TETRA_SRC         # Must be set - source root
MOD_SRC           # $TETRA_SRC/bash/modname
MOD_DIR           # $TETRA_DIR/modname (runtime)
```

### 2. Module Structure
- **Library**: `includes.sh` only
- **Module**: Has `actions.sh` (usually has REPL)
- **App**: Implements TUI

### 3. Lazy Loading
```bash
# In boot_modules.sh
tetra_register_module "modname" "$TETRA_BASH/modname"
tetra_create_lazy_function "func_name" "modname"
```

### 4. Includes Pattern
```bash
# bash/modname/includes.sh
: "${MOD_SRC:=$TETRA_SRC/bash/modname}"
: "${MOD_DIR:=$TETRA_DIR/modname}"
export MOD_SRC MOD_DIR
source "$MOD_SRC/modname.sh"
```

### 5. REPL Pattern
- Bash 5.2+ always
- Always starts: `source ~/tetra/tetra.sh`
- Interactive command interfaces

## Usage Tracking

MELVIN tracks queries to determine when to refresh:

- **Logs**: `$TETRA_DIR/melvin/stats.jsonl`
- **Metrics**: Hit rate, popular queries, staleness
- **Auto-refresh when**:
  - Staleness > 7 days
  - Miss rate > 20%
  - Manual refresh requested

## Architecture

```
bash/melvin/
  ├── includes.sh              # Entry point
  ├── melvin.sh                # Core dispatcher
  ├── melvin_classifier.sh     # Taxonomy engine
  ├── melvin_health.sh         # Health reports
  ├── melvin_scanner.sh        # Code parser
  ├── melvin_stats.sh          # Usage tracking
  ├── melvin_repl.sh           # REPL interface
  └── README.md                # This file

$TETRA_DIR/melvin/
  ├── classification.json      # Cached classifications
  ├── stats.jsonl             # Usage logs
  └── last_refresh.txt        # Refresh timestamp
```

## Example: Analyzing bash/rag

```bash
$ melvin explain rag

bash/rag: MODULE
  Has actions.sh (with REPL)

Description:
  RAG (Retrieval-Augmented Generation) system for tetra

Features: includes actions repl
Strong globals: RAG_SRC RAG_DIR
Exported functions:
  - rag_repl
  - tetra_rag_search
  - tetra_rag_chunks
  - tetra_rag_context
  - tetra_rag_cite
  - tetra_rag_export_jsonl

Dependencies: tree

LOC: ~2500 lines
Last modified: 2025-10-25
Registered: ✓ boot_modules.sh:44

Classification: MODULE (Has actions.sh with REPL)
```

## Integration

MELVIN integrates with:
- **bash/tree**: For future knowledge tree storage
- **bash/repl**: For interactive interface
- **boot system**: Lazy loading via `boot_modules.sh`

## Future Extensions

- Knowledge tree integration (`melvin_tree.sh`)
- RAG integration for semantic search
- Git change tracking for smart refresh
- Module dependency graphs
- Concept teaching system

## Philosophy

MELVIN embodies precision and accounting:
- Never misses a directory
- Accurate classification
- Usage-based intelligence
- The tetra way, quantified

---

**MELVIN**: Machine Electronics Live Virtual Intelligence Network
*Precision above all.*
