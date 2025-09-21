# Complete Tetra System Use Case: NH → tetra.toml → TSM Workflow

## The Tetra Way: Single Source of Truth Configuration Management

This guide demonstrates the complete Tetra ecosystem workflow from infrastructure discovery through deployment using `tetra.toml` as the single source of truth.

## 1. Initial Setup: Loading NH Organization Context

```bash
# Start fresh terminal session
cd ~/src/devops/tetra

# Load the Tetra environment (auto-loads modules: utils,prompt,tmod,tsm,nvm,python,node,deploy,rag)
source ~/.profile

# Load project context for PixelJam Arcade infrastructure
pj  # Activates pixeljam-arcade context from ~/nh/pixeljam-arcade/

# Verify infrastructure variables are loaded
echo "Development: $pad"    # pxjam-arcade-dev01  → 137.184.226.163
echo "QA/Staging: $paq"     # pxjam-arcade-qa01   → 146.190.151.245
echo "Production: $pap"     # pxjam-arcade-prod01 → 64.23.151.249
echo "Prod Float: $papf"    # Production floating IP
```

## 2. Infrastructure Sync: NH → tetra.toml

```bash
# Sync NH infrastructure data to tetra.toml
tetra env toml sync
# 🔄 Syncing NH infrastructure data to tetra.toml...
# 📍 NH Context: pixeljam-arcade
# 📁 NH Data: /Users/mricos/nh/pixeljam-arcade/digocean.env
#
# 🔍 Extracting infrastructure data from NH...
# ✅ Infrastructure data synced successfully
#
# 📋 Updated infrastructure section:
#   qa_server = "pxjam-arcade-qa01"
#   qa_ip = "146.190.151.245"
#   qa_private_ip = "10.124.0.2"
#   qa_floating_ip = "24.199.72.22"
#   dev_server = "pxjam-arcade-dev01"
#   dev_ip = "137.184.226.163"
#   dev_private_ip = "10.124.0.4"
#   prod_server = "pxjam-arcade-prod01"
#   prod_ip = "64.23.151.249"
#   prod_private_ip = "10.124.0.3"
#   prod_floating_ip = "164.90.247.44"

# Validate the updated TOML structure
tetra env toml validate
# 🔍 Validating tetra.toml structure...
# ✓ Found variable references
# ✅ tetra.toml validation passed

# Show specific sections
tetra env toml show infrastructure
# 📋 [infrastructure] section:
#   qa_server = "pxjam-arcade-qa01"
#   qa_ip = "146.190.151.245"
#   qa_private_ip = "10.124.0.2"
#   ...

tetra env toml show variables
# 📋 [variables] section:
#   domain_base = "pixeljamarcade.com"
#   default_port = 8000
#   spaces_region = "sfo3"
#   ...
```

## 3. Secret Management: Environment Variables for Security

```bash
# Set up secrets via environment variables (never committed to git)
export DEV_SPACES_BUCKET="pxjam-dev-bucket"
export DEV_SPACES_ACCESS_KEY="DO00ABC123..."
export DEV_SPACES_SECRET_KEY="LRrH456..."

export STAGING_SPACES_BUCKET="pxjam-staging-bucket"
export STAGING_SPACES_ACCESS_KEY="DO00DEF789..."
export STAGING_SPACES_SECRET_KEY="LRrH012..."

export PROD_SPACES_BUCKET="pxjam-prod-bucket"
export PROD_SPACES_ACCESS_KEY="DO00GHI345..."
export PROD_SPACES_SECRET_KEY="LRrH678..."

export LOCAL_SPACES_BUCKET="pxjam-local-bucket"
export LOCAL_SPACES_ACCESS_KEY="DO00JKL901..."
export LOCAL_SPACES_SECRET_KEY="LRrH234..."
```

## 4. Environment Generation: tetra.toml → env/*.env Files

```bash
# Generate development environment with variable resolution and secret injection
tetra env init dev
# 🔧 Using tetra.toml for environment generation
# 🎯 Target: env/dev.env
#
# 🔄 Generating env/dev.env from tetra.toml...
# ✓ Injected secret from $DEV_SPACES_BUCKET
# ✓ Injected secret from $DEV_SPACES_ACCESS_KEY
# ✓ Injected secret from $DEV_SPACES_SECRET_KEY
# ✅ Created env/dev.env from tetra.toml
#
# 📋 Generated variables:
#   NODE_ENV="development"
#   TETRA_ENV="dev"
#   PORT="8000"
#   SERVER_IP="137.184.226.163"
#   SERVER_PRIVATE_IP="10.124.0.4"
#   DOMAIN_NAME="dev.pixeljamarcade.com"
#   PD_DIR="/home/dev/pj/pd"
#   SPACES_BUCKET="pxjam-dev-bucket"
#   SPACES_ACCESS_KEY="DO00ABC123..."
#   SPACES_SECRET_KEY="LRrH456..."
#   SPACES_ENDPOINT="sfo3.digitaloceanspaces.com"
#
# ✅ All secrets resolved successfully

# Generate staging environment
tetra env init staging
# Similar output with staging-specific values and secrets

# Generate production environment
tetra env init prod
# Similar output with production-specific values and secrets

# Generate local development environment
tetra env init local
# Similar output with local-specific values and secrets

# Check what was generated
ls -la env/
# -rw-r--r--  1 user  staff   724 Sep 20 15:25 dev.env.tmpl
# -rw-r--r--  1 user  staff   603 Sep 20 15:24 local.env.tmpl
# -rw-r--r--  1 user  staff   704 Sep 20 15:24 prod.env.tmpl
# -rw-r--r--  1 user  staff   700 Sep 20 15:24 staging.env.tmpl
# -rw-------  1 user  staff   892 Sep 20 16:42 dev.env         # Generated, git-ignored
# -rw-------  1 user  staff   901 Sep 20 16:43 staging.env     # Generated, git-ignored
# -rw-------  1 user  staff   887 Sep 20 16:44 prod.env        # Generated, git-ignored
# -rw-------  1 user  staff   845 Sep 20 16:45 local.env       # Generated, git-ignored
```

## 5. Firewall Configuration: UFW Management from tetra.toml

```bash
# Show UFW rules defined in tetra.toml for all environments
tetra env toml ufw show
# 🔥 UFW rules defined in tetra.toml:
#
# [dev]:
#   ufw allow 22/tcp
#   ufw allow 8000/tcp
#   ufw allow 80/tcp
#   ufw allow 443/tcp
#
# [staging]:
#   ufw allow 22/tcp
#   ufw allow 8000/tcp
#   ufw allow 80/tcp
#   ufw allow 443/tcp
#
# [prod]:
#   ufw allow 22/tcp
#   ufw allow 8000/tcp
#   ufw allow 80/tcp
#   ufw allow 443/tcp

# Show UFW rules for specific environment
tetra env toml ufw show dev
# 🔥 UFW rules for [dev]:
#   ufw allow 22/tcp
#   ufw allow 8000/tcp
#   ufw allow 80/tcp
#   ufw allow 443/tcp

# Apply UFW rules to development server (when SSHed into $pad)
ssh root@$pad
tetra env toml ufw apply dev
# 🔥 Applying UFW rules for [dev]...
#
# 📋 Rules to apply:
#   ufw allow 22/tcp
#   ufw allow 8000/tcp
#   ufw allow 80/tcp
#   ufw allow 443/tcp
#
# Apply these UFW rules? (y/N): y
# 🔄 Applying rules...
# ✅ Applied: ufw allow 22/tcp
# ✅ Applied: ufw allow 8000/tcp
# ✅ Applied: ufw allow 80/tcp
# ✅ Applied: ufw allow 443/tcp
#
# 📊 Summary:
#   Applied: 4 rules
#   Failed: 0 rules
```

## 6. Local Service Management: TSM with Generated Environment Files

```bash
# Check available registered services
tsm services
# Available Services:
# Name          Type  Port  Description
# ----          ----  ----  -----------
# tetra         node  4444  Tetra main server
# devpages      node  4000  DevPages CLI server
# webserver     bash  8888  Simple Python web server

# Start tetra main server using generated development environment
tsm start --env env/dev.env tetra
# TSM[0] Starting tetra with env/dev.env
# tetra-4444 started successfully

# Create a custom Node.js application
cat > server.js << 'EOF'
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({
    message: 'Hello from Tetra!',
    environment: process.env.NODE_ENV,
    tetra_env: process.env.TETRA_ENV,
    server_ip: process.env.SERVER_IP,
    domain: process.env.DOMAIN_NAME,
    port: PORT,
    spaces_bucket: process.env.SPACES_BUCKET
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
  console.log(`Domain: ${process.env.DOMAIN_NAME}`);
  console.log(`Server IP: ${process.env.SERVER_IP}`);
});
EOF

# Start the custom server using generated development environment
tsm start --env env/dev.env node server.js myapp
# TSM[1] Starting node server.js as myapp with env/dev.env
# myapp-8000 started successfully

# Test multi-environment setup - start staging version
tsm start --env env/staging.env node server.js myapp-staging
# TSM[2] Starting node server.js as myapp-staging with env/staging.env
# myapp-staging-8001 started successfully

# Check running processes
tsm list
# TSM ID  Name              PID    Port  Status  Uptime
# ------  ----              ---    ----  ------  ------
# 0       tetra-4444        12345  4444  Running 3m 15s
# 1       myapp-8000        12346  8000  Running 2m 45s
# 2       myapp-staging-8001 12347  8001  Running 1m 30s
```

## 7. Application Testing: Multi-Environment Verification

```bash
# Test the development application
curl http://localhost:8000
# {
#   "message": "Hello from Tetra!",
#   "environment": "development",
#   "tetra_env": "dev",
#   "server_ip": "137.184.226.163",
#   "domain": "dev.pixeljamarcade.com",
#   "port": "8000",
#   "spaces_bucket": "pxjam-dev-bucket"
# }

# Test the staging application
curl http://localhost:8001
# {
#   "message": "Hello from Tetra!",
#   "environment": "staging",
#   "tetra_env": "staging",
#   "server_ip": "146.190.151.245",
#   "domain": "staging.pixeljamarcade.com",
#   "port": "8001",
#   "spaces_bucket": "pxjam-staging-bucket"
# }

# Check application health
curl http://localhost:8000/health
# {"status":"healthy","timestamp":"2024-09-20T23:45:32.123Z"}

# View application logs
tsm logs 1
# Last 50 lines from myapp-8000:
# Server running on port 8000 in development mode
# Domain: dev.pixeljamarcade.com
# Server IP: 137.184.226.163
# GET / 200 - - 15.234 ms
# GET /health 200 - - 2.156 ms

# Check environment variables for the service
tsm env 1
# Environment variables for myapp-8000:
# NODE_ENV=development
# TETRA_ENV=dev
# PORT=8000
# SERVER_IP=137.184.226.163
# SERVER_PRIVATE_IP=10.124.0.4
# DOMAIN_NAME=dev.pixeljamarcade.com
# PD_DIR=/home/dev/pj/pd
# SPACES_BUCKET=pxjam-dev-bucket
# SPACES_ACCESS_KEY=DO00ABC123...
# SPACES_SECRET_KEY=LRrH456...
# SPACES_ENDPOINT=sfo3.digitaloceanspaces.com
```

## 8. Remote Deployment: Infrastructure Integration

```bash
# Package application for remote deployment
tar czf myapp.tar.gz server.js package.json

# Deploy to development server using NH variables and tetra.toml configuration
scp myapp.tar.gz root@$pad:/tmp/
ssh root@$pad

# On development server - sync tetra.toml and generate environment
cd /opt/tetra
scp user@local:/path/to/tetra.toml .
tetra env init dev  # Uses server's environment variables for secrets
tsm start --env env/dev.env node /tmp/myapp/server.js production-app

# Deploy to staging server using NH variables
scp myapp.tar.gz root@$paq:/opt/staging/
ssh root@$paq
# Similar process with staging environment

# Deploy to production server using floating IP for reliability
scp myapp.tar.gz root@$papf:/opt/production/
ssh root@$papf
# Similar process with production environment

# View infrastructure summary
echo "=== Infrastructure Endpoints (from tetra.toml) ==="
tetra env toml show infrastructure
# 📋 [infrastructure] section:
#   qa_server = "pxjam-arcade-qa01"
#   qa_ip = "146.190.151.245"
#   qa_private_ip = "10.124.0.2"
#   qa_floating_ip = "24.199.72.22"
#   dev_server = "pxjam-arcade-dev01"
#   dev_ip = "137.184.226.163"
#   dev_private_ip = "10.124.0.4"
#   prod_server = "pxjam-arcade-prod01"
#   prod_ip = "64.23.151.249"
#   prod_private_ip = "10.124.0.3"
#   prod_floating_ip = "164.90.247.44"
```

## 9. Production Service Management: Nginx & Systemd

```bash
# On production server - install nginx configuration using tetra.toml values
tsm nginx generate pixeljamarcade.com /tmp/tetra-nginx.conf
# Generating nginx configuration for domain: pixeljamarcade.com
# Nginx configuration generated: /tmp/tetra-nginx.conf

tsm nginx install pixeljamarcade.com
# Installing nginx configuration...
# Configuration installed: /etc/nginx/sites-available/tetra.conf
# Site enabled: /etc/nginx/sites-enabled/tetra.conf
# Nginx configuration test passed
# Nginx reloaded successfully
# Tetra nginx configuration installed successfully!
# Tetra should now be accessible at: https://pixeljamarcade.com

# Install systemd service for production
tsm systemd install production
# Installing tetra systemd service for production environment...
# Service file installed: /etc/systemd/system/tetra.service
# Systemd daemon reloaded
# Tetra service enabled for boot
# Tetra systemd service installed successfully!

# Check nginx and systemd status
tsm nginx status
# === Tetra Nginx Configuration Status ===
# Configuration: INSTALLED (/etc/nginx/sites-available/tetra.conf)
# Site: ENABLED (/etc/nginx/sites-enabled/tetra.conf)
# Nginx: RUNNING

tsm systemd status
# === Tetra Systemd Service Status ===
# Status: ACTIVE
# Boot: ENABLED
```

## 10. Complete Environment Management

```bash
# Show all sections of tetra.toml
tetra env toml show
# 📋 tetra.toml sections:
#   infrastructure
#   variables
#   environments.local
#   environments.dev
#   environments.staging
#   environments.prod
#   deployment

# Validate complete configuration
tetra env toml validate
# 🔍 Validating tetra.toml structure...
# ✓ Found variable references
# ✅ tetra.toml validation passed

# List all generated environment files
tetra env list
# 📋 Environment Templates (safe to commit):
#   📄 env/dev.env.tmpl → dev environment
#   📄 env/staging.env.tmpl → staging environment
#   📄 env/prod.env.tmpl → prod environment
#   📄 env/local.env.tmpl → local environment
# 🔒 Local Environment Files (never committed):
#   🔑 env/dev.env (secrets for dev)
#   🔑 env/staging.env (secrets for staging)
#   🔑 env/prod.env (secrets for prod)
#   🔑 env/local.env (secrets for local)

# Stop all local services
tsm stop "*"
# Stopping all TSM processes...
# TSM[0] tetra-4444 stopped
# TSM[1] myapp-8000 stopped
# TSM[2] myapp-staging-8001 stopped
```

## Key Benefits Demonstrated

1. **Single Source of Truth**: `tetra.toml` centralizes all configuration across environments
2. **Infrastructure Integration**: Automatic sync from NH discovery to TOML configuration
3. **Terraform-Style Variables**: `${variables.*}` and `${infrastructure.*}` resolution
4. **Secure Secret Management**: Environment variable injection, never committed secrets
5. **Multi-Environment Support**: Consistent configuration across local/dev/staging/prod
6. **Firewall Management**: UFW rules defined in TOML and applied per environment
7. **Service Integration**: TSM, Nginx, and Systemd all use generated environment files
8. **Developer Experience**: Simple commands hide complexity while maintaining power

## Complete Command Reference

```bash
# Infrastructure Management
pj                                    # Load NH context
tetra env toml sync                   # Sync NH → tetra.toml
tetra env toml show infrastructure    # View infrastructure data

# Environment Generation
tetra env init dev                    # Generate env/dev.env from tetra.toml
tetra env init staging               # Generate env/staging.env from tetra.toml
tetra env init prod                  # Generate env/prod.env from tetra.toml

# Service Management
tsm start --env env/dev.env server.js           # Start with development config
tsm start --env env/staging.env server.js       # Start with staging config
tsm list                                        # Show running services
tsm logs 0 -f                                  # Follow service logs

# Firewall Management
tetra env toml ufw show dev          # Show firewall rules for dev
tetra env toml ufw apply prod        # Apply production firewall rules

# Validation & Status
tetra env toml validate              # Validate TOML structure
tetra env list                       # Show all environment files
tsm ports                           # Show port mappings
```

This workflow demonstrates the complete Tetra ecosystem: from infrastructure discovery through NH, centralized configuration in `tetra.toml`, secure environment generation, local service management via TSM, firewall configuration, and deployment to remote infrastructure using consistent semantic abstractions.