# Tetra REPL Standardization - Phase 1 Complete

**Date:** 2025-10-30
**Status:** ✅ Phase 1 Complete | 🚧 Phase 2 Planned

---

## Executive Summary

We've successfully standardized the Tetra REPL and help system architecture. All modules will now follow a unified "Tetra Way" that provides:

- ✅ Consistent REPL patterns across all modules
- ✅ Hybrid command routing (`/mod.action` and `/action`)
- ✅ Tree-based help with progressive disclosure
- ✅ 3-tier tab completion (static, dynamic, tree-based)
- ✅ Module registry for cross-module discovery
- ✅ Comprehensive documentation and migration guides

---

## Phase 1: Completed Work

### 1. Core REPL Framework Enhancements

**File: `bash/repl/command_processor.sh`**
- Added module registry system
  - `REPL_MODULE_REGISTRY` - Tracks modules and their commands
  - `REPL_MODULE_HANDLERS` - Maps module.command to handler functions
  - `REPL_MODULE_CONTEXT` - Tracks active module context
- Implemented hybrid command routing
  - `/mod.action` - Explicit module-qualified routing
  - `/action` - Context-aware routing (searches current module first, then all modules)
- Enhanced `repl_dispatch_slash()` with 5-level priority system:
  1. Module registered handlers (overrides)
  2. Slash command handlers
  3. Built-in meta commands
  4. Tree-based handler lookup
  5. Legacy action system
- Added new API functions:
  - `repl_register_module(name, commands, namespace)`
  - `repl_register_module_handler(path, handler)`
  - `repl_set_module_context(name)`
  - `repl_get_module_context()`

**File: `bash/repl/completion.sh` (NEW)**
- Created completion registration API
  - `repl_register_static_completion(command, values)` - Fixed value lists
  - `repl_register_dynamic_completion(command, function)` - Runtime values
  - `repl_get_completions(command, current_word)` - Query system
  - `repl_show_completions(command, current_word)` - Display helper
- Supports both inline display and programmatic access

### 2. Tree-Based Help System

**File: `bash/tree/builders.sh` (NEW)**
- Created high-level builder utilities for common patterns
  - `tree_build_category(path, title, help)` - Category nodes
  - `tree_build_command(path, title, help, synopsis, examples, handler, completion_fn)` - Full command nodes
  - `tree_build_action(path, title, help, handler, completion_fn, completion_values)` - Action nodes
  - `tree_build_flag(path, title, help, short_flag)` - Boolean flags
  - `tree_build_option(path, title, help, short_opt, default, completion_values)` - Key-value options
  - `tree_build_module_spec(module_name)` - Bulk builder from spec
- Auto-registers handlers in REPL system when provided
- Reduces boilerplate in module help files

**File: `bash/tree/tree_repl_complete.sh` (ENHANCED)**
- Added dynamic completion support
  - Checks `completion_fn` metadata on tree nodes
  - Calls dynamic function to get runtime values
  - Falls back to static `completion_values`
- Enhanced both completion contexts:
  - `tree_repl_completion()` - For bash completion system
  - `_tree_repl_complete()` - For readline (bind -x)
- Filters values by current word for smart matching

**File: `bash/tree/shell_complete.sh` (NEW)**
- Created CLI mode bash completion generator
  - `tree_generate_shell_completion(command, namespace)` - Generate completion function
  - `tree_register_shell_completion(module, namespace)` - Register for module
  - `tree_generate_completion_script(module, namespace)` - Create standalone file
  - `tree_install_all_completions(output_dir)` - Install for all registered modules
- Supports both static and dynamic completions
- Generates standalone scripts for ~/.bash_completion.d/

### 3. Pattern Standardization

**File: `bash/game/games/estoface/core/estoface_repl.sh` (FIXED)**
- Removed custom `while` loop (anti-pattern)
- Now uses standard `repl_run()` pattern
- Removed custom readline bindings (`bind -x`)
- Now uses `tree_repl_enable_completion()`
- Follows same pattern as pulsar/formant (consistency)
- Properly exports and cleans up callback overrides

### 4. Documentation

**File: `bash/repl/TETRA_WAY.md` (NEW) - 7000+ words**

Comprehensive standard defining:
- Core principles (TETRA_SRC is sacred, consistency over customization)
- Module structure (directory layout, file naming, function naming)
- REPL implementation (standard pattern, anti-patterns)
- Help tree system (namespace rules, metadata requirements)
- Command routing (hybrid support, resolution priority)
- Tab completion (3-tier system, static + dynamic)
- Module registration (API usage, benefits)
- Testing & validation (checklists, validation tests)

**File: `MIGRATION_GUIDE.md` (NEW)**

Step-by-step migration guide with:
- Breaking changes explained
- Migration checklist (6 phases)
- Step-by-step instructions
- Before/after examples for:
  - Estoface REPL (custom loop → standard pattern)
  - Help systems (custom → tree-based)
  - Completions (custom bindings → tree-based)
- Common issues and solutions
- Recommended migration order

---

## Architecture Overview

### Unified Tree Structure

All help content lives in a single global tree with namespace prefixes:

```
help.MODULE[.CATEGORY].ACTION

Examples:
  help.rag                    # Module root
  help.rag.flow               # Category
  help.rag.flow.create        # Action
  help.game.play              # Direct action
  help.org.project.create     # Nested action
```

### Dual Access Paths

```
┌─────────────────────────────────────┐
│     Unified Tree Structure          │
│     (bash/tree/core.sh)             │
│                                     │
│  help.rag.flow.create               │
│  help.game.play                     │
│  help.org.add                       │
└─────────────────────────────────────┘
              │
    ┌─────────┴──────────┐
    │                    │
    ▼                    ▼
┌─────────┐      ┌──────────────┐
│  thelp  │      │  REPL /help  │
│ (CLI)   │      │  (REPL)      │
├─────────┤      ├──────────────┤
│ Quick   │      │ Interactive  │
│ No REPL │      │ Paginated    │
│ Fast    │      │ TAB browse   │
└─────────┘      └──────────────┘
```

### Hybrid Command Routing

**In CLI Mode (Augment):**
```bash
$ /rag.flow.create "desc"     # Explicit
$ /flow.create "desc"         # Context-aware
$ /help                       # Meta commands
```

**In REPL Mode (Takeover):**
```bash
rag> flow create "desc"       # Direct (context)
rag> /rag.flow.create "desc"  # Explicit (also works)
rag> !ls                      # Shell escape
rag> /mode                    # Toggle mode
```

### Three-Tier Completion

1. **Tree structure** - Shows available commands/categories
2. **Dynamic values** - Calls `completion_fn` for runtime values
3. **Static values** - Uses `completion_values` for fixed lists

---

## Key Benefits

### For Module Developers
- **Less code** - Use builders instead of manual help text
- **Consistency** - Standard pattern works everywhere
- **Features for free** - `/help`, `/mode`, `/theme`, `/history`, `/clear`
- **Easy testing** - Standard validation checklist

### For Users
- **Predictable** - All REPLs work the same way
- **Discoverable** - TAB completion everywhere
- **Flexible** - Both `/mod.action` and `/action` work
- **Fast** - `thelp` for quick CLI reference, REPL for exploration

### For Tetra
- **Maintainable** - One pattern to understand and fix
- **Extensible** - New modules follow template
- **Documented** - Complete specification + migration guide
- **Tested** - Estoface proves it works

---

## Current State

### ✅ Implemented
- Core REPL framework with module registry
- Hybrid command routing system
- Tree builder utilities
- Dynamic/static completion support
- Shell completion generator
- Estoface REPL fixed
- Complete documentation (TETRA_WAY.md, MIGRATION_GUIDE.md)

### 🚧 Not Yet Implemented
- Game help system migrations (pulsar, formant)
- RAG help system migration
- Org help system migration
- Module REPL registration updates
- thelp harmonization
- bash/repl/README.md updates
- Module generator script
- Full integration testing

---

## Phase 2: Continuation Plan

See `CONTINUATION_PLAN.md` for detailed Phase 2 roadmap including:
- thelp harmonization and enhancements
- Module help migrations (games, rag, org, melvin, tdoc)
- Module REPL updates (registration, context setting)
- Module generator template
- Documentation updates
- Integration testing
- Shell completion installation

---

## Files Modified

**Modified:**
- `bash/repl/command_processor.sh` - Added module registry, hybrid routing
- `bash/tree/tree_repl_complete.sh` - Added dynamic completion support
- `bash/game/games/estoface/core/estoface_repl.sh` - Fixed to use standard pattern

**Created:**
- `bash/repl/completion.sh` - Completion registration API
- `bash/tree/builders.sh` - Help tree builders
- `bash/tree/shell_complete.sh` - Shell completion generator
- `bash/repl/TETRA_WAY.md` - Official standard (7000+ words)
- `MIGRATION_GUIDE.md` - Step-by-step migration guide
- `REFACTOR_SUMMARY.md` - This file
- `CONTINUATION_PLAN.md` - Phase 2 roadmap

---

## Next Steps

1. Review and approve Phase 2 plan (`CONTINUATION_PLAN.md`)
2. Execute thelp harmonization
3. Migrate module help systems
4. Update module REPLs with registration
5. Test hybrid routing end-to-end
6. Document any issues discovered
7. Consider generating completions for all modules

---

## Success Metrics

**Phase 1 Complete When:**
- ✅ Core framework implemented
- ✅ Tree builders available
- ✅ At least one module (estoface) migrated
- ✅ Documentation complete

**Phase 2 Complete When:**
- All game modules migrated
- Core modules (rag, org) migrated
- thelp fully harmonized
- All modules registered
- Integration tests pass
- Shell completions installable

---

## References

**Standards:**
- `bash/repl/TETRA_WAY.md` - The official standard
- `MIGRATION_GUIDE.md` - How to migrate

**Examples:**
- `bash/game/games/estoface/core/estoface_repl.sh` - Newly fixed
- `bash/game/games/pulsar/pulsar_repl.sh` - Best practice

**Core Files:**
- `bash/repl/command_processor.sh` - Routing dispatcher
- `bash/tree/builders.sh` - Help tree builders
- `bash/tree/tree_repl_complete.sh` - REPL completion
- `bash/tree/shell_complete.sh` - Shell completion

---

**Status:** Ready for Phase 2 ✅
