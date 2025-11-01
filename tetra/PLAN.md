# REPL Consolidation + tdocs Refactor: Implementation Plan

**Created**: 2025-10-31
**Status**: Ready for implementation
**Scope**: Two parallel efforts - REPL system consolidation + tdoc→tdocs refactor

---

## Executive Summary

This plan consolidates the REPL system to a single, clear execution model (hybrid mode) and refactors `tdoc` to `tdocs` with modern REPL integration, TDS theming, and comprehensive documentation.

### Key Decisions Made:
1. **Hard break**: tdoc → tdocs (no backward compatibility)
2. **Auto-migration**: Runtime data migrated automatically
3. **REPL consolidation**: Remove takeover mode, keep hybrid only
4. **TDS tokens**: All colors use theme-aware tokens
5. **One-key mode**: Reserved for TUI only (separate from REPL)

---

## Part 1: Understanding the Current State

### REPL System Analysis

#### Two Orthogonal Dimensions (Current):

**Execution Mode** (bash/repl/core/mode.sh):
- `augment` (default) - Shell commands by default, `/cmd` for module
- `takeover` (unused) - Module commands by default, `!cmd` for shell

**Input Mode** (bash/repl/repl.sh):
- `basic` - Simple `read -r -p`
- `enhanced` - TCurses readline with history/editing
- `tui` - Stub only, not implemented in REPL

#### Real-World Usage:
- bash/rag/rag_repl.sh - Uses `augment` + `enhanced`
- bash/org/org_repl.sh - Uses `augment` + auto-detect
- **No module uses takeover mode**
- **TUI is separate system** (game loop, demos)

#### Problems Identified:
1. **No visual mode indicator** - Users can't tell augment vs takeover
2. **Takeover mode unused** - Adds complexity, no value
3. **TUI input mode incomplete** - Stub code, not functional
4. **Naming confusion** - "augment" unclear, "takeover" vs "repl"
5. **6 mode combinations** - Only 2 actually work

---

### TUI vs REPL: The Fundamental Difference

#### REPL (Line-Based Input)
```bash
read -r -e -p "$prompt" line    # Read full line until Enter
```
- **Input unit**: Full line (until Enter pressed)
- **Editing**: Yes (Emacs keybindings: Ctrl-A/E/K, arrow history)
- **Echo**: Visible as you type
- **Prompt**: Visible (`$ tdocs>`)
- **Terminal**: `stty echo icanon`
- **Use case**: Command execution, shell augmentation
- **Example**: `$ tdocs> /ls --core` [Enter]

#### TUI (One-Key/Character Input)
```bash
read -rsn1 -t 0.1 key    # Read single character, no Enter
```
- **Input unit**: Single character
- **Editing**: None (immediate action)
- **Echo**: Silent (`-s` flag)
- **Prompt**: Hidden (full-screen rendering)
- **Terminal**: `stty -echo -icanon`
- **Use case**: Navigation, games, interactive UIs
- **Example**: Press `p` → pause instantly

**Key Insight**: These are **two different systems** that happen to share tcurses infrastructure. Don't conflate them!

---

### Current tdoc System

**Location**: `bash/tdoc/`
**Functions**: ~90 (all prefixed `tdoc_`)
**Globals**: 6 (`TDOC_SRC`, `TDOC_DIR`, etc.)
**Architecture**: Well-designed, TCS 3.0 compliant
**Integration**: Used by rag, org, tree modules
**Missing**: REPL interface, theme-aware colors

**Runtime State**:
- Database: `$TETRA_DIR/tdoc/db/*.meta`
- Chuck docs: `$TETRA_DIR/tdoc/chuck/*.md`
- Indexes: Various `.tdoc/index.json` files

---

## Part 2: REPL System Consolidation

### Goals:
1. Simplify to single execution mode (hybrid)
2. Clear input mode naming
3. Remove unused/incomplete code
4. Standardize prompts with mode indicators
5. Document the distinction between REPL and TUI

### Changes to bash/repl/

#### 2.1 Remove Takeover Mode

**Files to modify**:
- `bash/repl/core/mode.sh` (lines 24, 34-36, 51-52)
  - Remove `REPL_EXECUTION_MODE` variable
  - Remove `repl_set_execution_mode()` function
  - Remove `repl_is_takeover()` function
  - Keep `repl_is_augment()` → rename to `repl_is_hybrid()`

- `bash/repl/command_processor.sh` (lines 106-128, 400-457)
  - Remove takeover routing logic
  - Remove `/mode` command
  - Simplify to single path: shell default, `/` for module/meta
  - Update help text

- `bash/repl/repl.sh` (lines 30, 40-41, 77-78)
  - Remove execution mode history files
  - Single history file: `${REPL_HISTORY_BASE}.history`

**Result**: Always run in hybrid mode (shell + /slash commands)

#### 2.2 Rename for Clarity

**Execution mode**:
- `augment` → `hybrid` (clearer intent)
- Remove `takeover` entirely
- Update all references across codebase

**Input modes**:
- `basic` → `simple` (more intuitive)
- `enhanced` → `readline` (explicit about feature)
- Remove `tui` from REPL input modes

**Files**:
- `bash/repl/core/mode.sh` - Rename augment → hybrid
- `bash/repl/core/input.sh` - Rename basic/enhanced
- `bash/repl/repl.sh` - Update mode detection

#### 2.3 Standardize Prompts

**Require mode indicator in all prompts**:

```bash
# Default prompt builder (in repl.sh)
repl_build_prompt() {
    local module=$(repl_get_module_context)
    REPL_PROMPT="$ ${module}> "
}
```

**Examples**:
```
$ tdocs>
$ rag>
$ org>
```

**With context** (optional, module-specific):
```
$ tdocs[core]>
$ rag[flow-123]>
$ org[proj/docs]>
```

**File**: Add to `bash/repl/prompt_manager.sh`

#### 2.4 Document TUI Separation

Create `bash/repl/docs/TUI_VS_REPL.md`:

```markdown
# TUI vs REPL: Understanding the Difference

## REPL (Line-Based Commands)
- Full line input with editing
- Visible prompt and echo
- Use for: Command execution, shell augmentation
- Examples: rag_repl, org_repl, tdocs_repl

## TUI (Character-Based Navigation)
- Single keypress input
- Full-screen rendering
- Use for: Navigation, games, interactive UIs
- Examples: game loop, tcurses demos

## Don't Mix Them!
REPL and TUI are fundamentally different input systems.
Use REPL for commands, TUI for navigation.
```

---

## Part 3: tdoc → tdocs Refactor

### Goals:
1. Rename all tdoc → tdocs (hard break)
2. Add REPL interface (hybrid mode)
3. Use TDS tokens for theme-aware colors
4. Simplify commands (remove `list`, keep `ls`)
5. Comprehensive documentation
6. Migration script for runtime data

### 3.1 Core Rename (32+ files)

#### Directory Structure
```bash
bash/tdoc/ → bash/tdocs/
```

#### Function Renames (~90 functions)
```bash
# All functions
tdoc_*           → tdocs_*
_tdoc_*          → _tdocs_*

# Specific examples
tdoc()                    → tdocs()
tdoc_module_init()        → tdocs_module_init()
tdoc_view_doc()           → tdocs_view_doc()
tdoc_list_docs()          → tdocs_ls_docs()  # Rename list → ls
tdoc_parse_frontmatter()  → tdocs_parse_frontmatter()
```

#### Global Variables (6 renames)
```bash
TDOC_SRC          → TDOCS_SRC
TDOC_DIR          → TDOCS_DIR
TDOC_DB_DIR       → TDOCS_DB_DIR
TDOC_CONFIG_DIR   → TDOCS_CONFIG_DIR
TDOC_CACHE_DIR    → TDOCS_CACHE_DIR
TDOC_TAG_COLORS   → TDOCS_TAG_COLORS
```

#### Help Tree
```bash
help.tdoc → help.tdocs
```

#### Files to Update:

**Core module (14 files)**:
- `bash/tdocs/tdocs.sh` (renamed from tdoc.sh)
- `bash/tdocs/includes.sh`
- `bash/tdocs/core/*.sh` (6 files)
- `bash/tdocs/ui/*.sh` (3 files)
- `bash/tdocs/integrations/*.sh` (1 file)
- `bash/tdocs/actions/*.sh` (2 files)

**Integration files**:
- `bash/rag/core/kb_manager.sh` - Update tdoc calls
- `bash/org/VIEW_DOCS.sh` - Update module loading
- `bash/tree/test_tdoc_help.sh` → `test_tdocs_help.sh`

**Documentation (9 files)**:
- `bash/tdocs/docs/README.md`
- `bash/tdocs/IMPLEMENTATION_SUMMARY.md`
- `bash/org/README_TDOC.md` → `README_TDOCS.md`
- Various planning docs (CONTINUATION_PLAN.md, etc.)

### 3.2 Command Simplification

**Remove**:
- `list` command (redundant with `ls`)
- `tdocs_list_docs()` function

**Keep and enhance**:
- `ls` command - detailed list with color badges
- `tdocs_ls_docs()` - add metadata headers, category badges

**Update help tree**:
```
help.tdocs/
├── init
├── view
├── ls           ← Unified command (removed list)
├── search
├── tag
├── evidence
├── audit
└── browse       ← NEW: launches REPL
```

### 3.3 TDS Token Integration (Theme-Aware Colors)

#### Create `bash/tdocs/ui/colors.sh`:

```bash
#!/usr/bin/env bash
# tdocs Color System - Uses TDS tokens for theme support

# Category colors
tdocs_color_category() {
    local category="$1"
    case "$category" in
        core)  tds_text_color "info" ;;      # Theme's info color
        other) tds_text_color "muted" ;;     # Theme's muted/dim
    esac
}

# Status colors
tdocs_color_status() {
    local status="$1"
    case "$status" in
        draft)      tds_text_color "warning" ;;   # Theme's warning
        stable)     tds_text_color "success" ;;   # Theme's success
        deprecated) tds_text_color "error" ;;     # Theme's error
    esac
}

# Evidence weight colors
tdocs_color_evidence() {
    local weight="$1"
    case "$weight" in
        primary)   tds_text_color "success" ;;    # Bright
        secondary) tds_text_color "info" ;;       # Medium
        tertiary)  tds_text_color "muted" ;;      # Dim
    esac
}

export -f tdocs_color_category
export -f tdocs_color_status
export -f tdocs_color_evidence
```

#### Update All Output Functions:

**Files to modify**:
- `bash/tdocs/ui/tags.sh` - Use `tdocs_color_*()` functions
- `bash/tdocs/ui/preview.sh` - Use TDS tokens
- `bash/tdocs/core/search.sh` - Color search results
- `bash/tdocs/tdocs.sh` - Main command output

**Example refactor**:
```bash
# BEFORE (hardcoded):
echo -e "\033[38;2;102;170;153mCORE\033[0m"

# AFTER (theme-aware):
echo "$(tdocs_color_category "core")CORE$(tds_reset_color)"
```

#### Graceful Fallback:
```bash
tdocs_render_doc() {
    local doc="$1"

    if command -v tds_render_markdown >/dev/null 2>&1; then
        tds_render_markdown "$doc"
    else
        cat "$doc"  # Plain fallback
    fi
}
```

### 3.4 REPL Integration (Hybrid Mode)

#### Create `bash/tdocs/tdocs_repl.sh`:

```bash
#!/usr/bin/env bash
# tdocs REPL - Interactive document browser

# Dependencies
source "$TETRA_SRC/bash/repl/repl.sh"
source "$TDOCS_SRC/tdocs_commands.sh"

# REPL state (filters, context)
TDOCS_REPL_CATEGORY=""      # all|core|other
TDOCS_REPL_MODULE=""        # module filter
TDOCS_REPL_DOC_COUNT=0      # cached count

# Main REPL entry point
tdocs_repl() {
    # Initialize
    tdocs_module_init

    # Register slash commands
    tdocs_register_commands

    # Set module context for help/completion
    repl_set_module_context "tdocs"

    # Build dynamic prompt
    repl_build_prompt() {
        local ctx=""

        # Add category filter if set
        if [[ -n "$TDOCS_REPL_CATEGORY" ]]; then
            ctx="[$TDOCS_REPL_CATEGORY]"
        fi

        # Update doc count
        TDOCS_REPL_DOC_COUNT=$(tdocs_count_filtered)

        # Format: $ tdocs[filter]>
        REPL_PROMPT="$ tdocs${ctx}> "
    }

    # Custom input processor (optional, for future enhancements)
    # repl_process_input() { ... }

    # Run REPL in readline mode (hybrid execution is default)
    repl_run readline
}

# Launch REPL
tdocs_repl "$@"
```

#### Create `bash/tdocs/tdocs_commands.sh`:

```bash
#!/usr/bin/env bash
# tdocs Slash Command Handlers

# Register all tdocs commands
tdocs_register_commands() {
    if ! command -v repl_register_slash_command >/dev/null 2>&1; then
        echo "Error: REPL system not available" >&2
        return 1
    fi

    # Core commands
    repl_register_slash_command "ls" tdocs_cmd_ls
    repl_register_slash_command "view" tdocs_cmd_view
    repl_register_slash_command "search" tdocs_cmd_search
    repl_register_slash_command "tag" tdocs_cmd_tag
    repl_register_slash_command "init" tdocs_cmd_init

    # Context commands
    repl_register_slash_command "filter" tdocs_cmd_filter
    repl_register_slash_command "env" tdocs_cmd_env

    # Utility commands
    repl_register_slash_command "audit" tdocs_cmd_audit
    repl_register_slash_command "evidence" tdocs_cmd_evidence
}

# Command: /ls [--core|--other] [--module NAME]
tdocs_cmd_ls() {
    local args=("$@")

    # Apply current filters
    local filter_args=()
    [[ -n "$TDOCS_REPL_CATEGORY" ]] && filter_args+=("--$TDOCS_REPL_CATEGORY")
    [[ -n "$TDOCS_REPL_MODULE" ]] && filter_args+=("--module" "$TDOCS_REPL_MODULE")

    # Merge with provided args
    tdocs_ls_docs "${filter_args[@]}" "${args[@]}"
}

# Command: /view <file>
tdocs_cmd_view() {
    local doc="${1:-}"

    if [[ -z "$doc" ]]; then
        echo "Usage: /view <file>"
        return 1
    fi

    tdocs_view_doc "$doc"
}

# Command: /search <query>
tdocs_cmd_search() {
    local query="${1:-}"

    if [[ -z "$query" ]]; then
        echo "Usage: /search <query>"
        return 1
    fi

    tdocs_search_docs "$query"
}

# Command: /tag <file>
tdocs_cmd_tag() {
    local doc="${1:-}"

    if [[ -z "$doc" ]]; then
        echo "Usage: /tag <file>"
        return 1
    fi

    tdocs_tag_interactive "$doc"
}

# Command: /init <file>
tdocs_cmd_init() {
    local doc="${1:-}"

    if [[ -z "$doc" ]]; then
        echo "Usage: /init <file>"
        return 1
    fi

    shift
    tdocs_init_doc "$doc" "$@"
}

# Command: /filter {core|other|module=NAME|clear}
tdocs_cmd_filter() {
    local filter="${1:-}"

    case "$filter" in
        core)
            TDOCS_REPL_CATEGORY="core"
            echo "Filter: core documents only"
            return 2  # Signal prompt rebuild
            ;;
        other)
            TDOCS_REPL_CATEGORY="other"
            echo "Filter: other documents only"
            return 2
            ;;
        module=*)
            TDOCS_REPL_MODULE="${filter#module=}"
            echo "Filter: module=$TDOCS_REPL_MODULE"
            return 2
            ;;
        clear)
            TDOCS_REPL_CATEGORY=""
            TDOCS_REPL_MODULE=""
            echo "Filters cleared"
            return 2
            ;;
        *)
            echo "Usage: /filter {core|other|module=NAME|clear}"
            return 1
            ;;
    esac
}

# Command: /env [toggle|set VALUE]
tdocs_cmd_env() {
    local action="${1:-toggle}"

    # Implementation depends on what "environment" means for tdocs
    # Could be: dev/prod context, module context, etc.
    # Placeholder for now

    echo "Environment context management"
    echo "Usage: /env {toggle|set VALUE}"
}

# Command: /audit
tdocs_cmd_audit() {
    tdocs_audit_docs "$@"
}

# Command: /evidence <query>
tdocs_cmd_evidence() {
    local query="${1:-}"

    if [[ -z "$query" ]]; then
        echo "Usage: /evidence <query>"
        return 1
    fi

    shift
    tdocs_evidence_for_query "$query" "$@"
}

export -f tdocs_register_commands
export -f tdocs_cmd_ls
export -f tdocs_cmd_view
export -f tdocs_cmd_search
export -f tdocs_cmd_tag
export -f tdocs_cmd_init
export -f tdocs_cmd_filter
export -f tdocs_cmd_env
export -f tdocs_cmd_audit
export -f tdocs_cmd_evidence
```

#### User Experience:

```bash
# Launch REPL
$ tdocs browse

# Inside REPL (hybrid mode)
$ tdocs> ls                          # Shell ls
$ tdocs> /ls                         # List all docs (tdocs command)
$ tdocs> /filter core                # Set category filter
$ tdocs[core]> /ls                   # List only core docs
$ tdocs[core]> /view README.md       # View document
$ tdocs[core]> git status            # Shell still works!
$ tdocs[core]> /filter module=rag    # Add module filter
$ tdocs[core]> /ls                   # List core docs in rag module
$ tdocs[core]> /filter clear         # Clear all filters
$ tdocs> /search "architecture"      # Search across docs
$ tdocs> /help                       # Show help
$ tdocs> /exit                       # Exit REPL
```

### 3.5 Migration Script

#### Create `bash/tdocs/scripts/migrate_from_tdoc.sh`:

```bash
#!/usr/bin/env bash
# Migrate runtime data from tdoc → tdocs

set -euo pipefail

echo "=== tdoc → tdocs Migration ==="
echo ""

# Check if old directory exists
if [[ ! -d "$TETRA_DIR/tdoc" ]]; then
    echo "No migration needed: $TETRA_DIR/tdoc does not exist"
    exit 0
fi

# Check if new directory already exists
if [[ -d "$TETRA_DIR/tdocs" ]]; then
    echo "Error: $TETRA_DIR/tdocs already exists"
    echo "Please remove it first if you want to re-migrate"
    exit 1
fi

# Create backup
echo "Creating backup: $TETRA_DIR/tdoc.backup.$(date +%Y%m%d_%H%M%S)"
cp -r "$TETRA_DIR/tdoc" "$TETRA_DIR/tdoc.backup.$(date +%Y%m%d_%H%M%S)"

# Move directory
echo "Moving $TETRA_DIR/tdoc → $TETRA_DIR/tdocs"
mv "$TETRA_DIR/tdoc" "$TETRA_DIR/tdocs"

# Update any path references in metadata files
echo "Updating path references in metadata files..."
find "$TETRA_DIR/tdocs/db" -name "*.meta" -type f | while read -r meta_file; do
    if grep -q '"doc_path".*tdoc' "$meta_file" 2>/dev/null; then
        # Update paths (if any reference old module name)
        sed -i.bak 's|bash/tdoc/|bash/tdocs/|g' "$meta_file"
        rm -f "${meta_file}.bak"
    fi
done

echo ""
echo "✓ Migration complete!"
echo ""
echo "Runtime data migrated:"
echo "  Database: $TETRA_DIR/tdocs/db/"
echo "  Chuck:    $TETRA_DIR/tdocs/chuck/"
echo "  Config:   $TETRA_DIR/tdocs/config/"
echo ""
echo "Backup saved to: $TETRA_DIR/tdoc.backup.*"
```

### 3.6 Tab Completion Enhancement

#### Update `bash/tdocs/tdocs_completion.sh`:

```bash
#!/usr/bin/env bash
# tdocs Tab Completion (tree-based)

_tdocs_complete() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"

    # Ensure tree exists
    _org_ensure_tree "help.tdocs"

    # Complete commands
    if [[ $COMP_CWORD -eq 1 ]]; then
        local path="help.tdocs"
        local children=$(tree_children "$path" 2>/dev/null)
        COMPREPLY=($(compgen -W "$children browse" -- "$cur"))
        return 0
    fi

    # Complete flags/options based on command
    local cmd="${COMP_WORDS[1]}"

    case "$cmd" in
        ls)
            if [[ "$cur" == -* ]]; then
                COMPREPLY=($(compgen -W "--core --other --module --preview" -- "$cur"))
            elif [[ "$prev" == "--module" ]]; then
                # Dynamic module completion
                local modules=$(_tdocs_get_modules)
                COMPREPLY=($(compgen -W "$modules" -- "$cur"))
            fi
            ;;
        view|tag|init)
            # File completion
            COMPREPLY=($(compgen -f -- "$cur"))
            ;;
        filter)
            COMPREPLY=($(compgen -W "core other clear module=" -- "$cur"))
            ;;
    esac
}

# Get available modules from metadata
_tdocs_get_modules() {
    if [[ -d "$TDOCS_DIR/db" ]]; then
        find "$TDOCS_DIR/db" -name "*.meta" -type f \
            -exec jq -r '.module' {} \; 2>/dev/null | \
            sort -u | \
            grep -v '^null$'
    fi
}

# Register completion
complete -F _tdocs_complete tdocs
```

### 3.7 Internal Documentation

#### 3.7.1 Function Headers (Template)

Add to all ~90 functions:

```bash
# tdocs_view_doc() - Display document with TDS rendering and metadata
#
# Renders a markdown document with color-coded metadata header and
# syntax highlighting. Automatically uses pager for long documents.
#
# Usage:
#   tdocs_view_doc <file> [--pager|--raw|--meta-only]
#
# Arguments:
#   file         Path to markdown document (required)
#   --pager      Force pager even for short documents
#   --raw        Skip color rendering, show plain text
#   --meta-only  Show only metadata header, not content
#
# Returns:
#   0 on success
#   1 on error (file not found, invalid format, etc.)
#
# Dependencies:
#   - tds_render_markdown (optional, falls back to cat)
#   - tdocs_get_metadata (for metadata header)
#   - tdocs_color_* (for colored badges)
#
# Examples:
#   tdocs_view_doc "bash/rag/docs/README.md"
#   tdocs_view_doc "README.md" --pager
#   tdocs_view_doc "README.md" --meta-only
#
# See also:
#   tdocs_ls_docs, tdocs_preview_doc
```

#### 3.7.2 Architecture Documentation

Create `bash/tdocs/docs/ARCHITECTURE.md`:

```markdown
# tdocs Architecture

## Overview

tdocs (Tetra Document Manager) is a TCS 3.0-compliant system for managing
LLM-generated markdown documentation with metadata tracking, RAG integration,
and color-coded categorization.

## Directory Structure

```
bash/tdocs/
├── tdocs.sh              # Main CLI entry point
├── tdocs_repl.sh         # Interactive REPL interface
├── includes.sh           # Module loader
├── core/
│   ├── metadata.sh       # YAML frontmatter parsing/writing
│   ├── database.sh       # TCS 3.0 timestamp-based database
│   ├── index.sh          # JSON index management
│   ├── classify.sh       # Auto-detection and classification
│   ├── search.sh         # Search and list operations
│   └── chuck.sh          # Chuck system (LLM response capture)
├── ui/
│   ├── colors.sh         # TDS token color mapping (NEW)
│   ├── tags.sh           # Color-coded tag rendering
│   ├── preview.sh        # Document preview with metadata
│   └── interactive.sh    # Interactive tagging UI
├── integrations/
│   └── rag_evidence.sh   # RAG evidence provider
├── actions/
│   └── chuck.sh          # Chuck command routing
├── scripts/
│   └── migrate_from_tdoc.sh  # Migration script
└── docs/
    ├── README.md              # User guide
    ├── ARCHITECTURE.md        # This file
    ├── API_REFERENCE.md       # Function reference
    ├── REPL_INTEGRATION.md    # REPL usage guide
    └── THEMING.md             # TDS color system
```

## Runtime Structure

```
$TETRA_DIR/tdocs/
├── db/
│   ├── {timestamp}.meta       # JSON metadata files
│   └── {timestamp}.tags       # Tag files for grep
├── chuck/
│   └── {id}.{kind}.md         # Chuck documents
├── config/
└── cache/
```

## Core Concepts

### 1. Taxonomy: Core vs Other

**Core** - Stable reference documentation
- Specs, guides, API references
- Reviewed, production-ready
- High evidence weight for RAG

**Other** - Working documentation
- Draft notes, investigations, summaries
- In-progress, temporary
- Lower evidence weight

### 2. Metadata Schema

YAML frontmatter in every document:

```yaml
---
category: core|other
type: spec|guide|reference|bug-fix|refactor|plan|summary|investigation
tags: [tag1, tag2, ...]
module: <module_name>
created: YYYY-MM-DD
updated: YYYY-MM-DD
status: draft|stable|deprecated
evidence_weight: primary|secondary|tertiary
---
```

### 3. TCS 3.0 Database

Timestamp-based metadata storage:
- `{timestamp}.meta` - JSON metadata
- `{timestamp}.tags` - Newline-separated tags for grep
- Fast lookup by timestamp
- Correlation across modules

### 4. TDS Theme Integration

All colors use TDS tokens for theme support:
- `tdocs_color_category()` - core/other colors
- `tdocs_color_status()` - draft/stable/deprecated
- `tdocs_color_evidence()` - primary/secondary/tertiary

Benefits:
- Works with any theme (tokyo-night, solarized, etc.)
- Adapts to light/dark mode
- Respects accessibility preferences

## Data Flow

### Document Initialization

```
User creates doc.md
  ↓
tdocs init doc.md
  ↓
Auto-detect module/type
  ↓
Interactive classification
  ↓
Write YAML frontmatter
  ↓
Create database entry
  ↓
Update index
```

### Document Viewing

```
tdocs view doc.md
  ↓
Read metadata (frontmatter or DB)
  ↓
Render metadata header (colored badges)
  ↓
Render content (TDS markdown)
  ↓
Auto-pager if >50 lines
```

### RAG Evidence

```
RAG query "authentication"
  ↓
tdocs_evidence_for_query()
  ↓
Search documents
  ↓
Filter by evidence_weight
  ↓
Return ranked list
  ↓
RAG uses for context
```

## Integration Points

### REPL System (bash/repl/)
- Uses hybrid mode (shell + /slash commands)
- Registers slash command handlers
- Provides context for prompt
- Tab completion via tree

### TDS System (bash/tds/)
- Color token mapping for themes
- Markdown rendering
- Syntax highlighting

### Tree System (bash/tree/)
- Help tree: `help.tdocs.*`
- Command structure
- Tab completion

### RAG System (bash/rag/)
- Evidence provider
- Document weighting
- Query expansion

## Design Decisions

### Why Tmpfile for Prompts?
Avoids shell escaping issues with complex color codes.
See: bash/rag/rag_repl.sh:231-341 for reference.

### Why Timestamp Database?
- TCS 3.0 compliance
- Fast correlation across modules
- Immutable IDs for references

### Why Separate Chuck System?
Raw LLM responses need different handling:
- No frontmatter required
- Quick capture workflow
- Promotion to reference docs later

## Future Enhancements

- [ ] TUI mode for visual browsing
- [ ] Git integration for doc versioning
- [ ] Bulk operations (tag all, reclassify, etc.)
- [ ] Export formats (PDF, HTML)
- [ ] Advanced search (regex, boolean, fuzzy)
```

#### 3.7.3 API Reference

Create `bash/tdocs/docs/API_REFERENCE.md`:

```markdown
# tdocs API Reference

## Public Functions

### Core Operations

#### `tdocs()`
Main CLI entry point.

**Usage**: `tdocs <command> [args...]`

**Commands**: init, view, ls, search, tag, evidence, audit, browse

---

#### `tdocs_module_init()`
Initialize tdocs module (directories, help tree).

**Usage**: `tdocs_module_init`

**Returns**: 0 on success

---

### Document Operations

#### `tdocs_init_doc()`
Initialize document with metadata.

**Usage**: `tdocs_init_doc <file> [--core|--other] [--type TYPE] [--tags TAGS] [--module MODULE]`

**Returns**: 0 on success, 1 on error

---

#### `tdocs_view_doc()`
View document with color rendering.

**Usage**: `tdocs_view_doc <file> [--pager|--raw|--meta-only]`

**Returns**: 0 on success, 1 on error

---

#### `tdocs_ls_docs()`
List documents with filters.

**Usage**: `tdocs_ls_docs [--core|--other] [--module NAME] [--tags TAGS] [--preview]`

**Returns**: 0 on success

---

### Metadata Operations

#### `tdocs_parse_frontmatter()`
Parse YAML frontmatter from document.

**Usage**: `tdocs_parse_frontmatter <file>`

**Output**: JSON object with metadata

**Returns**: 0 if frontmatter exists, 1 if not

---

#### `tdocs_write_frontmatter()`
Write/update YAML frontmatter.

**Usage**: `tdocs_write_frontmatter <file> <metadata_json>`

**Returns**: 0 on success, 1 on error

---

### Database Operations

#### `tdocs_db_create()`
Create database entry for document.

**Usage**: `tdocs_db_create <doc_path> <metadata_json>`

**Returns**: Timestamp ID on success

---

#### `tdocs_db_get()`
Get metadata by timestamp.

**Usage**: `tdocs_db_get <timestamp>`

**Output**: JSON metadata

**Returns**: 0 if found, 1 if not

---

### Search Operations

#### `tdocs_search_docs()`
Full-text search across documents.

**Usage**: `tdocs_search_docs <query> [--core|--other] [--module NAME]`

**Returns**: 0 on success

---

### Color Functions (NEW)

#### `tdocs_color_category()`
Get TDS color for category.

**Usage**: `tdocs_color_category {core|other}`

**Output**: ANSI color code

---

#### `tdocs_color_status()`
Get TDS color for status.

**Usage**: `tdocs_color_status {draft|stable|deprecated}`

**Output**: ANSI color code

---

## Private Functions

Functions prefixed with `_tdocs_` are internal and subject to change.

## Constants

### Globals

- `TDOCS_SRC` - Source directory (defaults to `$TETRA_SRC/bash/tdocs`)
- `TDOCS_DIR` - Runtime directory (defaults to `$TETRA_DIR/tdocs`)
- `TDOCS_DB_DIR` - Database directory
- `TDOCS_CONFIG_DIR` - Config directory
- `TDOCS_CACHE_DIR` - Cache directory

### REPL State

- `TDOCS_REPL_CATEGORY` - Current category filter
- `TDOCS_REPL_MODULE` - Current module filter
- `TDOCS_REPL_DOC_COUNT` - Cached document count

## See Also

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design
- [REPL_INTEGRATION.md](./REPL_INTEGRATION.md) - REPL usage
- [THEMING.md](./THEMING.md) - Color system
```

#### 3.7.4 REPL Integration Guide

Create `bash/tdocs/docs/REPL_INTEGRATION.md`:

```markdown
# tdocs REPL Integration Guide

## Overview

tdocs provides an interactive REPL (Read-Eval-Print Loop) for browsing
and managing documents. The REPL runs in **hybrid mode**, where shell
commands work normally and module commands use the `/slash` prefix.

## Launching the REPL

```bash
$ tdocs browse
```

Or directly:

```bash
$ bash bash/tdocs/tdocs_repl.sh
```

## Prompt Format

The prompt shows your current context:

```
$ tdocs>              # No filters active
$ tdocs[core]>        # Category filter: core only
$ tdocs[other]>       # Category filter: other only
```

## Execution Mode: Hybrid

In hybrid mode:
- **Shell commands work directly**: `ls`, `cd`, `git status`
- **Module commands use slash**: `/ls`, `/view`, `/search`
- **No mode switching needed**: Both work simultaneously

### Examples

```bash
$ tdocs> pwd                     # Shell: show current directory
/Users/me/project

$ tdocs> ls -la                  # Shell: list files
drwxr-xr-x  ...

$ tdocs> /ls                     # Module: list tdocs documents
CORE | spec | bash/rag/docs/README.md
CORE | guide | bash/tdocs/docs/ARCHITECTURE.md
...

$ tdocs> /view README.md         # Module: view document
[Colored markdown output...]

$ tdocs> git status              # Shell: still works!
On branch main
...
```

## Slash Commands

### Document Operations

#### `/ls [--core|--other] [--module NAME]`
List documents with optional filters.

```bash
$ tdocs> /ls                     # List all
$ tdocs> /ls --core              # Core only
$ tdocs> /ls --module rag        # rag module only
$ tdocs> /ls --core --module rag # Both filters
```

#### `/view <file>`
View document with color rendering.

```bash
$ tdocs> /view bash/rag/docs/README.md
$ tdocs> /view README.md --pager
```

#### `/search <query>`
Full-text search across documents.

```bash
$ tdocs> /search "authentication"
$ tdocs> /search "REPL integration"
```

#### `/tag <file>`
Interactive tag editor.

```bash
$ tdocs> /tag README.md
```

#### `/init <file>`
Initialize document with metadata.

```bash
$ tdocs> /init docs/NEW_FEATURE.md
$ tdocs> /init docs/PLAN.md --core --type plan
```

### Context Commands

#### `/filter {core|other|module=NAME|clear}`
Set persistent filters (changes prompt).

```bash
$ tdocs> /filter core
Filter: core documents only
$ tdocs[core]> /ls               # Now only shows core docs

$ tdocs[core]> /filter module=rag
Filter: module=rag
$ tdocs[core]> /ls               # Shows core docs in rag module

$ tdocs[core]> /filter clear
Filters cleared
$ tdocs>
```

#### `/env [toggle|set VALUE]`
Environment context management (future).

```bash
$ tdocs> /env toggle
$ tdocs> /env set production
```

### Utility Commands

#### `/audit`
Find documents without metadata.

```bash
$ tdocs> /audit
```

#### `/evidence <query>`
Get evidence-weighted documents for RAG.

```bash
$ tdocs> /evidence "authentication flow"
```

### Meta Commands

#### `/help [topic]`
Show help.

```bash
$ tdocs> /help
$ tdocs> /help ls
```

#### `/exit` or `/quit`
Exit REPL.

```bash
$ tdocs> /exit
```

## Keyboard Shortcuts

Standard Emacs-style readline keybindings work:

- **Ctrl-A**: Beginning of line
- **Ctrl-E**: End of line
- **Ctrl-K**: Kill to end of line
- **Ctrl-U**: Kill to beginning
- **Ctrl-W**: Kill word backwards
- **Ctrl-L**: Clear screen
- **Ctrl-D**: Exit REPL
- **Ctrl-C**: Cancel current input
- **↑/↓**: History navigation
- **Tab**: Command/file completion

## Tab Completion

Completion works for:

- Commands: `/<Tab>` → shows available commands
- Flags: `/ls --<Tab>` → shows `--core --other --module --preview`
- Modules: `/ls --module <Tab>` → shows available modules
- Files: `/view <Tab>` → file path completion

## History

Command history is saved per session:

```
$TETRA_DIR/repl/history.history
```

View recent history:

```bash
$ tdocs> /history 20
```

## Tips & Tricks

### Quick Navigation

```bash
# Set filter, then use shell commands to work
$ tdocs> /filter core
$ tdocs[core]> /ls                    # See what's available
$ tdocs[core]> cd bash/rag/docs       # Navigate with shell
$ tdocs[core]> /view README.md        # View local file
```

### Combining Shell and Module

```bash
# Find files, then view with tdocs
$ tdocs> find . -name "*REPL*"
./bash/rag/docs/REPL_FIXES.md
./bash/repl/README.md

$ tdocs> /view ./bash/rag/docs/REPL_FIXES.md
```

### Batch Operations

```bash
# Shell for-loop with module commands
$ tdocs> for f in bash/*/docs/README.md; do echo "=== $f ==="; /view "$f" --meta-only; done
```

## Advanced: REPL State

The REPL maintains session state:

- `TDOCS_REPL_CATEGORY` - Current category filter
- `TDOCS_REPL_MODULE` - Current module filter
- `TDOCS_REPL_DOC_COUNT` - Cached document count

These are bash variables you can inspect:

```bash
$ tdocs> echo $TDOCS_REPL_CATEGORY
core
```

## Exiting the REPL

Three ways:

1. `/exit` or `/quit` command
2. Ctrl-D (EOF)
3. Ctrl-C (interrupt)

All will cleanly restore your terminal.

## See Also

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design
- [API_REFERENCE.md](./API_REFERENCE.md) - Function reference
- bash/repl/README.md - REPL system documentation
```

#### 3.7.5 Theming Guide

Create `bash/tdocs/docs/THEMING.md`:

```markdown
# tdocs Theming Guide

## Overview

tdocs uses the TDS (Tetra Display System) token-based color system,
ensuring all visual output adapts to the user's theme preferences.

## Why TDS Tokens?

### Before (Hardcoded Colors):
```bash
echo -e "\033[38;2;102;170;153mCORE\033[0m"  # Teal, always
```

**Problems**:
- Breaks in light themes
- Ignores accessibility preferences
- Requires code changes for new themes

### After (TDS Tokens):
```bash
echo "$(tds_text_color "info")CORE$(tds_reset_color)"
```

**Benefits**:
- ✅ Adapts to any theme (tokyo-night, solarized, gruvbox, etc.)
- ✅ Works in light and dark modes
- ✅ Respects user accessibility settings
- ✅ Central theme management in bash/tds/

## TDS Token Mapping

### Category Colors

```bash
tdocs_color_category() {
    case "$1" in
        core)  tds_text_color "info" ;;    # Important reference
        other) tds_text_color "muted" ;;   # Less critical
    esac
}
```

**Output** (depends on theme):
- Tokyo Night: core=teal, other=gray
- Solarized Light: core=blue, other=dim
- Gruvbox Dark: core=aqua, other=gray

### Status Colors

```bash
tdocs_color_status() {
    case "$1" in
        draft)      tds_text_color "warning" ;;   # Work in progress
        stable)     tds_text_color "success" ;;   # Production ready
        deprecated) tds_text_color "error" ;;     # Don't use
    esac
}
```

**Semantic meaning** preserved across themes:
- Warning: Always "caution" color (yellow/orange)
- Success: Always "good" color (green)
- Error: Always "danger" color (red)

### Evidence Weight Colors

```bash
tdocs_color_evidence() {
    case "$1" in
        primary)   tds_text_color "success" ;;  # High value
        secondary) tds_text_color "info" ;;     # Medium value
        tertiary)  tds_text_color "muted" ;;    # Low value
    esac
}
```

## Available TDS Tokens

From bash/tds/tokens/:

```bash
# Semantic tokens
tds_text_color "success"   # Positive, good, complete
tds_text_color "error"     # Negative, danger, failed
tds_text_color "warning"   # Caution, in-progress
tds_text_color "info"      # Informational, highlight
tds_text_color "muted"     # De-emphasized, secondary
tds_text_color "emphasis"  # Strong highlight

# Reset
tds_reset_color            # Return to default
```

## Usage in Code

### Simple Text Coloring

```bash
# Color a badge
local color=$(tdocs_color_category "core")
echo "${color}CORE$(tds_reset_color)"
```

### Multi-Color Output

```bash
# Metadata header
local cat_color=$(tdocs_color_category "$category")
local status_color=$(tdocs_color_status "$status")

echo "${cat_color}[$category]$(tds_reset_color) ${status_color}[$status]$(tds_reset_color) $title"

# Example output:
# [CORE] [stable] Authentication System
#  ^^^^   ^^^^^^
#  teal   green
```

### Full Document Rendering

```bash
# Use TDS markdown renderer
if command -v tds_render_markdown >/dev/null 2>&1; then
    tds_render_markdown "$doc_path"
else
    cat "$doc_path"  # Graceful fallback
fi
```

## Theming Best Practices

### DO:
- ✅ Use semantic tokens (`success`, `error`, `info`)
- ✅ Provide plain-text fallback for non-TDS environments
- ✅ Use `tds_reset_color` after every colored segment
- ✅ Test with multiple themes (light/dark)

### DON'T:
- ❌ Hardcode ANSI codes (`\033[38;2;...`)
- ❌ Hardcode hex colors (`#66AA99`)
- ❌ Assume dark background
- ❌ Use color as only indicator (accessibility!)

## Testing with Different Themes

```bash
# Set theme
theme_set tokyo-night
tdocs view README.md

# Try another theme
theme_set solarized-light
tdocs view README.md

# Try high-contrast (accessibility)
theme_set high-contrast
tdocs view README.md
```

All should remain readable with appropriate colors!

## Fallback Behavior

If TDS is not available:

```bash
# TDS detection
if command -v tds_text_color >/dev/null 2>&1; then
    # Use TDS
    echo "$(tds_text_color "info")CORE$(tds_reset_color)"
else
    # Plain text fallback
    echo "CORE"
fi
```

tdocs does this automatically for all output.

## See Also

- bash/tds/README.md - TDS system documentation
- bash/tds/tokens/ - Available token definitions
- bash/color/README.md - Legacy color system (being replaced)
```

---

## Part 4: Implementation Checklist

### Phase 1: REPL Consolidation

- [ ] Remove takeover mode from bash/repl/core/mode.sh
- [ ] Rename augment → hybrid
- [ ] Simplify bash/repl/command_processor.sh
- [ ] Remove `/mode` command
- [ ] Update bash/repl/repl.sh (single history file)
- [ ] Add default prompt builder with module context
- [ ] Rename input modes (basic→simple, enhanced→readline)
- [ ] Remove TUI from REPL input mode detection
- [ ] Update all module REPLs (rag, org) to use new naming
- [ ] Create bash/repl/docs/TUI_VS_REPL.md
- [ ] Update bash/repl/README.md

### Phase 2: tdocs Core Rename

- [ ] Rename bash/tdoc/ → bash/tdocs/
- [ ] Update all function names (90 functions)
- [ ] Update all global variables (6 variables)
- [ ] Update help tree (help.tdoc → help.tdocs)
- [ ] Update integration files (rag, org, tree)
- [ ] Update documentation references

### Phase 3: tdocs Command Simplification

- [ ] Remove `list` command
- [ ] Rename `tdoc_list_docs()` → `tdocs_ls_docs()`
- [ ] Enhance `ls` output (colored badges, metadata headers)
- [ ] Update help tree (remove list node)

### Phase 4: tdocs TDS Integration

- [ ] Create bash/tdocs/ui/colors.sh
- [ ] Implement tdocs_color_category()
- [ ] Implement tdocs_color_status()
- [ ] Implement tdocs_color_evidence()
- [ ] Update bash/tdocs/ui/tags.sh (use TDS tokens)
- [ ] Update bash/tdocs/ui/preview.sh (use TDS tokens)
- [ ] Update bash/tdocs/core/search.sh (color results)
- [ ] Update bash/tdocs/tdocs.sh (main output)
- [ ] Add graceful TDS fallback everywhere

### Phase 5: tdocs REPL Integration

- [ ] Create bash/tdocs/tdocs_repl.sh
- [ ] Create bash/tdocs/tdocs_commands.sh
- [ ] Implement slash command registration
- [ ] Implement /ls command handler
- [ ] Implement /view command handler
- [ ] Implement /search command handler
- [ ] Implement /tag command handler
- [ ] Implement /init command handler
- [ ] Implement /filter command handler
- [ ] Implement /env command handler (placeholder)
- [ ] Implement /audit command handler
- [ ] Implement /evidence command handler
- [ ] Add dynamic prompt with context indicators
- [ ] Test REPL in hybrid mode

### Phase 6: tdocs Tab Completion

- [ ] Update bash/tdocs/tdocs_completion.sh
- [ ] Implement tree-based command completion
- [ ] Implement flag completion (--core, --other, etc.)
- [ ] Implement dynamic module completion
- [ ] Test completion in shell and REPL

### Phase 7: Migration & Testing

- [ ] Create bash/tdocs/scripts/migrate_from_tdoc.sh
- [ ] Test migration with sample data
- [ ] Verify metadata integrity after migration
- [ ] Test all tdocs commands
- [ ] Test REPL slash commands
- [ ] Test filter state management
- [ ] Test TDS colors in multiple themes
- [ ] Test tab completion
- [ ] Test integration with rag module
- [ ] Test integration with org module
- [ ] Test integration with tree/thelp

### Phase 8: Documentation

- [ ] Add function headers to all 90 functions
- [ ] Create bash/tdocs/docs/ARCHITECTURE.md
- [ ] Create bash/tdocs/docs/API_REFERENCE.md
- [ ] Create bash/tdocs/docs/REPL_INTEGRATION.md
- [ ] Create bash/tdocs/docs/THEMING.md
- [ ] Update bash/tdocs/docs/README.md
- [ ] Update bash/tdocs/IMPLEMENTATION_SUMMARY.md
- [ ] Update CONTINUATION_PLAN.md
- [ ] Update MIGRATION_GUIDE.md
- [ ] Update bash/org/README_TDOCS.md

---

## Part 5: Testing Strategy

### Unit Tests

- [ ] Test metadata parsing (YAML frontmatter)
- [ ] Test database CRUD operations
- [ ] Test color token mapping
- [ ] Test filter logic
- [ ] Test search functionality

### Integration Tests

- [ ] Test REPL command routing
- [ ] Test slash command handlers
- [ ] Test tree help integration
- [ ] Test RAG evidence integration
- [ ] Test migration script

### User Acceptance Tests

- [ ] Launch REPL and execute all slash commands
- [ ] Set filters and verify prompt updates
- [ ] Test shell commands work in REPL (hybrid mode)
- [ ] Test tab completion for all commands
- [ ] Test with multiple themes (tokyo-night, solarized, gruvbox)
- [ ] Test migration from existing tdoc data

---

## Part 6: Success Criteria

### REPL System:
- ✅ Single execution mode (hybrid) only
- ✅ Clear naming (simple/readline input modes)
- ✅ All prompts show module context
- ✅ TUI documented as separate system
- ✅ All modules (rag, org, tdocs) use consistent pattern

### tdocs Module:
- ✅ All `tdoc_*` renamed to `tdocs_*`
- ✅ REPL interface works (hybrid mode)
- ✅ All colors use TDS tokens
- ✅ Tab completion works
- ✅ Migration script succeeds
- ✅ All documentation complete
- ✅ Integration tests pass

### User Experience:
- ✅ Can type shell commands in REPL without prefix
- ✅ Can type `/cmd` for module commands
- ✅ Prompt clearly shows current context
- ✅ Colors adapt to theme changes
- ✅ Tab completion suggests correct options
- ✅ Help system (`/help`, `thelp tdocs.cmd`) works

---

## Part 7: Migration Path for Users

### For End Users:

**One-time migration**:
```bash
# Automatic migration
source ~/tetra/tetra.sh
tmod load tdocs
# Migration happens automatically on first load
```

**Command changes**:
```bash
# Old:
tdoc list --core
tdoc view file.md

# New:
tdocs ls --core
tdocs view file.md
```

**New REPL interface**:
```bash
# Launch interactive mode
tdocs browse

# Inside REPL
$ tdocs> /ls
$ tdocs> /view README.md
$ tdocs> /filter core
$ tdocs[core]> /search "authentication"
```

### For Developers:

**Module loading**:
```bash
# Old:
tmod load tdoc

# New:
tmod load tdocs
```

**Function calls in scripts**:
```bash
# Old:
tdoc_view_doc "file.md"

# New:
tdocs_view_doc "file.md"
```

**Integration**:
```bash
# Update references in your modules
# Example: bash/rag/core/kb_manager.sh
# Change: tdoc_view_doc → tdocs_view_doc
```

---

## Part 8: Timeline Estimate

**Total**: ~2-3 days for full implementation

### Day 1: REPL Consolidation + Core Rename
- Morning: Remove takeover mode, rename augment→hybrid (2-3 hours)
- Afternoon: Rename bash/tdoc→tdocs, update all functions (3-4 hours)
- Evening: Update integrations, test basic functionality (1-2 hours)

### Day 2: TDS + REPL Integration
- Morning: Implement TDS color system (2-3 hours)
- Afternoon: Create REPL interface and slash commands (3-4 hours)
- Evening: Tab completion, testing (2 hours)

### Day 3: Documentation + Migration
- Morning: Migration script, testing (2 hours)
- Afternoon: Write all documentation (3-4 hours)
- Evening: Final testing, cleanup (2 hours)

---

## Part 9: Risk Mitigation

### Risk: Breaking existing tdoc users
**Mitigation**:
- Migration script with backup
- Clear communication in CHANGELOG
- Consider alias: `alias tdoc=tdocs` for transition period

### Risk: TDS not available in all environments
**Mitigation**:
- Graceful fallback to plain text
- Test without TDS loaded

### Risk: REPL mode confusion
**Mitigation**:
- Clear prompt indicators
- Documentation emphasizing hybrid mode
- Remove confusing alternatives (takeover)

### Risk: Tab completion conflicts
**Mitigation**:
- Test with other bash completion systems
- Use unique function names (_tdocs_complete)

---

## Part 10: Future Enhancements (Post-MVP)

### TUI Mode (Future)
```bash
# Visual document browser
tdocs browse-tui

# Full-screen interface
# j/k navigation
# e toggle environment
# / search mode
# q quit
```

### Advanced Features
- [ ] Git integration for doc versioning
- [ ] Bulk operations (tag all, reclassify)
- [ ] Export formats (PDF, HTML)
- [ ] Advanced search (regex, boolean, fuzzy)
- [ ] Document templates
- [ ] Automatic categorization (ML-based)

---

## Appendix A: File Inventory

### REPL System Files (bash/repl/)
- core/mode.sh (modify: remove takeover, rename augment)
- core/input.sh (modify: rename modes)
- core/loop.sh (no changes)
- repl.sh (modify: single history file, default prompt)
- command_processor.sh (modify: remove takeover routing, /mode)
- prompt_manager.sh (enhance: default builder)
- symbol_parser.sh (no changes)
- README.md (update: documentation)
- docs/TUI_VS_REPL.md (create: new guide)

### tdocs Module Files (bash/tdocs/)

**Core (14 files)**:
- tdocs.sh (rename from tdoc.sh, update all references)
- includes.sh (update paths)
- core/metadata.sh (rename functions)
- core/database.sh (rename functions)
- core/index.sh (rename functions)
- core/classify.sh (rename functions)
- core/search.sh (rename functions, add TDS colors)
- core/chuck.sh (rename functions)
- ui/colors.sh (create: TDS token mapping)
- ui/tags.sh (update: use TDS tokens)
- ui/preview.sh (update: use TDS tokens)
- ui/interactive.sh (rename functions)
- integrations/rag_evidence.sh (rename functions)
- actions/chuck.sh (rename functions)

**REPL (2 new files)**:
- tdocs_repl.sh (create: REPL interface)
- tdocs_commands.sh (create: slash command handlers)

**Scripts (1 new file)**:
- scripts/migrate_from_tdoc.sh (create: migration tool)

**Completion (1 file)**:
- tdocs_completion.sh (update: tree-based completion)

**Documentation (5 files)**:
- docs/README.md (update: user guide)
- docs/ARCHITECTURE.md (create: system design)
- docs/API_REFERENCE.md (create: function reference)
- docs/REPL_INTEGRATION.md (create: REPL guide)
- docs/THEMING.md (create: TDS color guide)

### Integration Files (3 files):
- bash/rag/core/kb_manager.sh (update: tdoc→tdocs calls)
- bash/org/VIEW_DOCS.sh (update: module loading)
- bash/tree/test_tdoc_help.sh (rename: test_tdocs_help.sh)

**Total**: ~45 files modified/created

---

## Appendix B: Command Reference

### Shell Commands (Work in REPL)
```bash
$ tdocs> ls                  # Shell ls
$ tdocs> pwd                 # Shell pwd
$ tdocs> cd bash/rag/docs    # Shell cd
$ tdocs> git status          # Shell git
$ tdocs> find . -name "*.md" # Shell find
```

### Module Slash Commands (tdocs-specific)
```bash
$ tdocs> /ls                     # List docs
$ tdocs> /ls --core              # List core docs
$ tdocs> /ls --module rag        # List rag module docs
$ tdocs> /view README.md         # View document
$ tdocs> /search "query"         # Search docs
$ tdocs> /tag file.md            # Tag document
$ tdocs> /init file.md           # Initialize metadata
$ tdocs> /filter core            # Set filter
$ tdocs> /filter clear           # Clear filters
$ tdocs> /env toggle             # Toggle environment
$ tdocs> /audit                  # Find untracked docs
$ tdocs> /evidence "query"       # Get evidence for RAG
```

### Meta Slash Commands (REPL built-ins)
```bash
$ tdocs> /help                   # Show help
$ tdocs> /help ls                # Command-specific help
$ tdocs> /history 20             # Show history
$ tdocs> /clear                  # Clear screen
$ tdocs> /exit                   # Exit REPL
$ tdocs> /quit                   # Exit REPL
```

---

## Appendix C: Color Token Examples

### Category Badges

**Code**:
```bash
local color=$(tdocs_color_category "$category")
echo "${color}[${category^^}]$(tds_reset_color)"
```

**Output** (Tokyo Night theme):
- `[CORE]` → Teal color
- `[OTHER]` → Gray color

**Output** (Solarized Light theme):
- `[CORE]` → Blue color
- `[OTHER]` → Dim gray

### Status Indicators

**Code**:
```bash
local color=$(tdocs_color_status "$status")
echo "${color}[$status]$(tds_reset_color)"
```

**Output** (any theme):
- `[draft]` → Warning color (yellow/orange)
- `[stable]` → Success color (green)
- `[deprecated]` → Error color (red)

### Full Metadata Header

**Code**:
```bash
local cat_color=$(tdocs_color_category "$category")
local status_color=$(tdocs_color_status "$status")
local ev_color=$(tdocs_color_evidence "$evidence_weight")

echo "${cat_color}[$category]$(tds_reset_color) ${status_color}[$status]$(tds_reset_color) ${ev_color}[$evidence_weight]$(tds_reset_color) | $module | $title"
```

**Output** (colorized):
```
[core] [stable] [primary] | rag | Authentication System
 ^^^^   ^^^^^^   ^^^^^^^
 teal   green    bright-green
```

---

## Contact & Support

**Questions**: Open an issue or discussion in the Tetra repository

**Implementation**: Start with Phase 1 (REPL consolidation), then move to tdocs refactor

**Status**: Ready for implementation (all design decisions made)

---

*End of Plan*
