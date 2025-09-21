#!/usr/bin/env bash

# PixelJam Arcade Staging Entrypoint
# Environment: staging@staging.pixeljam.com
# Purpose: Production-ready staging environment startup

set -euo pipefail

# Environment Configuration
export NODE_ENV=production
export PORT=4443
export TETRA_PORT=${TETRA_PORT:-$PORT}
export TETRA_ENV=staging

# Staging-specific paths
export TETRA_DIR=${TETRA_DIR:-/home/staging/tetra}
export TETRA_SRC=${TETRA_SRC:-/home/staging/src/pixeljam/pja/arcade/tetra}
export APP_DIR=${APP_DIR:-/home/staging/src/pixeljam/pja/arcade}
export PD_DIR=${PD_DIR:-/home/staging/pj/pd}

# Node.js Configuration
export NVM_DIR=${NVM_DIR:-/home/staging/.nvm}
export NODE_OPTIONS="--max-old-space-size=2048"

# Logging Configuration
export LOG_LEVEL=${LOG_LEVEL:-info}
export LOG_FORMAT=${LOG_FORMAT:-json}

# Security Configuration
export DISABLE_DEBUG=true
export ENABLE_SECURITY_HEADERS=true

# Performance Configuration
export CLUSTER_MODE=${CLUSTER_MODE:-false}
export KEEP_ALIVE_TIMEOUT=65000
export HEADERS_TIMEOUT=66000

# Colors for logging
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging function
log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date "+%Y-%m-%d %H:%M:%S")
    
    case "$level" in
        INFO)  echo -e "${GREEN}[STAGING-INFO]${NC}  $timestamp: $message" ;;
        WARN)  echo -e "${YELLOW}[STAGING-WARN]${NC}  $timestamp: $message" ;;
        ERROR) echo -e "${RED}[STAGING-ERROR]${NC} $timestamp: $message" ;;
        DEBUG) echo -e "${BLUE}[STAGING-DEBUG]${NC} $timestamp: $message" ;;
        *)     echo "[STAGING] $timestamp: $message" ;;
    esac
}

# Error handler
error_exit() {
    log "ERROR" "$1"
    exit 1
}

# Validate PD_DIR and required CSV files
validate_pd_dir() {
    log "INFO" "📁 Validating PD_DIR structure..."
    
    # Check if PD_DIR is set
    if [[ -z "$PD_DIR" ]]; then
        error_exit "PD_DIR environment variable must be set for staging"
    fi
    
    # Check if PD_DIR exists
    if [[ ! -d "$PD_DIR" ]]; then
        error_exit "PD_DIR directory not found: $PD_DIR"
    fi
    
    # Check required CSV files
    local required_files=("users.csv" "roles.csv")
    local optional_files=("capabilities.csv")
    local missing_required=()
    
    for file in "${required_files[@]}"; do
        local file_path="$PD_DIR/$file"
        if [[ ! -f "$file_path" ]]; then
            missing_required+=("$file")
            log "ERROR" "❌ Required CSV file missing: $file_path"
        else
            log "INFO" "✅ Found required file: $file_path"
            
            # Validate file is not empty
            if [[ ! -s "$file_path" ]]; then
                log "WARN" "⚠️ Required file is empty: $file_path"
            fi
        fi
    done
    
    # Check optional files
    for file in "${optional_files[@]}"; do
        local file_path="$PD_DIR/$file"
        if [[ -f "$file_path" ]]; then
            log "INFO" "✅ Found optional file: $file_path"
        else
            log "DEBUG" "ℹ️ Optional file not found: $file_path (this is OK)"
        fi
    done
    
    # Fail if any required files are missing
    if [[ ${#missing_required[@]} -gt 0 ]]; then
        error_exit "Missing required CSV files in staging: ${missing_required[*]}. Please deploy these files before starting the server."
    fi
    
    log "INFO" "✅ PD_DIR validation completed"
    log "DEBUG" "PD_DIR location: $PD_DIR"
}

# Pre-flight checks
preflight_checks() {
    log "INFO" "🔍 Running staging pre-flight checks..."
    
    # Check required directories
    local required_dirs=("$TETRA_DIR" "$TETRA_SRC" "$APP_DIR")
    for dir in "${required_dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            error_exit "Required directory not found: $dir"
        fi
    done
    
    # Check PD_DIR and required CSV files
    validate_pd_dir
    
    # Check Node.js availability
    if [[ -f "$NVM_DIR/nvm.sh" ]]; then
        source "$NVM_DIR/nvm.sh"
        log "INFO" "✅ NVM loaded from $NVM_DIR"
    else
        log "WARN" "⚠️ NVM not found at $NVM_DIR, using system Node.js"
    fi
    
    # Verify Node.js version
    if ! command -v node >/dev/null 2>&1; then
        error_exit "Node.js not found in PATH"
    fi
    
    local node_version=$(node --version)
    log "INFO" "📦 Node.js version: $node_version"
    
    # Check if application files exist
    if [[ ! -f "server.js" ]]; then
        error_exit "server.js not found in current directory"
    fi
    
    # Check environment file
    if [[ -f ".env" ]]; then
        log "INFO" "📄 Environment file loaded: .env"
        # Source environment file if it exists
        set -a
        source .env
        set +a
    else
        log "WARN" "⚠️ No .env file found, using defaults"
    fi
    
    # Check port availability
    if netstat -tuln 2>/dev/null | grep -q ":$PORT "; then
        log "WARN" "⚠️ Port $PORT is already in use"
    else
        log "INFO" "✅ Port $PORT is available"
    fi
    
    log "INFO" "✅ Pre-flight checks completed"
}

# Setup staging environment
setup_environment() {
    log "INFO" "🔧 Setting up staging environment..."
    
    # Change to application directory
    cd "$APP_DIR" || error_exit "Failed to change to application directory: $APP_DIR"
    
    # Load Tetra environment if available
    if [[ -f "$TETRA_SRC/bash/bootloader.sh" ]]; then
        source "$TETRA_SRC/bash/bootloader.sh"
        log "INFO" "✅ Tetra environment loaded"
    else
        log "WARN" "⚠️ Tetra bootloader not found, continuing without Tetra"
    fi
    
    # Set process title
    export PROCESS_TITLE="pixeljam-arcade-staging"
    
    log "INFO" "✅ Environment setup completed"
}

# Health check function
health_check() {
    log "INFO" "🏥 Performing health check..."
    
    # Check if server responds
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -f "http://localhost:$PORT/health" >/dev/null 2>&1; then
            log "INFO" "✅ Health check passed (attempt $attempt)"
            return 0
        fi
        
        log "DEBUG" "Health check attempt $attempt/$max_attempts failed, retrying..."
        sleep 2
        ((attempt++))
    done
    
    log "ERROR" "❌ Health check failed after $max_attempts attempts"
    return 1
}

# Signal handlers
cleanup() {
    log "INFO" "🧹 Cleaning up staging environment..."
    # Add any cleanup logic here
    exit 0
}

# Trap signals
trap cleanup SIGTERM SIGINT

# Main execution
main() {
    log "INFO" "🚀 Starting PixelJam Arcade Staging Server..."
    log "INFO" "Environment: $NODE_ENV"
    log "INFO" "Port: $PORT"
    log "INFO" "Working Directory: $(pwd)"
    
    # Run checks and setup
    preflight_checks
    setup_environment
    
    # Start the server
    log "INFO" "🌟 Launching Node.js server..."
    
    # Use exec to replace the shell process with Node.js
    # This ensures proper signal handling
    exec node server.js
}

# Handle script execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
