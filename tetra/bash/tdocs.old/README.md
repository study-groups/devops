# TDocs - Tetra Document Manager

LLM-generated markdown document management with semantic classification, tagging, and publishing.

## Quick Start

```bash
# Source tetra first
source ~/tetra/tetra.sh

# Index documents in current directory
tdocs index .

# List indexed documents
tdocs ls

# Search documents
tdocs search "pattern"

# Tag document
tdocs tag doc123 implementation

# Publish to directory
tdocs publish doc123 ~/output/

# Interactive REPL
tdocs repl
```

## Core Concepts

### Document Lifecycle
1. **Create** - LLM generates markdown in working directory
2. **Index** - tdocs discovers and classifies documents
3. **Tag** - Add semantic tags (plan, implementation, etc.)
4. **Search** - Find documents by content, tags, or metadata
5. **Publish** - Export to various formats/destinations

### Semantic Classification

Documents are auto-classified by type:
- `plan` - Implementation plans, designs
- `implementation` - Code implementation notes
- `bug` - Bug reports, fixes
- `refactor` - Refactoring documentation
- `test` - Test documentation
- `doc` - General documentation

## Commands

### Document Management
- `tdocs index [dir]` - Index markdown files
- `tdocs ls [filter]` - List documents (compact 80-col format)
- `tdocs show <id>` - Display document
- `tdocs search <pattern>` - Search content
- `tdocs tag <id> <tags...>` - Add tags

### Publishing
- `tdocs publish <id> <target>` - Publish document
- `tdocs publish list` - List publish targets
- `tdocs publish config <target>` - Configure target

### Maintenance
- `tdocs clean` - Remove stale entries
- `tdocs stats` - Show statistics
- `tdocs help` - Show help

## REPL Mode

```bash
# Launch interactive REPL with tab completion
tdocs repl

tdocs> ls
tdocs> search "authentication"
tdocs> tag doc123 security implemented
tdocs> show doc123
tdocs> publish doc123 ~/docs/
tdocs> help
tdocs> quit
```

## Tab Completion

Bash completion for tdocs commands:

```bash
# Enable completion (auto-loaded with tetra)
source "$TDOCS_SRC/tdocs_completion.sh"

# Use completion
tdocs <TAB>           # Shows commands
tdocs tag <TAB>       # Shows document IDs
tdocs publish <TAB>   # Shows targets
```

## Module Structure

- `includes.sh` - Module entry point, sets MOD_SRC/MOD_DIR
- `actions.sh` - TCS-compliant actions for TUI integration
- `tdocs.sh` - Main CLI interface
- `tdocs_repl.sh` - Interactive REPL with rlwrap support
- `tdocs_completion.sh` - Bash tab completion
- `core/` - Core functionality (metadata, database, search)
- `ui/` - UI components (formatting, display)

## Configuration

Documents database: `$TDOCS_DIR/db/documents.json`
Tags database: `$TDOCS_DIR/db/tags.json`
Config: `$TDOCS_DIR/config/`

## Display Format

Ultra-compact 80-column layout for terminal viewing:
```
ID     Type    Tags             File
────────────────────────────────────────────────────────────────────────────
doc001 plan    auth,api         AUTHENTICATION_PLAN.md
doc002 impl    auth,backend     AUTH_IMPLEMENTATION.md
```

## See Also

- `FLOW_AND_SEMANTICS.md` - Document lifecycle and semantics
- `docs/SEMANTIC_MODEL.md` - Classification system details
- `docs/TDOCS_RAG_INTEGRATION.md` - RAG integration guide
- `DEMO_README.md` - Demo and examples
