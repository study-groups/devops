# Tetra Conventions

**Version**: 1.0
**Status**: Active
**Date**: 2025-12-06

This document defines the command patterns, configuration formats, and conventions used throughout the Tetra ecosystem.

## Command Pattern

All tetra modules follow a consistent command structure:

```
module action [options] <target> [env]
```

### Examples

```bash
deploy push arcade dev           # Deploy arcade to dev environment
deploy push --dry-run arcade prod # Preview production deployment
deploy preflight arcade staging  # Run pre-deploy checks
org switch pxjam                 # Switch to pxjam organization
tkm deploy all                   # Deploy SSH keys to all environments
```

## Standard Flags

These flags are supported across all deploy commands:

| Flag | Short | Description |
|------|-------|-------------|
| `--dry-run` | `-n` | Preview without executing |
| `--force` | `-f` | Skip confirmations |
| `--verbose` | `-v` | Show detailed output |
| `--skip-preflight` | | Bypass pre-deploy checks |

## Environments

Environments are defined per-organization in `tetra.toml`. Common environments:

- `local` - Local development machine
- `dev` - Development server
- `staging` - Staging/QA server
- `prod` - Production server

Environment configuration comes from DigitalOcean via the NH module:

```bash
nh fetch                        # Fetch infrastructure from DO
org import nh digocean.json     # Import to tetra.toml
```

## Configuration Files

### Organization Config (`tetra.toml`)

Located at `$TETRA_DIR/orgs/<org>/tetra.toml`. Defines environments and connectivity.

```toml
[env.dev]
host = "137.184.226.163"
auth_user = "root"           # SSH login user (has keys)
work_user = "dev"            # App user (owns /var/www)
domain = "dev.example.com"

[env.prod]
host = "64.23.151.249"
auth_user = "root"
work_user = "prod"
domain = "example.com"
```

**SSH User Model:**
- `auth_user` - Who you SSH as (typically `root`). Has the SSH keys.
- `work_user` - Who runs the app (e.g., `dev`, `prod`). Owns `/var/www`.

### Target Config (`targets/<name>.toml`)

Located at `$TETRA_DIR/orgs/<org>/targets/<name>.toml`. Defines WHERE to deploy.

```toml
[target]
repo = "git@github.com:org/arcade.git"
www = "/var/www/arcade"
local = "~/src/arcade"

[envs.dev]
branch = "develop"
domain = "arcade.dev.example.com"

[envs.prod]
branch = "release"
domain = "arcade.example.com"
```

### Deployment Config (`tetra-deploy.toml`)

Located in the repository root. Defines WHAT the deployment is and HOW to run it.

```toml
[deploy]
name = "arcade"
type = "node"              # node | static | python

[env]
required = ["DATABASE_URL", "SESSION_SECRET", "PORT"]
optional = ["DEBUG", "LOG_LEVEL"]

[service]
command = "node server.js"
port = 3000
health = "/health"

[hooks]
pre = ["npm install", "npm run build"]
post = ["pm2 restart arcade"]
```

### Environment Files (`env/<env>.env`)

Located in the repository at `env/<environment>.env`. Standard shell variable format.

```bash
# env/prod.env
export DATABASE_URL=postgres://...
export SESSION_SECRET=supersecret
export PORT=3000
```

## Deployment Workflow

### 1. Setup

```bash
org switch pxjam                    # Activate organization
deploy target add arcade            # Create target config
# Edit repo's tetra-deploy.toml     # Define deployment requirements
# Create env/dev.env                # Create environment file
```

### 2. Pre-flight

```bash
deploy preflight arcade dev         # Verify everything is ready
deploy env status arcade            # Check env file status
deploy env validate arcade dev      # Validate against requirements
```

### 3. Deploy

```bash
deploy push --dry-run arcade dev    # Preview
deploy push arcade dev              # Deploy to dev
deploy push arcade prod             # Deploy to production
```

## Hooks

Hooks are defined in the repo's `tetra-deploy.toml` and execute during deployment:

| Hook | When | Failure Behavior |
|------|------|------------------|
| `pre` | Before git pull | Stops deployment |
| `post` | After git pull | Warning only |

```toml
[hooks]
pre = ["npm install", "npm run build"]
post = ["pm2 restart arcade", "notify-slack.sh"]
```

## Records (TRS)

All deployment events are recorded using the Tetra Record Specification.

**Location**: `$TETRA_DIR/orgs/<org>/db/`

**Format**: `<timestamp>.<type>.<target>.<env>.<ext>`

**Example**:
```
1760230000.deploy.arcade.dev.json
```

**Record contents**:
```json
{
  "target": "arcade",
  "env": "dev",
  "timestamp": 1760230000,
  "git_sha": "abc123f",
  "git_branch": "develop",
  "result": "success",
  "duration_ms": 45000
}
```

**Query history**:
```bash
ls $TETRA_DIR/orgs/pxjam/db/*.deploy.arcade.*.json
```

## Module Pattern

Tetra modules follow a consistent structure:

```
bash/<module>/
├── includes.sh          # Module loader, exports
├── <module>.sh          # Main dispatcher
├── <module>_*.sh        # Subcommand implementations
└── <module>_complete.sh # Tab completion
```

### Naming Conventions

- **Functions**: `module_action()` or `module_submodule_action()`
- **Private functions**: `_module_helper()`
- **Variables**: `MODULE_SETTING` (uppercase with module prefix)
- **Files**: `module_submodule.sh` (lowercase with underscores)

### Standard Exports

```bash
# At end of includes.sh
export -f module_main module_action ...
export MODULE_VAR1 MODULE_VAR2
```

## Directory Structure

```
$TETRA_DIR/                        # ~/.tetra by default
├── orgs/
│   └── <org>/
│       ├── tetra.toml             # Org config (environments)
│       ├── targets/               # Deployment targets
│       │   └── <name>.toml
│       └── db/                    # TRS records
│           └── *.json
└── <module>/
    └── db/                        # Module-specific records
```

## See Also

- **TRS_SPECIFICATION.md** - Tetra Record Specification
- **MODULE_SYSTEM_SPECIFICATION.md** - Module development guide

---

**Maintained by**: Tetra Core Team
