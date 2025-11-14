# Instructions: Create docs/README.md

**Copy this entire file into a new Claude Code chat to create the first core document.**

---

## Context

You are creating the first of 4 core Tetra documentation files. This is `docs/README.md` - the project overview and quick start guide.

## Background: The Tetra Architecture

Tetra is a bash-based development environment with a unique architecture:

**The Core Concept: Configuration at a Distance**
- **TES (Tetra Endpoint Specification)** = The NOUNS (where things are)
  - Defined in `$TETRA_DIR/orgs/{org-name}/tetra.toml`
  - Semantic symbols like `@dev`, `@staging`, `@prod`
  - Progressive resolution through 7 levels (Symbol → Address → Channel → Connector → Handle → Locator → Binding → Plan)

- **Module Actions** = The VERBS (what to do)
  - Defined in `bash/{module}/actions.sh`
  - Format: `verb:noun` (e.g., `deploy:service`, `push:config`)

- **The Integration**: `module.action @endpoint`
  - Example: `org push:config @dev`
  - Module action operates on TES endpoint

**Module Types**:
1. **Modules** (user-facing, have `actions.sh`): tsm, org, tetra
2. **Libraries** (utilities, no `actions.sh`): repl, tds, color

**Boot Sequence**:
1. `~/tetra/tetra.sh` - Main entry point
2. `bash/bootloader.sh` - Module loader
3. `bash/boot/boot_modules.sh` - Register 40+ modules
4. Lazy load modules via `tmod load <name>`

## Key Files to Reference

Read these files to understand the actual implementation:
- `bash/boot/boot_modules.sh` - See all registered modules
- `bash/tsm/README.md` - Example of a well-documented module
- `bash/org/actions.sh` - Example of action declarations
- `bash/tds/tds.sh` - Example of a library (no actions.sh)
- `$TETRA_DIR/orgs/pixeljam-arcade/tetra.toml` - Example TES configuration
- `docs/TES_SSH_Extension.md` - Progressive resolution explanation

## Document Requirements

**File**: `docs/README.md`

**Audience**: New users, quick start seekers

**Length**: ~400-500 lines

**Sections**:

### 1. Header & Tagline (5-10 lines)
```markdown
# Tetra

Configuration-driven development environment with semantic infrastructure endpoints.

**Core Concept**: Define infrastructure once (`tetra.toml`), use everywhere via semantic symbols.
```

### 2. What is Tetra? (30-50 lines)
- Bash-based development environment
- Two core systems working together:
  - TES: Define WHERE (infrastructure endpoints)
  - Module Actions: Define WHAT (operations)
- Example: `org push:config @dev` = push (verb) config (noun) to dev (endpoint)
- Key benefit: "Configuration at a distance"

### 3. Quick Start (50-80 lines)
```bash
# Installation
source ~/tetra/tetra.sh

# Your first commands
tsm list                    # List running processes
tsm start python server.py  # Start a service
org list:orgs              # List organizations

# Working with endpoints
org push:config @dev       # Push config to dev
```

### 4. The Big Picture: TES × Module Actions (80-120 lines)

**Architecture Diagram** (ASCII art):
```
┌─────────────────────────────────────────────┐
│ tetra.toml (in $TETRA_DIR/orgs/{org}/)     │
│ Defines: @local, @dev, @staging, @prod     │
│ TES = The NOUNS (where things are)         │
└─────────────────────────────────────────────┘
                   ↓
            Resolved by
                   ↓
┌─────────────────────────────────────────────┐
│ Module Actions (bash/{module}/actions.sh)  │
│ Define: verb:noun operations               │
│ Module Actions = The VERBS (what to do)    │
└─────────────────────────────────────────────┘
```

**Explain**:
- tetra.toml is THE source of truth for infrastructure
- One file defines all environments
- Modules operate on these endpoints
- Example workflow: Define `@staging` once, use everywhere

### 5. Core Modules (50-80 lines)

Brief overview of major modules:
- **tsm**: Process manager (PM2-style for bash/Python/Node)
- **org**: Organization management (compiles tetra.toml from infrastructure)
- **tetra**: Core bootstrap and module loader
- **tkm**: SSH key management
- **vox**: Voice/audio (if applicable)

For each, show 2-3 example commands.

### 6. Core Libraries (30-50 lines)

Brief overview:
- **repl**: REPL framework (used by tsm, org)
- **tds**: Display system (themes, colors, layouts)
- **color**: Color/theme system (used by tds)

Explain: Libraries provide utilities, modules provide user-facing commands.

### 7. Environment × Mode System (40-60 lines)

Explain the context system:
- **Environments**: {Local, Dev, Staging, Production}
- **Modes**: {Inspect, Transfer, Execute}
- **Context** = Environment × Mode
- Actions filter by context

Example:
```bash
# In Local × Inspect mode:
org view:toml        # Available

# In Dev × Execute mode:
org deploy:service   # Available
```

### 8. Progressive Resolution (40-60 lines)

Brief explanation of TES resolution:
```
@staging  (Symbol - Level 0)
  ↓
143.198.45.123  (Address - Level 1)
  ↓
dev@143.198.45.123  (Channel - Level 2)
  ↓
root:dev@143.198.45.123 -i ~/.ssh/key  (Connector - Level 3)
  ↓
[Validated Handle, then Locator, Binding, Plan...]
```

Note: Full details in TES.md

### 9. Getting Started Tutorials (60-90 lines)

**Tutorial 1: Using TSM (Process Manager)**
```bash
# Start a Python HTTP server
tsm start python -m http.server 8000

# List running processes
tsm list

# View logs
tsm logs 0 -f

# Stop
tsm stop 0
```

**Tutorial 2: Setting Up an Organization**
```bash
# Create organization from infrastructure
org create:org my-company

# Compile tetra.toml from DigitalOcean
org compile:toml my-company

# Push configuration to staging
org push:config @staging
```

### 10. Documentation Links (30-40 lines)

Links to the other 3 core docs:
- **[TES.md](TES.md)** - Understanding endpoints (the nouns)
- **[DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md)** - Building modules (the verbs)
- **[CORE_SPECIFICATION.md](CORE_SPECIFICATION.md)** - TCS 4.0 technical reference

Links to specialized docs:
- **[bash/tsm/README.md](../bash/tsm/README.md)** - TSM detailed guide
- **[docs/reference/tsm/](reference/tsm/)** - TSM reference docs
- **[docs/reference/manual/](reference/manual/)** - User manual (10 chapters)

### 11. Common Use Cases (40-60 lines)

Show 3-4 real-world scenarios:
1. **Local Development**: Using TSM to manage dev servers
2. **Deploying to Staging**: Push code/config to @staging
3. **Production Deployment**: Deploy to @prod with validation
4. **Multi-Environment Management**: Same commands, different endpoints

### 12. Troubleshooting (30-40 lines)

Common issues:
- Module not found → `tmod load <name>`
- Endpoint not defined → Check tetra.toml
- Permission denied → Check SSH keys
- Where to get help

### 13. Contributing (20-30 lines)

- How to add modules
- How to extend TES
- Link to DEVELOPER_GUIDE.md
- Community guidelines

### 14. License & Credits (10-20 lines)

## Writing Guidelines

1. **Be concrete**: Use actual commands, not placeholders
2. **Show, don't tell**: Include command output examples
3. **Progressive disclosure**: Start simple, add complexity gradually
4. **Cross-reference**: Link to other docs for details
5. **Use diagrams**: ASCII art for architecture
6. **Real examples**: Use pixeljam-arcade org as example when helpful

## Tone

- Friendly and welcoming to new users
- Technical but not overwhelming
- Focus on "why" not just "what"
- Emphasize the unique architecture (TES × Actions)

## Create the File

Create `docs/README.md` with all sections above. Make it comprehensive, accurate to the actual codebase, and a great first impression of Tetra.

**After completion**: This becomes the entry point for ALL Tetra documentation.
