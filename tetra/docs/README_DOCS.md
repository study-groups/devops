# Tetra Documentation Structure

**Last Updated**: October 23, 2025

This document explains the organization of Tetra's documentation.

## Core Documentation (Start Here)

These 4 documents form the complete foundation of Tetra:

1. **README.md** *(to be created)*
   - Project overview and quick start guide
   - Target: New users, quick start seekers
   - Length: ~400-500 lines
   - Topics: What is Tetra, installation, first commands, tutorials

2. **TES.md** *(to be created)*
   - Tetra Endpoint Specification - THE NOUNS (where things are)
   - Target: All Tetra users (foundational)
   - Length: ~600-800 lines
   - Topics: Progressive resolution, tetra.toml, symbols (@local, @dev, @staging, @prod)

3. **DEVELOPER_GUIDE.md** *(to be created)*
   - Building Tetra modules and actions - THE VERBS (what to do)
   - Target: Module developers, contributors
   - Length: ~700-900 lines
   - Topics: Modules vs libraries, actions pattern, TES integration, REPL/TUI

4. **CORE_SPECIFICATION.md** *(to be created)*
   - TCS 4.0 technical reference - THE FOUNDATION (how it works)
   - Target: Tetra architects, core contributors
   - Length: ~600-800 lines
   - Topics: Operators, Environment × Mode, type contracts, logging, TTS

## Creating the Core Docs

Each core document has detailed instructions:

- `INSTRUCTIONS_README.md` - Instructions for creating README.md
- `INSTRUCTIONS_TES.md` - Instructions for creating TES.md
- `INSTRUCTIONS_DEVELOPER_GUIDE.md` - Instructions for creating DEVELOPER_GUIDE.md
- `INSTRUCTIONS_CORE_SPECIFICATION.md` - Instructions for creating CORE_SPECIFICATION.md

**Workflow**: Copy each INSTRUCTIONS_*.md file into a new Claude Code chat to create the corresponding document one-at-a-time.

## Supporting Documentation

### TES Extensions (Referenced by TES.md)

- **TES_SSH_Extension.md** - SSH deployment specifics
  - Progressive resolution for SSH
  - Dual-role authentication (auth_user:work_user)
  - Connector format and validation

- **TES_Storage_Extension.md** - Cloud storage integration
  - S3, DigitalOcean Spaces integration
  - Storage endpoint resolution

- **TES_Agent_Extension.md** - AI agent integration
  - Claude API integration
  - Agent endpoint patterns

### Technical Standards (Referenced by CORE_SPECIFICATION.md)

- **TCS_4.0_LOGGING_STANDARD.md** - Unified logging specification
  - Log entry structure (JSON)
  - API functions (tetra_log_*)
  - Module integration pattern
  - Query functions

- **TTS_TETRA_TRANSACTION_STANDARD.md** - Transaction system
  - File-based transaction pattern
  - State management (FSM)
  - Transaction directory structure
  - TES integration

## Reference Documentation (docs/reference/)

Module-specific and technical reference docs:

### TSM (Tetra Service Manager) - docs/reference/tsm/
- `README.md` - Documentation index
- `daemon-setup.md` - Systemd integration
- `testing.md` - Test suite documentation
- `architecture-review.md` - Architecture analysis

### User Manual - docs/reference/manual/
10-chapter user manual (check directory for chapters)

### Development Reference - docs/reference/development/
Development guides and patterns

### Implementation Notes - docs/reference/implementation/
Specific implementation details

## Theory Documentation (docs/theory/)

Theoretical foundations and design philosophy:

- `symbols.md` - Symbol system analysis (three-context framework)
- `types.md` - Type system design
- `tetrascript.md` - TetraScript language design
- `geometry.md` - Geometric interpretations
- `adjoints.md` - Adjoint functor patterns
- `paths.md` - Path resolution theory
- `language.md` - Language design notes
- `alternatives.md` - Alternative approaches considered
- `random.md` - Miscellaneous notes

## Archived Documentation (docs/archive/)

Historical documentation superseded by core docs but retained for reference:

### 2025-logging-refactor/
Logging system refactoring docs (October 2025)
- Now consolidated into CORE_SPECIFICATION.md

### proposals/
Provisional plans (TTM, TUI)

### repl-design/
REPL architecture and design
- Now consolidated into DEVELOPER_GUIDE.md

### implementations/
Reference implementations (CDP Agent)

### org-system/
Organization compilation system
- Now consolidated into TES.md and DEVELOPER_GUIDE.md

See `archive/README.md` for details.

## Legacy Documentation (docs/legacy/)

Very old documentation kept for historical reference:
- Early design docs
- Prototype implementations
- Superseded by all current docs

## Documentation Principles

### 1. Four Core Documents Only

The top-level docs/ directory contains ONLY:
- 4 core documents (README, TES, DEVELOPER_GUIDE, CORE_SPECIFICATION)
- Supporting TES extension docs (SSH, Storage, Agent)
- Supporting technical standards (TCS 4.0 Logging, TTS)
- Instructions for creating the core docs

Everything else goes in subdirectories (reference/, theory/, archive/, legacy/).

### 2. Clear Target Audiences

- **README.md** → New users
- **TES.md** → All users (foundational)
- **DEVELOPER_GUIDE.md** → Module developers
- **CORE_SPECIFICATION.md** → Architects

### 3. Cross-References

Docs reference each other:
- README.md → points to TES.md, DEVELOPER_GUIDE.md
- TES.md → references TES_SSH_Extension.md, CORE_SPECIFICATION.md
- DEVELOPER_GUIDE.md → references TES.md, CORE_SPECIFICATION.md
- CORE_SPECIFICATION.md → references TCS_4.0_LOGGING_STANDARD.md, TTS

### 4. Single Source of Truth

- Infrastructure endpoints → TES.md
- Module development → DEVELOPER_GUIDE.md
- Technical foundation → CORE_SPECIFICATION.md
- No duplication between docs

## Architecture Summary

### The Tetra Mental Model

**TES = The NOUNS** (where things are)
- Defined in `$TETRA_DIR/orgs/{org-name}/tetra.toml`
- Semantic symbols: `@local`, `@dev`, `@staging`, `@prod`
- Progressive resolution: Symbol → Address → Channel → Connector → Handle → Locator → Binding → Plan
- Documented in: **TES.md**

**Module Actions = The VERBS** (what to do)
- Defined in `bash/{module}/actions.sh`
- Format: `verb:noun` (e.g., `push:config`, `deploy:service`)
- Documented in: **DEVELOPER_GUIDE.md**

**TCS 4.0 = The FOUNDATION** (how it works)
- Operators: `.`, `:`, `::`, `→`, `@`, `×`
- Environment × Mode context algebra
- Type contracts with effects
- Documented in: **CORE_SPECIFICATION.md**

**Integration**: `module.action @endpoint`
- Example: `org push:config @dev`
- Module action (verb) operates on TES endpoint (noun)

## Contributing to Documentation

When adding new documentation:

1. **Core docs**: Do NOT edit directly - they are generated from INSTRUCTIONS_*.md files
2. **Module docs**: Add to `docs/reference/{module}/`
3. **Theory**: Add to `docs/theory/`
4. **Historical**: Add to `docs/archive/` with explanation
5. **User manual**: Add to `docs/reference/manual/`

## Documentation Status

- ✅ TSM documentation consolidated (bash/tsm/)
- ✅ Instruction files created (4 files)
- ✅ Historical docs archived
- ✅ Redundant docs removed
- ⏳ Core docs to be created (README, TES, DEVELOPER_GUIDE, CORE_SPECIFICATION)
- ⏳ Cross-references to be updated after core docs exist

---

**Next Step**: Create the 4 core documents using the INSTRUCTIONS_*.md files, one-at-a-time in separate Claude Code chats.
