# Tetra Consolidation Report

**Generated:** 2025-10-30
**Purpose:** Identify and consolidate organizational bloat in the tetra project

## Executive Summary

Tetra has grown to **68 bash modules** (11MB) with **651 shell scripts**. While the core architecture is solid, organizational debt has accumulated:

- 13 backup files (.bak) in git
- 20+ compiled object files (.o) in git
- 10+ scattered archive directories
- 194 README files
- 22 test scripts at project root
- Overlapping functionality in voice/UI modules

**The Essence:** ~30 core modules form the backbone. ~38 additional modules need review/consolidation.

---

## Current Structure

```
tetra/ (37MB total)
├── bash/           11MB - 68 modules, 651 scripts (THE ESSENCE)
├── server/         26MB - Node.js server
├── gamepad/        7.5MB
├── demo/           2.5MB
├── docs/           732KB
├── tests/          352KB
└── [22 test/debug scripts at root - MOVE THESE]
```

### Top 15 Bash Modules by Size

```
2.8M    game/          - Terminal games + C game engine
2.4M    vox/           - Voice synthesis
808K    rag/           - RAG system
612K    tsm/           - Service manager (PM2-like)
592K    org/           - Environment management
276K    tkm/           - Knowledge manager
228K    utils/         - Core utilities
208K    repl/          - Universal REPL
180K    estovox/       - Voice synthesis (OVERLAP with vox/)
160K    deploy/        - Deployment
152K    tds/           - Design system
144K    tetra/         - Core module
132K    tdoc/          - Documentation manager
128K    tree/          - Tree navigation
120K    midi/          - MIDI integration
```

---

## The 30 Core Modules (The Essence)

### System Core (5 modules)
- **boot/** - Bootstrap system
- **utils/** - Core utilities
- **logs/** - Unified logging
- **color/** - Color/theme system
- **tds/** - Design tokens

### Module Management (3 modules)
- **tmod/** - Module system
- **tsm/** - Service/process manager
- **tkm/** - Knowledge manager

### User Interface (4 modules)
- **repl/** - Universal REPL library
- **tcurses/** - Terminal primitives
- **tui/** - TUI framework
- **prompt/** - Shell prompt

### Environment & Deployment (4 modules)
- **org/** - Organization/environment
- **deploy/** - Deployment system
- **env/** - Environment config
- **spaces/** - Workspace management

### Development Tools (4 modules)
- **git/** - Git integration
- **qa/** - Quality assurance
- **tree/** - Tree navigation/completion
- **tdoc/** - Documentation

### External Integrations (5 modules)
- **rag/** - RAG system
- **melvin/** - AI assistant
- **claude/** - Claude API
- **ssh/** - SSH utilities
- **sync/** - Synchronization

### Python/Node (3 modules)
- **python/** - Python environment
- **nvm/** - Node version manager
- **node/** - Node.js utilities

### Specialized (2 modules)
- **vox/** - Voice synthesis
- **midi/** - MIDI integration

---

## Immediate Cleanup (Low Risk)

### 1. Remove Build Artifacts

```bash
# Remove compiled objects
find bash/game -name "*.o" -type f -delete

# Update .gitignore
cat >> .gitignore << 'EOF'
# Build artifacts
*.o
*.a
*.so
*.dylib

# Backup files
*.bak
*~
.*.swp
.*.swo

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db
EOF
```

**Impact:** Clean repo, faster git operations
**Risk:** None (can rebuild with make)

### 2. Remove Backup Files

```bash
# List what will be removed (review first)
find . -name "*.bak" -o -name "*~"

# Remove
find . -name "*.bak" -delete
find . -name "*~" -delete
```

**Files to remove:**
- 13 .bak files in bash/org/, bash/spaces/, bash/repl/, bash/tetra/, bash/vox/
- 1 ~ file in bash/tetra/

### 3. Remove Empty Directories

```bash
rmdir tserve/ org/ nh/ 2>/dev/null || true
rm CLAUDE.md  # Empty file (instructions are in ~/.claude/CLAUDE.md)
```

### 4. Consolidate Root Test Files

```bash
# Create test structure
mkdir -p tests/{integration,debug,modules}

# Move test files
mv test_*.sh tests/integration/
mv debug_*.sh tests/debug/
mv trace_*.sh tests/debug/
mv minimal_*.sh tests/debug/

# Update references in CI/docs
```

**22 files to move from root to tests/**

---

## Medium Priority Consolidation

### 5. Archive Strategy - Pick ONE Location

**Option A: Single /archive at root**
```bash
mkdir -p archive/{bash,docs,legacy}
mv legacy/* archive/legacy/
mv docs/archive/* archive/docs/
mv docs/legacy/* archive/docs/
mv bash/graveyard/* archive/bash/
# Review and move bash/*/archive/ individually
rmdir legacy docs/archive docs/legacy bash/graveyard
```

**Option B: Keep archives within modules**
```bash
# Move all legacy content into module-specific archives
# Delete bash/graveyard (only has venv.sh)
rm -rf bash/graveyard
# Consolidate docs archives
mv docs/legacy/* docs/archive/
rmdir docs/legacy
```

**Recommendation:** Option A (single /archive) - easier to find/purge old content

### 6. Documentation Consolidation

**Current state:**
- 194 README files scattered everywhere
- 20+ root-level markdown files
- Duplicate summaries

**Actions:**
```bash
mkdir -p docs/development
mv BOOTLOADER_REFACTOR.md docs/development/
mv CONTINUATION_PLAN.md docs/development/
mv DEPLOYMENT_GUIDE.md docs/guides/
mv MIGRATION_GUIDE.md docs/guides/
mv ORG_MODULE_FIX_SUMMARY.md docs/development/
mv PHASE1_COMPLETE.md docs/development/
mv REFACTOR_SUMMARY.md docs/development/

# Keep at root only:
# - README.md
# - CONTRIBUTING.md (if exists)
# - LICENSE (if exists)
```

### 7. Demo Directory Cleanup

**Issue:** demo/basic/001 through 014 - unclear purpose

**Action needed:**
```bash
# Create README explaining the numbering
cat > demo/basic/README.md << 'EOF'
# Tetra Basic Demos

Progressive demonstrations of tetra capabilities:

- 001-005: Early prototypes (archive candidates)
- 006-010: Core feature demos
- 011-014: Latest iterations

TODO: Consolidate or remove obsolete demos
EOF
```

Or consolidate to demo/{latest,archive}/

---

## Major Refactoring (Requires Planning)

### 8. Voice Synthesis Module Overlap

**Current state:**
- **bash/vox/** (2.4MB) - Voice synthesis system
- **bash/estovox/** (180KB) - Alternative voice synthesis
- **bash/game/games/estoface/** - Phoneme/facial animation
- **bash/game/games/formant/** - Formant synthesis

**Questions to answer:**
1. Is estovox/ a replacement for vox/ or complementary?
2. Should game voice engines be separate or integrated?
3. Can we consolidate into bash/voice/{vox,estovox,engines}?

**Action:** Document relationship or consolidate

### 9. UI Framework Consolidation

**Current state:**
- **bash/tcurses/** - Terminal primitives (input, buffers, screen)
- **bash/tui/** - TUI framework
- **bash/tetraboard/** - Another UI system?
- **bash/tds/** - Design tokens
- **bash/repl/** - REPL framework

**Ideal layering:**
```
repl/          - Application layer (uses tui)
  ↓
tui/           - Widget layer (uses tcurses)
  ↓
tcurses/       - Primitive layer (input/output)
  ↓
tds/           - Design tokens (colors, spacing)
```

**Action:** Document layering or consolidate redundant code

### 10. Module Audit - Document or Delete

**Unclear modules to review:**

| Module | Size | Files | Last Modified | Action Needed |
|--------|------|-------|---------------|---------------|
| agents/ | ? | 4 dirs | ? | Document purpose or delete |
| anthropic/ | ? | ? | ? | Consolidate with claude/? |
| ast/ | 52KB | ? | ? | Document or delete |
| code/ | small | 2 files | ? | Delete or integrate |
| graveyard/ | ? | venv.sh | ? | DELETE (archive first) |
| nh/ | small | 5 items | ? | Document or delete |
| pb/ | ? | ? | ? | Document purpose |
| pbase/ | ? | ? | ? | Relate to pb/ or delete |
| pbvm/ | ? | ? | ? | Relate to pb/ or delete |
| pico/ | 160KB | ? | ? | Document purpose |
| wip/ | 68KB | 17 files | Jul 20 | Archive or promote |
| watchdog/ | 224KB | ? | ? | Document purpose |

**Action:** For each module, either:
1. Add README.md explaining purpose and usage
2. Move to /archive if obsolete
3. Delete if truly orphaned

---

## Recommended Directory Structure

### After Consolidation

```
tetra/
├── bash/                   # Core modules (consolidated to ~50)
│   ├── boot/              # Bootstrap
│   ├── core/              # Merge: utils, logs, color, tds
│   ├── modules/           # Merge: tmod, tsm, tkm
│   ├── ui/                # Merge: tcurses, tui, repl, prompt
│   ├── env/               # Merge: org, spaces, deploy, env
│   ├── dev/               # Merge: git, qa, tree, tdoc
│   ├── integrations/      # Merge: rag, melvin, claude, ssh, sync
│   ├── runtime/           # Merge: python, nvm, node
│   ├── voice/             # Merge: vox, estovox
│   └── [other specialized modules as-is]
│
├── server/                 # Node.js server
├── gamepad/                # Gamepad support
├── demo/                   # Clean up numbered dirs
│   ├── latest/
│   └── archive/
│
├── docs/                   # All documentation
│   ├── guides/
│   ├── development/       # Move root .md files here
│   └── api/
│
├── tests/                  # All tests (move from root)
│   ├── integration/
│   ├── modules/
│   └── debug/
│
├── archive/                # Single archive location
│   ├── bash/
│   ├── docs/
│   └── legacy/
│
├── tools/                  # Build/deployment tools
├── bin/                    # Executables
├── README.md
└── .gitignore              # Updated

NOT in repo:
- *.o, *.a (build artifacts)
- *.bak, *~ (backup files)
- node_modules/ (except via package.json)
```

---

## Implementation Plan

### Phase 1: Immediate Cleanup (1-2 hours)
- [ ] Remove build artifacts and add to .gitignore
- [ ] Remove backup files and add to .gitignore
- [ ] Remove empty directories
- [ ] Move root test files to tests/

### Phase 2: Archive Consolidation (2-4 hours)
- [ ] Create /archive directory structure
- [ ] Move all archive/* content to /archive
- [ ] Move bash/graveyard to /archive/bash/graveyard
- [ ] Document archive policy in /archive/README.md
- [ ] Remove now-empty archive directories

### Phase 3: Documentation Cleanup (2-3 hours)
- [ ] Move root development docs to docs/development/
- [ ] Move guides to docs/guides/
- [ ] Audit excessive READMEs (194 files - many may be outdated)
- [ ] Create docs/index.md with navigation

### Phase 4: Module Audit (1 week)
- [ ] Review each unclear module
- [ ] Add README.md or move to archive
- [ ] Document voice module relationships
- [ ] Document UI framework layering
- [ ] Consolidate or clearly separate overlapping modules

### Phase 5: Major Refactoring (Future - requires planning)
- [ ] Consider consolidating related modules into directories
- [ ] Evaluate demo/ structure and cleanup numbered dirs
- [ ] Review node_modules duplication opportunities

---

## Success Metrics

**Before:**
- 68 modules in bash/
- 22 test files at root
- 13 backup files tracked
- 20+ .o files tracked
- 10+ archive locations
- 194 README files

**After Phase 1-3:**
- 68 modules in bash/ (same, but cleaner)
- 0 test files at root (moved to tests/)
- 0 backup files tracked
- 0 .o files tracked
- 1 archive location (/archive)
- ~150 README files (cleanup duplicates/outdated)

**After Phase 4:**
- ~50-55 modules (consolidated/archived ~13-18)
- Clear purpose documented for all modules
- Voice/UI overlaps resolved or documented

---

## Notes

- **TETRA_SRC is the strong global** - all consolidation must preserve this
- Bash 5.2 requirement - no changes needed
- Boot system (source ~/tetra/tetra.sh) - must continue working
- Test thoroughly after each phase
- Maintain git history (use `git mv` not `rm && cp`)

---

## Next Steps

1. Review this report
2. Start with Phase 1 (low risk, immediate wins)
3. Test that tetra still boots after Phase 1
4. Proceed to Phase 2-3 when ready
5. Schedule time for Phase 4 module audit
