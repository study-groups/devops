# Organization Management and TDash Dashboard

## Overview

Tetra's organization management system provides multi-client infrastructure support with a revolutionary dashboard interface. This system enables seamless switching between different client organizations while maintaining clean, organized configuration files.

## TETRA_DIR Structure

The Tetra directory has been reorganized for maximum clarity:

```
$TETRA_DIR/
├── tetra.sh                    # Only file at root level
├── config/
│   ├── modules.conf           # Module configuration
│   ├── tetra.toml            # Active organization symlink
│   └── tetra/                # Tetra module storage
│       ├── config/
│       ├── history/
│       └── logs/
├── orgs/                     # Organization configurations
│   ├── pixeljam_arcade/
│   │   └── pixeljam_arcade.toml
│   └── client_name/
│       └── client_name.toml
├── modules/                  # All module data
│   ├── tsm/, rag/, utils/, nvm/, etc.
├── services/                 # TSM service definitions
└── env/                     # Environment files
```

## Organization Management Commands

### Core Commands

```bash
# List all organizations
tetra org list

# Show active organization
tetra org active

# Switch to different organization
tetra org switch <org_name>

# Create new organization
tetra org create <org_name>
```

### Advanced Commands (Future)

```bash
# Deploy org config to environment
tetra org push <org> <env>

# Sync org config from environment
tetra org pull <org> <env>

# Bi-directional sync across environments
tetra org sync <org>
```

## Organization Structure

Each organization has its own directory with a TOML configuration file:

```toml
# Example: pixeljam_arcade.toml
[org]
name = "pixeljam_arcade"
description = "Pixeljam Arcade infrastructure"

[environments.local]
description = "Local development environment"

[environments.dev]
description = "Development server environment"
dev_server = "pxjam-arcade-dev01"
dev_ip = "137.184.226.163"

[environments.staging]
description = "Staging environment"
staging_server = "pxjam-arcade-staging01"
staging_ip = "137.184.227.45"

[environments.prod]
description = "Production environment"
prod_server = "pxjam-arcade-prod01"
prod_ip = "137.184.228.92"

[domains]
dev = "dev.pixeljamarcade.com"
staging = "staging.pixeljamarcade.com"
prod = "pixeljamarcade.com"

[infrastructure]
# DigitalOcean integration, server specs, etc.
```

## Active Organization System

The active organization is managed through a symlink:
- `$TETRA_DIR/config/tetra.toml` → `$TETRA_DIR/orgs/active_org/active_org.toml`
- Switching organizations updates this symlink automatically
- All Tetra tools read from the active organization configuration

## TDash - Revolutionary Dashboard

TDash provides a 4-mode, 4-environment navigation system for infrastructure management.

### Navigation System

**4 Modes (A/D keys):**
- **TOML** ← → **TKM** ← → **TSM** ← → **DEPLOY**

**5 Environments (W/S keys):**
- **SYSTEM** ↕ **LOCAL** ↕ **DEV** ↕ **STAGING** ↕ **PROD**

**Item Navigation (J/I/K/L keys):**
- Navigate within selected mode+environment combination

### Key Features

#### Organization Integration
- **Organization Context**: TDash displays active organization in TOML:SYSTEM mode
- **Real-time Updates**: Switching organizations immediately updates dashboard context
- **Infrastructure Display**: Shows server IPs, memory specs, regions from organization TOML

#### TOML Mode Features
- **Live Data Parsing**: Real-time infrastructure data from organization TOML
- **SSH Connectivity**: Non-blocking connectivity checks with visual indicators
- **Rich Formatting**: Bold highlighting, color coding, status symbols
- **Infrastructure Summary**: Server details, domains, environment configurations

#### Navigation Features
- **Perfect Double-buffering**: Flicker-free navigation experience
- **20 Unique Views**: 4 modes × 5 environments = comprehensive coverage
- **Instant Switching**: Seamless transitions between modes and environments

### TDash Usage

```bash
# Launch dashboard
tdash

# Interactive navigation mode (default)
tdash repl

# Show help
tdash help
```

### Navigation Keys

| Key | Action |
|-----|--------|
| **A/D** | Switch modes (TOML ← → TKM ← → TSM ← → DEPLOY) |
| **W/S** | Switch environments (SYSTEM ↕ LOCAL ↕ DEV ↕ STAGING ↕ PROD) |
| **J/I/K/L** | Navigate items within current mode+environment |
| **Q** | Quit dashboard |

## Workflow Examples

### Multi-Client Management

```bash
# Check current organization
tetra org active
# Output: pixeljam_arcade

# List all client organizations
tetra org list
# Shows: pixeljam_arcade (active), client_two, personal

# Switch to different client
tetra org switch client_two

# Launch dashboard for new client
tdash
# Dashboard now shows client_two infrastructure
```

### New Client Setup

```bash
# Create new organization
tetra org create new_client

# Switch to new organization
tetra org switch new_client

# Edit configuration
$EDITOR $TETRA_DIR/orgs/new_client/new_client.toml

# Verify in dashboard
tdash
```

## Integration with Other Systems

### TSM Service Manager
- Services can be organization-specific
- Service definitions respect active organization context
- Environment-specific service configurations

### Environment Management
- Organization TOML drives environment promotion
- Automatic adaptations for domains, paths, security
- Multi-environment coordination per organization

### Module System
- All modules work with organization context
- Module data organized in `$TETRA_DIR/modules/`
- Lazy loading and registration system unchanged

## Best Practices

### Organization Naming
- Use consistent naming: match DigitalOcean organization names
- Lowercase with underscores: `pixeljam_arcade`, `client_name`
- Descriptive but concise: `personal`, `staging_env`

### TOML Configuration
- Complete environment definitions for all stages
- Include all server details, IPs, domains
- Document infrastructure specifications
- Use consistent section structure

### Workflow Management
- Switch organizations before starting work
- Verify active organization with `tetra org active`
- Use TDash to visualize infrastructure before deployments
- Keep organization configs in sync across environments

## Troubleshooting

### Common Issues

**Organization not found:**
```bash
tetra org list
# Verify organization exists and spelling is correct
```

**Symlink issues:**
```bash
ls -la $TETRA_DIR/config/tetra.toml
# Should point to valid organization TOML
```

**TDash not showing organization:**
```bash
tetra org active
# Verify active organization is set
```

### Recovery Commands

```bash
# Reset to known organization
tetra org switch pixeljam_arcade

# Recreate organization if corrupted
tetra org create backup_org
```

## Future Enhancements

### Planned Features
- **5th ORG Mode**: Direct organization management within TDash
- **Config Push/Pull**: Deploy organization configs to remote environments
- **NH Integration**: Auto-populate TOML from DigitalOcean API
- **Real-time Metrics**: CPU, memory, disk usage in TDash
- **Log Streaming**: Infrastructure logs within dashboard

### Roadmap Integration
- Multi-environment sync across all client organizations
- Advanced search and filtering in TDash
- Infrastructure cost tracking and alerts
- Automated backup and recovery systems

This organization management system provides the foundation for scalable multi-client infrastructure management while maintaining the clean, efficient workflow that defines the Tetra philosophy.