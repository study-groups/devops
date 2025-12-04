# Organization (org) Worksheet

Complete guide from tetra installation to managing organizations.

## Phase 1: Prerequisites

- [ ] **01** Tetra Installation
  ```bash
  # Clone tetra
  git clone <tetra-repo> ~/tetra

  # Add to shell profile (~/.bashrc or ~/.zshrc)
  source ~/tetra/tetra.sh

  # Verify
  tetra status
  ```

- [ ] **02** Set TETRA_DIR
  ```bash
  # Default location (if not set)
  export TETRA_DIR="$HOME/.tetra"

  # Create directory structure
  mkdir -p "$TETRA_DIR"/{config,orgs}

  # Verify
  ls -la "$TETRA_DIR"
  ```

- [ ] **03** Infrastructure Data (if using nh)
  ```bash
  # Ensure you have run nh setup (see nh/checklist.md)
  # You should have:
  ls $NH_DIR/myorg/digocean.json
  ```

## Phase 2: Organization Setup

- [ ] **04** Create Organization
  ```bash
  # Initialize with source files
  org init myorg

  # This creates:
  #   $TETRA_DIR/orgs/myorg/
  #   $TETRA_DIR/orgs/myorg/00-org.toml
  #   $TETRA_DIR/orgs/myorg/10-infrastructure.toml
  #   $TETRA_DIR/orgs/myorg/20-storage.toml
  #   ...

  # Verify
  ls "$TETRA_DIR/orgs/myorg/"
  ```

- [ ] **05** Import Infrastructure (from nh)
  ```bash
  # Preview what will be imported
  org import list myorg

  # Import droplets to 10-infrastructure.toml
  org import nh myorg

  # This auto-runs: org build myorg

  # Verify
  org view environments
  ```

- [ ] **06** Switch to Organization
  ```bash
  # Activate organization
  org switch myorg

  # This:
  #   1. Creates symlink: config/tetra.toml -> orgs/myorg/tetra.toml
  #   2. Exports environment variables: $dev, $staging, $prod

  # Verify
  org status
  ```

## Phase 3: Source Files

- [ ] **07** Understand Source Files
  ```bash
  # List source files
  org sections myorg

  # Source files live in:
  #   $TETRA_DIR/orgs/myorg/
  #   00-org.toml            # Identity
  #   10-infrastructure.toml # Servers (from nh import)
  #   20-storage.toml        # S3/Spaces
  #   30-resources.toml      # App resources
  #   40-services.toml       # Ports/services
  #   tetra.toml             # Compiled output (don't edit)

  # Edit a source file
  $EDITOR "$TETRA_DIR/orgs/myorg/20-storage.toml"
  ```

- [ ] **08** Build Combined Config
  ```bash
  # Assemble NN-*.toml into tetra.toml
  org build myorg

  # This:
  #   1. Validates each source file
  #   2. Checks for duplicates
  #   3. Concatenates into tetra.toml

  # Verify
  org view
  ```

- [ ] **09** Check Dirty Status
  ```bash
  # Status shows if rebuild is needed
  org status

  # Output shows (dirty) if source files changed:
  #   Active: myorg
  #   Config: /path/tetra.toml (dirty)
  #   ...
  #   Run 'org build' to rebuild
  ```

## Phase 4: Working with Environments

- [ ] **10** View Environments
  ```bash
  # List all environments with connection info
  org env

  # Output:
  #   dev        root@1.2.3.4
  #   staging    root@1.2.3.5
  #   prod       root@1.2.3.6

  # Show details for specific environment
  org env dev
  ```

- [ ] **11** Use Environment Variables
  ```bash
  # After 'org switch', IPs are exported as shell variables
  echo $dev       # 1.2.3.4
  echo $staging   # 1.2.3.5
  echo $prod      # 1.2.3.6

  # SSH using variables
  ssh root@$dev
  ssh root@$staging
  ssh root@$prod
  ```

- [ ] **12** Setup SSH Keys (tkm integration)
  ```bash
  # Initialize key manager for this org
  tkm init

  # Generate keys for all environments
  tkm gen all

  # Deploy public keys to servers
  tkm deploy all

  # Test connectivity
  tkm test
  ```

## Phase 5: TOML Operations

- [ ] **13** View Configuration
  ```bash
  # View entire tetra.toml
  org view

  # Filter by section prefix
  org view environments     # All [environments.*]
  org view connectors       # [connectors]
  org view storage          # [storage.*]

  # Show specific section
  org section environments.dev
  ```

- [ ] **14** Get/Set Values
  ```bash
  # Get a value by path
  org get environments.dev.host
  org get org.name

  # Set a value (existing keys only)
  org set environments.dev.host 10.0.0.5
  ```

- [ ] **15** Edit Source Files
  ```bash
  # Edit a source file directly
  $EDITOR "$TETRA_DIR/orgs/myorg/10-infrastructure.toml"

  # Rebuild after editing
  org build
  ```

## Phase 6: Multi-Organization Management

- [ ] **16** Create Aliases
  ```bash
  # Create short alias for long org name
  org alias pj pixeljam-arcade

  # Now you can:
  org switch pj    # instead of pixeljam-arcade

  # List aliases
  org alias

  # Remove alias
  org unalias pj
  ```

- [ ] **17** Manage Multiple Orgs
  ```bash
  # List all organizations
  org list

  # Output shows active org with *
  #   * myorg
  #     pixeljam-arcade
  #     pj -> pixeljam-arcade

  # Switch between orgs
  org switch pixeljam-arcade
  org status
  ```

---

## Quick Reference

### Data Flow
```
$NH_DIR/<org>/digocean.json     (from nh fetch)
       |
       v  (org import nh)
10-infrastructure.toml           (environments + connectors)
       |
       + 00-org.toml             (org identity)
       + 20-storage.toml         (S3/Spaces - manual)
       + 30-resources.toml       (apps - manual)
       |
       v  (org build)
tetra.toml                       (assembled config)
       |
       v  (org switch)
$dev, $staging, $prod            (shell variables)
       |
       v  (tkm deploy)
SSH access to infrastructure
```

### Common Commands
```bash
org status          # Current org + connectors + dirty flag
org list            # List all orgs
org switch <name>   # Activate org, export vars
org init <name>     # Create org with source templates

org build [name]    # Assemble NN-*.toml into tetra.toml
org sections [name] # List source files

org view [filter]   # View tetra.toml
org edit            # Open tetra.toml in $EDITOR
org section <name>  # Show specific section
org validate        # Check TOML syntax

org env             # List environments with IPs
org env <name>      # Show environment details

org get <path>      # Get value (environments.dev.host)
org set <path> <v>  # Set value

org alias           # List aliases
org alias s c       # Create alias s -> c
org unalias <name>  # Remove alias

org import nh <org>       # Import $NH_DIR/<org>/digocean.json
org import list <org>     # Preview import

org help            # Full command list
```

### Files
```
$TETRA_DIR/
├── config/
│   └── tetra.toml -> ../orgs/<active>/tetra.toml  (symlink)
└── orgs/
    ├── <org>/
    │   ├── 00-org.toml            # Source: [org]
    │   ├── 10-infrastructure.toml # Source: [environments.*], [connectors]
    │   ├── 20-storage.toml        # Source: [storage.*]
    │   ├── 30-resources.toml      # Source: [resources.*]
    │   ├── 40-services.toml       # Source: [services]
    │   └── tetra.toml             # Compiled output
    └── <alias> -> <canonical>/    # Alias symlinks
```

### tetra.toml Structure
```toml
# 00-org.toml
[org]
name = "myorg"

# 10-infrastructure.toml (from nh import)
[environments.local]
description = "Local development"

[environments.dev]
description = "Dev server"
host = "1.2.3.4"
user = "root"
ssh_work_user = "dev"

[environments.staging]
host = "1.2.3.5"
user = "root"
ssh_work_user = "staging"

[environments.prod]
host = "1.2.3.6"
user = "root"
ssh_work_user = "prod"

[connectors]
"@dev" = { auth_user = "root", work_user = "dev", host = "1.2.3.4" }
"@staging" = { auth_user = "root", work_user = "staging", host = "1.2.3.5" }
"@prod" = { auth_user = "root", work_user = "prod", host = "1.2.3.6" }

# 20-storage.toml
[storage.spaces]
endpoint = "sfo3.digitaloceanspaces.com"
bucket = "myorg"
region = "sfo3"

# 30-resources.toml
[resources.games]
manifest_path = "/var/www/arcade/games.json"
assets_path = "/var/www/arcade/games/"

# 40-services.toml
[services]
app = 3000
api = 8000
```

### Refresh Workflow
```bash
# When infrastructure changes at DigitalOcean:
nh fetch                    # Pull fresh data (nh module)
org import nh myorg         # Re-import (auto-builds)
org switch myorg            # Reload variables
org env                     # Verify changes
```

### Troubleshooting
```bash
# "No active org"
org switch myorg            # Must switch first

# "No source files"
org init myorg              # Initialize source templates

# Build validation fails
org sections myorg          # List what's there
$EDITOR $TETRA_DIR/orgs/myorg/*.toml  # Fix errors

# Environments not detected from import
org import list myorg       # Check detection
# Tag droplets at DigitalOcean: dev, staging, prod
nh fetch && org import nh myorg  # Re-import after tagging

# Variables not exported
org switch myorg            # Re-switch to export
echo $dev $staging $prod    # Check variables

# Config shows (dirty)
org build                   # Rebuild tetra.toml
```
