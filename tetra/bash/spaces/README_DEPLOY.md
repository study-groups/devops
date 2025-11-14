# Tetra Spaces + Nginx Deployment System

Complete system for managing DigitalOcean Spaces and nginx deployments.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    TETRA DEPLOYMENT SYSTEM                  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   spaces/    │    │   nginx/     │    │   tdocs/     │  │
│  │              │    │              │    │              │  │
│  │ • spaces.sh  │───▶│spaces_proxy.sh│───▶│  publish.sh │  │
│  │ • do-spaces │    │              │    │              │  │
│  │ • spaces_repl│    │ nginx config │    │ s3cmd+nginx │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                    │                    │          │
│         └────────────────────┴────────────────────┘          │
│                              │                                │
│                     ┌────────▼────────┐                      │
│                     │   tetra.toml    │                      │
│                     │                 │                      │
│                     │ [environments]  │                      │
│                     │ [publish.xxx]   │                      │
│                     └─────────────────┘                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                     ┌─────────────────┐
                     │ REMOTE SERVER   │
                     │                 │
                     │ /etc/nginx/     │
                     │ sites-enabled/  │
                     └─────────────────┘
```

## Three-Layer System

### 1. Spaces Layer - S3 Operations
**Location:** `$TETRA_SRC/bash/spaces/`

**Files:**
- `spaces.sh` - TES symbol resolution (@spaces:bucket)
- `do-spaces.sh` - AWS CLI wrapper for DO Spaces
- `spaces_repl.sh` - Interactive REPL for Spaces management

**Purpose:** Direct S3/Spaces operations (upload, download, list, etc.)

**Example:**
```bash
source $TETRA_SRC/bash/spaces/spaces_repl.sh
spaces_repl

spaces:devpages> ls published/
spaces:devpages> put myfile.html published/
spaces:devpages> sync ./dist published/docs/
```

### 2. Nginx Layer - Configuration Management
**Location:** `$TETRA_SRC/bash/nginx/`

**Files:**
- `spaces_proxy.sh` - Generate and deploy nginx configs for Spaces proxying
- `nginx.sh` - Generic nginx helpers

**Purpose:** Generate and deploy nginx reverse proxy configs

**Example:**
```bash
source $TETRA_SRC/bash/nginx/spaces_proxy.sh

# Generate config
tetra_nginx_spaces_config devpages devpages.pixeljamarcade.com sfo3

# Deploy to production
tetra_nginx_spaces_deploy --dry-run devpages prod
tetra_nginx_spaces_deploy devpages prod
```

### 3. TDocs Layer - Documentation Publishing
**Location:** `$TETRA_SRC/bash/tdocs/`

**Files:**
- `core/publish.sh` - Full publish pipeline (s3cmd + nginx config generation)
- `tdocs_commands.sh` - REPL commands for tdocs

**Purpose:** Complete documentation publishing workflow

**Example:**
```bash
tdocs publish my-doc.md docs
tdocs publish-targets
```

## Configuration in tetra.toml

### Environment Configuration
All three layers read from `tetra.toml`:

```toml
# SSH connection info (used by nginx deploy)
[environments.prod]
symbol = "@prod"
ssh_host = "137.184.226.163"
ssh_auth_user = "root"
ssh_key = "~/.ssh/id_rsa"

# Spaces/S3 publish targets (used by tdocs + spaces REPL)
[publish.docs]
bucket = "pja-docs"
path = "/"
endpoint = "https://sfo3.digitaloceanspaces.com"
region = "sfo3"
public_url = "https://docs.pixeljamarcade.com"
access_key = "DO00..."
secret_key = "..."

[publish.devpages]
bucket = "devpages"
path = "/published"
endpoint = "https://sfo3.digitaloceanspaces.com"
region = "sfo3"
public_url = "https://devpages.pixeljamarcade.com"
```

### Where Files Are Stored

**Local (NOT in tetra.toml):**
```
~/tetra/orgs/pixeljam-arcade/nginx/
├── devpages.conf      # Generated nginx configs
├── tau.conf
└── pja-docs.conf
```

**Remote (After Deploy):**
```
/etc/nginx/sites-available/devpages.conf
/etc/nginx/sites-enabled/devpages.conf → ../sites-available/devpages.conf
```

## Complete Workflows

### Workflow 1: DevPages Publishing + Nginx

**Scenario:** Set up devpages publishing infrastructure

```bash
# 1. Load tetra
source ~/tetra/tetra.sh
pj  # loads pixeljam-arcade org

# 2. Generate nginx config (local only)
source $TETRA_SRC/bash/nginx/spaces_proxy.sh
tetra_nginx_spaces_config devpages devpages.pixeljamarcade.com sfo3

# 3. Review and deploy
tetra_nginx_spaces_deploy --dry-run devpages prod  # dry run
tetra_nginx_spaces_deploy devpages prod             # deploy

# 4. Publish content from devpages app
# (DevPages app uses DO_SPACES_* env vars or publish.devpages config)
```

### Workflow 2: Direct File Upload via REPL

**Scenario:** Upload files interactively

```bash
# Start Spaces REPL
source $TETRA_SRC/bash/spaces/spaces_repl.sh
spaces_repl

# Interactive session:
spaces> use devpages
spaces:devpages> ls published/
spaces:devpages> put index.html published/
spaces:devpages> sync ./dist published/docs/
```

### Workflow 3: TDocs Full Publishing

**Scenario:** Publish documentation with nginx setup

```bash
# 1. Add publish target to tetra.toml
[publish.tau]
bucket = "tau"
endpoint = "https://sfo3.digitaloceanspaces.com"
region = "sfo3"
public_url = "https://tau.pixeljamarcade.com"

# 2. Publish document
tdocs publish tau-guide.md tau

# 3. Generate nginx config
tdocs generate-nginx tau > ~/tetra/orgs/pixeljam-arcade/nginx/tau.conf

# 4. Deploy nginx config
tetra_nginx_spaces_deploy tau prod
```

### Workflow 4: Multi-Site Deployment

**Scenario:** Set up multiple doc sites

```bash
source $TETRA_SRC/bash/nginx/spaces_proxy.sh

# DevPages
tetra_nginx_spaces_config devpages devpages.pixeljamarcade.com sfo3
tetra_nginx_spaces_deploy devpages prod

# Tau Documentation
tetra_nginx_spaces_config tau tau.pixeljamarcade.com sfo3
tetra_nginx_spaces_deploy tau prod

# PJA Docs
tetra_nginx_spaces_config pja-docs docs.pixeljamarcade.com sfo3
tetra_nginx_spaces_deploy pja-docs prod

# List all configs
tetra_nginx_spaces_list
```

## Integration Points

### 1. Spaces REPL ↔ Nginx

From Spaces REPL, generate nginx config:

```bash
spaces:devpages> nginx devpages.pixeljamarcade.com
# Outputs nginx config to stdout
```

### 2. TDocs ↔ Nginx

TDocs generates nginx configs from publish targets:

```bash
tdocs generate-nginx docs
# Reads [publish.docs] from tetra.toml
# Outputs nginx config
```

### 3. DevPages ↔ Spaces

DevPages app reads config from:
- Environment variables: `DO_SPACES_*`
- Or tetra.toml: `[publish.devpages]`

## Command Reference

### Spaces REPL Commands
```bash
spaces_repl                 # Start interactive REPL
buckets                     # List buckets
use <bucket>                # Set current bucket
ls [path]                   # List files
put <file> [remote]         # Upload file
get <remote> [local]        # Download file
sync <dir> [remote]         # Sync directory
nginx <domain>              # Generate nginx config
status                      # Show session info
```

### Nginx Deployment Commands
```bash
tetra_nginx_spaces_config <bucket> <domain> [region] [name]
tetra_nginx_spaces_deploy [--dry-run] <name> <env>
tetra_nginx_spaces_list
tetra_nginx_spaces_wizard   # Interactive setup
```

### TDocs Commands
```bash
tdocs publish <source> <target>
tdocs publish-targets
tdocs generate-nginx <target>
```

## Environment Variables

### Required for Spaces Operations
```bash
export DO_SPACES_KEY="DO00..."
export DO_SPACES_SECRET="..."
export DO_SPACES_BUCKET="devpages"
export DO_SPACES_REGION="sfo3"
export DO_SPACES_ENDPOINT="https://sfo3.digitaloceanspaces.com"
```

### Required for Tetra
```bash
export TETRA_ROOT="$HOME/tetra"
export TETRA_SRC="$HOME/src/devops/tetra/bash"
export TETRA_ORG="pixeljam-arcade"
```

## Quick Start - Complete Setup

```bash
# 1. Load environment
source ~/tetra/tetra.sh
pj

# 2. Load all modules
source $TETRA_SRC/bash/spaces/spaces_repl.sh
source $TETRA_SRC/bash/nginx/spaces_proxy.sh

# 3. Generate and deploy nginx config
tetra_nginx_spaces_config devpages devpages.pixeljamarcade.com sfo3
tetra_nginx_spaces_deploy --dry-run devpages prod
tetra_nginx_spaces_deploy devpages prod

# 4. Test with Spaces REPL
spaces_repl
# Then: use devpages, ls, etc.
```

## Troubleshooting

### "Credentials not found"
```bash
# Check environment
spaces_status

# Or set explicitly
export DO_SPACES_KEY="..."
export DO_SPACES_SECRET="..."
```

### "nginx -t failed"
```bash
# Check nginx config syntax
ssh root@$prod "nginx -t"

# View error log
ssh root@$prod "tail -50 /var/log/nginx/error.log"
```

### "Connection refused"
```bash
# Check tetra.toml environment config
cat ~/tetra/orgs/pixeljam-arcade/tetra.toml | grep -A5 "\[environments.prod\]"

# Test SSH
ssh -i ~/.ssh/id_rsa root@$prod "hostname"
```
