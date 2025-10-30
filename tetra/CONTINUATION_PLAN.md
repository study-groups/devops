# Tetra REPL Standardization - Phase 2 Continuation Plan

**Date:** 2025-10-30
**Prerequisites:** Phase 1 Complete (see REFACTOR_SUMMARY.md)
**Estimated Effort:** 15-20 tasks

---

## Overview

Phase 2 focuses on migrating existing modules to the new standard and harmonizing the thelp system with the unified tree architecture. This creates a complete, consistent help and command system across all of Tetra.

---

## Goals

1. **thelp Harmonization** - Integrate thelp with module registry and tree builders
2. **Module Migrations** - Migrate all module help systems to tree-based approach
3. **REPL Updates** - Add module registration to all REPLs
4. **Testing** - Validate hybrid routing and completions work end-to-end
5. **Documentation** - Update remaining docs with new patterns
6. **Tooling** - Create module generator for future modules

---

## Phase 2 Tasks

### Part A: thelp Harmonization (Priority: HIGH)

#### Task A1: Review Current thelp Implementation
**Goal:** Understand how thelp currently works and identify integration points

**Actions:**
- Read `bash/thelp/thelp.sh` in detail
- Identify current tree access patterns
- Document current path resolution logic
- Note any hard-coded module assumptions
- Check for completion support

**Deliverable:** Notes on thelp architecture and integration points

#### Task A2: Enhance thelp with Module Registry Awareness
**Goal:** Make thelp aware of registered modules for auto-discovery

**Changes to `bash/thelp/thelp.sh`:**
1. Source `bash/repl/command_processor.sh` to access `REPL_MODULE_REGISTRY`
2. Add `thelp --modules` command to list all registered modules
3. Enhance path resolution to check registry for valid modules
4. Update `--list` to use registry if available

**Example:**
```bash
# New behavior
$ thelp --modules
Available modules:
  rag      - Retrieval-Augmented Generation
  game     - Game REPL launcher
  org      - Organization management
  melvin   - Documentation system

$ thelp rag.flow.create
# Uses REPL_MODULE_REGISTRY to validate 'rag' is a real module
```

**Deliverable:** Enhanced thelp with module registry integration

#### Task A3: Add Dynamic Completion Support to thelp
**Goal:** Enable thelp to call `completion_fn` from tree nodes

**Changes to `bash/thelp/thelp.sh`:**
1. When showing help for a command, check for `completion_fn` metadata
2. If present, call it and show available values
3. Add `thelp --complete <path>` command for scripting
4. Support filtering by current word

**Example:**
```bash
$ thelp --complete rag.flow.list
active-flow-1
active-flow-2
completed-flow-3

$ thelp --complete game.play
pulsar
formant
estoface
```

**Deliverable:** thelp with dynamic completion support

#### Task A4: Generate Shell Completion for thelp Command
**Goal:** Enable `thelp <TAB>` in bash shell

**Actions:**
1. Use `tree_register_shell_completion "thelp" "help"`
2. Create completion script for thelp itself
3. Test multi-level completion: `thelp rag.<TAB>`, `thelp rag.flow.<TAB>`
4. Document installation in thelp README

**Example:**
```bash
$ thelp ra<TAB>          # Completes to 'rag'
$ thelp rag.<TAB>        # Shows: flow txn doc
$ thelp rag.flow.<TAB>   # Shows: create list resume
```

**Deliverable:** Shell completion for thelp command

#### Task A5: Update thelp README
**Goal:** Document new features and relationship to REPL help

**Additions:**
- Explain thelp vs REPL /help (when to use each)
- Document `--modules`, `--complete` flags
- Show tab completion examples
- Link to TETRA_WAY.md for tree building

**Deliverable:** Updated `bash/thelp/README.md`

---

### Part B: Game Module Migrations (Priority: HIGH)

#### Task B1: Migrate Pulsar Help to Tree Structure
**Goal:** Convert pulsar help to use tree builders

**File: `bash/game/games/pulsar/pulsar_help.sh`**

**Current State:**
- Uses direct `tree_insert` calls
- 18-line paginated display
- Tree-based but verbose

**Migration:**
1. Replace `tree_insert` with `tree_build_*()` calls
2. Add `handler` metadata for each action
3. Add `completion_fn` for dynamic completions (sprite IDs, etc.)
4. Add `completion_values` for static completions (sprite types, etc.)
5. Follow `help.game.pulsar.*` namespace

**Example Before:**
```bash
tree_insert "pulsar" category title="Pulsar Engine" help="..."
tree_insert "pulsar.engine" category title="Engine Control" help="..."
tree_insert "pulsar.engine.start" command title="Start" help="..." synopsis="..."
```

**Example After:**
```bash
source "$TETRA_SRC/bash/tree/builders.sh"

tree_build_category "help.game.pulsar" "Pulsar Engine" "Sprite animation engine"
tree_build_category "help.game.pulsar.engine" "Engine Control" "Start and manage engine"
tree_build_command "help.game.pulsar.engine.start" \
    "Start Engine" \
    "Start the Pulsar animation engine" \
    "start [grid_w] [grid_h]" \
    "start 80 24" \
    "pulsar_repl_start"
```

**Deliverable:** Migrated `pulsar_help.sh` using tree builders

#### Task B2: Migrate Formant Help to Tree Structure
**Goal:** Convert formant help to use tree builders

**File: `bash/game/games/formant/formant_help.sh` (if exists)**

**Actions:**
1. Similar to pulsar migration
2. Use `help.game.formant.*` namespace
3. Add handlers and completions
4. Document phoneme completions (static values)

**Deliverable:** Migrated formant help using tree builders

#### Task B3: Update Game Registry with Namespaces
**Goal:** Add namespace information to game registry

**File: `bash/game/core/game_registry.sh`**

**Changes:**
1. Add `GAME_REGISTRY_NAMESPACE` associative array
2. Map game IDs to help namespaces
3. Use in game_play() to set module context

**Example:**
```bash
declare -gA GAME_REGISTRY_NAMESPACE=(
    [pulsar]="help.game.pulsar"
    [formant]="help.game.formant"
    [estoface]="help.game.estoface"
)
```

**Deliverable:** Updated game registry with namespaces

#### Task B4: Update Game REPLs with Registration
**Goal:** Add module registration to all game REPLs

**Files:**
- `bash/game/games/pulsar/pulsar_repl.sh`
- `bash/game/games/formant/formant_repl.sh`
- `bash/game/games/estoface/core/estoface_repl.sh` (already done)

**Changes (in main entry function):**
```bash
pulsar_game_repl_run() {
    # Register module
    repl_register_module "pulsar" "start stop spawn kill set list" "help.game.pulsar"
    repl_set_module_context "pulsar"

    # ... rest of setup
}
```

**Deliverable:** All game REPLs register themselves

---

### Part C: Core Module Migrations (Priority: MEDIUM)

#### Task C1: Migrate RAG Help to Tree Structure
**Goal:** Convert rag help to use tree builders

**File: `bash/rag/rag_help.sh` (create if doesn't exist)**

**Current State:**
- Check if help system exists
- May use custom help or tree_insert

**Migration:**
1. Create or update `rag_help.sh`
2. Use tree builders for all help
3. Follow `help.rag.*` namespace pattern
4. Add handlers: `rag_flow_create`, `rag_txn_commit`, etc.
5. Add dynamic completions: flow IDs, agent types, etc.

**Structure:**
```
help.rag
├── help.rag.flow
│   ├── help.rag.flow.create
│   ├── help.rag.flow.list
│   ├── help.rag.flow.resume
│   └── help.rag.flow.status
├── help.rag.txn
│   ├── help.rag.txn.begin
│   ├── help.rag.txn.commit
│   └── help.rag.txn.rollback
└── help.rag.doc
    ├── help.rag.doc.add
    └── help.rag.doc.search
```

**Deliverable:** Migrated `bash/rag/rag_help.sh`

#### Task C2: Update RAG REPL with Registration
**Goal:** Add module registration to rag REPL

**File: `bash/rag/rag_repl.sh`**

**Changes:**
```bash
rag_repl_run() {
    # Register module
    repl_register_module "rag" "flow txn doc" "help.rag"
    repl_set_module_context "rag"

    # ... rest of setup
}
```

**Deliverable:** RAG REPL registers itself

#### Task C3: Migrate Org Help to Tree Structure
**Goal:** Convert org help to use tree builders

**File: `bash/org/org_help.sh` (create if doesn't exist)**

**Structure:**
```
help.org
├── help.org.add
├── help.org.list
├── help.org.switch
├── help.org.project
│   ├── help.org.project.create
│   └── help.org.project.archive
└── help.org.member
    ├── help.org.member.add
    └── help.org.member.remove
```

**Deliverable:** Migrated `bash/org/org_help.sh`

#### Task C4: Update Org REPL with Registration
**Goal:** Add module registration to org REPL

**File: `bash/org/org_repl.sh`**

**Deliverable:** Org REPL registers itself

---

### Part D: Utility Module Migrations (Priority: LOW)

#### Task D1: Migrate Melvin Help to Tree Structure
**Goal:** Convert melvin help to use tree builders

**Structure:**
```
help.melvin
├── help.melvin.scan
├── help.melvin.status
├── help.melvin.classify
└── help.melvin.stats
```

**Deliverable:** Migrated melvin help

#### Task D2: Migrate tdoc Help to Tree Structure
**Goal:** Convert tdoc help to use tree builders

**Structure:**
```
help.tdoc
├── help.tdoc.generate
├── help.tdoc.view
└── help.tdoc.search
```

**Deliverable:** Migrated tdoc help

#### Task D3: Update Utility REPLs with Registration
**Goal:** Add registration to melvin, tdoc, logs, etc.

**Deliverable:** All utility modules register themselves

---

### Part E: Tooling & Automation (Priority: MEDIUM)

#### Task E1: Create Module Generator Script
**Goal:** Scaffold new modules following the standard

**File: `bash/utils/new_module.sh`**

**Features:**
- Interactive prompts for module name, description
- Generate directory structure
- Create stub files (module.sh, module_help.sh, module_repl.sh)
- Generate template help tree
- Create includes.sh
- Generate README.md

**Usage:**
```bash
$ bash/utils/new_module.sh

Module name: mymodule
Description: My awesome module
Has REPL? [y/n]: y
Commands (space-separated): cmd1 cmd2 cmd3

Creating bash/mymodule/...
  ✓ mymodule.sh
  ✓ mymodule_help.sh
  ✓ mymodule_repl.sh
  ✓ includes.sh
  ✓ README.md

Next steps:
1. Implement handlers in mymodule.sh
2. Update help tree in mymodule_help.sh
3. Test: source ~/tetra/tetra.sh && mymodule_repl_run
```

**Deliverable:** `bash/utils/new_module.sh` generator script

#### Task E2: Create Shell Completion Installer
**Goal:** One-command installation of all shell completions

**File: `bash/utils/install_completions.sh`**

**Features:**
1. Detect if bash-completion is installed
2. Find or create completion directory
3. Call `tree_install_all_completions()`
4. Add source line to ~/.bashrc if needed
5. Provide instructions for manual setup

**Usage:**
```bash
$ bash/utils/install_completions.sh

Detecting bash-completion... found
Installing completions to ~/.bash_completion.d/
  ✓ rag
  ✓ game
  ✓ org
  ✓ melvin
  ✓ tdoc
  ✓ thelp

Adding source line to ~/.bashrc... done

Completions installed! Restart your shell or run:
  source ~/.bashrc
```

**Deliverable:** `bash/utils/install_completions.sh` script

---

### Part F: Documentation Updates (Priority: MEDIUM)

#### Task F1: Update bash/repl/README.md
**Goal:** Add hybrid routing examples and new features

**Additions:**
- Hybrid routing section (`/mod.action` vs `/action`)
- Module registration examples
- Cross-module command usage
- Updated completion examples (static + dynamic)
- Link to TETRA_WAY.md

**Deliverable:** Updated `bash/repl/README.md`

#### Task F2: Update bash/tree/README.md
**Goal:** Document tree builders and new patterns

**Additions:**
- Tree builder utilities section
- Standard namespace patterns
- `completion_fn` and `completion_values` usage
- Dynamic completion examples
- Shell completion generation

**Deliverable:** Updated `bash/tree/README.md`

#### Task F3: Create Quick Start Guide
**Goal:** Simple guide for adding help to existing modules

**File: `bash/tree/QUICKSTART.md`**

**Content:**
- 5-minute guide to adding tree-based help
- Copy-paste template
- Common patterns (category, command, action)
- Testing commands

**Deliverable:** `bash/tree/QUICKSTART.md`

---

### Part G: Testing & Validation (Priority: HIGH)

#### Task G1: Create Integration Test Script
**Goal:** Automated testing of hybrid routing

**File: `bash/repl/test_hybrid_routing.sh`**

**Tests:**
1. Module registration works
2. `/mod.action` routing works
3. `/action` finds current module's actions
4. `/action` searches other modules
5. Context switching works
6. Tree-based handler lookup works

**Usage:**
```bash
$ bash bash/repl/test_hybrid_routing.sh

Testing hybrid routing...
  ✓ Module registration
  ✓ Explicit routing (/mod.action)
  ✓ Context-aware routing (/action)
  ✓ Cross-module routing
  ✓ Handler lookup
  ✓ Completion generation

All tests passed!
```

**Deliverable:** Test script for hybrid routing

#### Task G2: Create Completion Test Script
**Goal:** Validate tab completions work everywhere

**File: `bash/tree/test_completions.sh`**

**Tests:**
1. Tree structure completions
2. Static value completions
3. Dynamic function completions
4. Shell completions for thelp
5. REPL completions
6. Filter by current word

**Deliverable:** Test script for completions

#### Task G3: Manual Testing Checklist
**Goal:** Human-validated testing of all features

**Create:** `TESTING_CHECKLIST.md`

**Sections:**
- thelp functionality (commands, flags, completions)
- REPL help (navigation, pagination, TAB)
- Hybrid routing (all combinations)
- Module switching
- Completion (static, dynamic, tree)
- Mode switching
- Each migrated module

**Deliverable:** Testing checklist document

#### Task G4: Run Full Integration Tests
**Goal:** Execute all tests and document results

**Actions:**
1. Run automated tests
2. Work through manual checklist
3. Document any issues found
4. Fix critical issues
5. Document known limitations

**Deliverable:** Test results document

---

## Execution Order

Recommended order to minimize dependencies:

### Sprint 1: thelp Foundation (1-2 days)
1. A1: Review thelp implementation
2. A2: Add module registry awareness
3. A3: Add dynamic completion support
4. A4: Generate shell completion for thelp
5. A5: Update thelp README

### Sprint 2: Game Migrations (2-3 days)
6. B1: Migrate pulsar help
7. B2: Migrate formant help
8. B3: Update game registry
9. B4: Update game REPLs

### Sprint 3: Core Migrations (2-3 days)
10. C1: Migrate RAG help
11. C2: Update RAG REPL
12. C3: Migrate org help
13. C4: Update org REPL

### Sprint 4: Testing & Tooling (1-2 days)
14. G1: Create integration tests
15. G2: Create completion tests
16. E1: Create module generator
17. E2: Create completion installer

### Sprint 5: Documentation & Validation (1 day)
18. F1: Update bash/repl/README.md
19. F2: Update bash/tree/README.md
20. F3: Create quick start guide
21. G3: Manual testing checklist
22. G4: Run full integration tests

### Sprint 6: Utilities (optional, 1 day)
23. D1: Migrate melvin help
24. D2: Migrate tdoc help
25. D3: Update utility REPLs

**Total Estimated Time:** 7-11 days depending on scope

---

## Success Criteria

Phase 2 is complete when:

- ✅ thelp is fully harmonized with module registry
- ✅ thelp has shell completion
- ✅ All game modules use tree builders
- ✅ RAG and org modules use tree builders
- ✅ All modules register themselves in REPLs
- ✅ Hybrid routing works end-to-end
- ✅ TAB completion works in CLI and REPL
- ✅ Integration tests pass
- ✅ Documentation is updated
- ✅ Module generator script works
- ✅ Completion installer works

---

## Risk Mitigation

### Risk: Breaking existing module functionality
**Mitigation:**
- Test each module after migration
- Keep old help as comments initially
- Have rollback plan

### Risk: Incompatibilities between thelp and REPL help
**Mitigation:**
- Use same tree structure for both
- Test both access paths
- Document any differences

### Risk: Performance issues with large trees
**Mitigation:**
- Lazy tree building (only when needed)
- Cache completion results
- Profile if issues arise

### Risk: Incomplete testing coverage
**Mitigation:**
- Create automated tests early
- Manual checklist as backup
- Dog-food the system during development

---

## Post-Phase 2 Considerations

### Future Enhancements
- MCP server integration for remote help
- Web-based help browser
- Help search across all modules
- Completion caching for performance
- Help versioning for API changes

### Maintenance
- Document tree building patterns as they emerge
- Create linters for help tree quality
- Monitor completion performance
- Collect user feedback on routing

---

## Appendix: File Checklist

**To Create:**
- `bash/repl/test_hybrid_routing.sh`
- `bash/tree/test_completions.sh`
- `bash/tree/QUICKSTART.md`
- `bash/utils/new_module.sh`
- `bash/utils/install_completions.sh`
- `TESTING_CHECKLIST.md`
- Test results document

**To Modify:**
- `bash/thelp/thelp.sh`
- `bash/thelp/README.md`
- `bash/game/games/pulsar/pulsar_help.sh`
- `bash/game/games/formant/formant_help.sh` (or create)
- `bash/game/games/pulsar/pulsar_repl.sh`
- `bash/game/games/formant/formant_repl.sh`
- `bash/game/core/game_registry.sh`
- `bash/rag/rag_help.sh` (or create)
- `bash/rag/rag_repl.sh`
- `bash/org/org_help.sh` (or create)
- `bash/org/org_repl.sh`
- `bash/melvin/melvin_help.sh` (or create)
- `bash/tdoc/tdoc_help.sh` (or create)
- `bash/repl/README.md`
- `bash/tree/README.md`

**Total:** ~7 new files, ~15 modified files

---

**Ready to Execute:** ✅
**Depends On:** Phase 1 Complete
**Next Step:** Review and approve this plan, then begin Sprint 1
