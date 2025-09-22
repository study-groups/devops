# Nodeholder and Tetra Integration

## Overview

Nodeholder (NH) and Tetra form a two-layer infrastructure management system that bridges DigitalOcean cloud resources with application deployment workflows. This integration enables seamless infrastructure discovery, semantic mapping, and deployment automation across development, staging, and production environments.

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   DigitalOcean  │    │   Nodeholder    │    │     Tetra       │
│   (Raw Cloud)   │────│  (Discovery)    │────│ (Deployment)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
   doctl API calls       Semantic Mapping      App Orchestration
   Droplet metadata      Variable Generation   Service Management
   Network topology      Context Management    Environment Sync
```

### Integration Flow

1. **Infrastructure Discovery**: NH scans DigitalOcean infrastructure via `doctl` API
2. **Semantic Mapping**: NH creates human-readable variables and mappings
3. **Context Export**: NH provides standardized environment variables
4. **Tetra Consumption**: Tetra reads NH context for deployment targeting
5. **Organization Sync**: Infrastructure data populates Tetra organization TOML files

## Nodeholder: Infrastructure Discovery Layer

### Primary Functions

**Infrastructure Scanning:**
- Queries DigitalOcean API for droplets, volumes, domains, floating IPs
- Extracts server names, IP addresses, network configurations
- Builds comprehensive infrastructure JSON snapshots

**Semantic Variable Generation:**
```bash
# NH creates semantic shortcuts from server names
# Server: pxjam-arcade-dev01 → Variable: $pad (p+a+d)
export pad="137.184.226.163"     # Development server
export paq="146.190.151.245"     # QA/Staging server
export pap="64.23.151.249"       # Production server

# Network variants
export padp="10.116.0.2"         # Development private IP
export paqf="146.190.151.245"    # Staging floating IP
```

**Context Management:**
- Project-specific contexts under `$NH_DIR/<project>/`
- Context switching via `pj` command loads environment variables
- Isolation between different client organizations

### NH Variable Naming Convention

NH generates variables using **first-letter abbreviation** from hyphen-separated server names:

```bash
# Pattern: organization-project-environment-sequence
pxjam-arcade-dev01    → pad   (p+a+d)
pxjam-arcade-qa01     → paq   (p+a+q)
pxjam-arcade-prod01   → pap   (p+a+p)
client-website-dev01  → cwd   (c+w+d)
client-website-prod01 → cwp   (c+w+p)
```

**Network Type Suffixes:**
- No suffix: Public IP (default)
- `p` suffix: Private IP (`$padp`, `$paqp`)
- `f` suffix: Floating IP (`$padf`, `$paqf`)

## Tetra: Application Deployment Layer

### Organization-Centric Model

Tetra organizes infrastructure around **organizations** - client-specific configurations that define multi-environment deployment targets.

**Organization Structure:**
```bash
$TETRA_DIR/
├── config/
│   └── tetra.toml          # Symlink to active organization
├── orgs/
│   ├── pixeljam_arcade/
│   │   └── pixeljam_arcade.toml
│   └── client_name/
│       └── client_name.toml
```

**Active Organization Management:**
```bash
tetra org list              # Show all organizations
tetra org active            # Show current active organization
tetra org switch <name>     # Switch to different organization
```

### Tetra Organization TOML Structure

Tetra consumes NH infrastructure data through standardized TOML configurations:

```toml
[org]
name = "pixeljam_arcade"
description = "Pixeljam Arcade infrastructure"

[environments.local]
description = "Local development environment"

[environments.dev]
description = "Development server environment"
dev_server = "pxjam-arcade-dev01"
dev_ip = "137.184.226.163"          # Maps to NH $pad
dev_private_ip = "10.116.0.2"       # Maps to NH $padp

[environments.staging]
description = "Staging environment"
staging_server = "pxjam-arcade-qa01"
staging_ip = "146.190.151.245"      # Maps to NH $paq
staging_private_ip = "10.116.0.3"   # Maps to NH $paqp

[environments.prod]
description = "Production environment"
prod_server = "pxjam-arcade-prod01"
prod_ip = "64.23.151.249"           # Maps to NH $pap
prod_private_ip = "10.116.0.4"      # Maps to NH $papp

[domains]
dev = "dev.pixeljamarcade.com"      # Points to dev_ip
staging = "staging.pixeljamarcade.com"  # Points to staging_ip
prod = "pixeljamarcade.com"         # Points to prod_ip

[infrastructure]
provider = "digitalocean"
region = "nyc3"
```

## Integration Workflows

### 1. Infrastructure Discovery to Deployment

```bash
# Step 1: Load NH context for infrastructure discovery
pj  # Loads pixeljam-arcade context

# Step 2: Verify infrastructure variables are available
echo "Dev: $pad, Staging: $paq, Prod: $pap"

# Step 3: Switch to Tetra organization context
tetra org switch pixeljam_arcade

# Step 4: Deploy using Tetra with NH-discovered infrastructure
tetra deploy --target dev      # Uses $pad internally
tetra deploy --target staging  # Uses $paq internally
tetra deploy --target prod     # Uses $pap internally
```

### 2. Multi-Environment Variable Mapping

**Environment Variables Flow:**
```bash
# NH Discovery → Environment Variables → Tetra Consumption

# Development Environment
$pad → TETRA_DEV_IP → [environments.dev] dev_ip
$padp → TETRA_DEV_PRIVATE_IP → [environments.dev] dev_private_ip

# Staging Environment
$paq → TETRA_STAGING_IP → [environments.staging] staging_ip
$paqp → TETRA_STAGING_PRIVATE_IP → [environments.staging] staging_private_ip

# Production Environment
$pap → TETRA_PROD_IP → [environments.prod] prod_ip
$papp → TETRA_PROD_PRIVATE_IP → [environments.prod] prod_private_ip
```

### 3. Domain and Subdomain Handling

For scenarios where multiple environments share the same IP but use different subdomains:

```toml
[environments.staging]
staging_ip = "137.184.226.163"      # Same IP as prod
staging_domain = "staging.pixeljamarcade.com"

[environments.prod]
prod_ip = "137.184.226.163"         # Same IP as staging
prod_domain = "pixeljamarcade.com"

[routing]
# Nginx/Apache virtual host configuration
staging_vhost = "staging.pixeljamarcade.com"
prod_vhost = "pixeljamarcade.com"
shared_ip = "137.184.226.163"
```

**Environment Variable Expansion:**
```bash
# Generate environment-specific variables
STAGING_DOMAIN="staging.pixeljamarcade.com"
STAGING_URL="https://staging.pixeljamarcade.com"
PROD_DOMAIN="pixeljamarcade.com"
PROD_URL="https://pixeljamarcade.com"
SHARED_IP="137.184.226.163"
```

## TDash Integration

TDash provides real-time monitoring of the NH-Tetra integration:

### TOML Mode Display

**SYSTEM Environment:** Organization overview
- Active organization name from symlink
- Infrastructure summary from NH data
- Overall connectivity status

**DEV/STAGING/PROD Environments:**
- Server details from organization TOML
- IP addresses (public/private) with NH variable mappings
- Domain configurations and routing
- SSH connectivity status using NH shortcuts
- Infrastructure specifications

**Example TDash TOML Display:**
```
[TOML:DEV] pixeljam_arcade
┌─────────────────────────────────────┐
│ Development Environment             │
├─────────────────────────────────────┤
│ Server: pxjam-arcade-dev01          │
│ Public IP: 137.184.226.163 ($pad) ✓ │
│ Private IP: 10.116.0.2 ($padp)     │
│ Domain: dev.pixeljamarcade.com      │
│ SSH Status: Connected               │
│ Region: nyc3                        │
└─────────────────────────────────────┘
```

## Common Integration Patterns

### 1. Shared Infrastructure with Environment Routing

```toml
[infrastructure.shared]
load_balancer_ip = "64.23.151.249"
backend_servers = ["10.116.0.2", "10.116.0.3", "10.116.0.4"]

[environments.dev]
subdomain = "dev"
backend_pool = ["10.116.0.2"]
ssl_cert = "dev-cert"

[environments.staging]
subdomain = "staging"
backend_pool = ["10.116.0.3"]
ssl_cert = "staging-cert"

[environments.prod]
subdomain = ""  # Root domain
backend_pool = ["10.116.0.4"]
ssl_cert = "prod-cert"
```

### 2. Multi-Client Context Switching

```bash
# Switch between client contexts
NH_CONTEXT=pixeljam_arcade && pj && tetra org switch pixeljam_arcade
NH_CONTEXT=client_two && pj && tetra org switch client_two

# Variables automatically update per context
echo $pad  # Different IP for each client's dev environment
```

### 3. Environment Variable Standardization

**Required Environment Variables per Environment:**
```bash
# Development
DEV_IP, DEV_PRIVATE_IP, DEV_DOMAIN, DEV_SSH_KEY, DEV_USER

# Staging
STAGING_IP, STAGING_PRIVATE_IP, STAGING_DOMAIN, STAGING_SSH_KEY, STAGING_USER

# Production
PROD_IP, PROD_PRIVATE_IP, PROD_DOMAIN, PROD_SSH_KEY, PROD_USER

# Common
PROJECT_NAME, ORGANIZATION, DEPLOY_USER, DEPLOY_KEY_PATH
```

## Best Practices

### NH-Tetra Integration

1. **Consistent Naming**: Use same naming pattern across NH and Tetra
2. **Context Isolation**: Always load correct NH context before Tetra operations
3. **Variable Validation**: Verify NH variables exist before Tetra deployment
4. **Automatic Sync**: Keep organization TOML files updated with NH discoveries

### Environment Management

1. **IP Documentation**: Document which environments share IPs
2. **Subdomain Strategy**: Use consistent subdomain patterns across organizations
3. **SSL Management**: Account for environment-specific certificates
4. **Monitoring**: Use TDash to verify infrastructure connectivity

### Security Considerations

1. **SSH Key Management**: Environment-specific SSH keys in TOML
2. **Private IP Usage**: Use private IPs for internal service communication
3. **Secret Injection**: Use `var.*` pattern for sensitive environment variables
4. **Access Control**: Limit NH context access to authorized users

## Troubleshooting

### Common Issues

**NH Variables Not Available:**
```bash
# Verify NH context is loaded
echo $DIGITALOCEAN_CONTEXT
pj  # Reload context

# Check variable generation
env | grep '^p[a-z]*=' | sort
```

**Organization TOML Outdated:**
```bash
# Verify active organization
tetra org active
ls -la $TETRA_DIR/config/tetra.toml

# Refresh infrastructure data
nh_load_env_vars
tetra org sync
```

**TDash Not Showing Infrastructure:**
```bash
# Verify both NH and Tetra contexts
pj && tetra org active
tdash  # Should show current organization data
```

This integration provides a seamless bridge between raw cloud infrastructure and application deployment, enabling rapid, organized, multi-environment workflows while maintaining security and operational clarity.