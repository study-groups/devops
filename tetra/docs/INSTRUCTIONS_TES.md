# Instructions: Create docs/TES.md

**Copy this entire file into a new Claude Code chat to create the second core document.**

---

## Context

You are creating `docs/TES.md` - the foundational document for Tetra Endpoint Specification. This is THE NOUNS document - it defines WHERE things are in your infrastructure.

## Key Insight: TES is Foundational, Not an Extension

TES is not an add-on or extension. It's the foundation of Tetra's "configuration at a distance" philosophy:
- **One file** (`tetra.toml`) defines all infrastructure
- **Semantic symbols** (`@dev`, `@staging`, `@prod`) provide durable conceptual endpoints
- **Progressive resolution** transforms symbols into executable SSH commands
- **Module actions** operate on these endpoints

## Background

**TES = Tetra Endpoint Specification**
- The system for defining infrastructure endpoints
- Declarative configuration (not imperative scripts)
- Progressive resolution through 7 levels
- Enables "write once, deploy anywhere"

**File Location**: `$TETRA_DIR/orgs/{org-name}/tetra.toml`
- This is THE tetra.toml file for an organization
- Generated from NH (NodeHolder) via discovery/mapping process
- Single source of truth for all infrastructure

**Integration with Module Actions**:
```bash
org push:config @dev        # TES resolves @dev, module pushes config
tsm start:service @staging  # TES resolves @staging, TSM starts service
```

## Key Files to Reference

**Example tetra.toml**:
- `$TETRA_DIR/orgs/pixeljam-arcade/tetra.toml` - Real production example

**TES Documentation**:
- `docs/TES_SSH_Extension.md` - Current TES SSH spec (version 2.1)
- `docs/TES_Storage_Extension.md` - Storage extension
- `docs/TES_Agent_Extension.md` - Agent extension

**Compilation Pipeline**:
- `bash/org/compiler.sh` - tetra.toml compiler
- `bash/org/nh_to_toml.sh` - NH to TOML converter
- `bash/org/discovery.sh` - Infrastructure discovery

## Document Requirements

**File**: `docs/TES.md`

**Audience**: All Tetra users (this is foundational)

**Length**: ~600-800 lines (comprehensive spec)

**Sections**:

### 1. Header & Overview (30-50 lines)
```markdown
# TES - Tetra Endpoint Specification

**Version**: 3.0
**Status**: Foundational Specification

## Overview

TES is Tetra's system for "configuration at a distance" - define infrastructure once, use everywhere.

**Core Concept**: One file (`tetra.toml`) defines all infrastructure endpoints. Modules operate on these endpoints via semantic symbols.
```

Explain:
- Why TES exists (durable conceptual endpoints)
- The problem it solves (infrastructure scattered across scripts)
- The solution (declarative configuration)

### 2. The Big Picture (60-80 lines)

**TES = The NOUNS** (Where things are)
- `@local` = your laptop
- `@dev` = development server
- `@staging` = staging server
- `@prod` = production server

**Module Actions = The VERBS** (What to do)
- `push:config` = deploy configuration
- `deploy:service` = deploy application
- `check:health` = verify service health

**Integration**:
```bash
module.action @endpoint

# Examples:
org push:config @dev          # Push config TO dev
org pull:config @staging      # Pull config FROM staging
tsm restart:service @prod     # Restart service ON prod
```

### 3. File Location & Structure (80-120 lines)

**Location**: `$TETRA_DIR/orgs/{org-name}/tetra.toml`

**Why this location?**
- `$TETRA_DIR` = runtime data directory (`~/tetra/` by default)
- `orgs/` = multi-organization support
- `{org-name}/` = organization-specific configuration
- `tetra.toml` = THE configuration file

**Structure Overview**:
```toml
[metadata]
name = "my-company"
tes_version = "2.1"

[symbols]
# Level 0: Semantic labels
"@local" = { address = "127.0.0.1", type = "local" }
"@dev" = { address = "143.198.45.123", droplet = "dev01", type = "remote" }
"@staging" = { address = "24.199.72.22", droplet = "staging01", type = "remote" }
"@prod" = { address = "164.90.247.44", droplet = "prod01", type = "remote" }

[connectors]
# Level 3: Authenticated channels
"@dev" = { auth_user = "root", work_user = "dev", host = "143.198.45.123", auth_key = "~/.ssh/id_rsa" }
"@staging" = { auth_user = "root", work_user = "deploy", host = "24.199.72.22", auth_key = "~/.ssh/id_rsa" }
"@prod" = { auth_user = "root", work_user = "prod", host = "164.90.247.44", auth_key = "~/.ssh/id_rsa" }

[infrastructure]
# Reference data (droplet IDs, IPs, domains, etc.)
provider = "digitalocean"
dev_droplet_id = 437858577
dev_domain = "dev.mycompany.com"
# ... more infrastructure details

[environments]
# Environment-specific configuration
[environments.dev]
database_url = "postgres://dev.mycompany.com/db"
api_key = "dev_key_12345"

[environments.prod]
database_url = "postgres://prod.mycompany.com/db"
api_key = "prod_key_67890"
```

Explain each section's purpose.

### 4. Progressive Resolution (The Heart of TES) (150-200 lines)

This is the most important section. Explain the 7-level resolution hierarchy:

**Level 0: Symbol** (Semantic label)
- What: Human-friendly name
- Example: `@staging`
- Specifies: Nothing - just a label
- Missing: Everything (host, user, auth, path, operation)

**Level 1: Address** (Network location)
- What: IP address or hostname
- Example: `143.198.45.123` or `staging.mycompany.com`
- Specifies: Where to connect
- Missing: User, authentication, path, operation

**Level 2: Channel** (User + Address)
- What: User account + network location
- Example: `dev@143.198.45.123`
- Specifies: Who + where
- Missing: Authentication method, path, operation

**Level 3: Connector** (Authenticated Channel)
- What: Dual-role authentication with key
- Example: `root:dev@143.198.45.123 -i ~/.ssh/id_rsa`
- Format: `auth_user:work_user@host -i keyfile`
- Specifies: Auth user (for SSH), work user (for commands), host, key
- Missing: Validation status, specific resource path

**Dual-Role Auth Explained**:
```bash
# Traditional SSH (single role):
ssh dev@host "command"

# Dual-role (separate auth and work users):
ssh -i ~/.ssh/key root@host "su - dev -c 'command'"

# Why?
# - auth_user (root): Has SSH access
# - work_user (dev): Runs the actual commands
# - Separation of concerns: auth ≠ execution
```

**Level 4: Handle** (Validated Connector)
- What: Connector that passed pre-flight checks
- Example: Connector + validation status ✓
- Specifies: Channel is reachable, key works
- Missing: Specific resource path, operation

**Level 5: Locator** (Handle + Resource Path)
- What: Validated channel + file/directory path
- Example: `dev@143.198.45.123:~/.ssh/authorized_keys`
- Specifies: Exact resource to operate on
- Missing: Operation type (read/write/execute)

**Level 6: Binding** (Locator + Operation)
- What: Resource + intended operation + validation
- Example: `write(dev@143.198.45.123:~/.ssh/authorized_keys)`
- Specifies: What operation, validated that it's safe
- Missing: Execution context (the actual command)

**Level 7: Plan** (Complete Executable Command)
- What: Full SSH command ready to execute
- Example: `ssh root:dev@143.198.45.123 -i ~/.ssh/key 'cat > ~/.ssh/authorized_keys'`
- Specifies: EVERYTHING - ready to run
- Missing: Nothing - execute now!

**Progressive Resolution Flow**:
```
@staging                                              (Level 0: Symbol)
  ↓ [symbols] table lookup
24.199.72.22                                          (Level 1: Address)
  ↓ Default user or specification
deploy@24.199.72.22                                   (Level 2: Channel)
  ↓ [connectors] table lookup
root:deploy@24.199.72.22 -i ~/.ssh/id_rsa            (Level 3: Connector)
  ↓ Pre-flight check (SSH test)
[Validated Handle]                                    (Level 4: Handle)
  ↓ Add resource path
deploy@24.199.72.22:~/app/config.toml                (Level 5: Locator)
  ↓ Add operation intent
write(deploy@24.199.72.22:~/app/config.toml)         (Level 6: Binding)
  ↓ Generate SSH command
ssh root@24.199.72.22 -i ~/.ssh/key \               (Level 7: Plan)
  'su - deploy -c "cat > ~/app/config.toml"'
```

### 5. Generation Pipeline (80-120 lines)

Explain how tetra.toml is created:

**Step 1: NH (NodeHolder) - Raw Infrastructure Data**
- Location: `~/nh/{org}/digocean.json`
- What: Unmodified API responses from DigitalOcean
- Tool: `nh fetch {org}`
- NH is "pure substrate" - no interpretation

**Step 2: Discovery - Interactive Mapping**
- Tool: `org discover:infrastructure {org}`
- What: User maps droplets → environments
- Output: `{org}.mapping.json`
- Example:
  ```json
  {
    "droplet_437858577": {
      "name": "dev01",
      "environment": "dev",
      "role": "application"
    }
  }
  ```

**Step 3: Conversion - TOML Generation**
- Tool: `org compile:toml {org}`
- Input: `digocean.json` + `{org}.mapping.json`
- Output: `$TETRA_DIR/orgs/{org}/tetra.toml`
- What: Generate `[symbols]` and `[connectors]` sections

**Complete Flow**:
```bash
# 1. Fetch raw infrastructure
nh fetch pixeljam-arcade
# Creates: ~/nh/pixeljam-arcade/digocean.json

# 2. Map to environments (interactive)
org discover:infrastructure pixeljam-arcade
# Creates: ~/nh/pixeljam-arcade/pixeljam-arcade.mapping.json

# 3. Generate tetra.toml
org compile:toml pixeljam-arcade
# Creates: ~/tetra/orgs/pixeljam-arcade/tetra.toml
```

**Why this separation?**
- NH: Infrastructure as ground truth (immutable)
- Mapping: Human semantics (dev/staging/prod)
- TOML: Tetra-specific configuration

### 6. Using TES in Module Actions (100-150 lines)

Show how modules consume TES endpoints:

**Example 1: Simple Resolution**
```bash
# In bash/org/actions.sh
org_action_push_config() {
    local target="$1"  # e.g., "@dev"

    # Resolve symbol to connector
    local connector=$(tes_resolve "$target" "connector")
    # Returns: root:dev@143.198.45.123 -i ~/.ssh/id_rsa

    # Use connector
    ssh "$connector" "cat > /etc/config.toml" < local_config.toml
}
```

**Example 2: Multi-Level Resolution**
```bash
# Different actions need different resolution levels
check_reachable() {
    local target="$1"
    local address=$(tes_resolve "$target" "address")
    ping -c 1 "$address"
}

deploy_files() {
    local target="$1"
    local connector=$(tes_resolve "$target" "connector")
    rsync -avz ./dist/ "$connector":/var/www/
}

validate_resource() {
    local target="$1"
    local path="$2"
    local locator=$(tes_resolve "$target" "locator" "$path")
    # Check if file exists
    ssh "$locator" "test -f $path"
}
```

**Example 3: Handling Local vs Remote**
```bash
handle_endpoint() {
    local target="$1"

    # Check if local
    if tes_is_local "$target"; then
        # Direct file operations
        cp config.toml /local/path/
    else
        # Remote via SSH
        local connector=$(tes_resolve "$target" "connector")
        scp config.toml "$connector":/remote/path/
    fi
}
```

### 7. TES Extensions (120-180 lines)

TES has specialized behaviors for different protocols:

**SSH Extension** (Most Common)
- Progressive resolution for SSH connections
- Dual-role authentication (auth_user:work_user)
- Key management integration
- Pre-flight validation
- See full spec in TES_SSH_Extension.md

Key features:
- Connector format: `auth_user:work_user@host -i keyfile`
- Example: `root:deploy@staging.company.com -i ~/.ssh/deploy_key`
- Why dual-role? Security boundary (SSH access ≠ command execution)

**Storage Extension**
- S3, DigitalOcean Spaces, etc.
- TES symbols map to cloud storage endpoints
- Example: `@backup-bucket`, `@cdn-assets`
- Connector includes credentials, region, bucket name

**Agent Extension**
- AI agent integration (Claude, etc.)
- TES symbols for agent endpoints
- Example: `@claude-api`, `@automation-agent`
- Connector includes API keys, model settings

Each extension section should:
1. Explain use case
2. Show connector format
3. Give 2-3 examples
4. Link to detailed docs

### 8. Best Practices (80-100 lines)

**Naming Conventions**:
- Symbols: Use standard names (`@dev`, `@staging`, `@prod`)
- Work users: Match environment (`dev`, `staging`, `prod`)
- Auth users: Usually `root` or dedicated deploy user

**Security**:
- Never commit tetra.toml with credentials
- Use key files, not passwords
- Separate auth and work users
- Rotate keys regularly
- Use separate keys per environment

**Organization**:
- One tetra.toml per organization
- Version control the mapping.json
- Document non-standard configurations
- Keep infrastructure section up-to-date

**Testing**:
```bash
# Validate resolution
tes resolve @dev connector

# Test connectivity
tes validate @dev

# Dry-run operations
org push:config @dev --dry-run
```

### 9. Troubleshooting (60-80 lines)

Common issues:

**Symbol not found**:
```bash
# Error: @staging not defined
# Fix: Check [symbols] section in tetra.toml
```

**SSH connection fails**:
```bash
# Error: Permission denied
# Debug: ssh -vv root@host -i ~/.ssh/key
# Check: Key file permissions (chmod 600)
# Check: auth_user has SSH access
```

**Dual-role auth confusion**:
```bash
# Error: root has no write permission to /home/deploy/
# Cause: Trying to write as auth_user instead of work_user
# Fix: Ensure command runs as work_user
```

**Compilation failures**:
```bash
# Error: mapping.json not found
# Fix: Run org discover:infrastructure first
```

### 10. Reference (40-60 lines)

**TES Resolution Functions** (from org module):
- `tes_resolve <symbol> <level>` - Resolve to specific level
- `tes_is_local <symbol>` - Check if endpoint is local
- `tes_validate <symbol>` - Pre-flight validation
- `tes_get_address <symbol>` - Get IP/hostname
- `tes_get_connector <symbol>` - Get full connector string

**TOML Structure Reference**:
- `[metadata]` - Org metadata, TES version
- `[symbols]` - Level 0 (semantic → address mapping)
- `[connectors]` - Level 3 (authenticated channels)
- `[infrastructure]` - Reference data (droplet IDs, etc.)
- `[environments]` - Environment-specific config

**Related Documentation**:
- [README.md](README.md) - Project overview
- [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) - Using TES in modules
- [docs/TES_SSH_Extension.md](TES_SSH_Extension.md) - Full SSH spec
- [bash/org/README.md](../bash/org/README.md) - Org module docs

### 11. Appendix: Example tetra.toml (80-120 lines)

Include a complete, annotated example from pixeljam-arcade showing:
- All sections properly configured
- Comments explaining each part
- Multiple environments (local, dev, staging, prod)
- Different connector configurations

## Writing Guidelines

1. **Be precise**: TES is a specification - accuracy matters
2. **Progressive detail**: Start simple, add complexity
3. **Real examples**: Use actual pixeljam-arcade configuration
4. **Visual diagrams**: ASCII art for resolution flow
5. **Code samples**: Show actual bash usage
6. **Cross-reference**: Link to related docs

## Tone

- Technical but clear (this is a spec)
- Authoritative (this is THE reference)
- Practical (focus on usage, not theory)
- Comprehensive (cover all levels, extensions)

## Create the File

Create `docs/TES.md` as the foundational specification for Tetra endpoints. This document should be THE reference for understanding and using TES.

**After completion**: This becomes the nouns reference - how infrastructure is defined in Tetra.
