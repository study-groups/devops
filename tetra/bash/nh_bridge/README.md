# nh_bridge - Nodeholder Bridge

Import DigitalOcean infrastructure from Nodeholder's `digocean.json` into Tetra org sections.

**Module name:** `nh_bridge`
**Function prefix:** `nhb_*`
**No collision with standalone Nodeholder** (`~/src/devops/nh`)

## Quick Start

```bash
# Load the module
tmod load nh_bridge

# List droplets in a JSON file (dry run)
nhb_list ~/nh/myorg/digocean.json

# Import infrastructure (creates/updates 10-infrastructure.toml)
nhb_import ~/nh/myorg/digocean.json myorg

# Or quick import from Nodeholder context
nhb_quick_import myorg

# Edit other sections (storage, resources, etc.)
$EDITOR ~/.tetra/orgs/myorg/

# Rebuild tetra.toml after edits
org build myorg

# Setup SSH keys
org switch myorg
tkm init && tkm gen all && tkm deploy all
```

## Architecture

```
doctl (DigitalOcean API)
         |
    Nodeholder (~/src/devops/nh)   <- holds credentials, `nh` command
         |
   digocean.json                   <- bridge contract
         |
    nh_bridge module               <- this module (nhb_* functions)
         |
   10-infrastructure.toml          <- PARTIAL (only infra)
         |
    org build                      <- assembler
         |
   tetra.toml                      <- GENERATED (all sections)
```

**Key principles:**
- Tetra has NO DigitalOcean credentials
- `nhb_import` only updates infrastructure section
- Other sections (storage, resources) are preserved
- `org build` assembles partials into final config

## Namespace Separation

| Project | Location | Command | Functions |
|---------|----------|---------|-----------|
| **Nodeholder** | `~/src/devops/nh` | `nh` | `nh_*` |
| **nh_bridge** | `tetra/bash/nh_bridge` | (none) | `nhb_*` |

No function name collisions - safe to use both in same shell.

## Commands

### Import functions

```bash
nhb_import <json> <org> [no-build]  # Import, optionally skip auto-build
nhb_quick_import <context> [org]    # Import from Nodeholder context
nhb_list <json>                     # List droplets (dry run)
```

### Helper functions

```bash
nhb_status                       # Nodeholder availability
nhb_validate_json <file>         # Validate JSON format
nhb_suggest_refresh <file> 30    # Warn if >30 days old
nhb_show_workflow                # Show architecture docs
```

## Environment Detection

Droplets are auto-assigned to environments based on name/tags:

| Pattern | Environment |
|---------|-------------|
| `*dev*`, `*development*` | dev |
| `*staging*`, `*qa*` | staging |
| `*prod*`, `*production*` | prod |

Undetected droplets are listed for manual assignment.

## Complete Workflow

```bash
# 1. Fetch infrastructure (in Nodeholder)
cd ~/src/devops/nh && nh fetch

# 2. Initialize org with sections
org init myorg

# 3. Import infrastructure
nhb_import ~/nh/myorg/digocean.json myorg

# 4. Edit other sections
$EDITOR ~/.tetra/orgs/myorg/20-storage.toml
$EDITOR ~/.tetra/orgs/myorg/30-resources.toml

# 5. Rebuild
org build myorg

# 6. Use
org switch myorg
tkm init && tkm gen all && tkm deploy all
```

## Re-importing Infrastructure

When infrastructure changes, re-import safely:

```bash
# Fetch latest from DigitalOcean (in Nodeholder)
cd ~/src/devops/nh && nh fetch

# Re-import (only updates 10-infrastructure.toml)
nhb_import ~/nh/myorg/digocean.json myorg

# Your storage, resources, services sections are preserved
```

## Files

```
bash/nh_bridge/
├── README.md        # This file
├── includes.sh      # Module loader
├── nhb_bridge.sh    # Nodeholder detection, validation, status
└── nhb_import.sh    # digocean.json -> infrastructure partial
```
