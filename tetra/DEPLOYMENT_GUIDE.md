# Tetra Deployment Guide

Complete guide for deploying Tetra across multiple environments with systemd daemon management.

## Overview

Tetra provides two complementary systems for deployment:

1. **Multi-Environment Configuration** - Manage configs for local, dev, staging, prod
2. **Systemd Daemon** - Run Tetra as a system service

## Quick Start: Dev Environment Deployment

```bash
# Step 1: Initialize organization config
export TETRA_ORG=my-company
tsm org init my-company

# Step 2: Edit local configuration (source of truth)
tsm org env edit local

# Step 3: Generate dev configuration
tsm org promote @dev

# Step 4: Review generated config
tsm org env show dev
tsm org diff @dev

# Step 5: Deploy to dev server
scp ~/tetra/org/my-company/environments/dev.toml \
    dev-server:/root/tetra/org/my-company/environments/dev.toml

# Step 6: On dev server - install daemon
ssh dev-server
source /root/tetra/tetra.sh
tsm daemon install @dev
tsm daemon enable
tsm daemon start

# Step 7: Verify
tsm daemon status
curl http://localhost:4444/health
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    LOCAL DEVELOPMENT                        │
│                                                             │
│  $TETRA_DIR/org/my-company/                                │
│  ├── manifest.toml                                         │
│  ├── environments/                                         │
│  │   └── local.toml  ← EDIT THIS (source of truth)        │
│  └── secrets/local.env                                     │
│                                                             │
│  $ tsm org promote @dev                                     │
│                      ↓                                      │
│  environments/dev.toml (GENERATED)                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                          ↓ scp
┌─────────────────────────────────────────────────────────────┐
│                     DEV SERVER                              │
│                                                             │
│  /root/tetra/org/my-company/                               │
│  └── environments/dev.toml                                 │
│                                                             │
│  /etc/systemd/system/tetra-dev.service                     │
│  └── ExecStart: source tetra.sh && tsm start tetra         │
│                                                             │
│  /root/tetra/tsm/services-available/tetra.tsm              │
│  └── command: node server/server.js --env dev              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Configuration Workflow

### 1. Single Source of Truth: local.toml

Edit one file with all your application logic:

```toml
# $TETRA_DIR/org/my-company/environments/local.toml

[deployment]
user = "mricos"              # dev: root, prod: tetra
tetra_src = "~/src/..."      # dev: /root/..., prod: /opt/tetra

[ports]
tetra = 4444                 # Same across all environments

[services.tetra]
command = "node server.js"   # prod adds: --env production
auto_restart = false         # Servers: true

[resources]
memory_max = 0               # prod: 4096 (4GB)

[security]
ssl_enabled = false          # prod: true
```

### 2. Dynamic Environment Generation

```bash
# Generate dev config (root:root, /root paths)
tsm org promote @dev

# Generate staging config (tetra:tetra, /opt paths, SSL)
tsm org promote @staging

# Generate prod config (strict security, backups, monitoring)
tsm org promote @prod
```

### 3. Environment Profiles

Each profile applies specific transformations:

| Setting              | local      | @dev               | @staging           | @prod              |
|---------------------|------------|--------------------|--------------------|---------------------|
| User                | mricos     | root               | tetra              | tetra              |
| TETRA_SRC           | ~/src/...  | /root/src/...      | /opt/tetra         | /opt/tetra         |
| TETRA_DIR           | ~/tetra    | /root/tetra        | /var/lib/tetra     | /var/lib/tetra     |
| Init System         | none       | systemd            | systemd            | systemd            |
| Command             | node srv.js| node srv.js --env dev | node srv.js --env staging | node srv.js --env production |
| Auto-restart        | false      | true               | true               | true               |
| Memory              | unlimited  | 1GB                | 2GB                | 4GB                |
| Firewall            | off        | on (open)          | on (restricted)    | on (strict)        |
| SSL                 | off        | off                | on                 | on (HSTS)          |
| Logging Level       | debug      | debug              | info               | warn               |
| Logging Format      | pretty     | json               | json               | json               |
| Monitoring          | off        | on                 | on (alerts)        | on (APM+alerts)    |
| Backup              | off        | optional           | daily              | daily+offsite      |

## Daemon Management

### Development Server (@dev)

```bash
# Install (creates systemd service)
tsm daemon install @dev

# Enable (start at boot)
tsm daemon enable

# Start
tsm daemon start

# Check status
tsm daemon status

# View logs
tsm daemon logs 50 -f

# Restart after config change
tsm daemon restart
```

### Systemd Service Details

The `tetra-dev.service` systemd unit:

```ini
[Service]
User=root
Group=root
WorkingDirectory=/root/tetra
Environment=TETRA_SRC=/root/src/devops/tetra
Environment=TETRA_DIR=/root/tetra
ExecStart=/bin/bash -c 'source /root/tetra/tetra.sh && tsm start tetra'
Restart=on-failure
```

Which runs TSM service definition:

```bash
# /root/tetra/tsm/services-available/tetra.tsm
TSM_NAME="tetra"
TSM_COMMAND="node server/server.js --env dev"
TSM_CWD="/root/src/devops/tetra"
TSM_ENV_FILE="env/dev.env"
TSM_PORT="4444"
```

## Complete Deployment Example

### Local → Dev

```bash
# 1. LOCAL: Configure
export TETRA_ORG=my-company
tsm org init my-company
vim ~/tetra/org/my-company/environments/local.toml

# 2. LOCAL: Generate dev config
tsm org promote @dev
tsm org env show dev

# 3. LOCAL: Deploy files to dev server
scp ~/tetra/org/my-company/environments/dev.toml \
    dev:/root/tetra/org/my-company/environments/

scp $TETRA_SRC/templates/systemd/tetra@dev.service \
    dev:/tmp/tetra-dev.service

scp $TETRA_SRC/templates/services/tetra-dev.tsm \
    dev:/tmp/tetra.tsm

# 4. DEV SERVER: Install
ssh dev
sudo cp /tmp/tetra-dev.service /etc/systemd/system/
sudo mkdir -p /root/tetra/tsm/services-available
sudo cp /tmp/tetra.tsm /root/tetra/tsm/services-available/

# 5. DEV SERVER: Setup daemon
source /root/tetra/tetra.sh
tsm enable tetra
tsm daemon install @dev
tsm daemon enable
tsm daemon start

# 6. DEV SERVER: Verify
systemctl status tetra-dev.service
tsm daemon logs
curl http://localhost:4444/health
```

## Directory Structure

### Development Machine
```
~/src/devops/tetra/              # Source code
~/tetra/                         # Runtime data
├── org/my-company/
│   ├── manifest.toml
│   ├── environments/
│   │   ├── local.toml          # YOU EDIT THIS
│   │   ├── dev.toml            # GENERATED
│   │   ├── staging.toml        # GENERATED
│   │   └── prod.toml           # GENERATED
│   ├── secrets/
│   │   ├── local.env
│   │   ├── dev.env
│   │   ├── staging.env
│   │   └── prod.env
│   └── history/                # Deployment backups
└── tsm/services-available/
    └── tetra.tsm
```

### Dev Server
```
/root/src/devops/tetra/          # Source code
/root/tetra/                     # Runtime data
├── org/my-company/
│   └── environments/
│       └── dev.toml
├── tsm/
│   ├── services-available/
│   │   └── tetra.tsm
│   ├── services-enabled/
│   │   └── tetra.tsm -> ../services-available/tetra.tsm
│   └── runtime/processes/
│       └── tetra-4444/
└── logs/

/etc/systemd/system/
└── tetra-dev.service
```

### Production Server
```
/opt/tetra/                      # Source code (owned by tetra user)
/var/lib/tetra/                  # Runtime data
├── org/my-company/
│   └── environments/
│       └── prod.toml
├── tsm/...
└── logs/

/etc/systemd/system/
└── tetra.service
```

## Secrets Management

**NEVER put secrets in TOML files!**

```bash
# Create environment-specific secrets
# LOCAL
cat > ~/tetra/org/my-company/secrets/local.env <<EOF
NODE_ENV=development
DATABASE_URL=postgres://localhost/dev
API_KEY=local-test-key
EOF

# DEV (deploy separately, never commit)
cat > dev.env <<EOF
NODE_ENV=development
DATABASE_URL=postgres://dev-db.internal/tetra_dev
API_KEY=dev-server-key-12345
EOF

# Copy to dev server (secure channel)
scp dev.env dev:/root/tetra/org/my-company/secrets/dev.env
rm dev.env  # Remove from local
```

## Monitoring & Logs

```bash
# Systemd logs
journalctl -u tetra-dev.service -f

# TSM logs
tsm logs tetra -f

# Daemon logs
tsm daemon logs 100 -f

# Application logs
tail -f /root/tetra/logs/tetra.log
```

## Rollback Procedure

```bash
# View deployment history
tsm org history @dev

# Rollback config
tsm org rollback @dev

# Redeploy to server
scp ~/tetra/org/my-company/environments/dev.toml dev:/root/tetra/...

# Restart daemon
ssh dev 'tsm daemon restart'
```

## CI/CD Integration

```yaml
# .github/workflows/deploy-dev.yml
name: Deploy to Dev
on:
  push:
    branches: [dev]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Generate dev config
        run: |
          source ~/tetra/tetra.sh
          export TETRA_ORG=my-company
          tsm org promote @dev

      - name: Deploy to dev server
        run: |
          scp ~/tetra/org/my-company/environments/dev.toml \
              dev:/root/tetra/org/my-company/environments/
          ssh dev 'tsm daemon restart'

      - name: Verify deployment
        run: |
          ssh dev 'curl -f http://localhost:4444/health'
```

## Troubleshooting

### Daemon won't start
```bash
# Check service status
systemctl status tetra-dev.service

# Check logs
journalctl -u tetra-dev.service -n 50

# Verify paths
ls -la /root/tetra/tetra.sh
ls -la /root/src/devops/tetra/server/server.js

# Test manually
source /root/tetra/tetra.sh
tsm start tetra
```

### Config not found
```bash
# Ensure org is set
export TETRA_ORG=my-company

# Check org structure
ls -la ~/tetra/org/my-company/

# Regenerate if needed
tsm org promote @dev
```

### Port conflicts
```bash
# Check what's using port
lsof -i :4444

# Update port in local.toml
vim ~/tetra/org/my-company/environments/local.toml
# [ports]
# tetra = 5555

# Regenerate and redeploy
tsm org promote @dev
```

## Best Practices

1. **Version control local.toml**: Commit to git as source of truth
2. **Gitignore generated files**: Don't commit dev/staging/prod.toml
3. **Separate secrets**: Never put secrets in TOML files
4. **Test locally first**: local → dev → staging → prod
5. **Use history**: Always keep deployment backups
6. **Monitor logs**: Watch daemon logs after deployment
7. **Gradual rollout**: Test in dev before promoting to prod

## Reference

- **Multi-Environment System**: `bash/org/MULTI_ENV_README.md`
- **Daemon Setup**: `bash/tsm/DAEMON_SETUP.md`
- **TSM Reference**: `bash/tsm/TSM_REFERENCE.md`

---

**Key Concept**: Edit `local.toml` (ONE file), promote to environments (GENERATED), deploy with systemd daemon.
