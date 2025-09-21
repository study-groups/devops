#!/bin/bash

# TKM Rekey Script - Automated SSH key rotation for staging and production
# Usage: ./tkm-rekey.sh [staging|prod|all] [days]
# Example: ./tkm-rekey.sh staging 30

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TETRA_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Default values
TARGET="${1:-all}"
KEY_DAYS="${2:-30}"
ORG_NAME="pixeljam_arcade"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Logging
log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date "+%Y-%m-%d %H:%M:%S")
    
    case "$level" in
        INFO)  echo -e "${GREEN}[INFO]${NC}  $timestamp: $message" ;;
        WARN)  echo -e "${YELLOW}[WARN]${NC}  $timestamp: $message" ;;
        ERROR) echo -e "${RED}[ERROR]${NC} $timestamp: $message" ;;
        DEBUG) echo -e "${BLUE}[DEBUG]${NC} $timestamp: $message" ;;
        TKM)   echo -e "${PURPLE}[TKM]${NC}   $timestamp: $message" ;;
        *)     echo "$timestamp: $message" ;;
    esac
}

error_exit() {
    log "ERROR" "$1"
    exit 1
}

# Load Tetra environment
load_tetra() {
    log "INFO" "🏠 Loading Tetra environment..."
    
    if [[ -f "$HOME/tetra/tetra.sh" ]]; then
        source "$HOME/tetra/tetra.sh"
        log "INFO" "✅ Tetra environment loaded"
    else
        error_exit "Tetra environment not found. Run: source ~/tetra/tetra.sh"
    fi
}

# Initialize TKM
init_tkm() {
    log "TKM" "🔧 Initializing TKM..."
    
    if ! command -v tkm >/dev/null 2>&1; then
        error_exit "TKM command not found. Ensure Tetra is properly installed."
    fi
    
    # Initialize TKM if not already done
    if [[ ! -d "$TETRA_DIR/tkm" ]]; then
        log "DEBUG" "TKM not initialized, running tkm init..."
        tkm init || error_exit "TKM initialization failed"
    fi
    
    log "TKM" "✅ TKM initialized"
}

# Setup organization
setup_organization() {
    log "TKM" "🏢 Setting up PixelJam organization..."
    
    # Check if organization exists
    if tkm org list | grep -q "$ORG_NAME"; then
        log "DEBUG" "Organization $ORG_NAME already exists"
    else
        log "DEBUG" "Creating organization: $ORG_NAME"
        tkm org add "$ORG_NAME" "PixelJam Arcade Production Infrastructure" || {
            log "WARN" "Organization creation failed, may already exist"
        }
    fi
    
    # Set as current organization
    tkm org set "$ORG_NAME" || error_exit "Failed to set current organization"
    
    log "TKM" "✅ Organization setup complete"
}

# Import server inventory
import_servers() {
    log "TKM" "📥 Checking server inventory..."
    
    # Check if servers are already imported
    if tkm envs | grep -E "(staging|prod)" >/dev/null 2>&1; then
        log "DEBUG" "Servers already imported"
        return 0
    fi
    
    log "INFO" "📋 Server inventory not found. Manual import required:"
    echo ""
    echo "1. Run: pj && nh_show_env_vars"
    echo "2. Copy the export statements output"
    echo "3. Run: tkm repl"
    echo "4. In TKM REPL, run: org import"
    echo "5. Paste the copied content and press Ctrl+D"
    echo ""
    read -p "Press Enter after completing server import, or 'q' to quit: " response
    
    if [[ "$response" == "q" ]]; then
        log "INFO" "Exiting. Run script again after importing servers."
        exit 0
    fi
    
    # Verify import
    if ! tkm envs | grep -E "(staging|prod)" >/dev/null 2>&1; then
        error_exit "Server import verification failed. No staging/prod environments found."
    fi
    
    log "TKM" "✅ Server inventory verified"
}

# Generate SSH keys
generate_keys() {
    local env="$1"
    log "TKM" "🔐 Generating SSH keys for $env (${KEY_DAYS} days)..."
    
    tkm generate "$env" deploy "$KEY_DAYS" || error_exit "Key generation failed for $env"
    
    log "TKM" "✅ Keys generated for $env"
}

# Deploy SSH keys
deploy_keys() {
    local env="$1"
    log "TKM" "🚀 Deploying SSH keys to $env..."
    
    # Run security audit before deployment
    log "DEBUG" "Running pre-deployment security audit..."
    tkm audit "$env" || log "WARN" "Security audit warnings detected"
    
    # Deploy keys
    tkm deploy "$env" || error_exit "Key deployment failed for $env"
    
    log "TKM" "✅ Keys deployed to $env"
}

# Test SSH access
test_access() {
    local env="$1"
    log "TKM" "🧪 Testing SSH access to $env..."
    
    # Test SSH connectivity with new keys
    tkm inspect "$env" || log "WARN" "SSH inspection warnings detected"
    
    log "TKM" "✅ SSH access test completed for $env"
}

# Backup old SSH keys
backup_ssh() {
    log "TKM" "⚠️ Backing up SSH directory..."
    
    local backup_dir="$HOME/.ssh.backup.$(date +%Y%m%d_%H%M%S)"
    cp -r "$HOME/.ssh" "$backup_dir" 2>/dev/null || log "WARN" "SSH backup failed"
    
    log "INFO" "📁 SSH backup created: $backup_dir"
}

# Revoke old keys
revoke_old_keys() {
    local env="$1"
    log "TKM" "🗑️ Revoking old SSH keys for $env..."
    
    tkm revoke "$env" old || log "WARN" "Old key revocation may have failed"
    
    log "TKM" "✅ Old keys revoked for $env"
}

# Generate final report
generate_report() {
    log "TKM" "📊 Generating rekeying report..."
    
    local report_file="/tmp/tkm_rekey_report_$(date +%Y%m%d_%H%M%S).txt"
    
    cat > "$report_file" <<EOF
=== TKM REKEYING REPORT ===
Timestamp: $(date)
Target: $TARGET
Key Duration: $KEY_DAYS days
Organization: $ORG_NAME

=== KEY STATUS ===
EOF
    
    tkm status >> "$report_file" 2>&1 || echo "Status check failed" >> "$report_file"
    
    echo ""
    echo "=== ENVIRONMENT STATUS ===" >> "$report_file"
    tkm envs >> "$report_file" 2>&1 || echo "Environment check failed" >> "$report_file"
    
    echo ""
    echo "Report saved to: $report_file"
    log "TKM" "✅ Rekeying report generated"
}

# Process single environment
rekey_environment() {
    local env="$1"
    
    log "INFO" "🔑 Starting rekey process for: $env"
    
    generate_keys "$env"
    deploy_keys "$env"
    test_access "$env"
    
    # Ask user before revoking old keys
    echo ""
    read -p "SSH access test completed for $env. Revoke old keys? (y/N): " confirm
    
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        revoke_old_keys "$env"
        log "INFO" "✅ Rekeying completed for $env"
    else
        log "INFO" "⏸️ Old keys preserved for $env. Revoke manually with: tkm revoke $env old"
    fi
}

# Main function
main() {
    echo "🔑 TKM SSH Key Rotation Script"
    echo "=============================="
    echo "Target: $TARGET"
    echo "Key Duration: $KEY_DAYS days"
    echo "Organization: $ORG_NAME"
    echo ""
    
    load_tetra
    init_tkm
    setup_organization
    import_servers
    backup_ssh
    
    case "$TARGET" in
        "staging")
            rekey_environment "staging"
            ;;
        "prod")
            rekey_environment "prod"
            ;;
        "all")
            rekey_environment "staging"
            echo ""
            rekey_environment "prod"
            ;;
        *)
            error_exit "Invalid target: $TARGET. Use: staging, prod, or all"
            ;;
    esac
    
    # Run final security audit
    log "TKM" "🔍 Running final security audit..."
    tkm audit || log "WARN" "Final security audit warnings detected"
    
    # Cleanup SSH directory
    log "TKM" "🧹 Cleaning up SSH directory..."
    tkm cleanup execute || log "WARN" "SSH cleanup warnings detected"
    
    generate_report
    
    echo ""
    echo "🎉 TKM rekeying process completed!"
    echo "✅ New SSH keys deployed and tested"
    echo "🔍 Run 'tkm status' to view current key status"
    echo "🌐 Test connectivity to verify deployment"
}

# Handle interruption
trap 'log "ERROR" "Rekeying interrupted by user"; exit 130' INT TERM

# Show usage if help requested
if [[ "${1:-}" =~ ^(-h|--help|help)$ ]]; then
    cat <<EOF
TKM Rekey Script - Automated SSH key rotation

Usage: $0 [target] [days]

Arguments:
  target    Environment to rekey: staging, prod, or all (default: all)
  days      Key expiration in days (default: 30)

Examples:
  $0                    # Rekey all environments with 30-day keys
  $0 staging            # Rekey staging only with 30-day keys
  $0 prod 7             # Rekey production with 7-day keys
  $0 all 60             # Rekey all environments with 60-day keys

Prerequisites:
  - Tetra environment loaded (source ~/tetra/tetra.sh)
  - SSH access to target servers
  - TKM properly configured

The script will:
  1. Initialize TKM and organization
  2. Generate new SSH keys
  3. Deploy keys to remote servers
  4. Test SSH connectivity
  5. Optionally revoke old keys
  6. Generate security report
EOF
    exit 0
fi

# Run main function
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
