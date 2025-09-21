# Tetra Change Log

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