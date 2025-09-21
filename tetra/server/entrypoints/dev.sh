#!/usr/bin/env bash

# PixelJam Arcade Development Entrypoint
# Environment: dev@dev.pixeljamarcade.com
# Purpose: Development environment with debugging and hot-reload support

set -euo pipefail

# Development Environment Configuration
export NODE_ENV=development
export PORT=4443
export TETRA_PORT=${TETRA_PORT:-$PORT}
export TETRA_ENV=development

# Development-specific paths
export TETRA_DIR=${TETRA_DIR:-/home/dev/tetra}
export TETRA_SRC=${TETRA_SRC:-/home/dev/src/pixeljam/pja/arcade/tetra}
export APP_DIR=${APP_DIR:-/home/dev/src/pixeljam/pja/arcade}
export PD_DIR=${PD_DIR:-/home/dev/pj/pd}

# Node.js Development Configuration
export NVM_DIR=${NVM_DIR:-/home/dev/pj/nvm}
export NODE_OPTIONS="--max-old-space-size=1024"

# Development Logging Configuration
export LOG_LEVEL=${LOG_LEVEL:-debug}
export LOG_FORMAT=${LOG_FORMAT:-pretty}
export DEBUG=${DEBUG:-*}

# Development Features
export ENABLE_HOT_RELOAD=${ENABLE_HOT_RELOAD:-true}
export ENABLE_DEBUG_MODE=true
export ENABLE_STACK_TRACES=true
export DISABLE_SECURITY_HEADERS=true  # For easier development

# Performance Configuration (Development)
export CLUSTER_MODE=false  # Disable clustering in dev for easier debugging
export WATCH_FILES=${WATCH_FILES:-true}

# Colors for development logging
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Development logging function (colorful and verbose)
log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date "+%H:%M:%S")
    
    case "$level" in
        INFO)  echo -e "${GREEN}[DEV-INFO]${NC}  $timestamp: $message" ;;
        WARN)  echo -e "${YELLOW}[DEV-WARN]${NC}  $timestamp: $message" ;;
        ERROR) echo -e "${RED}[DEV-ERROR]${NC} $timestamp: $message" ;;
        DEBUG) echo -e "${BLUE}[DEV-DEBUG]${NC} $timestamp: $message" ;;
        DEV)   echo -e "${PURPLE}[DEV]${NC}      $timestamp: $message" ;;
        *)     echo -e "${CYAN}[DEV]${NC}      $timestamp: $message" ;;
    esac
}

# Development error handler (non-fatal)
error_exit() {
    log "ERROR" "$1"
    log "INFO" "💡 Development tip: Check the error above and restart when ready"
    exit 1
}

# Validate PD_DIR and required CSV files
validate_pd_dir() {
    log "INFO" "📁 Validating PD_DIR structure..."
    
    # Check if PD_DIR is set
    if [[ -z "$PD_DIR" ]]; then
        log "WARN" "⚠️ PD_DIR environment variable not set, using default: /home/dev/pj/pd"
        export PD_DIR="/home/dev/pj/pd"
    fi
    
    # Check if PD_DIR exists
    if [[ ! -d "$PD_DIR" ]]; then
        log "WARN" "⚠️ PD_DIR directory not found: $PD_DIR"
        log "INFO" "💡 Creating PD_DIR directory..."
        mkdir -p "$PD_DIR" || {
            log "ERROR" "❌ Failed to create PD_DIR: $PD_DIR"
            return 1
        }
    fi
    
    # Check required CSV files
    local required_files=("users.csv" "roles.csv")
    local optional_files=("capabilities.csv")
    local missing_required=()
    
    for file in "${required_files[@]}"; do
        local file_path="$PD_DIR/$file"
        if [[ ! -f "$file_path" ]]; then
            missing_required+=("$file")
            log "WARN" "⚠️ Required CSV file missing: $file_path"
        else
            log "DEBUG" "✅ Found required file: $file_path"
        fi
    done
    
    # Check optional files
    for file in "${optional_files[@]}"; do
        local file_path="$PD_DIR/$file"
        if [[ -f "$file_path" ]]; then
            log "DEBUG" "✅ Found optional file: $file_path"
        else
            log "DEBUG" "ℹ️ Optional file not found: $file_path (this is OK)"
        fi
    done
    
    # In development, offer to create missing files
    if [[ ${#missing_required[@]} -gt 0 ]]; then
        log "WARN" "⚠️ Missing required CSV files: ${missing_required[*]}"
        log "INFO" "💡 Development mode: Creating minimal CSV files..."
        
        # Create minimal users.csv if missing
        if [[ ! -f "$PD_DIR/users.csv" ]]; then
            cat > "$PD_DIR/users.csv" <<EOF
dev,salt123,hash123
admin,salt456,hash456
EOF
            log "INFO" "✅ Created minimal users.csv with dev and admin users"
        fi
        
        # Create minimal roles.csv if missing
        if [[ ! -f "$PD_DIR/roles.csv" ]]; then
            cat > "$PD_DIR/roles.csv" <<EOF
dev,admin
admin,admin
EOF
            log "INFO" "✅ Created minimal roles.csv with admin roles"
        fi
    fi
    
    log "INFO" "✅ PD_DIR validation completed"
    log "DEBUG" "PD_DIR location: $PD_DIR"
}

# Development pre-flight checks (relaxed)
preflight_checks() {
    log "INFO" "🔍 Running development pre-flight checks..."
    
    # Check required directories (create if missing)
    local required_dirs=("$TETRA_DIR" "$TETRA_SRC" "$APP_DIR")
    for dir in "${required_dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            log "WARN" "⚠️ Directory not found: $dir (this is OK in development)"
        fi
    done
    
    # Check PD_DIR and required CSV files
    validate_pd_dir
    
    # Load NVM for development
    if [[ -f "$NVM_DIR/nvm.sh" ]]; then
        source "$NVM_DIR/nvm.sh"
        log "INFO" "✅ NVM loaded from $NVM_DIR"
        
        # Show available Node versions in development
        log "DEBUG" "Available Node versions: $(nvm list --no-colors | tr '\n' ' ')"
        
        # Use latest LTS if no version specified
        if [[ -z "${NODE_VERSION:-}" ]]; then
            nvm use --lts >/dev/null 2>&1 || log "WARN" "Could not switch to LTS Node version"
        fi
    else
        log "WARN" "⚠️ NVM not found at $NVM_DIR, using system Node.js"
    fi
    
    # Check Node.js (informational in dev)
    if ! command -v node >/dev/null 2>&1; then
        error_exit "Node.js not found in PATH"
    fi
    
    local node_version=$(node --version)
    local npm_version=$(npm --version 2>/dev/null || echo "not found")
    log "INFO" "📦 Node.js: $node_version, npm: $npm_version"
    
    # Check application files (create if missing in dev)
    if [[ ! -f "server.js" ]]; then
        log "WARN" "⚠️ server.js not found - make sure you're in the right directory"
    fi
    
    # Check/create environment file for development
    if [[ ! -f ".env" ]]; then
        log "WARN" "⚠️ No .env file found, creating development defaults..."
        cat > .env <<EOF
NODE_ENV=development
PORT=4443
DEBUG=true
LOG_LEVEL=debug
EOF
        log "INFO" "✅ Created development .env file"
    fi
    
    # Load environment file
    set -a
    source .env 2>/dev/null || true
    set +a
    
    # Check port (warn but don't fail in dev)
    if netstat -tuln 2>/dev/null | grep -q ":$PORT "; then
        log "WARN" "⚠️ Port $PORT is in use - you may need to kill existing processes"
        log "INFO" "💡 Try: lsof -ti:$PORT | xargs kill -9"
    else
        log "INFO" "✅ Port $PORT is available"
    fi
    
    log "INFO" "✅ Development pre-flight checks completed"
}

# Setup development environment
setup_environment() {
    log "INFO" "🔧 Setting up development environment..."
    
    # Change to application directory
    if [[ -d "$APP_DIR" ]]; then
        cd "$APP_DIR" || log "WARN" "Could not change to $APP_DIR"
    else
        log "WARN" "App directory $APP_DIR not found, staying in current directory"
    fi
    
    # Load Tetra environment if available
    if [[ -f "$TETRA_SRC/bash/bootloader.sh" ]]; then
        source "$TETRA_SRC/bash/bootloader.sh"
        log "INFO" "✅ Tetra environment loaded"
    else
        log "WARN" "⚠️ Tetra bootloader not found at $TETRA_SRC/bash/bootloader.sh"
        log "INFO" "💡 This is OK if you're working on a standalone version"
    fi
    
    # Set development process title
    export PROCESS_TITLE="pixeljam-arcade-dev"
    
    # Development-specific setup
    log "DEV" "🛠️ Development mode enabled"
    log "DEV" "🔍 Debug logging enabled"
    log "DEV" "🔄 Hot reload: $ENABLE_HOT_RELOAD"
    log "DEV" "👀 File watching: $WATCH_FILES"
    
    log "INFO" "✅ Development environment setup completed"
}

# Development health check (quick and informative)
health_check() {
    log "INFO" "🏥 Development health check..."
    
    local max_attempts=10  # Shorter timeout for dev
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -f "http://localhost:$PORT/health" >/dev/null 2>&1; then
            log "INFO" "✅ Health check passed!"
            log "DEV" "🌐 Server available at: http://localhost:$PORT"
            return 0
        fi
        
        log "DEBUG" "Health check attempt $attempt/$max_attempts..."
        sleep 1
        ((attempt++))
    done
    
    log "WARN" "⚠️ Health check failed - server may still be starting up"
    log "INFO" "💡 Check the server logs above for any errors"
    return 1
}

# Development cleanup (gentle)
cleanup() {
    log "INFO" "🧹 Development server shutting down..."
    log "DEV" "💡 Press Ctrl+C again to force quit if needed"
    exit 0
}

# Development signal handling
trap cleanup SIGTERM SIGINT

# Development helper functions
show_dev_info() {
    echo ""
    log "DEV" "🚀 Development Server Information"
    log "DEV" "=================================="
    log "DEV" "Environment: $NODE_ENV"
    log "DEV" "Port: $PORT"
    log "DEV" "Working Directory: $(pwd)"
    log "DEV" "Node Version: $(node --version)"
    log "DEV" "Process ID: $$"
    echo ""
    log "DEV" "🌐 Access URLs:"
    log "DEV" "  Local:   http://localhost:$PORT"
    log "DEV" "  Network: http://$(hostname -I | awk '{print $1}'):$PORT"
    echo ""
    log "DEV" "🛠️ Development Features:"
    log "DEV" "  Debug Mode: $ENABLE_DEBUG_MODE"
    log "DEV" "  Hot Reload: $ENABLE_HOT_RELOAD"
    log "DEV" "  File Watch: $WATCH_FILES"
    echo ""
    log "DEV" "💡 Development Tips:"
    log "DEV" "  • Use 'rs' to restart the server manually"
    log "DEV" "  • Check logs for detailed debugging information"
    log "DEV" "  • Environment variables can be modified in .env"
    echo ""
}

# Main development execution
main() {
    show_dev_info
    
    # Run development checks
    preflight_checks
    setup_environment
    
    # Start development server
    log "INFO" "🌟 Starting development server..."
    
    # Add development-specific Node.js flags
    export NODE_OPTIONS="$NODE_OPTIONS --inspect=0.0.0.0:9229"
    
    log "DEV" "🔍 Node.js inspector available at: http://localhost:9229"
    log "INFO" "🚀 Launching Node.js server in development mode..."
    
    # Use exec for proper signal handling
    exec node server.js
}

# Handle script execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
