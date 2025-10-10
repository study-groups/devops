# Tetra Documentation Index

**Last Updated:** 2025-10-10

## Core Documentation

### Project Management
- **[CLAUDE.md](../CLAUDE.md)** - Project instructions and current focus
- **[docs/index.md](index.md)** - Main documentation hub
- **[docs/guide.md](guide.md)** - Assistant interaction guide
- **[docs/changes.md](changes.md)** - Current changes and implementations
- **[docs/next.md](next.md)** - Roadmap and priorities

### Architecture & Design
- **[docs/architecture.md](architecture.md)** - System architecture overview
- **[docs/Tetra_Endpoint_Specifcatation.md](Tetra_Endpoint_Specifcatation.md)** - TES v2.1 specification
- **[demo/docs/separation.md](../demo/docs/separation.md)** - TUI/TView separation principles

### Current Focus
- **[demo/basic/010/claude.md](../demo/basic/010/claude.md)** - Demo 010 development guidelines

## Reference Documentation

### Manual & Guides
```
docs/reference/manual/
├── 01-system-overview.md
├── 02-tsm-service-manager.md
├── 03-tetra-summary.md
├── 04-tetra-help.md
├── 05-tetra-intro.md
├── 06-tetra-access.md
├── 07-tpm-process-manager.md
├── 08-development-progress.md
├── 09-tetra-environment-management.md
└── 10-organization-management-and-tdash.md
```

### Technical Reference
```
docs/reference/
├── module-system.md
├── tsm-migration-commands.md
├── tsm-migration-mapping.md
├── tsm-minimal-refactor.md
└── development/
    ├── code-requests.md
    └── terminology.md
```

### Error Documentation
- **[docs/reference/errors/TSM_ERROR_REPORT.md](reference/errors/TSM_ERROR_REPORT.md)** - TSM error tracking

## Theory & Design

**Category-theoretic foundations**

```
docs/theory/
├── adjoints.md           # Categorical adjunctions
├── alternatives.md       # Design alternatives
├── geometry.md          # Geometric semantics
├── language.md          # Language design
├── paths.md             # Path semantics
├── random.md            # Random notes
├── symbols.md           # Symbol systems
├── tetrascript.md       # TetraScript design
└── types.md             # Type theory
```

## Workflow Documentation

```
docs/workflow/
└── tetra-comprehensive-workflow.md
```

## Module-Specific Documentation

### TSM (Service Manager)
- **[bash/tsm/tsm.md](../bash/tsm/tsm.md)** - TSM documentation
- **[bash/tsm/tsm_module.md](../bash/tsm/tsm_module.md)** - Module integration
- **[bash/tsm/tests/README.md](../bash/tsm/tests/README.md)** - Test suite

### TView (Interface)
- **[docs/tview_architecture.md](tview_architecture.md)** - TView architecture

### TMOD (Module System)
- **[bash/tmod/tests/README.md](../bash/tmod/tests/README.md)** - TMOD tests

### RAG (Retrieval)
- **[bash/rag/docs/README.md](../bash/rag/docs/README.md)** - RAG system docs

### Melvin
- **[bash/melvin/docs/README.md](../bash/melvin/docs/README.md)** - Melvin documentation (if active)

## Demo & Examples

### Working Demos
```
demo/
├── docs/
│   ├── action-def.md
│   ├── changes.md
│   ├── formula.md
│   ├── linear-algebra.md
│   ├── next.md
│   ├── separation.md        ← Key: TUI/TView separation
│   ├── step-def.md
│   ├── toy-model.md
│   └── tui-syntax.md
├── basic/010/
│   ├── claude.md            ← Current focus
│   └── docs/
│       ├── action-def.md
│       ├── formula.md
│       ├── linear-algebra.md
│       ├── next.md
│       ├── resolution-strategy.md
│       ├── step-def.md
│       └── toy-model.md
├── bframe/README.md
└── cframe/README.md
```

## Organization Templates
- **[orgs/nodeholder/README.md](../orgs/nodeholder/README.md)** - NodeHolder org template

## Server & API
- **[server/README.md](../server/README.md)** - Server documentation
- **[server/api/tetra-api-architecture.md](../server/api/tetra-api-architecture.md)** - API architecture

## Integration Documentation
- **[docs/reference/11-nodeholder-tetra-integration.md](reference/11-nodeholder-tetra-integration.md)** - NH/Tetra integration

---

## Documentation Principles

1. **Single Source of Truth**: Core docs in `docs/`, module-specific in module dirs
2. **Current Focus**: See `CLAUDE.md` for active work
3. **Theory Preserved**: Category theory foundations in `docs/theory/`
4. **Clean Structure**: Obsolete planning docs removed, keep working references only

## Quick Navigation

**Starting point:** [docs/index.md](index.md)
**For LLMs:** [docs/guide.md](guide.md)
**Current work:** [CLAUDE.md](../CLAUDE.md)
**Specifications:** [Tetra_Endpoint_Specifcatation.md](Tetra_Endpoint_Specifcatation.md)
