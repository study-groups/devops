# TDOCS Demo

Quick walkthrough of TDOCS module-aware document management.

## Quick Start

```bash
./demo_tdocs.sh
```

## What It Shows

**Discover & Initialize**
- Find undocumented markdown files
- Add metadata frontmatter
- Mark temporal documents for auto-archival

**List & Filter**
- Browse documents by category, module, tags
- Color-rendered markdown preview

**Module Operations**
- View all docs for a module
- Audit module specifications
- Full-text search
- RAG evidence weighting

**Document Types**
- standard, specification, temporal, guide, example

**Completeness Levels**
- L0-L4 module maturity tracking

**Interactive Mode**
- REPL with /ls, /view, /search, /module commands

## Commands Shown

```bash
tdocs audit                  # Find undocumented files
tdocs init doc.md --core     # Add metadata frontmatter
tdocs ls --preview           # List all tracked documents
tdocs ls --module tubes      # Filter by module
tdocs view doc.md            # Render with colors
tdocs module tubes           # View module docs
tdocs audit-specs            # Check module specifications
tdocs search 'query'         # Full-text search
tdocs evidence 'query'       # Get RAG evidence list
tdocs browse                 # Launch interactive REPL
```

## Try It Yourself

```bash
tdocs audit-specs     # Check your module specifications
tdocs module tubes    # View docs for tubes module
tdocs browse          # Launch interactive REPL
tdocs help            # See all commands
```
