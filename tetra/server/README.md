# Tetra Server Scripts

A collection of practical bash scripts for skilled Linux administrators to manage PixelJam Arcade infrastructure.

## Scripts Overview

### 🚀 `deploy-staging.sh` - Complete Staging Deployment
Comprehensive deployment script that handles the entire dev→staging pipeline.

```bash
# Basic deployment
./deploy-staging.sh

# Deploy specific branch
./deploy-staging.sh feature-branch

# Force deployment (ignore dirty git status)
./deploy-staging.sh main force
```

**What it does:**
- ✅ Validates prerequisites (SSH connectivity assumed working)
- 📁 Creates deployment backups (.env, nginx configs)
- 📥 Syncs code from dev to staging branch
- 🔧 Generates staging.env from dev environment
- 📋 Deploys nginx and systemd configuration files
- 🏗️ Builds application (npm ci && npm run build)
- 🔄 Restarts services (arcade-staging.service, nginx)
- ✅ Verifies deployment success
- 📊 Generates deployment report

**Prerequisites:**
- SSH key-based authentication to staging server
- Sudo privileges on staging server
- Git repository access

### 🔑 `tkm-rekey.sh` - SSH Key Rotation
Automated SSH key rotation using Tetra Key Manager (TKM).

```bash
# Rekey all environments (30-day keys)
./tkm-rekey.sh

# Rekey staging only
./tkm-rekey.sh staging

# Rekey production with 7-day keys
./tkm-rekey.sh prod 7
```

**What it does:**
- 🏠 Loads Tetra environment and initializes TKM
- 🏢 Sets up PixelJam organization in TKM
- 📥 Imports server inventory from `nh_show_env_vars`
- 🔐 Generates fresh SSH keys with expiration
- 🚀 Deploys keys to remote servers with security audits
- 🧪 Tests SSH connectivity with new keys
- 🗑️ Safely revokes old keys after verification
- 📊 Generates comprehensive security report

### ⚙️ `service-manager.sh` - Unified Service Control
Centralized service management across all environments.

```bash
# Restart staging arcade service
./service-manager.sh restart arcade-staging staging

# Check nginx status locally
./service-manager.sh status nginx local

# View production logs (last 100 lines)
./service-manager.sh logs arcade-prod prod 100

# List all services on staging
./service-manager.sh list staging

# Run health check on production
./service-manager.sh health prod
```

**Available services:**
- `arcade-dev` - Development arcade service
- `arcade-staging` - Staging arcade service  
- `arcade-prod` - Production arcade service
- `nginx` - Nginx web server
- `postgresql` - PostgreSQL database
- `redis` - Redis cache server

**Available actions:**
- `start/stop/restart/reload` - Service control
- `enable/disable` - Auto-start configuration
- `status` - Service status and details
- `logs` - View service logs
- `list` - List all services
- `health` - Comprehensive health check

### 🏥 `health-check.sh` - System Health Monitoring
Comprehensive system and service health monitoring.

```bash
# Check local system
./health-check.sh

# Check staging with detailed output
./health-check.sh staging --detailed

# Get JSON output for monitoring systems
./health-check.sh prod --json
```

**Health checks performed:**
- 🔗 SSH connectivity (remote environments)
- 💻 System resources (CPU, memory, disk, load average)
- ⚙️ Service status (all configured services)
- 🌐 Network connectivity (DNS, internet)
- 🏥 Application health endpoints
- 🗄️ Database connectivity (PostgreSQL, Redis)

**Output formats:**
- Standard: Human-readable with color coding
- Detailed: Includes all check details
- JSON: Machine-readable for monitoring integration

## Prerequisites

### Environment Setup
```bash
# Load Tetra environment
source ~/tetra/tetra.sh

# Verify TKM is available
tkm info
```

### SSH Access
Ensure SSH key-based authentication is configured:
```bash
# Test SSH connectivity
ssh staging@staging.pixeljam.com "echo 'SSH OK'"
ssh prod@prod.pixeljam.com "echo 'SSH OK'"
```

### Required Permissions
- SSH access to target servers
- `sudo` privileges for service management
- Git repository access

## Environment Configuration

### Host Mappings
```bash
dev      -> dev@dev.pixeljamarcade.com
staging  -> staging@staging.pixeljam.com  
prod     -> prod@prod.pixeljam.com
local    -> localhost
```

### Service Mappings
```bash
arcade-dev      -> arcade-dev.service
arcade-staging  -> arcade-staging.service
arcade-prod     -> arcade-prod.service
nginx           -> nginx
postgresql      -> postgresql
redis           -> redis-server
```

## Usage Patterns

### Complete Deployment Workflow
```bash
# 1. Deploy to staging (assumes SSH access is configured)
./deploy-staging.sh

# 2. Verify deployment health
./health-check.sh staging --detailed

# 3. Check service status
./service-manager.sh list staging

# 4. View application logs if needed
./service-manager.sh logs arcade-staging staging 50
```

### Security Maintenance (Separate from Deployment)
```bash
# 1. Rotate SSH keys (monthly - run separately from deployment)
./tkm-rekey.sh all 30

# 2. Verify key deployment
tkm status

# 3. Test connectivity after rekeying
./health-check.sh staging
./health-check.sh prod
```

### Expected Directory Structure
```
project-root/
├── config/
│   ├── nginx/
│   │   └── staging.conf          # Nginx configuration for staging
│   └── systemd/
│       └── arcade-staging.service # Systemd service file
├── env.sh                        # Development environment (or .env)
└── tetra/server/
    ├── deploy-staging.sh         # This deployment script
    ├── tkm-rekey.sh             # Separate SSH key management
    ├── service-manager.sh       # Service control
    └── health-check.sh          # Health monitoring
```

### Monitoring and Troubleshooting
```bash
# Quick health overview
./health-check.sh staging

# Detailed system analysis
./health-check.sh prod --detailed

# Service-specific troubleshooting
./service-manager.sh status arcade-prod prod
./service-manager.sh logs arcade-prod prod 200

# Restart problematic services
./service-manager.sh restart arcade-prod prod
```

## Integration with Monitoring

### JSON Output for Monitoring Systems
```bash
# Generate JSON health reports
./health-check.sh prod --json > /var/log/health-prod.json

# Cron job example (every 5 minutes)
*/5 * * * * /path/to/health-check.sh prod --json >> /var/log/health-monitoring.log
```

### Exit Codes
All scripts follow standard exit code conventions:
- `0` - Success
- `1` - Warning/partial failure
- `2` - Critical error
- `130` - Interrupted by user

## Security Considerations

### SSH Key Management
- Keys are generated with expiration dates
- Old keys are safely archived, not deleted
- Security audits are performed before deployment
- Backup of SSH directory is created before changes

### Service Management
- All service operations require sudo privileges
- Commands are executed with proper error handling
- Remote operations use SSH with timeout settings
- Detailed logging for audit trails

### Network Security
- SSH connections use BatchMode for automation
- Connection timeouts prevent hanging operations
- Health checks validate SSL/TLS endpoints
- DNS resolution is verified before operations

## Troubleshooting

### Common Issues

**SSH Connection Failures:**
```bash
# Check SSH key authentication
ssh -v staging@staging.pixeljam.com

# Verify SSH agent
ssh-add -l

# Test with specific key
ssh -i ~/.ssh/specific_key staging@staging.pixeljam.com
```

**Service Start Failures:**
```bash
# Check service logs
./service-manager.sh logs arcade-staging staging 100

# Verify service configuration
./service-manager.sh status arcade-staging staging

# Check system resources
./health-check.sh staging --detailed
```

**Deployment Failures:**
```bash
# Check git status
git status

# Verify SSH connectivity
ssh staging@staging.pixeljam.com "echo 'SSH OK'"

# Check disk space on target
ssh staging@staging.pixeljam.com "df -h"

# Review deployment logs
tail -f /tmp/deployment_report_*.txt
```

## Script Customization

### Environment Variables
```bash
# Override default settings
export TETRA_DIR="/custom/tetra/path"
export TKM_AUTO_INIT=true
export DEPLOYMENT_TIMEOUT=300
```

### Custom Service Definitions
Edit the service arrays in each script:
```bash
# In service-manager.sh
declare -A SERVICES=(
    ["custom-service"]="my-custom.service"
    # ... existing services
)
```

### Custom Health Checks
Add custom checks to `health-check.sh`:
```bash
# Custom application-specific checks
check_custom_application() {
    # Your custom health check logic
}
```

## Contributing

When adding new scripts or modifying existing ones:

1. Follow the established error handling patterns
2. Use consistent logging and color coding
3. Include comprehensive help text
4. Add appropriate exit codes
5. Test on all target environments
6. Update this README with new functionality

## Support

For issues or questions:
- Check script help: `./script-name.sh --help`
- Review Tetra documentation
- Examine log files in `/tmp/` and system logs
- Test individual components before full deployment
