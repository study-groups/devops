# Tetra Documentation

**Last Updated:** 2025-11-04

Welcome to the Tetra documentation. This directory contains all technical specifications, guides, reference materials, and architectural documentation for the Tetra ecosystem.

---

## Quick Navigation

- **New to Tetra?** Start with [guides/INSTRUCTIONS_README.md](guides/INSTRUCTIONS_README.md)
- **Looking for specifications?** See [specifications/](#specifications)
- **Need a reference?** Check [reference/](#reference)
- **Want to understand the architecture?** Read [architecture/](#architecture)

---

## Directory Structure

```
docs/
├── specifications/      # Core Tetra format and system specifications
├── guides/              # User guides, tutorials, and developer documentation
├── architecture/        # System architecture and design documents
├── analysis/            # Analysis and design studies
├── reference/           # Reference materials, templates, and examples
├── theory/              # Theoretical and conceptual explorations
└── workflow/            # Workflow and process documentation
```

---

## Specifications

**Core Tetra Formats** - The foundational specifications that define Tetra's data and interaction patterns:

| Spec | Description | Status |
|------|-------------|--------|
| [TAS](specifications/TAS_SPECIFICATION.md) | **Tetra Action Specification** - Semantic action syntax (`/action:noun @endpoint`) | v1.0 |
| [TRS](specifications/TRS_SPECIFICATION.md) | **Tetra Record Specification** - File-based database pattern (`timestamp.module.type.ext`) | v1.0 |
| [TTS](specifications/TTS_TETRA_TRANSACTION_STANDARD.md) | **Tetra Transaction Standard** - Transaction management with FSM | v1.0 Provisional |
| [TES](specifications/INSTRUCTIONS_TES.md) | **Tetra Endpoint Specification** - Infrastructure endpoint configuration | v3.0 Foundational |

**TES Extensions:**
- [TES SSH Extension](specifications/TES_SSH_Extension.md) - SSH endpoint resolution
- [TES Agent Extension](specifications/TES_Agent_Extension.md) - Agent-based execution
- [TES Bash Agent Extension](specifications/TES_Bash_Agent_Extension.md) - Bash agent implementation
- [TES Storage Extension](specifications/TES_Storage_Extension.md) - Storage endpoints

**Supporting Specifications:**
- [TCS 4.0](specifications/TCS_4.0_LOGGING_STANDARD.md) - Logging standard

---

## Guides

### Getting Started
- [README](guides/README_DOCS.md) - Documentation overview
- [Core Specification](guides/INSTRUCTIONS_CORE_SPECIFICATION.md) - Core concepts and principles
- [Developer Guide](guides/INSTRUCTIONS_DEVELOPER_GUIDE.md) - Developer workflow and practices
- [TES Instructions](guides/INSTRUCTIONS_TES.md) - How to create TES configurations

### Module Development
- [Module System Specification](guides/MODULE_SYSTEM_SPECIFICATION.md) - How to build Tetra modules
- [Module Completeness Criteria](guides/MODULE_COMPLETENESS_CRITERIA.md) - Standards for complete modules

---

## Architecture

### System Design
- [TETRA TRINITY](architecture/TETRA_TRINITY.md) - The three pillars of Tetra architecture

### Conceptual Framework
The Tetra Trinity represents the three fundamental aspects of the system:
1. **Infrastructure** (TES) - Where things are
2. **Actions** (TAS) - What to do
3. **Data** (TRS/TTS) - How to store

---

## Analysis

Design studies and architectural analyses:

- [TUI Refactor Analysis](analysis/TUI_REFACTOR_ANALYSIS.md) - REPL-centric TUI design with command logging
- [Interactive UI Patterns](analysis/INTERACTIVE_UI_PATTERNS.md) - Catalog of all interactive UI systems in Tetra

---

## Reference

### Templates & Examples
- [Module Spec Template](reference/MODULE_SPEC_TEMPLATE.md) - Template for module specifications
- [Tubes Integration Example](reference/TUBES_INTEGRATION_EXAMPLE.md) - Integration pattern example

### Implementation Details
- [Module System](reference/module-system.md) - Module system internals
- [TDoc System Design](reference/tdoc-system-design.md) - Documentation system architecture
- [TSM Migration](reference/tsm-migration-commands.md) - Service manager migration guide

### Historical
See `reference/historical/` for archived specifications and design documents.

---

## Theory

Conceptual and theoretical explorations of Tetra's design space:

- [Symbols](theory/symbols.md) - Symbol systems and semantics
- [Types](theory/types.md) - Type theory and semantic computing
- [Paths](theory/paths.md) - Path resolution and navigation
- [Alternatives](theory/alternatives.md) - Alternative approaches considered
- [Adjoints](theory/adjoints.md) - Adjoint relationships in system design
- [Geometry](theory/geometry.md) - Geometric perspectives on architecture
- [Language](theory/language.md) - Language design and DSLs
- [TetraScript](theory/tetrascript.md) - TetraScript language design
- [Random](theory/random.md) - Miscellaneous theoretical notes

---

## Workflow

Process documentation and comprehensive workflows:

- [Comprehensive Workflow](workflow/tetra-comprehensive-workflow.md) - End-to-end development workflow

---

## Documentation Categories

### By Role

**If you're a User:**
1. Start: [Instructions README](guides/INSTRUCTIONS_README.md)
2. Learn: [Core Specification](guides/INSTRUCTIONS_CORE_SPECIFICATION.md)
3. Deploy: [TES Instructions](guides/INSTRUCTIONS_TES.md)

**If you're a Developer:**
1. Start: [Developer Guide](guides/INSTRUCTIONS_DEVELOPER_GUIDE.md)
2. Learn: [Module System](guides/MODULE_SYSTEM_SPECIFICATION.md)
3. Build: [Module Template](reference/MODULE_SPEC_TEMPLATE.md)

**If you're an Architect:**
1. Start: [TETRA TRINITY](architecture/TETRA_TRINITY.md)
2. Deep Dive: [Theory](theory/)
3. Design: [Analysis](analysis/)

### By Format

**Specifications (What Tetra Uses):**
- TAS - Action syntax
- TRS - Record format
- TTS - Transaction pattern
- TES - Endpoint configuration

**Guides (How to Use Tetra):**
- Getting started tutorials
- Module development
- Configuration guides

**Reference (When You Need Details):**
- Templates
- Examples
- Implementation notes

**Theory (Why Tetra Works This Way):**
- Design rationale
- Conceptual foundations
- Explorations

---

## Document Status Legend

- **Foundational** - Core specification, critical to system
- **Specification** - Formal specification, stable
- **Provisional** - Working specification, may change
- **Draft** - Work in progress
- **Historical** - Archived, may be outdated

---

## Contributing to Documentation

### Adding New Documentation

1. **Choose the right directory:**
   - `specifications/` - Formal specifications only
   - `guides/` - How-to and tutorial content
   - `architecture/` - System design documents
   - `analysis/` - Design studies and analyses
   - `reference/` - Templates, examples, technical details
   - `theory/` - Conceptual explorations

2. **Follow naming conventions:**
   - Use UPPERCASE for specifications: `TAS_SPECIFICATION.md`
   - Use Title Case for guides: `Module_Development_Guide.md`
   - Be descriptive and specific

3. **Include document metadata:**
   ```markdown
   # Document Title

   **Version:** 1.0
   **Status:** Specification
   **Date:** YYYY-MM-DD
   **Author:** (optional)
   ```

4. **Update this README:**
   - Add your document to the appropriate section
   - Include brief description
   - Note status and version

### Document Standards

- Use **Markdown** format
- Include **table of contents** for docs >200 lines
- Provide **examples** for specifications
- Cross-reference related documents
- Keep language **clear and concise**
- Use **code blocks** with language tags

---

## Index by Topic

### Actions & Commands
- [TAS Specification](specifications/TAS_SPECIFICATION.md)
- [Interactive UI Patterns](analysis/INTERACTIVE_UI_PATTERNS.md)

### Data & Storage
- [TRS Specification](specifications/TRS_SPECIFICATION.md)
- [TTS Transaction Standard](specifications/TTS_TETRA_TRANSACTION_STANDARD.md)

### Infrastructure & Deployment
- [TES Specification](guides/INSTRUCTIONS_TES.md)
- [TES Extensions](specifications/) - All TES_*.md files

### Module Development
- [Module System Specification](guides/MODULE_SYSTEM_SPECIFICATION.md)
- [Module Completeness Criteria](guides/MODULE_COMPLETENESS_CRITERIA.md)
- [Module Template](reference/MODULE_SPEC_TEMPLATE.md)

### UI & Interaction
- [TUI Refactor Analysis](analysis/TUI_REFACTOR_ANALYSIS.md)
- [Interactive UI Patterns](analysis/INTERACTIVE_UI_PATTERNS.md)

### System Architecture
- [TETRA TRINITY](architecture/TETRA_TRINITY.md)
- [Theory Documents](theory/)

---

## Quick Reference

### The Four Core Formats

```bash
# TAS - Actions (What to do)
/send:message @prod
/list:files @dev
/deploy::authenticated:service @staging

# TES - Endpoints (Where things are)
@local    # Your machine
@dev      # Development server
@staging  # Staging environment
@prod     # Production environment

# TRS - Records (How to name files)
1730760123.module.type.kind.ext
# Example: 1730760123.vox.audio.sally.mp3

# TTS - Transactions (How to track work)
deploy-staging-20251104T143022/
├── state.json
├── events.ndjson
└── ctx/
```

### Common Workflows

```bash
# Deploy configuration
org push:config @staging

# Query data
rag query:code @local

# Start service
tsm start:service @prod

# View transaction
tts view deploy-staging-20251104T143022
```

---

## Getting Help

- **Documentation Issues:** Create an issue describing what's unclear
- **Missing Documentation:** Request specific guides or references
- **Documentation Improvements:** Submit pull requests with enhancements

---

## Recent Updates

- **2025-11-04:** Reorganized docs directory structure
  - Created `analysis/`, `architecture/`, `specifications/`, `guides/` directories
  - Moved all documents to appropriate locations
  - Created this comprehensive README
  - Added TUI Refactor Analysis

- **2025-11-03:** Added TETRA TRINITY architecture document

- **2025-11-02:** Updated TAS and TRS specifications to v1.0

---

**Next Steps:**
- Add diagrams to architecture documents
- Create quick-start video tutorials
- Expand theory section with practical examples
- Add API reference documentation
