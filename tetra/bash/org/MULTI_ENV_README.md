# Tetra Multi-Environment Configuration System

**Single Source of Truth → Dynamic Environment Generation**

## Philosophy

**ONE template (local.toml), INFINITE environments.**

Instead of maintaining separate configuration files for each environment, you maintain a single `local.toml` file that serves as the source of truth. Environment-specific configurations (dev, staging, prod) are **dynamically generated** from this template using environment profiles.

## Quick Start

```bash
# 1. Initialize your organization
tsm org init my-company
export TETRA_ORG=my-company

# 2. Edit your local configuration (source of truth)
tsm org env edit local

# 3. Promote to dev environment
tsm org promote @dev

# 4. Review what was generated
tsm org env show dev

# 5. Deploy to dev server
scp ~/tetra/org/my-company/environments/dev.toml dev-server:/root/tetra/org/my-company/environments/
```

## Directory Structure

```
$TETRA_DIR/org/my-company/
├── manifest.toml                    # Org-wide settings
├── environments/
│   ├── local.toml                  # SOURCE OF TRUTH (you edit this)
│   ├── dev.toml                    # Generated from local.toml
│   ├── staging.toml                # Generated from local.toml
│   └── prod.toml                   # Generated from local.toml
├── secrets/                        # Gitignored secrets
│   ├── local.env
│   ├── dev.env
│   ├── staging.env
│   └── prod.env
└── history/                        # Deployment backups
    ├── dev_20250119_143022.toml
    └── ...
```

## Workflow

### 1. Edit Local Configuration

Edit `local.toml` with your desired configuration:

```bash
tsm org env edit local
```

This file contains your **application logic**: ports, services, basic settings. Comments in the file show what will change per environment:

```toml
[deployment]
tetra_src = "~/src/devops/tetra"      # dev: /root/src/devops/tetra, prod: /opt/tetra
user = "mricos"                       # dev: root, prod: tetra

[services.tetra]
command = "node server/server.js"    # prod adds: --env production
auto_restart = false                  # Servers: true

[resources]
memory_max = 0                        # prod: 4096 (4GB)

[security]
firewall_enabled = false              # prod: true
ssl_enabled = false                   # prod: true

[logging]
level = "debug"                       # prod: "warn"
format = "pretty"                     # prod: "json"
```

### 2. Promote to Environment

Generate environment-specific configuration:

```bash
# Promote to dev (@dev: root:root, /root/tetra)
tsm org promote @dev

# Promote to staging
tsm org promote @staging

# Promote to production
tsm org promote @prod
```

What happens:
1. Copies `local.toml` → `{env}.toml`
2. Applies environment profile transformations
3. Updates metadata (timestamp, user, commit)
4. Backs up previous version to `history/`

### 3. Review Generated Config

```bash
# Show the generated config
tsm org env show dev

# Compare local vs generated
tsm org diff @dev
```

### 4. Deploy to Server

```bash
# Copy to target server
scp ~/tetra/org/my-company/environments/dev.toml \
    dev-server:/root/tetra/org/my-company/environments/

# SSH to server and apply
ssh dev-server 'source ~/tetra/tetra.sh && tsm org apply'
```

## Environment Profiles

Each environment has a profile that defines transformations:

### @dev (Development Server)
- **User**: `root:root`
- **Paths**: `/root/src/devops/tetra`, `/root/tetra`
- **System**: Linux + systemd
- **Security**: Firewall enabled, open access (0.0.0.0/0)
- **Resources**: Moderate (1GB memory)
- **Monitoring**: Enabled with alerts
- **Backup**: Optional

### @staging
- **User**: `tetra:tetra` (dedicated user)
- **Paths**: `/opt/tetra`, `/var/lib/tetra`
- **System**: Linux + systemd
- **Security**: Firewall + SSL, internal network only
- **Resources**: Higher (2GB memory)
- **Monitoring**: Full monitoring + alerts
- **Backup**: Enabled (daily)

### @prod (Production)
- **User**: `tetra:tetra` (dedicated user)
- **Paths**: `/opt/tetra`, `/var/lib/tetra`
- **System**: Linux + systemd
- **Security**: STRICT (firewall + SSL + HSTS, internal only)
- **Resources**: Maximum (4GB memory, 131k file descriptors)
- **Monitoring**: REQUIRED (alerts, APM, metrics)
- **Backup**: REQUIRED (daily + offsite)
- **Compliance**: Audit logging, 90-day retention

## Commands Reference

### Organization Management

```bash
# Initialize new organization
tsm org init <orgname>

# List organizations
tsm org env list

# Set active organization
export TETRA_ORG=my-company
```

### Environment Management

```bash
# Edit local config (source of truth)
tsm org env edit local

# Show environment config
tsm org env show <env>

# Validate TOML syntax
tsm org env validate <env>
```

### Deployment

```bash
# Promote local to environment
tsm org promote @dev
tsm org promote @staging
tsm org promote @prod

# Show differences
tsm org diff @dev

# Deployment history
tsm org history @dev

# Rollback to previous version
tsm org rollback @dev
```

## Example: @dev Configuration

Starting with `local.toml`:

```toml
[deployment]
user = "mricos"
tetra_src = "~/src/devops/tetra"

[services.tetra]
command = "node server/server.js"
auto_restart = false

[security]
firewall_enabled = false
```

After `tsm org promote @dev`:

```toml
[deployment]
user = "root"  # Changed
tetra_src = "/root/src/devops/tetra"  # Changed

[services.tetra]
command = "node server/server.js --env dev"  # Flag added
auto_restart = true  # Changed

[security]
firewall_enabled = true  # Changed
allowed_ips = ["0.0.0.0/0"]  # Added
```

## Integration with TSM Daemon

The generated environment configs work seamlessly with the TSM daemon system:

```bash
# On dev server (after promoting config):
source /root/tetra/tetra.sh

# The daemon reads from org config
tsm daemon install @dev
tsm daemon enable
tsm daemon start

# Service definition comes from org config:
# - Paths from [deployment]
# - Ports from [ports]
# - Resources from [resources]
# - Security from [security]
```

## Best Practices

1. **Always edit local.toml**: Never edit dev/staging/prod.toml directly
2. **Review before deploying**: Use `tsm org diff @env` before promoting
3. **Version control local.toml**: Commit local.toml to git
4. **Gitignore generated files**: Add `environments/{dev,staging,prod}.toml` to `.gitignore`
5. **Keep secrets separate**: Never put secrets in TOML files, use `secrets/*.env`
6. **Test the flow**: local → dev → staging → prod
7. **Use deployment history**: Rollback is always available

## Secrets Management

TOML files contain configuration, NOT secrets. Secrets go in `secrets/`:

```bash
# Structure
org/my-company/secrets/
├── local.env          # Your local API keys
├── dev.env            # Dev server keys
├── staging.env        # Staging keys
└── prod.env           # Production keys (most sensitive)

# These are gitignored and deployed separately
```

Service definitions reference these:

```toml
[services.tetra]
env_file = "env/dev.env"  # Changes per environment
```

## Rollback Strategy

Every promotion creates a backup:

```bash
# View history
tsm org history @dev

# Output:
# 📄 20250119_143022
#    By: mricos
#    File: ~/tetra/org/my-company/history/dev_20250119_143022.toml

# Rollback to previous version
tsm org rollback @dev
```

## CI/CD Integration

```bash
#!/bin/bash
# deploy-to-dev.sh

# Ensure org is set
export TETRA_ORG=my-company

# Promote latest local to dev
tsm org promote @dev

# Review changes
tsm org diff @dev

# Deploy to server
scp ~/tetra/org/my-company/environments/dev.toml \
    dev-server:/root/tetra/org/my-company/environments/

# Apply on server
ssh dev-server 'source /root/tetra/tetra.sh && tsm org apply && tsm daemon restart'
```

## Troubleshooting

### "No organization set"
```bash
export TETRA_ORG=my-company
# Or add to ~/.bashrc
```

### "Local configuration not found"
```bash
tsm org init my-company
tsm org env edit local
```

### "Environment profile failed"
Check that `bash/org/env_profiles.sh` is loaded:
```bash
declare -f apply_dev_profile
```

## Architecture

```
local.toml (SOURCE OF TRUTH)
     ↓
tsm org promote @dev
     ↓
env_profiles.sh (apply_dev_profile)
     ↓
     - Copy local.toml → dev.toml
     - Transform paths: ~/ → /root/
     - Transform user: mricos → root
     - Add flags: --env dev
     - Enable features: auto_restart = true
     - Update metadata
     ↓
dev.toml (GENERATED)
```

## Files

- `org_config.sh` - Organization and environment management
- `env_profiles.sh` - Environment transformation rules
- `org_deploy.sh` - Promotion and deployment logic
- `templates/org/manifest.toml` - Org template
- `templates/org/environments/local.toml` - Single source template

## Next Steps

1. **Initialize**: `tsm org init <your-company>`
2. **Configure**: Edit `local.toml` with your settings
3. **Promote**: `tsm org promote @dev`
4. **Deploy**: Copy to server and apply
5. **Verify**: Check daemon status

---

**Remember**: `local.toml` is your source of truth. All other environments are generated from it.
