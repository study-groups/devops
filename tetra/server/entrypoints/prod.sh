#!/usr/bin/env bash

# PixelJam Arcade Production Entrypoint
# Environment: prod@prod.pixeljam.com
# Purpose: High-performance production environment startup

set -euo pipefail

# Production Environment Configuration
export NODE_ENV=production
export PORT=4443
export TETRA_PORT=${TETRA_PORT:-$PORT}
export TETRA_ENV=production

# Production-specific paths
export TETRA_DIR=${TETRA_DIR:-/home/prod/tetra}
export TETRA_SRC=${TETRA_SRC:-/home/prod/src/pixeljam/pja/arcade/tetra}
export APP_DIR=${APP_DIR:-/home/prod/src/pixeljam/pja/arcade}
export PD_DIR=${PD_DIR:-/home/prod/pj/pd}

# Node.js Production Configuration
export NVM_DIR=${NVM_DIR:-/home/prod/.nvm}
export NODE_OPTIONS="--max-old-space-size=4096 --optimize-for-size"

# Production Logging Configuration
export LOG_LEVEL=${LOG_LEVEL:-warn}
export LOG_FORMAT=${LOG_FORMAT:-json}
export ENABLE_ACCESS_LOG=true

# Security Configuration (Strict)
export DISABLE_DEBUG=true
export DISABLE_STACK_TRACES=true
export ENABLE_SECURITY_HEADERS=true
export ENABLE_RATE_LIMITING=true
export ENABLE_HELMET=true

# Performance Configuration (Optimized)
export CLUSTER_MODE=${CLUSTER_MODE:-true}
export CLUSTER_WORKERS=${CLUSTER_WORKERS:-0}  # 0 = auto-detect CPU cores
export KEEP_ALIVE_TIMEOUT=65000
export HEADERS_TIMEOUT=66000
export MAX_CONNECTIONS=1000

# Monitoring Configuration
export ENABLE_METRICS=true
export METRICS_PORT=${METRICS_PORT:-9090}
export HEALTH_CHECK_INTERVAL=30

# Colors for logging (minimal in production)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Production logging function (structured)
log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date -u "+%Y-%m-%dT%H:%M:%SZ")
    
    # Structured JSON logging for production
    if [[ "$LOG_FORMAT" == "json" ]]; then
        echo "{\"timestamp\":\"$timestamp\",\"level\":\"$level\",\"service\":\"arcade-prod\",\"message\":\"$message\"}"
    else
        case "$level" in
            INFO)  echo -e "${GREEN}[PROD-INFO]${NC}  $timestamp: $message" ;;
            WARN)  echo -e "${YELLOW}[PROD-WARN]${NC}  $timestamp: $message" ;;
            ERROR) echo -e "${RED}[PROD-ERROR]${NC} $timestamp: $message" ;;
            *)     echo "[PROD] $timestamp: $message" ;;
        esac
    fi
}

# Error handler with alerting capability
error_exit() {
    log "ERROR" "$1"
    
    # In production, could send alerts here
    # send_alert "Production server startup failed: $1"
    
    exit 1
}

# Validate PD_DIR and required CSV files (strict production validation)
validate_pd_dir() {
    log "INFO" "📁 Validating PD_DIR structure (production mode)..."
    
    # Check if PD_DIR is set (critical in production)
    if [[ -z "$PD_DIR" ]]; then
        error_exit "CRITICAL: PD_DIR environment variable must be set for production"
    fi
    
    # Check if PD_DIR exists
    if [[ ! -d "$PD_DIR" ]]; then
        error_exit "CRITICAL: PD_DIR directory not found: $PD_DIR"
    fi
    
    # Check directory permissions
    if [[ ! -r "$PD_DIR" ]]; then
        error_exit "CRITICAL: PD_DIR is not readable: $PD_DIR"
    fi
    
    # Check required CSV files with strict validation
    local required_files=("users.csv" "roles.csv")
    local optional_files=("capabilities.csv")
    local missing_required=()
    local validation_errors=()
    
    for file in "${required_files[@]}"; do
        local file_path="$PD_DIR/$file"
        if [[ ! -f "$file_path" ]]; then
            missing_required+=("$file")
            validation_errors+=("Missing required file: $file_path")
        else
            log "INFO" "✅ Found required file: $file_path"
            
            # Strict validation for production
            if [[ ! -r "$file_path" ]]; then
                validation_errors+=("File not readable: $file_path")
            fi
            
            if [[ ! -s "$file_path" ]]; then
                validation_errors+=("File is empty: $file_path")
            fi
            
            # Basic CSV format validation
            if ! head -1 "$file_path" | grep -q ","; then
                validation_errors+=("File does not appear to be CSV format: $file_path")
            fi
            
            # Check file age (warn if older than 30 days)
            local file_age=$(( ($(date +%s) - $(stat -c %Y "$file_path")) / 86400 ))
            if [[ $file_age -gt 30 ]]; then
                log "WARN" "⚠️ File is $file_age days old: $file_path"
            fi
        fi
    done
    
    # Check optional files
    for file in "${optional_files[@]}"; do
        local file_path="$PD_DIR/$file"
        if [[ -f "$file_path" ]]; then
            log "INFO" "✅ Found optional file: $file_path"
            
            # Validate optional files too
            if [[ ! -r "$file_path" ]]; then
                log "WARN" "⚠️ Optional file not readable: $file_path"
            fi
        else
            log "DEBUG" "ℹ️ Optional file not found: $file_path (this is OK)"
        fi
    done
    
    # Fail if any validation errors
    if [[ ${#validation_errors[@]} -gt 0 ]]; then
        log "ERROR" "❌ PD_DIR validation failed with ${#validation_errors[@]} errors:"
        for error in "${validation_errors[@]}"; do
            log "ERROR" "  - $error"
        done
        error_exit "CRITICAL: PD_DIR validation failed. Fix all errors before starting production server."
    fi
    
    # Additional production checks
    local total_users=$(wc -l < "$PD_DIR/users.csv" 2>/dev/null || echo "0")
    local total_roles=$(wc -l < "$PD_DIR/roles.csv" 2>/dev/null || echo "0")
    
    log "INFO" "📊 PD_DIR statistics: $total_users users, $total_roles roles"
    
    if [[ $total_users -eq 0 ]]; then
        error_exit "CRITICAL: No users found in users.csv"
    fi
    
    if [[ $total_roles -eq 0 ]]; then
        error_exit "CRITICAL: No roles found in roles.csv"
    fi
    
    log "INFO" "✅ PD_DIR validation completed successfully"
    log "INFO" "📁 PD_DIR location: $PD_DIR"
}

# Comprehensive pre-flight checks for production
preflight_checks() {
    log "INFO" "Running production pre-flight checks..."
    
    # Check system resources
    local available_memory=$(free -m | awk 'NR==2{printf "%.1f", $7/1024}')
    local available_disk=$(df -h / | awk 'NR==2{print $4}')
    local load_avg=$(uptime | awk -F'load average:' '{print $2}' | cut -d',' -f1 | xargs)
    
    log "INFO" "System resources - Memory: ${available_memory}GB, Disk: $available_disk, Load: $load_avg"
    
    # Check required directories
    local required_dirs=("$TETRA_DIR" "$TETRA_SRC" "$APP_DIR")
    for dir in "${required_dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            error_exit "Critical: Required directory not found: $dir"
        fi
    done
    
    # Check PD_DIR and required CSV files (critical for production)
    validate_pd_dir
    
    # Check Node.js with version validation
    if [[ -f "$NVM_DIR/nvm.sh" ]]; then
        source "$NVM_DIR/nvm.sh"
        log "INFO" "NVM loaded from $NVM_DIR"
    else
        log "WARN" "NVM not found, using system Node.js"
    fi
    
    if ! command -v node >/dev/null 2>&1; then
        error_exit "Critical: Node.js not found in PATH"
    fi
    
    local node_version=$(node --version)
    local node_major=$(echo "$node_version" | cut -d'.' -f1 | sed 's/v//')
    
    # Require Node.js 18+ for production
    if [[ "$node_major" -lt 18 ]]; then
        error_exit "Critical: Node.js version $node_version is too old. Require v18+"
    fi
    
    log "INFO" "Node.js version validated: $node_version"
    
    # Check critical application files
    local required_files=("server.js" "package.json")
    for file in "${required_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            error_exit "Critical: Required file not found: $file"
        fi
    done
    
    # Validate environment file
    if [[ ! -f ".env" ]]; then
        error_exit "Critical: Production .env file not found"
    fi
    
    # Source and validate environment
    set -a
    source .env
    set +a
    
    # Check required environment variables
    local required_vars=("NODE_ENV" "DATABASE_URL" "SESSION_SECRET")
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            error_exit "Critical: Required environment variable not set: $var"
        fi
    done
    
    # Check port availability
    if netstat -tuln 2>/dev/null | grep -q ":$PORT "; then
        error_exit "Critical: Port $PORT is already in use"
    fi
    
    # Check database connectivity (if applicable)
    if command -v pg_isready >/dev/null 2>&1 && [[ -n "${DATABASE_URL:-}" ]]; then
        if ! pg_isready -d "$DATABASE_URL" >/dev/null 2>&1; then
            log "WARN" "Database connectivity check failed"
        else
            log "INFO" "Database connectivity verified"
        fi
    fi
    
    log "INFO" "Production pre-flight checks completed successfully"
}

# Setup production environment with security hardening
setup_environment() {
    log "INFO" "Setting up production environment..."
    
    # Change to application directory
    cd "$APP_DIR" || error_exit "Failed to change to application directory: $APP_DIR"
    
    # Load Tetra environment
    if [[ -f "$TETRA_SRC/bash/bootloader.sh" ]]; then
        source "$TETRA_SRC/bash/bootloader.sh"
        log "INFO" "Tetra environment loaded"
    else
        log "WARN" "Tetra bootloader not found"
    fi
    
    # Set production-specific process title
    export PROCESS_TITLE="pixeljam-arcade-production"
    
    # Set file descriptor limits for high concurrency
    ulimit -n 65536 2>/dev/null || log "WARN" "Could not set file descriptor limit"
    
    # Set memory limits
    ulimit -v 8388608 2>/dev/null || log "WARN" "Could not set virtual memory limit"  # 8GB
    
    log "INFO" "Production environment setup completed"
}

# Enhanced health check with retry logic
health_check() {
    log "INFO" "Performing production health check..."
    
    local max_attempts=60  # Longer timeout for production
    local attempt=1
    local health_url="http://localhost:$PORT/health"
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -f -m 5 "$health_url" >/dev/null 2>&1; then
            log "INFO" "Health check passed (attempt $attempt)"
            
            # Additional production health checks
            local response=$(curl -s "$health_url" 2>/dev/null || echo "{}")
            log "INFO" "Health check response: $response"
            
            return 0
        fi
        
        if [[ $((attempt % 10)) -eq 0 ]]; then
            log "WARN" "Health check still failing after $attempt attempts"
        fi
        
        sleep 2
        ((attempt++))
    done
    
    error_exit "Critical: Health check failed after $max_attempts attempts"
}

# Production cleanup with graceful shutdown
cleanup() {
    log "INFO" "Initiating graceful shutdown..."
    
    # Send SIGTERM to child processes
    local children=$(jobs -p)
    if [[ -n "$children" ]]; then
        log "INFO" "Terminating child processes: $children"
        kill -TERM $children 2>/dev/null || true
        
        # Wait for graceful shutdown
        sleep 5
        
        # Force kill if still running
        kill -KILL $children 2>/dev/null || true
    fi
    
    log "INFO" "Production server shutdown completed"
    exit 0
}

# Enhanced signal handling for production
trap cleanup SIGTERM SIGINT SIGQUIT

# Production startup monitoring
startup_monitor() {
    local pid=$1
    local timeout=120  # 2 minutes startup timeout
    local elapsed=0
    
    while [[ $elapsed -lt $timeout ]]; do
        if ! kill -0 "$pid" 2>/dev/null; then
            error_exit "Server process died during startup"
        fi
        
        if health_check 2>/dev/null; then
            log "INFO" "Server startup completed successfully in ${elapsed}s"
            return 0
        fi
        
        sleep 5
        elapsed=$((elapsed + 5))
    done
    
    error_exit "Server startup timeout after ${timeout}s"
}

# Main production execution
main() {
    log "INFO" "Starting PixelJam Arcade Production Server..."
    log "INFO" "Environment: $NODE_ENV"
    log "INFO" "Port: $PORT"
    log "INFO" "Cluster Mode: $CLUSTER_MODE"
    log "INFO" "Working Directory: $(pwd)"
    log "INFO" "Process ID: $$"
    
    # Run comprehensive checks
    preflight_checks
    setup_environment
    
    # Start server with monitoring
    log "INFO" "Launching Node.js server in production mode..."
    
    if [[ "$CLUSTER_MODE" == "true" ]]; then
        log "INFO" "Starting in cluster mode with $CLUSTER_WORKERS workers"
        export ENABLE_CLUSTER=true
    fi
    
    # Use exec for proper signal handling in production
    exec node server.js
}

# Handle script execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
