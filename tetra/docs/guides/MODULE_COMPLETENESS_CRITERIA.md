# Tetra Module Completeness Criteria

**Version:** 1.0
**Date:** 2025-11-03
**Status:** Standard

## Overview

This document defines the **completeness criteria** for Tetra modules. A complete module properly implements the standard interfaces for **REPL, actions, help, and storage** according to Tetra conventions.

## Quick Reference

A **complete Tetra module** has:

```
✅ includes.sh        - Module loader
✅ <module>.sh        - Core functionality
✅ actions.sh         - TUI/action integration
✅ <module>_repl.sh   - Interactive REPL
✅ <module>_tree.sh   - Tree-based help
✅ README.md          - Documentation
✅ $MOD_DIR/          - Runtime data directory
✅ $MOD_DIR/db/       - Primary key database
```

## Module Completeness Levels

### Level 1: Functional Module (Minimum)
Basic working module with core functionality.

**Required:**
- ✅ `includes.sh` - Module loader
- ✅ `<module>.sh` - Core functions
- ✅ Strong globals (`MOD_SRC`, `MOD_DIR`)
- ✅ Runtime directories created

**Example:** `bash/python/includes.sh`, `bash/nh/includes.sh`

### Level 2: Integrated Module (Standard)
Module integrated with Tetra conventions.

**Required (Level 1 +):**
- ✅ `actions.sh` - Action definitions
- ✅ `README.md` - Module documentation
- ✅ Action registry integration
- ✅ Unified logging support

**Example:** `bash/pbase/`, `bash/tkm/`

### Level 3: Interactive Module (Enhanced)
Module with full interactive capabilities.

**Required (Level 2 +):**
- ✅ `<module>_repl.sh` - Interactive REPL
- ✅ `<module>_tree.sh` - Tree-based help
- ✅ `<module>_completion.sh` - Tab completion
- ✅ trepl registration
- ✅ Help system integration

**Example:** `bash/org/`, `bash/rag/`, `bash/tdocs/`

### Level 4: Complete Module (Gold Standard)
Fully complete with all integrations.

**Required (Level 3 +):**
- ✅ `tests/` directory with test suite
- ✅ TCS 4.0 compliant paths
- ✅ Database pattern (`$MOD_DIR/db/`)
- ✅ TES integration (if applicable)
- ✅ Comprehensive documentation
- ✅ Example scripts

**Example:** `bash/org/`, `bash/tsm/`, `bash/tubes/`

## Detailed Criteria

### 1. Directory Structure

```
bash/<module>/
├── includes.sh              # ✅ Required - Module loader
├── <module>.sh              # ✅ Required - Core functionality
├── <module>_paths.sh        # ⭐ Gold - TCS 4.0 paths
├── <module>_core.sh         # ⭐ Gold - Business logic
├── actions.sh               # ✅ Standard - Action definitions
├── <module>_repl.sh         # ✅ Enhanced - Interactive REPL
├── <module>_tree.sh         # ✅ Enhanced - Tree help
├── <module>_completion.sh   # ✅ Enhanced - Tab completion
├── profiles/                # ⭐ Gold - Configuration profiles
│   └── default.conf
├── tests/                   # ⭐ Gold - Test suite
│   ├── test_basic.sh
│   └── example_*.sh
└── README.md                # ✅ Standard - Documentation

$TETRA_DIR/<module>/
├── db/                      # ⭐ Gold - Primary key database
│   └── *.json
├── config/                  # ⭐ Gold - Configuration
├── logs/                    # ⭐ Gold - Module logs
└── cache/                   # ⭐ Gold - Temporary data
```

### 2. includes.sh Pattern

**Purpose:** Standard entry point for module loading.

**Required Elements:**
```bash
#!/usr/bin/env bash

# Module name includes
# Follow tetra convention: MOD_SRC for source, MOD_DIR for runtime

# Strong globals (per CLAUDE.md)
MOD_SRC="${MOD_SRC:-$TETRA_SRC/bash/<module>}"
MOD_DIR="${MOD_DIR:-$TETRA_DIR/<module>}"

# Backward compatibility (optional)
MODULE_SRC="$MOD_SRC"
MODULE_DIR="$MOD_DIR"

# Create runtime directories
[[ ! -d "$MOD_DIR" ]] && mkdir -p "$MOD_DIR"
[[ ! -d "$MOD_DIR/db" ]] && mkdir -p "$MOD_DIR/db"     # Gold
[[ ! -d "$MOD_DIR/config" ]] && mkdir -p "$MOD_DIR/config"  # Gold
[[ ! -d "$MOD_DIR/logs" ]] && mkdir -p "$MOD_DIR/logs"      # Gold

# Export for subprocesses
export MOD_SRC MOD_DIR MODULE_SRC MODULE_DIR

# Source main module
source "$MOD_SRC/<module>.sh"

# Initialize (optional)
if declare -f <module>_init >/dev/null 2>&1; then
    <module>_init
fi
```

**Examples:**
- ✅ Good: `bash/org/includes.sh`, `bash/tubes/includes.sh`
- ✅ Minimal: `bash/python/includes.sh`, `bash/nh/includes.sh`

### 3. Core Module (<module>.sh)

**Purpose:** Main module functionality and public API.

**Required Elements:**
```bash
#!/usr/bin/env bash

# <module>.sh - Module description

# Source dependencies (if needed)
source "${MODULE_SRC}/<module>_paths.sh"    # Gold
source "${MODULE_SRC}/<module>_core.sh"     # Gold

# Main command dispatcher
<module>() {
    local subcommand="${1:-help}"
    shift 2>/dev/null || true

    case "$subcommand" in
        command1)
            <module>_command1 "$@"
            ;;
        command2)
            <module>_command2 "$@"
            ;;
        help|--help|-h)
            <module>_help
            ;;
        *)
            echo "Unknown command: $subcommand"
            <module>_help
            return 1
            ;;
    esac
}

# Export main function
export -f <module>
```

### 4. actions.sh Pattern

**Purpose:** Integration with TUI and action system.

**Required Elements:**
```bash
#!/usr/bin/env bash

# <module>/actions.sh - TUI integration

# Action: <description>
<module>_action_<name>() {
    local arg1="$1"
    local arg2="$2"

    # Log action start
    tetra_log_info "<module>" "<action>" "compact" "jsonl" "$arg1"

    # Execute action
    if <module>_<action> "$arg1" "$arg2"; then
        tetra_log_success "<module>" "<action>" "compact" "jsonl"
        return 0
    else
        tetra_log_error "<module>" "<action>" "compact" "jsonl"
        return 1
    fi
}

# Export actions
export -f <module>_action_<name>
```

**Examples:**
- ✅ Complete: `bash/org/actions.sh`, `bash/tsm/actions.sh`
- ✅ Simple: `bash/tubes/actions.sh`, `bash/pbase/actions.sh`

### 5. REPL Integration

**Purpose:** Interactive shell for module.

**Required Elements:**
```bash
#!/usr/bin/env bash

# <module>_repl.sh - Interactive REPL

# Source universal REPL system
source "$TETRA_SRC/bash/repl/repl.sh"

# Set module name for completion
REPL_MODULE_NAME="<module>"

# Register with REPL system
repl_register_module "<module>" \
    "command1 command2 command3" \
    "help.<module>"

# Module-specific prompt (optional)
<module>_repl_prompt() {
    echo "<module>> "
}

# Entry point
<module>_repl() {
    # Set history location
    REPL_HISTORY_BASE="${TETRA_DIR}/<module>/history/<module>_repl"

    # Run REPL
    repl_run
}

# Export entry point
export -f <module>_repl
```

**trepl Registration:**
Add to `bash/repl/trepl.sh`:
```bash
TREPL_REGISTRY[<module>]="$TETRA_SRC/bash/<module>/<module>_repl.sh"
TREPL_DESCRIPTIONS[<module>]="Module description"
```

**Examples:**
- ✅ Complete: `bash/org/org_repl.sh`, `bash/rag/rag_repl.sh`
- ✅ Standard: `bash/tdocs/tdocs_repl.sh`, `bash/qa/qa_repl.sh`

### 6. Tree-Based Help

**Purpose:** Hierarchical help system integration.

**Required Elements:**
```bash
#!/usr/bin/env bash

# <module>_tree.sh - Tree-based help structure

# Source tree system
source "$TETRA_SRC/bash/tree/core.sh"
source "$TETRA_SRC/bash/tree/help.sh"

# Initialize help tree
<module>_tree_init() {
    # Root
    tree_insert "<module>" category \
        title="<Module Name>" \
        help="Module description"

    # Commands
    tree_insert "<module>.command1" command \
        title="Command 1" \
        help="Command description" \
        synopsis="<module> command1 [options]" \
        detail="Detailed description..." \
        examples="<module> command1 example"

    # More commands...
}

# Auto-initialize
<module>_tree_init 2>/dev/null || true
```

**Examples:**
- ✅ Complete: `bash/org/org_tree.sh`, `bash/rag/rag_repl.sh` (inline)
- ✅ Standard: `bash/tdocs/tdocs_repl.sh` (inline)

### 7. Database Pattern (Gold Standard)

**Purpose:** TCS 4.0 compliant timestamped database.

**Required Structure:**
```
$TETRA_DIR/<module>/
└── db/
    ├── <timestamp>.action.json      # Action records
    ├── <timestamp>.result.json      # Results
    ├── <timestamp>.state.json       # State snapshots
    └── <timestamp>.<type>.<ext>     # Data files
```

**Path Functions (in `<module>_paths.sh`):**
```bash
# Get database directory
<module>_get_db_dir() {
    echo "$MODULE_DIR/db"
}

# Generate timestamp
<module>_generate_timestamp() {
    date +%s
}

# Get database path
<module>_get_db_path() {
    local timestamp="$1"
    local type="$2"
    local extension="${3:-json}"
    echo "$(<module>_get_db_dir)/${timestamp}.${type}.${extension}"
}
```

**Examples:**
- ✅ Complete: `bash/tubes/tubes_paths.sh`, `bash/tsm/` (TCS 3.0)
- ✅ Emerging: `bash/org/`, `bash/rag/`

### 8. Documentation Requirements

**README.md Required Sections:**
```markdown
# <module> - Module Name

**Version:** X.Y
**Status:** [Stable|Beta|Alpha]

## Overview
Brief description (2-3 paragraphs)

## Quick Start
```bash
# Load module
source ~/tetra/tetra.sh
tmod load <module>

# Basic usage
<module> command1
<module> command2
```

## Features
- Feature 1
- Feature 2

## Commands
Command reference

## REPL Usage
If applicable

## Configuration
If applicable

## Examples
Working examples

## Integration
How module integrates with tetra

## Troubleshooting
Common issues

## References
- Related modules
- Documentation links
```

**Examples:**
- ✅ Complete: `bash/tubes/README.md`, `bash/org/README.md`
- ✅ Standard: Most modules have basic READMEs

## Module Checklist

Use this checklist to assess module completeness:

### Core Infrastructure ✅
- [ ] `includes.sh` exists
- [ ] Strong globals defined (`MOD_SRC`, `MOD_DIR`)
- [ ] Runtime directories created
- [ ] Main module file (`<module>.sh`)
- [ ] Command dispatcher implemented
- [ ] Help function exists

### Actions & Integration ✅
- [ ] `actions.sh` exists
- [ ] Actions use unified logging
- [ ] Actions exported properly
- [ ] TUI integration (if applicable)

### Interactive Features ✅
- [ ] `<module>_repl.sh` exists
- [ ] Registered with `trepl`
- [ ] REPL uses universal system
- [ ] Tab completion works
- [ ] History persists

### Help System ✅
- [ ] Tree-based help implemented
- [ ] Help topics organized hierarchically
- [ ] Examples provided
- [ ] Synopsis shows usage

### Storage & State ⭐
- [ ] `$MOD_DIR/db/` exists
- [ ] Timestamped database pattern
- [ ] Path functions defined
- [ ] Configuration directory
- [ ] Logs directory

### Documentation ✅
- [ ] `README.md` exists
- [ ] Quick start section
- [ ] Command reference
- [ ] Examples provided
- [ ] Integration documented

### Testing ⭐
- [ ] `tests/` directory exists
- [ ] Basic test suite
- [ ] Example scripts
- [ ] Tests pass

## Audit Process

### Step 1: Identify Level

Determine current completeness level:
```bash
# Check what exists
ls bash/<module>/

# Level 1: Has includes.sh and core
# Level 2: + actions.sh, README
# Level 3: + REPL, tree help
# Level 4: + tests, full TCS 4.0
```

### Step 2: Gap Analysis

List missing components:
```bash
# Missing REPL?
[ ! -f "bash/<module>/<module>_repl.sh" ] && echo "Missing REPL"

# Missing actions?
[ ! -f "bash/<module>/actions.sh" ] && echo "Missing actions"

# Missing tests?
[ ! -d "bash/<module>/tests" ] && echo "Missing tests"
```

### Step 3: Prioritize Improvements

**Priority 1 (High Impact):**
- REPL (user interaction)
- actions.sh (TUI integration)
- Tree help (discoverability)

**Priority 2 (Medium Impact):**
- Tests (quality)
- Database pattern (state management)
- Documentation (adoption)

**Priority 3 (Polish):**
- Profiles (configuration)
- Examples (learning)
- Advanced features

### Step 4: Implement Missing Pieces

Use templates from complete modules:
- **REPL template**: `bash/org/org_repl.sh`
- **Actions template**: `bash/tubes/actions.sh`
- **Tree template**: `bash/org/org_tree.sh`
- **Tests template**: `bash/tubes/tests/test_basic.sh`

## Module Examples by Level

### Level 1: Functional
- `bash/python/` - Basic Python integration
- `bash/nh/` - NodeHolder bridge
- `bash/nvm/` - NVM wrapper

### Level 2: Integrated
- `bash/pbase/` - Polybase integration
- `bash/tkm/` - Key manager
- `bash/logs/` - Log management

### Level 3: Interactive
- `bash/org/` - Organization management (excellent REPL)
- `bash/rag/` - RAG workflows (TDS integration)
- `bash/tdocs/` - Document browser (search)
- `bash/qa/` - Question answering

### Level 4: Complete
- `bash/tubes/` - Terminal networks (full TCS 4.0, tests, docs)
- `bash/tsm/` - Service manager (comprehensive)
- `bash/org/` - Organization management (when tests added)

## Upgrade Paths

### Level 1 → Level 2
1. Add `actions.sh` with TUI integration
2. Create `README.md` with basic docs
3. Implement unified logging
4. Register actions

### Level 2 → Level 3
1. Create `<module>_repl.sh`
2. Register with `trepl`
3. Implement tree-based help
4. Add tab completion
5. Test interactivity

### Level 3 → Level 4
1. Create `tests/` directory
2. Add test suite
3. Implement TCS 4.0 paths
4. Add database pattern
5. Create example scripts
6. Comprehensive documentation

## Standards Compliance

### TCS 4.0 Compliance
- ✅ Strong globals (`TETRA_SRC`, `MOD_SRC`, `MOD_DIR`)
- ✅ Path functions pattern
- ✅ Timestamped database
- ✅ Unified logging
- ✅ Type contracts (advanced)

### Tetra Conventions
- ✅ `includes.sh` as entry point
- ✅ `<module>.sh` as main file
- ✅ Export main function
- ✅ Create runtime directories
- ✅ Use `tetra_log_*` functions

### REPL Conventions
- ✅ Source `bash/repl/repl.sh`
- ✅ Register with `repl_register_module`
- ✅ Use history system
- ✅ Implement help command
- ✅ Register with `trepl`

## Benefits of Complete Modules

### For Users
- Consistent experience across modules
- Discoverable via `trepl list`
- Interactive exploration via REPL
- Comprehensive help system
- Working examples

### For Developers
- Clear standards to follow
- Reusable patterns
- Testing framework
- Documentation templates
- Integration points defined

### For Tetra Ecosystem
- Uniform architecture
- Easy onboarding
- Quality assurance
- Maintainability
- Extensibility

## Conclusion

A **complete Tetra module** implements:
1. ✅ **Core** - includes.sh, module.sh, strong globals
2. ✅ **Actions** - TUI integration, unified logging
3. ✅ **REPL** - Interactive shell, trepl registration
4. ✅ **Help** - Tree-based, hierarchical
5. ⭐ **Storage** - TCS 4.0 database pattern
6. ✅ **Docs** - Comprehensive README
7. ⭐ **Tests** - Working test suite

Use this document as a **checklist** when creating or auditing modules.

## References

- [docs/reference/module-system.md](reference/module-system.md) - Module architecture
- [docs/INSTRUCTIONS_CORE_SPECIFICATION.md](INSTRUCTIONS_CORE_SPECIFICATION.md) - TCS 4.0
- [bash/repl/TREPL_README.md](../bash/repl/TREPL_README.md) - REPL system
- [bash/tree/README.md](../bash/tree/README.md) - Tree help system
- [bash/tubes/](../bash/tubes/) - Gold standard example
- [bash/org/](../bash/org/) - Complete interactive module
