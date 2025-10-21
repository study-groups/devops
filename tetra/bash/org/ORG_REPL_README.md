# Org Mode REPL - Interactive Organization Management

Complete interactive system for managing Tetra organizations with hierarchical tab completion, discoverable help, and NodeHolder bridge integration.

## Features

✅ **Tab Completion** - Hierarchical command discovery
✅ **Interactive Help** - Discoverable help system
✅ **NodeHolder Bridge** - Smart integration without duplication
✅ **Workflow Guided** - Step-by-step from digocean.json → tetra.toml
✅ **AST-Based** - Uses bash AST utilities for parsing

## Quick Start

### Launch REPL

```bash
source ~/tetra/tetra.sh
tmod load org
org  # Or: tetra org repl
```

### Basic Workflow

```
org> help quickstart
org> import nh ~/nh/myorg myorg
org> secrets init myorg
org> compile myorg
org> switch myorg
org> push myorg dev
```

## Architecture

```
bash/org/
├── org_repl.sh          # REPL main loop
├── org_completion.sh    # Hierarchical tab completion
├── org_help.sh          # Discoverable help system
├── tetra_org.sh         # Core org management
├── discovery.sh         # Interactive infrastructure discovery
├── converter.sh         # DigitalOcean → TES TOML
├── compiler.sh          # Compile final tetra.toml
├── secrets_manager.sh   # Secrets management
└── includes.sh          # Module loader

bash/nh/
├── nh_bridge.sh         # NodeHolder bridge (helpers, not duplication)
├── README.md            # Bridge documentation
└── includes.sh          # Module loader
```

## Tab Completion Tree

The completion system uses a hierarchical tree structure:

```
/
├── list
├── active
├── switch
│   └── @org               # Org names
├── create
│   └── @string
├── import
│   ├── nh
│   │   ├── @nh_dir       # NodeHolder directories
│   │   └── @org
│   ├── json
│   │   ├── @json_file    # JSON files
│   │   └── @org
│   └── env
│       ├── @env_file
│       └── @org
├── discover
│   └── @json_file
├── secrets
│   ├── init → @org
│   ├── validate → @org
│   ├── load → @org @env
│   ├── list → @org
│   └── copy → @org @org
├── compile
│   └── @org
├── push
│   ├── @org
│   └── @env              # Environments
└── help
    ├── overview
    ├── quickstart
    ├── import
    ├── workflow
    └── commands
```

### Using Tab Completion

```bash
org> <TAB>                    # Shows all commands
org> import <TAB>             # Shows: nh json env
org> import nh <TAB>          # Shows NodeHolder directories
org> secrets <TAB>            # Shows: init validate load list copy
org> help <TAB>               # Shows help topics
```

## Help System

### Hierarchical Help Topics

```
overview        Organization management overview
quickstart      Quick start guide
import          Import organizations
workflow        Complete workflows
commands        Command reference
```

### Using Help

```bash
org> help                     # Shows overview
org> help quickstart          # Quick start
org> help workflow            # NodeHolder → Tetra workflow
org> help import              # Import help
org> help <TAB>               # Tab complete help topics
```

## NodeHolder Bridge

The `bash/nh/` module is a **bridge**, not a duplication:

### What It Does

✅ Checks if NodeHolder is available
✅ Validates digocean.json format
✅ Checks age of infrastructure data
✅ Suggests when to refresh
✅ Can invoke NH commands (with permission)
✅ Documents the workflow

### What It Does NOT Do

❌ Store doctl credentials
❌ Fetch from DigitalOcean directly
❌ Duplicate NodeHolder code
❌ Make Tetra dependent on NodeHolder

### Bridge Functions

```bash
nh_check_available         # Is NodeHolder installed?
nh_get_json_age <file>     # How old is digocean.json?
nh_validate_json <file>    # Is JSON valid?
nh_suggest_refresh <file>  # Suggest update if stale
nh_status                  # Show NodeHolder status
nh_fetch_latest [context]  # Fetch new data (with confirmation)
nh_show_workflow           # Show workflow documentation
```

## Complete Workflow: NodeHolder → Tetra

### 1. Fetch Infrastructure (in NodeHolder)

```bash
cd ../nh
source bash/doctl.sh
nh_doctl_get_all
# Creates: ~/nh/<context>/digocean.json
```

### 2. Import to Tetra (in Org REPL)

```bash
org> import nh ~/nh/pixeljam-arcade pixeljam-arcade
```

**Interactive Discovery Process:**
1. Parses digocean.json
2. Shows all resources (droplets, IPs, domains, volumes)
3. Auto-suggests environment mappings
4. Allows editing
5. Generates mapping.json
6. Creates TES-compliant TOML

**Output:**
```
$TETRA_DIR/org/pixeljam-arcade/
├── digitalocean.json           # Raw DO data
├── mapping.json               # Environment mappings
├── pixeljam-arcade.toml       # Infrastructure config (commit to git)
└── (secrets.env coming next)
```

### 3. Configure Secrets

```bash
org> secrets init pixeljam-arcade
# Creates template: $TETRA_DIR/org/pixeljam-arcade/secrets.env
```

Edit secrets:
```bash
$EDITOR $TETRA_DIR/org/pixeljam-arcade/secrets.env
```

Example secrets.env:
```env
DB_PASSWORD=supersecret
API_KEY=abc123
OAUTH_CLIENT_SECRET=xyz789
```

Validate:
```bash
org> secrets validate pixeljam-arcade
```

### 4. Compile Final Config

```bash
org> compile pixeljam-arcade
```

**Compilation Process:**
1. Validates all input files
2. Validates secrets (format and permissions)
3. Backs up existing tetra.toml
4. Converts infrastructure to TES 2.1
5. Interpolates secrets
6. Creates: `tetra.toml` (NEVER commit - has secrets)

### 5. Activate Organization

```bash
org> switch pixeljam-arcade
org> active
# Shows: pixeljam-arcade
```

This updates the symlink:
```
$TETRA_DIR/config/tetra.toml → $TETRA_DIR/org/pixeljam-arcade/tetra.toml
```

### 6. Deploy

```bash
org> push pixeljam-arcade dev
org> push pixeljam-arcade staging
org> push pixeljam-arcade prod
```

## Commands Reference

### Management
```
list, ls                   List all organizations
active                     Show active organization
switch <org>               Switch to organization
create <org>               Create new organization
validate <org>             Validate organization config
```

### Import
```
import nh <dir> [org]      Import from NodeHolder
import json <file> [org]   Import from DigitalOcean JSON
import env <file> [org]    Import from .env file
discover <json>            Interactive infrastructure discovery
```

### Secrets
```
secrets init <org>         Initialize secrets template
secrets validate <org>     Validate secrets file
secrets load <org> [env]   Load secrets to environment
secrets list <org>         List secret keys
secrets copy <src> <dst>   Copy secrets between orgs
```

### Configuration
```
compile <org>              Compile tetra.toml with secrets
refresh <org> [json]       Refresh from new infrastructure
```

### Deployment
```
push <org> <env>          Deploy to environment
pull <org> <env>          Pull from environment
rollback <org> <env>      Rollback deployment
history <org> [env]       View deployment history
```

### NodeHolder Bridge
```
nh status                  Show NodeHolder status
nh fetch [context]         Fetch latest infrastructure
nh workflow                Show workflow documentation
```

### Help
```
help [topic]               Show help
exit, quit, q              Exit REPL
```

## Tab Discovery Examples

### Discover Commands
```bash
org> <TAB>
list  active  switch  create  import  discover  validate
compile  refresh  secrets  push  pull  rollback  history
help  exit
```

### Discover Import Options
```bash
org> import <TAB>
nh  json  env

org> import nh <TAB>
pixeljam-arcade  another-org  (from ../nh/)
```

### Discover Environments
```bash
org> push myorg <TAB>
local  dev  staging  prod  qa
```

### Discover Help Topics
```bash
org> help <TAB>
overview  quickstart  import  workflow  commands  all
```

## File Structure Created

After importing an organization:

```
$TETRA_DIR/org/<org-name>/
├── digitalocean.json          # Raw DO data (from NodeHolder)
├── mapping.json               # Environment mappings
├── <org-name>.toml           # Infrastructure config (COMMIT)
├── secrets.env               # Credentials (NEVER COMMIT - 600 perms)
├── tetra.toml                # Compiled with secrets (NEVER COMMIT)
├── resources.toml            # Optional: file sync definitions
├── services/                 # Service templates
│   ├── app.service.toml
│   └── arcade.service.toml
├── nginx/                    # Nginx configurations
│   ├── dev.nginx.conf
│   ├── staging.nginx.conf
│   └── prod.nginx.conf
├── deployment/               # Deployment strategies
│   └── strategy.deploy.toml
├── backups/                  # Timestamped backups
│   └── tetra.toml.backup.*
└── deployments/              # Deployment metadata
    ├── dev.toml
    ├── staging.toml
    └── prod.toml
```

### What to Commit to Git

✅ COMMIT:
- `<org-name>.toml` - Infrastructure config
- `mapping.json` - Environment mappings
- `resources.toml` - File sync definitions
- `services/` - Service templates
- `nginx/` - Nginx configs
- `deployment/` - Deployment strategies

❌ NEVER COMMIT:
- `secrets.env` - Contains credentials
- `tetra.toml` - Has interpolated secrets
- `digitalocean.json` - Raw infrastructure (optional)

## Security

### Secrets Management

1. **secrets.env** has 600 permissions (owner read/write only)
2. **tetra.toml** contains secrets - NEVER commit
3. Both are in `.gitignore`
4. Compilation validates permissions
5. No doctl credentials in Tetra

### NodeHolder Separation

- doctl API keys stay in NodeHolder (../nh)
- Tetra only uses digocean.json (the bridge)
- No credential duplication
- Clean security boundary

## AST-Based Features

Uses `bash/rag/core/utils/ast.sh` for:
- Function parsing
- Code extraction
- Help generation from code comments

Example:
```bash
org_help_from_ast bash/org/tetra_org.sh org_import
# Extracts help from function comments
```

## Examples

### Example 1: Import Existing Organization
```bash
org> import nh ~/nh/pixeljam-arcade pixeljam
✓ NodeHolder directory found
✓ digocean.json found (age: 5 days)
Starting discovery...
[Interactive discovery process]
✓ Created organization: pixeljam
```

### Example 2: Stale Data Warning
```bash
org> import nh ~/nh/oldorg oldorg
⚠️  digocean.json is 45 days old
   To fetch latest: cd ../nh && nh_doctl_get_all
   Continue with existing data? [y/N]
```

### Example 3: Complete Setup
```bash
org> import nh ~/nh/myorg myorg
org> secrets init myorg
org> secrets validate myorg
org> compile myorg
org> switch myorg
org> active
myorg
org> push myorg dev
✓ Deployed to dev
```

## Integration with Tetra

### Command-Line Mode
```bash
tetra org list
tetra org switch myorg
tetra org repl  # Launch REPL
```

### Direct REPL
```bash
org  # Alias to org_repl
```

### Module Loading
```bash
source ~/tetra/tetra.sh
tmod load org  # Loads org + nh bridge
```

## See Also

- NodeHolder: `../nh/`
- NodeHolder Bridge: `bash/nh/README.md`
- AST Utilities: `bash/rag/core/utils/ast.sh`
- TES Spec: Tetra Environment Standard

## Contributing

When adding new commands:

1. Add to completion tree in `org_completion.sh`
2. Add help topic in `org_help.sh`
3. Add command handler in `org_repl.sh`
4. Export function in `includes.sh`
5. Update this README

## License

Part of Tetra - The Terminal-Enhanced Technology Runtime Architecture
