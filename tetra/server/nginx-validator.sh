#!/bin/bash

# Nginx Configuration Validator - Human-in-the-loop validation
# Usage: ./nginx-validator.sh [staging|prod] [--compare-dev]
# Example: ./nginx-validator.sh staging --compare-dev

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Default values
TARGET_ENV="${1:-staging}"
COMPARE_DEV="${2:-}"

# File paths
DEV_NGINX_CONFIG="/etc/nginx/sites-enabled/dev.pixeljamarcade.com.conf"
LOCAL_CONFIG="$PROJECT_ROOT/config/nginx/${TARGET_ENV}.conf"
SYSTEMD_CONFIG="$PROJECT_ROOT/config/systemd/arcade-${TARGET_ENV}.service"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Validation results
declare -A VALIDATION_RESULTS=()
OVERALL_STATUS="pass"

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
        CHECK) echo -e "${PURPLE}[CHECK]${NC} $timestamp: $message" ;;
        *)     echo "$timestamp: $message" ;;
    esac
}

# Extract configuration values from nginx config
extract_nginx_values() {
    local config_file="$1"
    local config_name="$2"
    
    if [[ ! -f "$config_file" ]]; then
        log "ERROR" "Config file not found: $config_file"
        return 1
    fi
    
    log "CHECK" "🔍 Analyzing $config_name configuration..."
    
    # Extract key values
    local server_names=$(grep -E "^\s*server_name" "$config_file" | sed 's/.*server_name\s*\([^;]*\);.*/\1/' | tr -d ' ' | sort)
    local listen_ports=$(grep -E "^\s*listen" "$config_file" | sed 's/.*listen\s*\([^;]*\);.*/\1/' | awk '{print $1}' | sort -n)
    local proxy_passes=$(grep -E "^\s*proxy_pass" "$config_file" | sed 's/.*proxy_pass\s*\([^;]*\);.*/\1/' | sort)
    local locations=$(grep -E "^\s*location\s+" "$config_file" | sed 's/.*location\s*\([^{]*\)\s*{.*/\1/' | tr -d ' ' | sort)
    local ssl_cert=$(grep -E "^\s*ssl_certificate\s+" "$config_file" | head -1 | sed 's/.*ssl_certificate\s*\([^;]*\);.*/\1/')
    local upstream_blocks=$(grep -E "^\s*upstream\s+" "$config_file" | sed 's/.*upstream\s*\([^{]*\)\s*{.*/\1/' | tr -d ' ' | sort)
    
    # Store results
    echo "=== $config_name CONFIGURATION ANALYSIS ==="
    echo "Server Names: $server_names"
    echo "Listen Ports: $listen_ports"
    echo "Proxy Passes: $proxy_passes"
    echo "Locations: $locations"
    echo "SSL Certificate: $ssl_cert"
    echo "Upstream Blocks: $upstream_blocks"
    echo ""
    
    # Return structured data for comparison
    cat <<EOF
CONFIG_NAME="$config_name"
SERVER_NAMES="$server_names"
LISTEN_PORTS="$listen_ports"
PROXY_PASSES="$proxy_passes"
LOCATIONS="$locations"
SSL_CERT="$ssl_cert"
UPSTREAM_BLOCKS="$upstream_blocks"
EOF
}

# Validate nginx configuration structure
validate_nginx_structure() {
    local config_file="$1"
    local env_name="$2"
    
    log "CHECK" "🔧 Validating nginx structure for $env_name..."
    
    local issues=()
    
    # Check for required sections
    if ! grep -q "server {" "$config_file"; then
        issues+=("Missing server block")
    fi
    
    # Check for SSL configuration
    if ! grep -q "ssl_certificate" "$config_file"; then
        issues+=("Missing SSL certificate configuration")
    fi
    
    # Check for security headers
    local security_headers=("X-Frame-Options" "X-XSS-Protection" "X-Content-Type-Options" "Strict-Transport-Security")
    for header in "${security_headers[@]}"; do
        if ! grep -q "$header" "$config_file"; then
            issues+=("Missing security header: $header")
        fi
    done
    
    # Check for gzip compression
    if ! grep -q "gzip on" "$config_file"; then
        issues+=("Missing gzip compression")
    fi
    
    # Check for proxy configuration
    if ! grep -q "proxy_pass" "$config_file"; then
        issues+=("Missing proxy_pass configuration")
    fi
    
    # Check for health check endpoint
    if ! grep -q "location /health" "$config_file"; then
        issues+=("Missing health check endpoint")
    fi
    
    # Report issues
    if [[ ${#issues[@]} -eq 0 ]]; then
        log "INFO" "✅ Nginx structure validation passed for $env_name"
        VALIDATION_RESULTS["nginx_structure_$env_name"]="pass"
    else
        log "WARN" "⚠️ Nginx structure issues found for $env_name:"
        for issue in "${issues[@]}"; do
            echo "  - $issue"
        done
        VALIDATION_RESULTS["nginx_structure_$env_name"]="warn"
        OVERALL_STATUS="warn"
    fi
}

# Validate systemd service configuration
validate_systemd_service() {
    local service_file="$1"
    local env_name="$2"
    
    log "CHECK" "⚙️ Validating systemd service for $env_name..."
    
    local issues=()
    
    if [[ ! -f "$service_file" ]]; then
        issues+=("Service file not found: $service_file")
        VALIDATION_RESULTS["systemd_$env_name"]="fail"
        OVERALL_STATUS="fail"
        return 1
    fi
    
    # Check for required sections
    local required_sections=("[Unit]" "[Service]" "[Install]")
    for section in "${required_sections[@]}"; do
        if ! grep -q "^$section" "$service_file"; then
            issues+=("Missing section: $section")
        fi
    done
    
    # Check for required service settings
    local required_settings=("Type=" "User=" "WorkingDirectory=" "ExecStart=" "Restart=")
    for setting in "${required_settings[@]}"; do
        if ! grep -q "^$setting" "$service_file"; then
            issues+=("Missing setting: $setting")
        fi
    done
    
    # Check for security settings
    local security_settings=("NoNewPrivileges=" "PrivateTmp=" "ProtectSystem=")
    for setting in "${security_settings[@]}"; do
        if ! grep -q "^$setting" "$service_file"; then
            issues+=("Missing security setting: $setting")
        fi
    done
    
    # Check environment file loading
    if ! grep -q "EnvironmentFile=" "$service_file"; then
        issues+=("Missing EnvironmentFile configuration")
    fi
    
    # Report issues
    if [[ ${#issues[@]} -eq 0 ]]; then
        log "INFO" "✅ Systemd service validation passed for $env_name"
        VALIDATION_RESULTS["systemd_$env_name"]="pass"
    else
        log "WARN" "⚠️ Systemd service issues found for $env_name:"
        for issue in "${issues[@]}"; do
            echo "  - $issue"
        done
        VALIDATION_RESULTS["systemd_$env_name"]="warn"
        OVERALL_STATUS="warn"
    fi
}

# Compare configurations between environments
compare_with_dev() {
    local target_config="$1"
    local target_env="$2"
    
    log "CHECK" "🔄 Comparing $target_env configuration with dev..."
    
    if [[ ! -f "$DEV_NGINX_CONFIG" ]]; then
        log "WARN" "⚠️ Dev nginx config not found at $DEV_NGINX_CONFIG"
        log "INFO" "💡 To compare with dev, ensure you have read access to dev server nginx config"
        return 0
    fi
    
    # Extract configurations
    local dev_data=$(mktemp)
    local target_data=$(mktemp)
    
    extract_nginx_values "$DEV_NGINX_CONFIG" "dev" > "$dev_data"
    extract_nginx_values "$target_config" "$target_env" > "$target_data"
    
    # Source the data
    source "$dev_data"
    local dev_ports="$LISTEN_PORTS"
    local dev_locations="$LOCATIONS"
    local dev_proxies="$PROXY_PASSES"
    
    source "$target_data"
    local target_ports="$LISTEN_PORTS"
    local target_locations="$LOCATIONS"
    local target_proxies="$PROXY_PASSES"
    
    # Compare key aspects
    echo ""
    echo "=== CONFIGURATION COMPARISON: DEV vs $target_env ==="
    echo ""
    
    # Port comparison
    echo "📡 LISTEN PORTS:"
    echo "  Dev:     $dev_ports"
    echo "  $target_env: $target_ports"
    if [[ "$dev_ports" == "$target_ports" ]]; then
        echo "  Status:  ✅ MATCH"
    else
        echo "  Status:  ⚠️ DIFFERENT"
        OVERALL_STATUS="warn"
    fi
    echo ""
    
    # Location comparison
    echo "📍 LOCATIONS:"
    echo "  Dev:     $dev_locations"
    echo "  $target_env: $target_locations"
    if [[ "$dev_locations" == "$target_locations" ]]; then
        echo "  Status:  ✅ MATCH"
    else
        echo "  Status:  ⚠️ DIFFERENT"
        OVERALL_STATUS="warn"
    fi
    echo ""
    
    # Proxy comparison
    echo "🔄 PROXY PASSES:"
    echo "  Dev:     $dev_proxies"
    echo "  $target_env: $target_proxies"
    if [[ "$dev_proxies" == "$target_proxies" ]]; then
        echo "  Status:  ✅ MATCH"
    else
        echo "  Status:  ⚠️ DIFFERENT"
        OVERALL_STATUS="warn"
    fi
    echo ""
    
    # Cleanup
    rm -f "$dev_data" "$target_data"
}

# Interactive human-in-the-loop validation
interactive_validation() {
    local config_file="$1"
    local service_file="$2"
    local env_name="$3"
    
    echo ""
    echo "🤝 HUMAN-IN-THE-LOOP VALIDATION"
    echo "================================"
    echo ""
    
    # Show configuration summary
    echo "Configuration files to review:"
    echo "  Nginx:   $config_file"
    echo "  Systemd: $service_file"
    echo ""
    
    # Round 1: Nginx configuration review
    echo "📋 ROUND 1: NGINX CONFIGURATION REVIEW"
    echo "--------------------------------------"
    echo ""
    echo "Please review the nginx configuration for $env_name:"
    echo "  File: $config_file"
    echo ""
    echo "Key areas to verify:"
    echo "  • Server names match environment"
    echo "  • SSL certificate paths are correct"
    echo "  • Proxy passes point to correct ports"
    echo "  • Security headers are appropriate"
    echo "  • Static asset paths are correct"
    echo ""
    
    read -p "Does the nginx configuration look correct? (y/n/view): " nginx_response
    
    case "$nginx_response" in
        "view"|"v")
            echo ""
            echo "=== NGINX CONFIGURATION ==="
            cat "$config_file"
            echo ""
            read -p "Configuration reviewed. Does it look correct? (y/n): " nginx_response
            ;;
    esac
    
    if [[ "$nginx_response" =~ ^[Yy]$ ]]; then
        log "INFO" "✅ Human validation: Nginx configuration approved"
        VALIDATION_RESULTS["human_nginx"]="pass"
    else
        log "WARN" "⚠️ Human validation: Nginx configuration needs review"
        VALIDATION_RESULTS["human_nginx"]="fail"
        OVERALL_STATUS="fail"
    fi
    
    echo ""
    
    # Round 2: Systemd service review
    echo "📋 ROUND 2: SYSTEMD SERVICE REVIEW"
    echo "-----------------------------------"
    echo ""
    echo "Please review the systemd service for $env_name:"
    echo "  File: $service_file"
    echo ""
    echo "Key areas to verify:"
    echo "  • User and group settings"
    echo "  • Working directory path"
    echo "  • Environment file path"
    echo "  • ExecStart command"
    echo "  • Security settings"
    echo ""
    
    read -p "Does the systemd service look correct? (y/n/view): " systemd_response
    
    case "$systemd_response" in
        "view"|"v")
            echo ""
            echo "=== SYSTEMD SERVICE ==="
            cat "$service_file"
            echo ""
            read -p "Service configuration reviewed. Does it look correct? (y/n): " systemd_response
            ;;
    esac
    
    if [[ "$systemd_response" =~ ^[Yy]$ ]]; then
        log "INFO" "✅ Human validation: Systemd service approved"
        VALIDATION_RESULTS["human_systemd"]="pass"
    else
        log "WARN" "⚠️ Human validation: Systemd service needs review"
        VALIDATION_RESULTS["human_systemd"]="fail"
        OVERALL_STATUS="fail"
    fi
}

# Generate validation report
generate_report() {
    local env_name="$1"
    
    echo ""
    echo "📊 VALIDATION REPORT"
    echo "==================="
    echo "Environment: $env_name"
    echo "Timestamp: $(date)"
    echo "Overall Status: $OVERALL_STATUS"
    echo ""
    
    echo "Validation Results:"
    for check in "${!VALIDATION_RESULTS[@]}"; do
        local status="${VALIDATION_RESULTS[$check]}"
        local status_icon
        case "$status" in
            "pass") status_icon="✅" ;;
            "warn") status_icon="⚠️" ;;
            "fail") status_icon="❌" ;;
            *) status_icon="❓" ;;
        esac
        printf "  %-25s %s %s\n" "$check" "$status_icon" "$status"
    done
    
    echo ""
    
    case "$OVERALL_STATUS" in
        "pass")
            echo -e "${GREEN}✅ VALIDATION PASSED${NC}"
            echo "Configuration is ready for deployment."
            ;;
        "warn")
            echo -e "${YELLOW}⚠️ VALIDATION WARNINGS${NC}"
            echo "Configuration has warnings but may be deployable."
            echo "Review the issues above before proceeding."
            ;;
        "fail")
            echo -e "${RED}❌ VALIDATION FAILED${NC}"
            echo "Configuration has critical issues."
            echo "Fix the problems before deployment."
            ;;
    esac
}

# Show usage
show_usage() {
    cat <<EOF
Nginx Configuration Validator - Human-in-the-loop validation

Usage: $0 [environment] [options]

Environments:
  staging     Validate staging configuration (default)
  prod        Validate production configuration

Options:
  --compare-dev    Compare with dev environment configuration

Examples:
  $0 staging                    # Validate staging config
  $0 prod --compare-dev         # Validate prod and compare with dev
  $0 staging                    # Interactive validation for staging

Validation Process:
  1. Structural validation of nginx configuration
  2. Structural validation of systemd service
  3. Optional comparison with dev environment
  4. Human-in-the-loop review (2 rounds)
  5. Final validation report

Files Validated:
  • config/nginx/{env}.conf
  • config/systemd/arcade-{env}.service

Dev Comparison:
  • Requires read access to: $DEV_NGINX_CONFIG
  • Compares ports, locations, proxy passes, and upstream blocks
EOF
}

# Main function
main() {
    if [[ "${1:-}" =~ ^(-h|--help|help)$ ]]; then
        show_usage
        exit 0
    fi
    
    echo "🔍 Nginx Configuration Validator"
    echo "================================"
    echo "Environment: $TARGET_ENV"
    echo "Local Config: $LOCAL_CONFIG"
    echo "Systemd Config: $SYSTEMD_CONFIG"
    echo ""
    
    # Validate configuration files exist
    if [[ ! -f "$LOCAL_CONFIG" ]]; then
        log "ERROR" "Local nginx config not found: $LOCAL_CONFIG"
        exit 1
    fi
    
    if [[ ! -f "$SYSTEMD_CONFIG" ]]; then
        log "ERROR" "Systemd service config not found: $SYSTEMD_CONFIG"
        exit 1
    fi
    
    # Run validations
    validate_nginx_structure "$LOCAL_CONFIG" "$TARGET_ENV"
    validate_systemd_service "$SYSTEMD_CONFIG" "$TARGET_ENV"
    
    # Compare with dev if requested
    if [[ "$COMPARE_DEV" == "--compare-dev" ]]; then
        compare_with_dev "$LOCAL_CONFIG" "$TARGET_ENV"
    fi
    
    # Interactive validation
    interactive_validation "$LOCAL_CONFIG" "$SYSTEMD_CONFIG" "$TARGET_ENV"
    
    # Generate final report
    generate_report "$TARGET_ENV"
    
    # Set exit code
    case "$OVERALL_STATUS" in
        "pass") exit 0 ;;
        "warn") exit 1 ;;
        "fail") exit 2 ;;
    esac
}

# Handle interruption
trap 'log "ERROR" "Validation interrupted"; exit 130' INT TERM

# Run main function
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
