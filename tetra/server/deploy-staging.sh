#!/bin/bash

# Tetra Deploy to Staging - Complete deployment script
# Usage: ./deploy-staging.sh [branch] [force]
# Example: ./deploy-staging.sh main force

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TETRA_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Load Tetra environment
source "$TETRA_ROOT/bash/bootloader.sh" 2>/dev/null || {
    echo "❌ Failed to load Tetra environment"
    exit 1
}

# Default values
BRANCH="${1:-main}"
FORCE_MODE="${2:-false}"
STAGING_HOST="staging@staging.pixeljam.com"
STAGING_PATH="/home/staging/src/pixeljam/pja/arcade"
SERVICES=("arcade-staging.service")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date "+%Y-%m-%d %H:%M:%S")
    
    case "$level" in
        INFO)  echo -e "${GREEN}[INFO]${NC}  $timestamp: $message" ;;
        WARN)  echo -e "${YELLOW}[WARN]${NC}  $timestamp: $message" ;;
        ERROR) echo -e "${RED}[ERROR]${NC} $timestamp: $message" ;;
        DEBUG) echo -e "${BLUE}[DEBUG]${NC} $timestamp: $message" ;;
        *)     echo "$timestamp: $message" ;;
    esac
}

# Error handler
error_exit() {
    log "ERROR" "$1"
    exit 1
}

# Check prerequisites
check_prerequisites() {
    log "INFO" "🔍 Checking deployment prerequisites..."
    
    # Check if we're in the right directory
    if [[ ! -f "$PROJECT_ROOT/package.json" ]]; then
        error_exit "Not in project root directory. Expected package.json at $PROJECT_ROOT"
    fi
    
    # Check SSH connectivity (prerequisite - should already be configured)
    log "DEBUG" "Testing SSH connectivity to $STAGING_HOST..."
    if ! ssh -o ConnectTimeout=10 -o BatchMode=yes "$STAGING_HOST" "echo 'SSH OK'" >/dev/null 2>&1; then
        error_exit "❌ Cannot connect to $STAGING_HOST. 
        
Prerequisites not met:
• SSH key-based authentication must be configured
• Run: ssh-copy-id $STAGING_HOST (or use TKM for key management)
• Test: ssh $STAGING_HOST 'echo SSH OK'
• For key rotation, use: ./tkm-rekey.sh staging"
    fi
    
    # Check git status
    if [[ -n "$(git status --porcelain)" && "$FORCE_MODE" != "force" ]]; then
        error_exit "Working directory is not clean. Commit changes or use 'force' parameter."
    fi
    
        # Check if staging server has required directories
        log "DEBUG" "Verifying staging server setup..."
        ssh "$STAGING_HOST" "
            mkdir -p '$STAGING_PATH' &&
            mkdir -p /tmp &&
            mkdir -p /home/staging/pj/pd &&
            sudo mkdir -p /etc/nginx/sites-enabled /etc/systemd/system
        " || error_exit "Failed to verify/create required directories on staging server"
    
    log "INFO" "✅ Prerequisites check passed"
}

# Backup current deployment
backup_deployment() {
    log "INFO" "📁 Creating deployment backup..."
    
    local backup_name="backup_$(date +%Y%m%d_%H%M%S)"
    
    ssh "$STAGING_HOST" "
        cd '$STAGING_PATH' && 
        cp .env .env.$backup_name 2>/dev/null || true &&
        echo 'Backup created: .env.$backup_name'
    " || log "WARN" "Backup creation failed (may not exist yet)"
}

# Sync code to staging
sync_code() {
    log "INFO" "📥 Synchronizing code to staging..."
    
    # Local git operations
    log "DEBUG" "Fetching latest changes..."
    git fetch --all --prune
    
    log "DEBUG" "Checking out branch: $BRANCH"
    git checkout "$BRANCH"
    git reset --hard "origin/$BRANCH"
    
    # Update staging branch
    log "DEBUG" "Updating staging branch..."
    git checkout staging 2>/dev/null || git checkout -b staging
    git reset --hard "$BRANCH"
    git push origin staging --force
    
    # Pull on staging server
    log "DEBUG" "Pulling code on staging server..."
    ssh "$STAGING_HOST" "
        cd '$STAGING_PATH' &&
        git fetch --all --prune &&
        git checkout staging &&
        git reset --hard origin/staging
    "
    
    # Return to original branch
    git checkout "$BRANCH"
    
    log "INFO" "✅ Code synchronization complete"
}

# Generate and upload environment files
setup_environment() {
    log "INFO" "🔧 Setting up staging environment files..."
    
    local temp_env="/tmp/staging.env.$$"
    
    # Generate staging.env from dev environment
    if [[ -f "$PROJECT_ROOT/env.sh" ]]; then
        log "DEBUG" "Generating staging.env from env.sh..."
        cp "$PROJECT_ROOT/env.sh" "$temp_env"
        
        # Replace dev-specific values with staging values
        sed -i 's/dev\.pixeljamarcade\.com/staging.pixeljam.com/g' "$temp_env"
        sed -i 's/NODE_ENV=development/NODE_ENV=production/g' "$temp_env"
        sed -i 's/PORT=3000/PORT=3000/g' "$temp_env"
        sed -i 's/DEBUG=true/DEBUG=false/g' "$temp_env"
        
    elif [[ -f "$PROJECT_ROOT/.env" ]]; then
        log "DEBUG" "Generating staging.env from .env..."
        cp "$PROJECT_ROOT/.env" "$temp_env"
        
        # Replace dev-specific values
        sed -i 's/dev\.pixeljamarcade\.com/staging.pixeljam.com/g' "$temp_env"
        sed -i 's/NODE_ENV=development/NODE_ENV=production/g' "$temp_env"
        sed -i 's/DEBUG=true/DEBUG=false/g' "$temp_env"
        
    else
        log "WARN" "No environment file found. Creating minimal staging.env..."
        cat > "$temp_env" <<EOF
NODE_ENV=production
PORT=3000
HOST=staging.pixeljam.com
DEBUG=false
EOF
    fi
    
    # Upload environment file
    log "DEBUG" "Uploading environment configuration to $STAGING_PATH/.env..."
    scp "$temp_env" "$STAGING_HOST:$STAGING_PATH/.env"
    
    # Cleanup local temp file
    rm -f "$temp_env"
    
    log "INFO" "✅ Environment file deployed"
}

# Validate configurations before deployment
validate_configs() {
    log "INFO" "🔍 Validating configuration files..."
    
    local validator_script="$SCRIPT_DIR/nginx-validator.sh"
    
    if [[ -f "$validator_script" ]]; then
        log "DEBUG" "Running nginx configuration validator..."
        
        # Run validator with human-in-the-loop
        if "$validator_script" staging; then
            log "INFO" "✅ Configuration validation passed"
        else
            local exit_code=$?
            if [[ $exit_code -eq 1 ]]; then
                log "WARN" "⚠️ Configuration validation warnings detected"
                read -p "Continue with deployment despite warnings? (y/N): " continue_response
                if [[ ! "$continue_response" =~ ^[Yy]$ ]]; then
                    error_exit "Deployment cancelled due to configuration warnings"
                fi
            else
                error_exit "Configuration validation failed. Fix issues before deployment."
            fi
        fi
    else
        log "WARN" "Configuration validator not found at $validator_script"
        log "INFO" "Proceeding without validation..."
    fi
}

# Deploy configuration files (nginx, systemd)
deploy_configs() {
    log "INFO" "📋 Deploying configuration files..."
    
    # Deploy nginx configuration if it exists
    local nginx_config="$PROJECT_ROOT/config/nginx/staging.conf"
    if [[ -f "$nginx_config" ]]; then
        log "DEBUG" "Deploying nginx configuration..."
        
        # Backup existing nginx config
        ssh "$STAGING_HOST" "sudo cp /etc/nginx/sites-enabled/staging.conf /etc/nginx/sites-enabled/staging.conf.backup.\$(date +%Y%m%d_%H%M%S) 2>/dev/null || true"
        
        # Upload new nginx config
        scp "$nginx_config" "$STAGING_HOST:/tmp/staging.conf"
        ssh "$STAGING_HOST" "sudo mv /tmp/staging.conf /etc/nginx/sites-enabled/staging.conf && sudo chown root:root /etc/nginx/sites-enabled/staging.conf"
        
        # Test nginx configuration on remote server
        log "DEBUG" "Testing nginx configuration on staging server..."
        if ssh "$STAGING_HOST" "sudo nginx -t"; then
            log "INFO" "✅ Nginx configuration deployed and validated on server"
        else
            log "ERROR" "❌ Nginx configuration validation failed on server"
            log "INFO" "Restoring backup configuration..."
            ssh "$STAGING_HOST" "sudo cp /etc/nginx/sites-enabled/staging.conf.backup.* /etc/nginx/sites-enabled/staging.conf 2>/dev/null || true"
            return 1
        fi
    else
        log "DEBUG" "No nginx config found at $nginx_config, skipping..."
    fi
    
    # Deploy systemd service file if it exists
    local systemd_service="$PROJECT_ROOT/config/systemd/arcade-staging.service"
    if [[ -f "$systemd_service" ]]; then
        log "DEBUG" "Deploying systemd service configuration..."
        
        # Upload systemd service file
        scp "$systemd_service" "$STAGING_HOST:/tmp/arcade-staging.service"
        ssh "$STAGING_HOST" "
            sudo mv /tmp/arcade-staging.service /etc/systemd/system/arcade-staging.service &&
            sudo chown root:root /etc/systemd/system/arcade-staging.service &&
            sudo chmod 644 /etc/systemd/system/arcade-staging.service &&
            sudo systemctl daemon-reload
        "
        
        log "INFO" "✅ Systemd service configuration deployed"
    else
        log "DEBUG" "No systemd service found at $systemd_service, skipping..."
    fi
    
    log "INFO" "✅ Configuration deployment complete"
}

# Deploy PD_DIR files (users.csv, roles.csv, capabilities.csv)
deploy_pd_files() {
    log "INFO" "📁 Deploying PD_DIR files..."
    
    local local_pd_dir="${PD_DIR:-/home/dev/pj/pd}"
    local staging_pd_dir="/home/staging/pj/pd"
    
    # Check if local PD_DIR exists
    if [[ ! -d "$local_pd_dir" ]]; then
        log "WARN" "⚠️ Local PD_DIR not found: $local_pd_dir"
        log "INFO" "Skipping PD_DIR deployment..."
        return 0
    fi
    
    # Required files
    local required_files=("users.csv" "roles.csv")
    local optional_files=("capabilities.csv")
    local deployed_files=()
    
    # Deploy required files
    for file in "${required_files[@]}"; do
        local local_file="$local_pd_dir/$file"
        if [[ -f "$local_file" ]]; then
            log "DEBUG" "Deploying required file: $file"
            
            # Backup existing file on staging
            ssh "$STAGING_HOST" "
                if [[ -f '$staging_pd_dir/$file' ]]; then
                    cp '$staging_pd_dir/$file' '$staging_pd_dir/$file.backup.\$(date +%Y%m%d_%H%M%S)'
                fi
            "
            
            # Upload new file
            scp "$local_file" "$STAGING_HOST:$staging_pd_dir/$file"
            deployed_files+=("$file")
            log "INFO" "✅ Deployed: $file"
        else
            log "ERROR" "❌ Required PD file missing: $local_file"
            return 1
        fi
    done
    
    # Deploy optional files
    for file in "${optional_files[@]}"; do
        local local_file="$local_pd_dir/$file"
        if [[ -f "$local_file" ]]; then
            log "DEBUG" "Deploying optional file: $file"
            
            # Backup existing file on staging
            ssh "$STAGING_HOST" "
                if [[ -f '$staging_pd_dir/$file' ]]; then
                    cp '$staging_pd_dir/$file' '$staging_pd_dir/$file.backup.\$(date +%Y%m%d_%H%M%S)'
                fi
            "
            
            # Upload new file
            scp "$local_file" "$STAGING_HOST:$staging_pd_dir/$file"
            deployed_files+=("$file")
            log "INFO" "✅ Deployed optional: $file"
        else
            log "DEBUG" "ℹ️ Optional PD file not found: $local_file (skipping)"
        fi
    done
    
    # Set proper permissions on staging
    ssh "$STAGING_HOST" "
        chmod 644 '$staging_pd_dir'/*.csv 2>/dev/null || true
        chown staging:staging '$staging_pd_dir'/*.csv 2>/dev/null || true
    "
    
    log "INFO" "✅ PD_DIR deployment complete (${#deployed_files[@]} files: ${deployed_files[*]})"
}

# Build application
build_application() {
    log "INFO" "🏗️ Building application on staging..."
    
    ssh "$STAGING_HOST" "
        cd '$STAGING_PATH' &&
        echo '🧹 Cleaning old build artifacts...' &&
        rm -rf node_modules build &&
        echo '📦 Installing dependencies...' &&
        npm ci &&
        echo '🏗️ Building application...' &&
        npm run build &&
        echo '✅ Build complete'
    "
    
    log "INFO" "✅ Application build complete"
}

# Restart services
restart_services() {
    log "INFO" "🔄 Restarting services..."
    
    for service in "${SERVICES[@]}"; do
        log "DEBUG" "Restarting service: $service"
        
        ssh "$STAGING_HOST" "
            sudo systemctl restart '$service' &&
            sleep 3 &&
            sudo systemctl status '$service' --no-pager --lines=5
        " || log "WARN" "Service restart may have failed: $service"
    done
    
    # Reload nginx if it exists
    ssh "$STAGING_HOST" "
        if systemctl is-active nginx >/dev/null 2>&1; then
            echo '🌐 Reloading nginx...'
            sudo systemctl reload nginx
        fi
    " || log "WARN" "Nginx reload failed or not installed"
    
    log "INFO" "✅ Service restart complete"
}

# Verify deployment
verify_deployment() {
    log "INFO" "✅ Verifying deployment..."
    
    # Check service status
    for service in "${SERVICES[@]}"; do
        log "DEBUG" "Checking service: $service"
        
        if ssh "$STAGING_HOST" "systemctl is-active '$service' >/dev/null 2>&1"; then
            log "INFO" "✅ Service $service is running"
        else
            log "ERROR" "❌ Service $service is not running"
            return 1
        fi
    done
    
    # Test local connectivity
    log "DEBUG" "Testing local application connectivity..."
    if ssh "$STAGING_HOST" "curl -f http://localhost:3000/health 2>/dev/null || curl -f http://localhost 2>/dev/null"; then
        log "INFO" "✅ Local connectivity test passed"
    else
        log "WARN" "⚠️ Local connectivity test failed"
    fi
    
    # Test external connectivity
    log "DEBUG" "Testing external connectivity..."
    if curl -f "https://staging.pixeljam.com/health" >/dev/null 2>&1; then
        log "INFO" "✅ External connectivity test passed"
    else
        log "WARN" "⚠️ External connectivity test failed"
    fi
    
    log "INFO" "✅ Deployment verification complete"
}

# Generate deployment report
generate_report() {
    log "INFO" "📊 Generating deployment report..."
    
    local report_file="/tmp/deployment_report_$(date +%Y%m%d_%H%M%S).txt"
    
    cat > "$report_file" <<EOF
=== STAGING DEPLOYMENT REPORT ===
Timestamp: $(date)
Branch: $BRANCH
Commit: $(git rev-parse HEAD)
Deployer: $(whoami)@$(hostname)

=== SERVICE STATUS ===
EOF
    
    for service in "${SERVICES[@]}"; do
        echo "Service: $service" >> "$report_file"
        ssh "$STAGING_HOST" "systemctl status '$service' --no-pager --lines=3" >> "$report_file" 2>&1 || true
        echo "" >> "$report_file"
    done
    
    echo "Report saved to: $report_file"
    log "INFO" "✅ Deployment report generated"
}

# Main deployment function
main() {
    echo "🚀 Starting deployment to staging..."
    echo "Branch: $BRANCH"
    echo "Force mode: $FORCE_MODE"
    echo "Target: $STAGING_HOST"
    echo "================================"
    
    check_prerequisites
    backup_deployment
    sync_code
    setup_environment
    validate_configs
    deploy_configs
    deploy_pd_files
    build_application
    restart_services
    verify_deployment
    generate_report
    
    echo ""
    echo "🎉 Deployment completed successfully!"
    echo "✅ Staging environment updated"
    echo "🌐 Check: https://staging.pixeljam.com"
}

# Handle script interruption
trap 'log "ERROR" "Deployment interrupted by user"; exit 130' INT TERM

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
