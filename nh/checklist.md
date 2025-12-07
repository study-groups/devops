# NodeHolder (nh) Worksheet

Complete guide from DigitalOcean account to tetra deployment.

## Phase 1: DigitalOcean Account Setup

- [ ] **01** Create DigitalOcean Account
  ```
  https://cloud.digitalocean.com/registrations/new
  ```
  - Sign up with email or GitHub/Google
  - Add payment method (required for API access)
  - Note your team/organization name

- [ ] **02** Generate API Token
  ```
  https://cloud.digitalocean.com/account/api/tokens
  ```
  - Click "Generate New Token"
  - Name it (e.g., "nh-cli")
  - Select "Full Access" (read + write)
  - Copy token immediately (shown only once)
  - Store securely (password manager recommended)

- [ ] **03** Install doctl
  ```bash
  # macOS
  brew install doctl

  # Linux
  snap install doctl

  # Verify
  doctl version
  ```

## Phase 2: Local Environment Setup

- [ ] **04** Initialize doctl Authentication
  ```bash
  # Create a named context (use your org/project name)
  doctl auth init --context myorg

  # Paste your API token when prompted
  # Token is stored in ~/.config/doctl/config.yaml
  ```

- [ ] **05** Verify doctl Access
  ```bash
  doctl auth switch --context myorg
  doctl account get
  doctl compute droplet list
  ```

- [ ] **06** Install NodeHolder (nh)
  ```bash
  # Clone or ensure nh is available
  cd ~/src/devops
  git clone <nh-repo> nh

  # Add to shell profile (~/.bashrc or ~/.zshrc)
  export DIGITALOCEAN_CONTEXT="myorg"
  source ~/src/devops/nh/init.sh
  ```

## Phase 3: NodeHolder Configuration

- [ ] **07** Create Context Directory
  ```bash
  # nh creates context dirs in ~/nh/
  nh create myorg

  # Or manually
  mkdir -p ~/nh/myorg
  ```

- [ ] **08** Switch to Context
  ```bash
  nh switch myorg

  # Verify
  nh status
  ```

- [ ] **09** Fetch Infrastructure
  ```bash
  # Pull all infrastructure data from DigitalOcean
  nh fetch

  # This creates:
  #   ~/nh/myorg/digocean.json    - Full infrastructure snapshot

  # Then load variables into shell:
  nh load
  ```

## Phase 4: Working with Infrastructure

- [ ] **10** View Resources
  ```bash
  # List all servers with IPs
  nh servers

  # Summary of all resource types
  nh doctl resources

  # Check data freshness
  nh doctl age
  ```

- [ ] **11** Environment Variables
  ```bash
  # Show all exported variables
  nh env

  # Variables are loaded via 'nh load' or auto-loaded on 'nh switch':
  #   $servername           - Public IP
  #   $servername_private   - Private IP
  #   $servername_floating  - Floating IP (if assigned)

  # Create short aliases (first letter of each part)
  nh alias make myorg
  # myorg_prod_web -> $mpw

  # Preview without loading
  nh alias show myorg

  # View current aliases
  nh alias
  ```

- [ ] **12** SSH Access
  ```bash
  # Check ssh-agent
  nh ssh status

  # Add key if needed
  nh ssh add ~/.ssh/id_ed25519

  # Connect to server
  nh ssh myorg_prod_web

  # Or use variable directly
  ssh root@$myorg_prod_web
  ```

## Phase 5: Tetra Integration

- [ ] **13** Import to Tetra Org
  ```bash
  # From tetra environment
  source ~/tetra/tetra.sh

  # Import infrastructure
  org import nh ~/nh/myorg/digocean.json myorg

  # This creates:
  #   ~/.tetra/orgs/myorg/sections/10-infrastructure.toml
  ```

- [ ] **14** Build Tetra Config
  ```bash
  # Assemble all sections into tetra.toml
  org build myorg

  # Switch to org
  org switch myorg

  # Verify
  org toml
  ```

- [ ] **15** Deploy Keys
  ```bash
  # Initialize key manager
  tkm init

  # Generate and deploy SSH keys
  tkm gen all
  tkm deploy all
  ```

---

## Quick Reference

### Data Flow
```
DigitalOcean API
       |
       v  (nh fetch)
digocean.json  ~/nh/<context>/digocean.json
       |
       v  (nh load)
Shell Variables  $server, $server_private
       |
       v  (nh alias make)
Short Aliases   $paq, $pad, $pap
       |
       v  (org import nh)
10-infrastructure.toml  ~/.tetra/orgs/<org>/sections/
       |
       v  (org build)
tetra.toml  ~/.tetra/orgs/<org>/tetra.toml
       |
       v  (tkm deploy)
Deployed Infrastructure
```

### Common Commands
```bash
nh status           # Current context and stats
nh servers          # List servers with IPs
nh fetch            # Refresh from DigitalOcean
nh load             # Load server IP variables
nh alias make pfx   # Create short aliases
nh ssh <server>     # SSH to server
nh doctl info       # Explain data pipeline
nh help             # Full command list
nh help alias       # Alias subcommands
```

### Files
```
~/nh/
└── <context>/
    ├── digocean.json       # Full infrastructure data (nh fetch)
    ├── digocean.env        # Full variable exports (nh load)
    ├── aliases.env         # Short aliases (nh alias make)
    ├── checklist.env       # Checklist progress
    └── digocean_clean.json # Cleaned (after nh doctl clean)

~/.config/doctl/
└── config.yaml             # doctl auth tokens

~/.tetra/orgs/<org>/
├── tetra.toml              # Generated config
└── sections/
    ├── 00-org.toml         # Organization identity
    ├── 10-infrastructure.toml  # From nh import
    ├── 20-storage.toml     # Manual: S3/Spaces
    └── 30-resources.toml   # Manual: Apps/services
```

### Refresh Workflow
```bash
# When infrastructure changes at DigitalOcean:
nh fetch                    # Pull fresh data
nh load                     # Reload variables
nh alias make myorg         # Recreate short aliases
nh servers                  # Verify changes
org import nh ~/nh/myorg/digocean.json myorg  # Re-import
org build myorg             # Rebuild tetra.toml
```
