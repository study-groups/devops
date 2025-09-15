# NH (NodeHolder) - Semantic Infrastructure Management

*The terraform layer of the Tetra ecosystem*

## Overview

NH is a semantic infrastructure discovery and mapping system that transforms complex cloud resources into intuitive, command-line driven workflows. It bridges raw DigitalOcean infrastructure with human-friendly abstractions, providing the foundation for the Tetra application deployment system.

## Philosophy: Semantic Infrastructure

NH implements a **dual-naming strategy** that serves both immediate shell convenience and long-term system integration:

- **Short Shell Variables**: `$paq`, `$pad`, `$pap` for rapid SSH access and scripting
- **Long Semantic Names**: `pxjam_arcade_qa01` for clarity and Tetra integration
- **Context Isolation**: Each project gets its own namespace and variable set

This creates an infrastructure layer that feels as natural as local development while maintaining production-grade organization.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   DigitalOcean  │    │       NH        │    │     Tetra       │
│   (Raw Infra)   │────│  (Semantic Map) │────│ (App Deploy)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
      doctl API           Discovery Engine        Service Layer
   Server Names →       Short Variables →      Deployment Logic
   IP Addresses         Context Management     Application State
```

### Core Pipeline

1. **Discovery**: Scans DigitalOcean infrastructure via `doctl` API
2. **Semantic Mapping**: Creates human-readable abbreviations from server names
3. **Variable Export**: Provides both convenience shortcuts and full context
4. **Tetra Handoff**: Supplies standardized deployment targets

## Quick Start

```bash
# Activate project context
pj

# Connect to servers
ssh root@$paq     # QA server
ssh root@$pad     # Development server
ssh root@$pap     # Production server

# Use private/floating IPs
ssh root@$paqp    # QA private IP
ssh root@$papf    # Production floating IP
```

## Variable Naming Convention

NH generates variables using **first-letter abbreviation** from underscore-separated server names:

```bash
# Server: pxjam-arcade-qa01
# Pattern: p(ixeljam) + a(rcade) + q(a) = paq
export paq=146.190.151.245

# Server: pxjam-arcade-dev01
# Pattern: p(ixeljam) + a(rcade) + d(ev) = pad
export pad=137.184.226.163

# Server: pxjam-arcade-prod01
# Pattern: p(ixeljam) + a(rcade) + p(rod) = pap
export pap=64.23.151.249
```

### Network Type Suffixes

- **No suffix**: Public IP (default)
- **`p` suffix**: Private IP (`$paqp`, `$papp`)
- **`f` suffix**: Floating IP (`$paqf`, `$papf`)

## Context Management

Each project has its own context directory under `$NH_DIR`:

```
~/nh/
├── pixeljam-arcade/    # pj -> symlink to this
│   ├── init.sh
│   ├── digocean.json
│   └── digocean.env
├── nodeholder/
└── mricos/
```

### Context Commands

```bash
pj                      # Load pixeljam-arcade context
nh_load_env_vars       # Refresh infrastructure data
nh_make_short_vars pxjam # Regenerate variables
```

## Integration with Tetra

NH provides the infrastructure foundation that Tetra consumes for application deployment:

### NH → Tetra Mapping

```bash
# NH provides infrastructure endpoints
$pad  → TETRA_DEV_IP     (development)
$paq  → TETRA_STAGING_IP (qa/staging)
$pap  → TETRA_PROD_IP    (production)
```

### Deployment Workflow

```bash
# 1. Load infrastructure context
pj

# 2. Deploy application via Tetra
tetra deploy --target dev      # Uses $pad internally
tetra deploy --target staging  # Uses $paq internally
tetra deploy --target prod     # Uses $pap internally
```

## File Structure

```
$NH_SRC/
├── bash/
│   ├── bootstrap.sh      # Function loader
│   ├── env.sh           # Environment management
│   ├── ip.sh            # IP address extraction
│   ├── shorten.sh       # Variable generation
│   └── doctl.sh         # DigitalOcean integration
├── init.sh              # Main initialization
└── README.md           # This file

$NH_DIR/
└── <context>/
    ├── init.sh          # Context-specific setup
    ├── digocean.json    # Raw infrastructure data
    └── digocean.env     # Generated variables
```

## Examples

### Multi-Environment Deployment

```bash
# Load context and deploy to development
pj
scp myapp.tar root@$pad:/tmp/
ssh root@$pad "cd /tmp && tar xf myapp.tar && ./install.sh"

# Test, then promote to staging
ssh root@$paq "curl -f http://localhost:8080/health"

# Finally deploy to production
scp myapp.tar root@$pap:/opt/releases/
ssh root@$pap "cd /opt/releases && ./deploy.sh myapp.tar"
```

### Infrastructure Inspection

```bash
pj
echo "Development: $pad"
echo "Staging: $paq"
echo "Production: $pap"
echo "Prod Floating: $papf"

# Show all project variables
env | grep '^p[a-z]*=' | sort
```

## Advanced Usage

### Custom Variable Generation

```bash
# Regenerate variables with different prefix
nh_make_short_vars myprefix

# Source updated environment
source $NH_DIR/$DIGITALOCEAN_CONTEXT/digocean.env
```

### Context Switching

```bash
# Switch to different project
NH_CONTEXT=nodeholder
source $NH_DIR/nodeholder/init.sh
```

## Troubleshooting

### Function Not Found Errors

```bash
# Reload NH functions
source $NH_SRC/bash/bootstrap.sh

# Verify functions are loaded
declare -f nh_load_env_vars
declare -f nh_make_short_vars
```

### Missing Variables

```bash
# Check if context is loaded
echo $DIGITALOCEAN_CONTEXT

# Verify infrastructure data exists
ls $NH_DIR/$DIGITALOCEAN_CONTEXT/

# Regenerate variables
pj
```

### DigitalOcean Authentication

```bash
# Check current context
doctl auth list

# Switch context if needed
doctl auth switch --context pixeljam-arcade
```

## Contributing

NH follows the Tetra ecosystem philosophy of semantic, command-line driven infrastructure. When adding features:

1. Maintain the dual-naming strategy (short + semantic)
2. Preserve context isolation between projects
3. Ensure clean integration with Tetra deployment workflows
4. Test variable generation across different naming patterns

