# Tetra Change Log

## 2025-01-21 - TSM Architecture Refactor and Named Port Registry

### Major Changes
- **Complete TSM module loading refactor** - Fixed circular dependencies and loading order issues
- **Named port registry system** - Standardized port assignments for known services
- **Proper global state management** - Associative arrays now initialize correctly through bootloader
- **Clean dependency-ordered loading** - No more circular dependencies or missing functions

### TSM Named Port Registry
Established standard port assignments:
- **devpages: 4000** - Development pages application
- **tetra: 4444** - Tetra system services
- **arcade: 8400** - Arcade gaming platform
- **pbase: 2600** - PocketBase database services

### Port Resolution Priority System
1. **Explicit --port flag** (highest priority)
2. **PORT from environment file**
3. **Named port registry** (new)
4. **Default port 3000** (fallback)

### Architecture Improvements
- **Backup strategy** - Created timestamped backup before changes
- **Dependency-ordered loading** - Core → Config → Utils → Service → Interface
- **Global state initialization** - Proper associative array management
- **Bootloader compatibility** - Works seamlessly with existing lazy loading

### Commands Added
- `tsm ports` - List named port registry
- `tsm ports scan` - Show port status (free/used with PIDs)
- `tsm ports validate` - Validate port registry for conflicts
- `tsm doctor` - Port diagnostics and conflict resolution

### Technical Debt Addressed
- Fixed bootloader loading order problems (not papered over)
- Resolved associative array scoping issues (proper global state)
- Standardized module architecture (consistent loading pattern)
- Eliminated hardcoded port defaults (intelligent resolution)

## 2025-01-21 - Organization Management System and TETRA_DIR Reorganization

### Major Changes
- **Complete TETRA_DIR reorganization** - Clean structure with `tetra.sh` as only root file
- **Multi-organization support** - Handle multiple client infrastructures seamlessly
- **Symlink-based active organization** - Dynamic org switching with `$TETRA_DIR/config/tetra.toml`
- **TDash organization integration** - Dashboard shows organization context and infrastructure
- **Module consolidation** - All module data moved to `$TETRA_DIR/modules/` directory

### New Directory Structure
```
$TETRA_DIR/
├── tetra.sh                    # Only file at root
├── config/
│   ├── modules.conf
│   ├── tetra.toml → orgs/active_org/active_org.toml
│   └── tetra/                  # tetra module storage
├── orgs/                       # Organization management
├── modules/                    # All module data
├── services/                   # TSM services
└── env/                       # Environment files
```

### Organization Management Features
- **Multi-client support** - Switch between different client infrastructures
- **Organization commands** - `tetra org list`, `tetra org switch`, `tetra org create`, `tetra org active`
- **TOML-based configuration** - Each organization has dedicated TOML file
- **Active organization detection** - All tools respect current organization context

### TDash Integration Updates
- **Organization context display** - Shows active organization in TOML:SYSTEM mode
- **Updated path detection** - Works with new `$TETRA_DIR/config/tetra.toml` location
- **Real-time org switching** - Dashboard updates when organizations change
- **Infrastructure display** - Parse and show organization-specific server data

### Key Commands Added
```bash
# Organization management
tetra org list                  # List all organizations
tetra org active               # Show active organization
tetra org switch <org>         # Switch to organization
tetra org create <org>         # Create new organization

# TDash with organization context
tdash                          # Launch with active org context
```

### Technical Improvements
- **Clean directory structure** - Eliminated clutter in TETRA_DIR root
- **Symlink management** - Automatic symlink updates for org switching
- **Path reference updates** - All modules work with new organization system
- **Module data preservation** - All module data safely moved and accessible
- **Testing** - Organization, TDash, and module loading tests

### Breaking Changes
- **TOML location changed** - From `$TETRA_DIR/tetra.toml` to `$TETRA_DIR/config/tetra.toml`
- **Module data moved** - From `$TETRA_DIR/{module}/` to `$TETRA_DIR/modules/{module}/`
- **Tetra module storage** - From `$TETRA_DIR/tetra/` to `$TETRA_DIR/config/tetra/`

### Migration Guide
- Existing configurations automatically migrated during reorganization
- All modules continue to work from new locations
- Organization system provides backward compatibility for single-org setups
- TDash retains all navigation and functionality with new organization context

## 2025-01-21 - TDash Dashboard with 4-Mode Navigation

### Major Changes
- **Complete TDash module refactor** - 4-mode, 4-environment navigation system
- **TOML infrastructure integration** - Parse and display real server data, IPs, memory, regions
- **SSH connectivity detection** - Real-time server status with non-blocking connectivity checks
- **Flicker elimination** - Perfect double-buffering for smooth navigation experience
- **Module rename** - From "dash" to "tdash" to avoid Linux dash command conflicts

### New Components
- `bash/tdash/tdash_repl.sh` - Complete rewrite with matrix navigation system
- `bash/tdash/includes.sh` - Updated module integration with new command interface
- Navigation: 4 modes × 5 environments = 20 unique views

### Navigation System
- **Modes (A/D keys)**: TOML ← → TKM ← → TSM ← → DEPLOY
- **Environments (W/S keys)**: SYSTEM ↕ LOCAL ↕ DEV ↕ STAGING ↕ PROD
- **Items (J/I/K/L keys)**: Navigate within selected mode+environment
- **Real-time data**: Live TOML parsing, SSH status, infrastructure specs

### Infrastructure Display Features
- **Server Information** - IP addresses, memory specs, DigitalOcean regions
- **Domain Management** - Environment-specific domain configurations
- **Service Status** - SSH connectivity with visual indicators
- **Rich Formatting** - Bold highlighting, color coding, status symbols

### Key Commands Added
```bash
# TDash navigation
tdash                    # Launch dashboard
tdash repl              # Interactive navigation mode
tdash help              # Show navigation help

# Module management
tmod enable tdash       # Enable TDash module
tmod load tdash         # Load TDash functionality
```

### Technical Improvements
- **Perfect double-buffering** - Generate all content before screen clear
- **TOML parsing integration** - Real infrastructure data from tetra.toml
- **Non-blocking SSH checks** - Connectivity detection without hanging
- **Bold/color formatting** - Using tput for reliable terminal formatting
- **Matrix navigation** - 20 different render functions for each mode+env combination

## 2025-01-20 - Systemd Service Daemon and TSM Service Management

### Major Changes
- **Implemented tetra-daemon systemd service** - Production server startup automation for enabled services
- **Added TSM service save/enable/disable system** - nginx-style symlink management for service persistence
- **Created complete systemd integration** - Service file, daemon executable, and service management
- **Enhanced TSM with service commands** - save, enable, disable, show commands for service definitions

### New Components
- `bin/tetra-daemon` - Systemd service daemon executable with auto-discovery
- `systemd/tetra.service` - Production systemd service file with security hardening
- `bash/tsm/tsm_service.sh` - Service definition management (save/enable/disable)
- Service directory structure: `services/*.tsm.sh`, `services/enabled/` (symlinks)

### Service Management Features
- **Service Definitions** - bash-based .tsm.sh files with TSM_NAME, TSM_COMMAND, TSM_CWD variables
- **nginx-style Enable/Disable** - Symlink services/enabled/ for automatic startup
- **Systemd Integration** - tetra-daemon starts enabled services on production server boot
- **PM2-like Persistence** - Services survive reboots via systemd + TSM integration

### Key Commands Added
```bash
# Service management
tsm save <name> <command>      # Save service definition
tsm enable <service>           # Enable for auto-startup
tsm disable <service>          # Disable auto-startup
tsm show <service>             # Show service config
tsm services                   # List all services

# Production deployment (Linux)
sudo ln -s ~/src/devops/tetra/systemd/tetra.service /etc/systemd/system/
sudo systemctl enable tetra.service
sudo systemctl start tetra.service
```

### Architecture
- **TETRA_SRC/bin/tetra-daemon** - Self-locating executable loads tetra environment
- **TETRA_DIR/services/** - Service definitions (.tsm.sh files)
- **TETRA_DIR/services/enabled/** - Symlinks to enabled services
- **systemd user service** - Runs as user with restricted permissions

## 2025-01-20 - The Tetra Way Environment Management Implementation

### Major Changes
- **Implemented complete environment management system** - Organic dev.env → promotion → deployment workflow
- **Removed local.env dependencies** - Local development now manual, dev.env as canonical source
- **Added tetra env command** - Environment promotion with automatic adaptations (domains, paths, security)
- **Enhanced TKM as local command center** - Deploy environments and services remotely via SSH
- **Created environment-specific service templates** - SystemD and nginx configs for dev/staging/prod
- **Updated TSM integration** - Auto-detects dev.env by default, removed local.env fallbacks

### New Components
- `bash/utils/tetra_env.sh` - Environment promotion and validation system
- `bash/tkm/tkm_deploy.sh` - Local command center deployment functionality
- `templates/systemd/pixeljam-arcade-{dev,staging,prod}.service` - Environment-specific services
- `templates/nginx/pixeljam-arcade-{dev,staging,prod}.conf` - Progressive security nginx configs
- `docs/manual/09-tetra-way-environment-management.md` - Complete workflow documentation

### Environment Philosophy
- **Local**: Developer laptop (TKM command center) - manual env management
- **Dev**: `/home/dev/src/pixeljam/` - organic development, canonical env source
- **Staging**: `/home/staging/src/pixeljam/` - promoted from dev with security
- **Production**: `/home/prod/src/pixeljam/` - promoted from staging with maximum security

### Git Alignment
- Personal branches → dev branch → dev server deployment
- Dev environment → staging promotion → staging deployment
- Staging environment → production promotion → production deployment

### Automatic Adaptations During Promotion
- **NODE_ENV**: development → staging → production
- **Domains**: dev.pixeljamarcade.com → staging.pixeljamarcade.com → pixeljamarcade.com
- **Paths**: /home/dev/ → /home/staging/ → /home/prod/
- **Security**: Progressive hardening, debug removal, production optimizations

### Key Commands Added
```bash
# Environment promotion
tetra env promote dev staging
tetra env promote staging prod
tetra env list
tetra env validate prod

# Local command center deployment
tkm deploy env staging
tkm deploy service prod
tkm deploy status

# Service management (updated)
tsm start entrypoints/dev.sh       # Auto-sources env/dev.env
tsm start --env staging server.sh  # Override environment
```

### Breaking Changes
- **TSM no longer defaults to local.env** - Now uses env/dev.env
- **Removed local.env from auto-detection** - Developers manage local copies manually
- **TKM deploy command enhanced** - Now handles both SSH keys and environment deployment

### Migration Required
- Move existing local.env to dev.env or recreate organically
- Update any scripts referencing local.env to use dev.env
- Configure SSH access for deployment targets
- Test environment promotion and deployment workflow