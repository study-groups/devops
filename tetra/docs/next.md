# Next Steps - NGM Architecture & Template System Refactoring

## Immediate Priority: NGM (Nginx Manager) Implementation

### Architecture Overview
**Complete Service-to-Web Pipeline:**
- **TSM** manages service lifecycle (start/stop/restart) with `.bundle.tsm` files
- **NGM** generates nginx configs from service definitions
- **Unified deployment** via `tetra.sh` orchestration script per environment

### End-to-End Workflow Vision
```bash
# Developer workflow
tsm save all dev.bundle.tsm         # Capture current service state
ngm generate dev                     # Generate nginx config from TSM bundle
ngm deploy dev                       # Push to dev.pixeljamarcade.com:/etc/nginx/sites-enabled/dev.conf

# Production deployment
tetra-dev.service runs: ~/tetra/tetra.sh
  ├─ tsm load dev.bundle.tsm         # Start all services
  ├─ ngm deploy dev                  # Configure nginx routing
  └─ systemctl reload nginx         # Apply routing changes
```

---

## File Structure Modernization

### Current vs Target Organization Structure
**Current (verbose):**
```
~/tetra/orgs/pixeljam_arcade/
├── pixeljam_arcade.toml                      # Too verbose
├── pixeljam_arcade.customizations.toml       # Too verbose
```

**Target (clean):**
```
~/tetra/orgs/pixeljam_arcade/
├── tetra.toml                                # Infrastructure config
├── custom.toml                               # User customizations
├── dev.bundle.tsm                            # TSM service bundles
├── staging.bundle.tsm
├── prod.bundle.tsm
├── qa.bundle.tsm
├── dev.nginx.toml                            # NGM nginx definitions
├── staging.nginx.toml
├── prod.nginx.toml
└── qa.nginx.toml
```

### Component Responsibility Matrix
| Component | File Type | Purpose | Example |
|-----------|-----------|---------|---------|
| **Tetra** | `.toml` | Infrastructure (servers, IPs, domains) | `tetra.toml` |
| **User** | `.toml` | SSH users, preferences, overrides | `custom.toml` |
| **TSM** | `.tsm` | Service definitions and orchestration | `dev.bundle.tsm` |
| **NGM** | `.toml` | Web routing and nginx configuration | `dev.nginx.toml` |

---

## NGM (Nginx Manager) Command Structure

### Core NGM Operations
```bash
# Configuration Generation
ngm generate dev                     # Generate dev.nginx.toml from current TSM state
ngm template dev.nginx.toml          # Create from template
ngm validate dev.nginx.toml          # Validate nginx syntax

# Deployment Operations
ngm deploy dev                       # Push to /etc/nginx/sites-enabled/dev.conf
ngm status dev                       # Check remote nginx status and health
ngm reload dev                       # Reload nginx configuration
ngm test dev                         # Test configuration before deployment

# Debugging and Management
ngm diff dev                         # Compare local vs deployed config
ngm backup dev                       # Backup current remote config
ngm restore dev <timestamp>          # Restore from backup
ngm logs dev                         # Show nginx access/error logs
```

### Service Discovery Integration
**NGM reads TSM bundles to understand:**
- Which services need web routing
- Service ports for upstream configuration
- Health check endpoints
- SSL/domain requirements
- Load balancing needs

---

## Template System Refactoring

### Current Templates (to be modified)
```
templates/
├── organizations/           # ✅ Keep and enhance
│   ├── simple.toml
│   ├── webapp.toml
│   ├── services.toml
│   └── shared-infrastructure.toml
├── nginx/                   # 🔄 Refactor completely
│   └── tetra.conf          # ❌ Remove (monolithic)
└── systemd/                # ✅ Keep single template
    └── tetra.service       # ✅ Single template for all environments
```

### Target Template Structure
```
templates/
├── organizations/           # Enhanced with port definitions
│   ├── simple.toml         # + port sections
│   ├── webapp.toml         # + port sections
│   ├── services.toml       # + port sections
│   └── shared-infrastructure.toml # ✅ Already updated with QA
├── nginx/                   # Environment-specific templates
│   ├── dev.nginx.toml      # 🆕 Development nginx config template
│   ├── staging.nginx.toml  # 🆕 Staging nginx config template
│   ├── prod.nginx.toml     # 🆕 Production nginx config template
│   └── qa.nginx.toml       # 🆕 QA nginx config template
└── systemd/                 # Single service template
    └── tetra.service       # ✅ Runs ~/tetra/tetra.sh
```

### Port Management Strategy
**Remove from `config/ports.toml`:**
```toml
# ❌ Remove these port ranges
[port_ranges]
development = "3000-3999"
staging = "4000-4999"
production = "5000-5999"
testing = "6000-6999"
```

**Centralize in org TOML files:**
```toml
# ✅ Define in organization templates
[services.devpages]
port = 4000

[services.arcade]
port = 8400

[services.tetra]
port = 4444
```

---

## SystemD Integration Pattern

### Single Service Template Strategy
**Keep `templates/systemd/tetra.service`** as single template because:
- Environment differences are runtime behavior, not configuration
- Service file determines execution context, not specific services
- `~/tetra/tetra.sh` script handles environment-specific logic

### Environment-Specific Service Files
```bash
# Production deployment creates:
/etc/systemd/system/tetra-dev.service     # ExecStart=~/tetra/tetra.sh dev
/etc/systemd/system/tetra-staging.service # ExecStart=~/tetra/tetra.sh staging
/etc/systemd/system/tetra-prod.service    # ExecStart=~/tetra/tetra.sh prod
/etc/systemd/system/tetra-qa.service      # ExecStart=~/tetra/tetra.sh qa
```

### tetra.sh Orchestration Script
```bash
#!/usr/bin/env bash
# ~/tetra/tetra.sh - Environment orchestration

ENV=${1:-dev}

echo "Starting Tetra environment: $ENV"
cd ~/tetra/orgs/pixeljam_arcade

# Load services for environment
tsm load ${ENV}.bundle.tsm

# Configure nginx routing
ngm deploy $ENV

# Health check and monitoring
while true; do
    sleep 30
    tsm health $ENV
    ngm status $ENV
done
```

---

## NGM Configuration Format

### nginx.toml Structure
```toml
# dev.nginx.toml example
[metadata]
environment = "dev"
domain = "dev.pixeljamarcade.com"
target_server = "137.184.226.163"

[ssl]
enabled = true
cert_path = "/etc/letsencrypt/live/dev.pixeljamarcade.com/fullchain.pem"
key_path = "/etc/letsencrypt/live/dev.pixeljamarcade.com/privkey.pem"

[[services]]
name = "devpages"
port = 4000
path = "/"
health_check = "/health"

[[services]]
name = "arcade"
port = 8400
path = "/arcade"
health_check = "/api/health"

[nginx]
sites_enabled_path = "/etc/nginx/sites-enabled"
config_file = "dev.conf"
reload_command = "systemctl reload nginx"
```

### Generated nginx.conf Output
```nginx
# Generated by NGM from dev.nginx.toml
server {
    listen 443 ssl http2;
    server_name dev.pixeljamarcade.com;

    ssl_certificate /etc/letsencrypt/live/dev.pixeljamarcade.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dev.pixeljamarcade.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:4000;
        # Health check: GET /health
    }

    location /arcade {
        proxy_pass http://127.0.0.1:8400;
        # Health check: GET /api/health
    }
}
```

---

## Implementation Phases

### Phase 1: File Structure Migration
**Priority: Complete QA work and establish new naming conventions**
1. ✅ **Complete QA environment integration** (DONE)
2. **Rename organization files**: `pixeljam_arcade.toml` → `tetra.toml`
3. **Rename customizations**: `.customizations.toml` → `custom.toml`
4. **Update TView data loading** to use new filenames
5. **Test environment cycling** with QA integration

### Phase 2: NGM Core Development
**Priority: Build foundational NGM module**
1. **Create NGM bash module** at `TETRA_SRC/bash/ngm/`:
   - `ngm.sh` - Main entry point and CLI
   - `ngm_core.sh` - Config generation logic
   - `ngm_templates.sh` - Template processing
   - `ngm_deploy.sh` - Remote deployment via SSH
2. **Implement core commands**: `generate`, `validate`, `deploy`, `status`
3. **TSM integration**: Read `.bundle.tsm` files for service discovery

### Phase 3: Template System Refactoring
**Priority: Create environment-specific nginx templates**
1. **Remove monolithic template**: `templates/nginx/tetra.conf`
2. **Create environment templates**: `dev.nginx.toml`, `staging.nginx.toml`, etc.
3. **Remove port ranges**: Clean up `config/ports.toml`
4. **Add service ports**: Update org templates with port definitions
5. **Template validation**: Ensure all templates generate valid nginx configs

### Phase 4: End-to-End Integration
**Priority: Complete deployment pipeline**
1. **Create tetra.sh orchestration**: Environment-aware startup script
2. **SystemD service generation**: Per-environment service files
3. **Remote deployment testing**: Full pipeline from local to server
4. **Health monitoring**: Integrated TSM/NGM health checks
5. **Documentation**: Complete workflow documentation

### Phase 5: Production Deployment
**Priority: Live deployment and testing**
1. **Deploy to dev.pixeljamarcade.com**: Test complete pipeline
2. **Verify nginx config generation**: Ensure proper routing
3. **Test service orchestration**: TSM + NGM coordination
4. **Monitor and iterate**: Performance and reliability testing

---

## Success Metrics & Validation

### Technical Validation
- ✅ **QA Environment**: Fully integrated with TView navigation and SSH connectivity
- 🎯 **End-to-End Pipeline**: Local development → nginx config → live deployment
- 🎯 **File Structure**: Clean organization with purpose-specific naming
- 🎯 **Template System**: Environment-specific, maintainable configurations
- 🎯 **Service Discovery**: Automatic nginx routing from TSM service definitions

### Operational Benefits
- **Infrastructure as Code**: All configs version-controlled and reproducible
- **Environment Parity**: Consistent deployment across dev/staging/prod/qa
- **Simplified Operations**: Single command deployment and updates
- **Service Discovery**: Automatic nginx routing without manual configuration
- **Health Monitoring**: Integrated service and web server health checks

### Developer Experience
- **Clear Separation**: Each tool (TSM/NGM/TView) has distinct, clear purpose
- **Intuitive Commands**: `tsm` for services, `ngm` for web routing, `tview` for monitoring
- **Environment Consistency**: Same commands work across all environments
- **Rapid Deployment**: Fast iteration from development to production

---

## Risk Mitigation

### Backwards Compatibility
- **Gradual Migration**: Implement alongside existing system
- **Fallback Options**: Keep existing configs during transition
- **Testing Strategy**: Comprehensive testing before production deployment
- **Rollback Plan**: Easy reversion to previous system if needed

### Error Handling
- **Config Validation**: Syntax checking before deployment
- **Health Checks**: Automatic detection of failed deployments
- **Backup Strategy**: Automatic backups before config changes
- **Monitoring Integration**: Alert on deployment or service failures

---

This roadmap establishes NGM as the missing piece in the Tetra ecosystem, creating a complete infrastructure management solution from service orchestration through web routing to live deployment. The architecture prioritizes clarity, maintainability, and operational simplicity while providing enterprise-grade capabilities for multi-environment deployment management.