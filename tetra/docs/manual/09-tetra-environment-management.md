# The Tetra Way - Environment Management

## Philosophy

The Tetra Way implements a practical, developer-friendly approach to environment management that aligns with git workflows and eliminates template complexity. Everything starts with organic development in `env/dev.env`, then uses intelligent tooling to promote configurations through environments.

## Core Principles

### 1. **Environment-User Alignment**
Each environment runs as a dedicated user following the convention:
- **Local**: Developer's laptop/private network (TKM command center)
- **Dev**: `/home/dev/src/pixeljam/` (shared development server)
- **Staging**: `/home/staging/src/pixeljam/` (pre-production)
- **Production**: `/home/prod/src/pixeljam/` (live environment)

### 2. **Git Semantic Alignment**
- Personal branches → merge to `dev` branch → deployed to dev server
- Dev branch → promoted to staging environment
- Staging → promoted to production environment

### 3. **Organic Development First**
- **No templates** - developers build `env/dev.env` naturally during development
- **No `local.env` in repo** - developers manage local copies manually
- **Promotion-based** - use tooling to create staging/prod environments

## Environment File Workflow

### Starting Development

1. **Create dev.env organically**:
```bash
# Developer builds this naturally during development
mkdir -p env
cat > env/dev.env <<EOF
export NODE_ENV=development
export PORT=8480
export DOMAIN_NAME=dev.pixeljamarcade.com
export USER=dev
export TETRA_ENV=dev
export PJA_SRC=/home/dev/src/pixeljam/pja/arcade
export LOG_DIR=/home/dev/.local/share/pixeljam/logs
EOF
```

2. **Work locally** (manual copy):
```bash
# Developer manages their own local copy
cp env/dev.env env/local.env  # Not tracked in git
# Edit local.env for localhost development
sed -i 's/dev\.pixeljamarcade\.com/localhost/' env/local.env
```

### Environment Promotion

Use the `tetra env` command to promote between environments:

```bash
# Promote dev to staging
tetra env promote dev staging

# Promote staging to production
tetra env promote staging prod

# List available environments
tetra env list

# Validate environment files
tetra env validate staging

# Compare environments
tetra env diff dev staging
```

### Automatic Adaptations

During promotion, the system automatically adapts:

- **NODE_ENV**: `development` → `staging` → `production`
- **DOMAIN_NAME**: `dev.pixeljamarcade.com` → `staging.pixeljamarcade.com` → `pixeljamarcade.com`
- **User paths**: `/home/dev/` → `/home/staging/` → `/home/prod/`
- **TETRA_ENV**: `dev` → `staging` → `prod`
- **Security**: Remove debug flags, enable production settings

## Deployment Workflow

### Local Command Center (TKM)

Use your local machine as the deployment command center:

```bash
# Deploy environment files to servers
tkm deploy env staging
tkm deploy env prod

# Deploy and restart services
tkm deploy service staging
tkm deploy service prod

# Check deployment status
tkm deploy status
tkm deploy status staging

# List deployable environments
tkm deploy list
```

### Service Management (TSM)

TSM automatically detects environment files:

```bash
# Start services with environment auto-detection
tsm start entrypoints/dev.sh       # Auto-sources env/dev.env
tsm start entrypoints/staging.sh   # Auto-sources env/staging.env

# Override environment explicitly
tsm start --env prod entrypoints/staging.sh  # Use prod.env

# Service registry integration
tsm start pixeljam-arcade-dev      # From service templates
```

## Service Templates

### SystemD Services

Environment-specific systemd service files:
- `templates/systemd/pixeljam-arcade-dev.service` - Development settings
- `templates/systemd/pixeljam-arcade-staging.service` - Staging security
- `templates/systemd/pixeljam-arcade-prod.service` - Production hardening

### Nginx Configuration

Environment-specific nginx configurations:
- `templates/nginx/pixeljam-arcade-dev.conf` - Development features (HMR, debug)
- `templates/nginx/pixeljam-arcade-staging.conf` - Moderate security
- `templates/nginx/pixeljam-arcade-prod.conf` - Maximum security, rate limiting

## Complete Workflow Example

### 1. Initial Development
```bash
# Developer creates dev.env organically
echo 'export NODE_ENV=development' > env/dev.env
echo 'export PORT=8480' >> env/dev.env
echo 'export DOMAIN_NAME=dev.pixeljamarcade.com' >> env/dev.env

# Work locally (manual copy)
cp env/dev.env env/local.env
sed -i 's/dev\.pixeljamarcade\.com/localhost/' env/local.env

# Test locally
tsm start --env local entrypoints/dev.sh
```

### 2. Deploy to Dev Server
```bash
# From local command center (TKM)
tkm deploy env dev
tkm deploy service dev

# Verify deployment
tkm deploy status dev
```

### 3. Promote to Staging
```bash
# Promote environment
tetra env promote dev staging

# Review changes
tetra env diff dev staging

# Deploy to staging
tkm deploy env staging
tkm deploy service staging
```

### 4. Promote to Production
```bash
# Promote environment
tetra env promote staging prod

# Validate production config
tetra env validate prod

# Deploy to production (careful!)
tkm deploy env prod
tkm deploy service prod

# Monitor deployment
tkm deploy status prod
```

## Key Benefits

### 1. **Developer-Friendly**
- No complex templates to maintain
- Organic development of environment files
- Manual local control with automatic server deployment

### 2. **Git-Aligned**
- Environment progression matches git branch workflow
- Clear separation between local development and server deployment

### 3. **Secure by Default**
- Automatic security hardening during promotion
- Environment-specific service configurations
- Progressive security from dev → staging → production

### 4. **Deployment Confidence**
- Local command center for all deployments
- Status tracking and synchronization verification
- Rollback capabilities through git and backups

## Best Practices

### Environment Files
- **Never commit local.env** - each developer manages their own
- **Build dev.env organically** - add variables as needed during development
- **Review promotion changes** - always check diffs before deploying
- **Validate before production** - use `tetra env validate prod`

### Security
- **Use TKM for key management** - SSH keys for server access
- **Progressive security** - staging more secure than dev, prod most secure
- **Audit deployments** - track who deployed what when

### Service Management
- **Use service templates** - environment-specific systemd/nginx configs
- **Monitor deployment status** - check synchronization regularly
- **Plan rollbacks** - maintain backup configurations

## Troubleshooting

### Environment Issues
```bash
# Check environment file status
tetra env list
tetra env validate <environment>

# Compare environments
tetra env diff dev staging

# Check deployment status
tkm deploy status
```

### Service Issues
```bash
# Check service status
tsm list
tsm info <service>

# View logs
tsm logs <service>

# Restart services
tkm deploy service <environment>
```

### Network Issues
```bash
# Test connectivity
tkm deploy status <environment>

# Check SSH access
ssh dev@dev.pixeljamarcade.com
ssh staging@pixeljamarcade.com
```

The Tetra Way provides a complete, practical approach to environment management that grows with your development workflow while maintaining security and deployment confidence.