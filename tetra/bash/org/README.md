# Org - Organization Management

Multi-client infrastructure management with TOML-based configuration, environment profiles, and symlink-based active organization system.

## Quick Start

```bash
# Source tetra first
source ~/tetra/tetra.sh

# Create organization
tetra org create mycompany

# Switch to organization
tetra org use mycompany

# List organizations
tetra org list

# View active organization
tetra org active

# Edit org configuration
tetra org edit

# Interactive REPL
org_repl
```

## Core Concepts

### Organization Structure
Each organization has its own:
- **tetra.toml** - Organization-specific configuration
- **Environments** - Development, staging, production configs
- **Resources** - Servers, databases, APIs, storage
- **Secrets** - Encrypted credentials (via secrets manager)
- **Connectors** - Service integration points

### Active Organization
- Single active org at a time via symlink
- Global `$TETRA_ACTIVE_ORG` variable
- Switch orgs with `tetra org use <name>`
- All tetra commands use active org context

### Configuration Format

TOML-based hierarchical configuration:

```toml
[org]
name = "mycompany"
description = "My Company Infrastructure"

[environments.production]
domain = "example.com"
api_url = "https://api.example.com"

[resources.database]
host = "db.example.com"
port = 5432
name = "myapp"

[storage.spaces]
bucket = "mycompany-assets"
region = "nyc3"
```

## Commands

### Organization Management
- `tetra org create <name>` - Create new organization
- `tetra org list` - List all organizations
- `tetra org use <name>` - Switch active organization
- `tetra org active` - Show active organization
- `tetra org delete <name>` - Delete organization

### Configuration
- `tetra org edit` - Edit organization TOML
- `tetra org show` - Display organization config
- `tetra org validate` - Validate TOML syntax
- `tetra org refresh` - Reload org configuration

### Environment Management
- `tetra org env list` - List environments
- `tetra org env show <env>` - Show environment config
- `tetra org env create <env>` - Create environment

### Secrets Management
- `tetra org secret set <key> <value>` - Store secret
- `tetra org secret get <key>` - Retrieve secret
- `tetra org secret list` - List secret keys
- `tetra org secret delete <key>` - Delete secret

## REPL Mode

```bash
# Launch interactive REPL with tab completion
org_repl

org:mycompany> list
org:mycompany> use othercompany
org:othercompany> show
org:othercompany> env list
org:othercompany> secret list
org:othercompany> help
org:othercompany> quit
```

## Tab Completion

Bash completion for org commands:

```bash
# Enable completion (auto-loaded with tetra)
source "$ORG_SRC/org_completion.sh"

# Use completion
tetra org <TAB>          # Shows commands
tetra org use <TAB>      # Shows organization names
tetra org env <TAB>      # Shows environment commands
```

## Module Structure

- `includes.sh` - Module entry point, sets MOD_SRC/MOD_DIR
- `actions.sh` - TCS-compliant actions for TUI integration
- `tetra_org.sh` - Main organization management
- `org_repl.sh` - Interactive REPL with rlwrap
- `org_completion.sh` - Bash tab completion
- `org_config.sh` - Configuration management
- `secrets_manager.sh` - Encrypted secrets storage
- `converter.sh` - TOML conversion utilities

## Organization Directory

```
$TETRA_DIR/orgs/
├── mycompany/
│   ├── tetra.toml           # Organization config
│   ├── secrets/             # Encrypted secrets
│   └── cache/               # Cached data
├── otherclient/
│   └── tetra.toml
└── active -> mycompany      # Symlink to active org
```

## Integration

Works seamlessly with:
- **Deploy** module - Environment-specific deployments
- **Spaces** module - Organization-scoped storage
- **Env** module - Environment variable management
- **TSM** module - Organization-specific services

## View System

Advanced TOML navigation and viewing:
- `org_view_env <env>` - View environment with semantics
- `org_view_resources` - View all resources
- `org_toml_flatten` - Flatten nested TOML
- `org_tes_viewer` - TES symbol resolution viewer

## See Also

- `ORG_REPL_README.md` - Detailed REPL documentation
- `MULTI_ENV_README.md` - Multi-environment guide
- `secrets_manager.sh` - Secrets management
- `VIEW_ENV_SEMANTICS.md` - View system documentation
