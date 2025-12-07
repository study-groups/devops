# NodeHolder and Tetra: Architecture and Data Flow

This is Part 3 of a series on managing SSH keys across DigitalOcean infrastructure.

Parts 1 and 2 covered the bootstrap problem and recovery scenarios. This post explains how NodeHolder (nh) and Tetra fit together, and why they're separate tools.

## The Pipeline

```
doctl (DO API)
    ↓
nh fetch
    ↓
digocean.json
    ↓
org import nh
    ↓
tetra.toml
    ↓
tkm (key management)
    ↓
~/.ssh/<org>/ + ~/.ssh/config
```

## Why Two Tools?

### NodeHolder (nh)

**Purpose**: Infrastructure discovery. Talk to DigitalOcean, cache the results.

**Responsibilities**:
- Manage doctl authentication contexts
- Fetch infrastructure data from DO API
- Store as `digocean.json` (the "bridge contract")
- Load server IPs as shell variables (`$dev`, `$staging`, `$prod`)
- Create short aliases (`$paq` for `pxjam_arcade_qa01`)
- Find bootstrap keys for initial access

**Does NOT**:
- Store doctl credentials (uses doctl's own config)
- Manage SSH keys
- Know about deployment environments
- Handle secrets

### Tetra (org, tkm)

**Purpose**: Environment semantics and key lifecycle.

**Responsibilities**:
- Map environment names to hosts (`@dev` → `137.184.226.163`)
- Define users per environment (`ssh_work_user = "dev"`)
- Generate SSH keys per org/environment
- Deploy keys to servers
- Rotate, revoke, audit keys
- Manage `~/.ssh/config` entries

**Does NOT**:
- Talk to DigitalOcean API
- Store doctl credentials
- Know how infrastructure was provisioned

## The Bridge: digocean.json

The single point of integration is `digocean.json`. NodeHolder produces it, Tetra consumes it.

```json
[
  {
    "Droplets": [
      {
        "name": "pxjam-arcade-dev01",
        "networks": {
          "v4": [
            {"type": "public", "ip_address": "137.184.226.163"},
            {"type": "private", "ip_address": "10.124.0.4"}
          ]
        },
        "tags": ["dev", "arcade"]
      }
    ]
  },
  {
    "SSHKeys": [
      {
        "id": 12345,
        "name": "mricos-macbook",
        "fingerprint": "ab:cd:ef:..."
      }
    ]
  },
  {
    "Domains": [
      {"name": "pixeljamarcade.com"}
    ]
  }
]
```

This separation means:
- Tetra works without NodeHolder (manually create `tetra.toml`)
- NodeHolder works without Tetra (just use `$dev` variables directly)
- Neither needs doctl credentials at runtime (only during `nh fetch`)

## File Locations

### NodeHolder

```
~/nh/                              # NH_DIR - data directory
├── pixeljam-arcade/               # Context (matches doctl context)
│   ├── digocean.json              # Cached infrastructure
│   ├── digocean.json.bak          # Backup before last fetch
│   └── aliases.env                # Short variable aliases
├── pj -> pixeljam-arcade/         # Symlink alias
└── other-project/
    └── digocean.json

~/src/devops/nh/bash/              # NH_SRC - source code
├── nh.sh                          # Main entry point
├── nh_doctl.sh                    # DO API operations
├── nh_env.sh                      # Environment variables
├── nh_keys.sh                     # Bootstrap key helpers
└── nh_complete.sh                 # Tab completion
```

### Tetra

```
~/tetra/                           # TETRA_DIR - data directory
├── config/
│   └── tetra.toml -> ../orgs/pixeljam-arcade/tetra.toml  # Active org
└── orgs/
    ├── pixeljam-arcade/
    │   ├── tetra.toml             # Main config (assembled)
    │   └── sections/              # Modular config pieces
    │       ├── 00-org.toml
    │       └── 10-infrastructure.toml
    └── pj -> pixeljam-arcade/     # Alias

~/.ssh/                            # SSH keys and config
├── pixeljam-arcade/               # TKM keys for this org
│   ├── dev_root                   # Private key
│   ├── dev_root.pub               # Public key
│   ├── dev_dev
│   ├── dev_dev.pub
│   ├── staging_root
│   └── ...
└── config                         # SSH config with Match blocks
```

## tetra.toml Structure

Generated from `digocean.json` via `org import nh`:

```toml
# pixeljam-arcade organization
# Generated from digocean.json on 2025-11-25T11:01:23-08:00

[org]
name = "pixeljam-arcade"

[environments.local]
description = "Local development"

[environments.dev]
description = "Dev server (pxjam-arcade-dev01)"
host = "137.184.226.163"
user = "root"
ssh_work_user = "dev"
private_ip = "10.124.0.4"
domain = "dev.pixeljamarcade.com"

[environments.staging]
description = "Staging server (pxjam-arcade-qa01)"
host = "146.190.151.245"
user = "root"
ssh_work_user = "staging"
private_ip = "10.124.0.2"
domain = "staging.pixeljamarcade.com"

[environments.prod]
description = "Prod server (pxjam-arcade-prod01)"
host = "64.23.151.249"
user = "root"
ssh_work_user = "prod"
private_ip = "10.124.0.3"
domain = "pixeljamarcade.com"

[connectors]
"@dev" = { auth_user = "root", work_user = "dev", host = "137.184.226.163" }
"@staging" = { auth_user = "root", work_user = "staging", host = "146.190.151.245" }
"@prod" = { auth_user = "root", work_user = "prod", host = "64.23.151.249" }
```

## SSH Config Generation

TKM generates `~/.ssh/config` entries using `Match Host` blocks:

```
# tkm: pixeljam-arcade dev
Match Host 137.184.226.163 User root
    IdentityFile ~/.ssh/pixeljam-arcade/dev_root

Match Host 137.184.226.163 User dev
    IdentityFile ~/.ssh/pixeljam-arcade/dev_dev

# tkm: pixeljam-arcade staging
Match Host 146.190.151.245 User root
    IdentityFile ~/.ssh/pixeljam-arcade/staging_root

Match Host 146.190.151.245 User staging
    IdentityFile ~/.ssh/pixeljam-arcade/staging_dev
```

This means SSH automatically selects the right key based on hostname and user:

```bash
ssh root@137.184.226.163    # Uses dev_root
ssh dev@137.184.226.163     # Uses dev_dev
```

Combined with `org switch` exporting `$dev=137.184.226.163`:

```bash
ssh root@$dev               # Uses dev_root
ssh dev@$dev                # Uses dev_dev
```

## Environment Detection

When importing from `digocean.json`, environment is detected from droplet name/tags:

| Pattern in name/tags | Environment |
|---------------------|-------------|
| `prod`, `production` | prod |
| `staging`, `stag`, `qa` | staging |
| `dev`, `development` | dev |

Droplets that don't match are listed as "unassigned" for manual configuration.

## Typical Workflows

### Initial Setup

```bash
# 1. Configure doctl
doctl auth init --context pixeljam-arcade

# 2. Fetch infrastructure
nh create pixeljam-arcade
nh switch pixeljam-arcade
nh fetch

# 3. Import to Tetra
org import nh ~/nh/pixeljam-arcade/digocean.json pixeljam-arcade
org switch pixeljam-arcade

# 4. Setup SSH keys
tkm init
tkm gen all
tkm deploy all --key $(nh keys bootstrap)
tkm test
```

### Daily Use

```bash
# Shell startup (in .bashrc or .zshrc)
source ~/tetra/tetra.sh
nh switch pj              # Sets $dev, $staging, $prod
org switch pj             # Loads org context

# Work
ssh dev@$dev              # Deploy code
ssh root@$staging         # System admin
```

### Infrastructure Changed

```bash
# New droplet added, or IPs changed
nh fetch
org import nh ~/nh/pixeljam-arcade/digocean.json pixeljam-arcade
tkm gen <new-env>
tkm deploy <new-env>
```

## Security Boundaries

| Tool | Has Access To | Does NOT Have |
|------|--------------|---------------|
| doctl | DO API token | SSH keys |
| nh | doctl (via subprocess) | SSH keys, secrets |
| org | tetra.toml | DO API, SSH private keys |
| tkm | SSH keys, tetra.toml | DO API, secrets |

The separation ensures:
- Compromised tkm keys don't give DO API access
- Compromised DO token doesn't give SSH access (keys are local)
- Each tool has minimum necessary permissions
