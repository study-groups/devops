# NodeHolder Bridge

Import DigitalOcean infrastructure from NodeHolder's `digocean.json` into Tetra org sections.

## Quick Start

```bash
# List droplets in a JSON file (dry run)
org import list ~/nh/myorg/digocean.json

# Import infrastructure (creates/updates sections/10-infrastructure.toml)
org import nh ~/nh/myorg/digocean.json myorg

# Edit other sections (storage, resources, etc.)
$EDITOR ~/.tetra/orgs/myorg/sections/

# Rebuild tetra.toml after edits
org build myorg

# Setup SSH keys
org switch myorg
tkm init && tkm gen all && tkm deploy all
```

## Architecture

```
doctl (DigitalOcean API)
         ↓
    NodeHolder (../nh)         ← holds credentials
         ↓
   digocean.json               ← bridge contract
         ↓
    nh_import.sh               ← this module
         ↓
   sections/10-infrastructure.toml  ← PARTIAL (only infra)
         ↓
    org build                  ← assembler
         ↓
   tetra.toml                  ← GENERATED (all sections)
```

**Key principles:**
- Tetra has NO DigitalOcean credentials
- `nh_import` only updates infrastructure section
- Other sections (storage, resources) are preserved
- `org build` assembles partials into final config

## Section Structure

```
~/.tetra/orgs/<org>/
├── tetra.toml              # GENERATED - never edit directly
└── sections/
    ├── 00-org.toml         # [org] identity
    ├── 10-infrastructure.toml  # [environments.*] [connectors] ← nh import
    ├── 20-storage.toml     # [storage.*] s3/spaces
    ├── 30-resources.toml   # [resources.*] games, docs
    ├── 40-services.toml    # [services.*] ports, apps
    └── 50-deploy.toml      # [deploy] [domains]
```

## Commands

### org commands

```bash
org init <name>                 # Create sections/ structure with templates
org import nh <json> <name>     # Import infrastructure partial
org import list <json>          # List droplets (dry run)
org build [name]                # Assemble tetra.toml from sections/
org sections [name]             # List section files
```

### Direct functions

```bash
nh_import <json> <org> [no-build]  # Import, optionally skip auto-build
nh_quick_import <context> [org]    # Import from NodeHolder context
nh_list <json>                     # List droplets
```

### Helper functions

```bash
nh_status                       # NodeHolder availability
nh_validate_json <file>         # Validate JSON format
nh_suggest_refresh <file> 30    # Warn if >30 days old
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
# 1. Fetch infrastructure (in NodeHolder)
cd ~/nh && nh_doctl_get_all

# 2. Initialize org with sections
org init myorg

# 3. Import infrastructure
org import nh ~/nh/myorg/digocean.json myorg

# 4. Edit other sections
$EDITOR ~/.tetra/orgs/myorg/sections/20-storage.toml
$EDITOR ~/.tetra/orgs/myorg/sections/30-resources.toml

# 5. Rebuild
org build myorg

# 6. Use
org switch myorg
tkm init && tkm gen all && tkm deploy all
```

## Re-importing Infrastructure

When infrastructure changes, re-import safely:

```bash
# Fetch latest from DigitalOcean
cd ~/nh && nh_doctl_get_all

# Re-import (only updates 10-infrastructure.toml)
org import nh ~/nh/myorg/digocean.json myorg

# Your storage, resources, services sections are preserved
```

## Files

```
bash/nh/
├── README.md        # This file
├── nh_bridge.sh     # NodeHolder detection, validation
├── nh_import.sh     # digocean.json → infrastructure partial
└── includes.sh      # Module loader
```
