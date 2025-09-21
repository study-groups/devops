#!/bin/bash

# Entrypoint Validator - Validate environment-specific entrypoint scripts
# Usage: ./entrypoint-validator.sh [environment] [--compare-all]
# Example: ./entrypoint-validator.sh staging --compare-all

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENTRYPOINTS_DIR="$SCRIPT_DIR/entrypoints"

# Default values
TARGET_ENV="${1:-all}"
COMPARE_ALL="${2:-}"

# Available environments
ENVIRONMENTS=("dev" "staging" "prod")

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

# Extract configuration from entrypoint script
extract_entrypoint_config() {
    local script_file="$1"
    local env_name="$2"
    
    if [[ ! -f "$script_file" ]]; then
        log "ERROR" "Entrypoint script not found: $script_file"
        return 1
    fi
    
    log "CHECK" "🔍 Analyzing $env_name entrypoint configuration..."
    
    # Extract key configuration values
    local node_env=$(grep -E "^export NODE_ENV=" "$script_file" | cut -d'=' -f2 | tr -d '"' || echo "not_set")
    local port=$(grep -E "^export PORT=" "$script_file" | cut -d'=' -f2 | tr -d '"' || echo "not_set")
    local tetra_env=$(grep -E "^export TETRA_ENV=" "$script_file" | cut -d'=' -f2 | tr -d '"' || echo "not_set")
    local log_level=$(grep -E "^export LOG_LEVEL=" "$script_file" | cut -d'=' -f2- | sed 's/.*:-\([^}]*\)}.*/\1/' || echo "not_set")
    local cluster_mode=$(grep -E "^export CLUSTER_MODE=" "$script_file" | cut -d'=' -f2 | tr -d '"' || echo "not_set")
    local debug_mode=$(grep -E "^export.*DEBUG.*=" "$script_file" | head -1 | cut -d'=' -f2 | tr -d '"' || echo "not_set")
    
    # Extract paths
    local tetra_dir=$(grep -E "^export TETRA_DIR=" "$script_file" | cut -d'=' -f2- | sed 's/.*:-\([^}]*\)}.*/\1/' || echo "not_set")
    local app_dir=$(grep -E "^export APP_DIR=" "$script_file" | cut -d'=' -f2- | sed 's/.*:-\([^}]*\)}.*/\1/' || echo "not_set")
    local nvm_dir=$(grep -E "^export NVM_DIR=" "$script_file" | cut -d'=' -f2- | sed 's/.*:-\([^}]*\)}.*/\1/' || echo "not_set")
    
    # Extract Node.js options
    local node_options=$(grep -E "^export NODE_OPTIONS=" "$script_file" | cut -d'=' -f2- | tr -d '"' || echo "not_set")
    
    # Check for required functions
    local has_preflight=$(grep -q "preflight_checks()" "$script_file" && echo "yes" || echo "no")
    local has_setup=$(grep -q "setup_environment()" "$script_file" && echo "yes" || echo "no")
    local has_health=$(grep -q "health_check()" "$script_file" && echo "yes" || echo "no")
    local has_cleanup=$(grep -q "cleanup()" "$script_file" && echo "yes" || echo "no")
    
    # Store results in associative array for comparison
    cat <<EOF
ENV_NAME="$env_name"
NODE_ENV="$node_env"
PORT="$port"
TETRA_ENV="$tetra_env"
LOG_LEVEL="$log_level"
CLUSTER_MODE="$cluster_mode"
DEBUG_MODE="$debug_mode"
TETRA_DIR="$tetra_dir"
APP_DIR="$app_dir"
NVM_DIR="$nvm_dir"
NODE_OPTIONS="$node_options"
HAS_PREFLIGHT="$has_preflight"
HAS_SETUP="$has_setup"
HAS_HEALTH="$has_health"
HAS_CLEANUP="$has_cleanup"
EOF
}

# Validate entrypoint structure
validate_entrypoint_structure() {
    local script_file="$1"
    local env_name="$2"
    
    log "CHECK" "🔧 Validating entrypoint structure for $env_name..."
    
    local issues=()
    
    # Check shebang
    if ! head -1 "$script_file" | grep -q "#!/usr/bin/env bash\|#!/bin/bash"; then
        issues+=("Missing or incorrect shebang")
    fi
    
    # Check set options
    if ! grep -q "set -euo pipefail" "$script_file"; then
        issues+=("Missing 'set -euo pipefail' for error handling")
    fi
    
    # Check required exports
    local required_exports=("NODE_ENV" "PORT" "TETRA_PORT" "PD_DIR")
    for export_var in "${required_exports[@]}"; do
        if ! grep -q "export $export_var=" "$script_file"; then
            issues+=("Missing required export: $export_var")
        fi
    done
    
    # Check required functions
    local required_functions=("preflight_checks" "setup_environment" "validate_pd_dir" "main")
    for func in "${required_functions[@]}"; do
        if ! grep -q "${func}()" "$script_file"; then
            issues+=("Missing required function: $func")
        fi
    done
    
    # Check signal handling
    if ! grep -q "trap.*cleanup" "$script_file"; then
        issues+=("Missing signal trap for cleanup")
    fi
    
    # Check exec usage for proper signal handling
    if ! grep -q "exec node" "$script_file"; then
        issues+=("Should use 'exec node' for proper signal handling")
    fi
    
    # Environment-specific validations
    case "$env_name" in
        "dev")
            if ! grep -q "NODE_ENV=development" "$script_file"; then
                issues+=("Development environment should set NODE_ENV=development")
            fi
            if ! grep -q "DEBUG.*=.*true\|LOG_LEVEL.*debug" "$script_file"; then
                issues+=("Development should enable debug logging")
            fi
            ;;
        "staging")
            if ! grep -q "NODE_ENV=production" "$script_file"; then
                issues+=("Staging environment should set NODE_ENV=production")
            fi
            if grep -q "DEBUG.*=.*true" "$script_file"; then
                issues+=("Staging should not enable debug mode")
            fi
            ;;
        "prod")
            if ! grep -q "NODE_ENV=production" "$script_file"; then
                issues+=("Production environment should set NODE_ENV=production")
            fi
            if grep -q "DEBUG.*=.*true" "$script_file"; then
                issues+=("Production must not enable debug mode")
            fi
            if ! grep -q "CLUSTER_MODE.*=.*true" "$script_file"; then
                issues+=("Production should enable cluster mode")
            fi
            ;;
    esac
    
    # Report issues
    if [[ ${#issues[@]} -eq 0 ]]; then
        log "INFO" "✅ Entrypoint structure validation passed for $env_name"
        VALIDATION_RESULTS["structure_$env_name"]="pass"
    else
        log "WARN" "⚠️ Entrypoint structure issues found for $env_name:"
        for issue in "${issues[@]}"; do
            echo "  - $issue"
        done
        VALIDATION_RESULTS["structure_$env_name"]="warn"
        OVERALL_STATUS="warn"
    fi
}

# Compare entrypoint configurations
compare_entrypoints() {
    log "CHECK" "🔄 Comparing entrypoint configurations..."
    
    local temp_dir=$(mktemp -d)
    
    # Extract configurations for all environments
    for env in "${ENVIRONMENTS[@]}"; do
        local script_file="$ENTRYPOINTS_DIR/$env.sh"
        if [[ -f "$script_file" ]]; then
            extract_entrypoint_config "$script_file" "$env" > "$temp_dir/$env.conf"
        fi
    done
    
    echo ""
    echo "=== ENTRYPOINT CONFIGURATION COMPARISON ==="
    echo ""
    
    # Compare key settings
    echo "📋 ENVIRONMENT SETTINGS:"
    printf "%-12s %-15s %-8s %-12s %-12s %-12s\n" "Environment" "NODE_ENV" "Port" "Log Level" "Cluster" "Debug"
    echo "=============================================================================="
    
    for env in "${ENVIRONMENTS[@]}"; do
        if [[ -f "$temp_dir/$env.conf" ]]; then
            source "$temp_dir/$env.conf"
            printf "%-12s %-15s %-8s %-12s %-12s %-12s\n" \
                "$ENV_NAME" "$NODE_ENV" "$PORT" "$LOG_LEVEL" "$CLUSTER_MODE" "$DEBUG_MODE"
        else
            printf "%-12s %-15s %-8s %-12s %-12s %-12s\n" \
                "$env" "MISSING" "-" "-" "-" "-"
        fi
    done
    
    echo ""
    echo "🛠️ FUNCTION AVAILABILITY:"
    printf "%-12s %-12s %-12s %-12s %-12s\n" "Environment" "Preflight" "Setup" "Health" "Cleanup"
    echo "================================================================"
    
    for env in "${ENVIRONMENTS[@]}"; do
        if [[ -f "$temp_dir/$env.conf" ]]; then
            source "$temp_dir/$env.conf"
            printf "%-12s %-12s %-12s %-12s %-12s\n" \
                "$ENV_NAME" "$HAS_PREFLIGHT" "$HAS_SETUP" "$HAS_HEALTH" "$HAS_CLEANUP"
        else
            printf "%-12s %-12s %-12s %-12s %-12s\n" \
                "$env" "MISSING" "MISSING" "MISSING" "MISSING"
        fi
    done
    
    echo ""
    echo "📁 PATH CONFIGURATION:"
    printf "%-12s %-30s %-30s\n" "Environment" "TETRA_DIR" "APP_DIR"
    echo "========================================================================"
    
    for env in "${ENVIRONMENTS[@]}"; do
        if [[ -f "$temp_dir/$env.conf" ]]; then
            source "$temp_dir/$env.conf"
            printf "%-12s %-30s %-30s\n" "$ENV_NAME" "$TETRA_DIR" "$APP_DIR"
        else
            printf "%-12s %-30s %-30s\n" "$env" "MISSING" "MISSING"
        fi
    done
    
    # Check for consistency issues
    echo ""
    echo "🔍 CONSISTENCY ANALYSIS:"
    
    # Check port consistency
    local ports=()
    for env in "${ENVIRONMENTS[@]}"; do
        if [[ -f "$temp_dir/$env.conf" ]]; then
            source "$temp_dir/$env.conf"
            ports+=("$PORT")
        fi
    done
    
    if [[ ${#ports[@]} -gt 1 ]]; then
        local unique_ports=($(printf '%s\n' "${ports[@]}" | sort -u))
        if [[ ${#unique_ports[@]} -eq 1 ]]; then
            echo "  ✅ Port consistency: All environments use port ${unique_ports[0]}"
        else
            echo "  ⚠️ Port inconsistency: Different ports used across environments"
            OVERALL_STATUS="warn"
        fi
    fi
    
    # Check path structure consistency
    local path_patterns=()
    for env in "${ENVIRONMENTS[@]}"; do
        if [[ -f "$temp_dir/$env.conf" ]]; then
            source "$temp_dir/$env.conf"
            # Extract path pattern (replace env-specific parts with placeholder)
            local pattern=$(echo "$APP_DIR" | sed "s/$env/ENV/g")
            path_patterns+=("$pattern")
        fi
    done
    
    if [[ ${#path_patterns[@]} -gt 1 ]]; then
        local unique_patterns=($(printf '%s\n' "${path_patterns[@]}" | sort -u))
        if [[ ${#unique_patterns[@]} -eq 1 ]]; then
            echo "  ✅ Path structure: Consistent across environments"
        else
            echo "  ⚠️ Path structure: Inconsistent patterns detected"
            OVERALL_STATUS="warn"
        fi
    fi
    
    # Cleanup
    rm -rf "$temp_dir"
}

# Test entrypoint execution (dry run)
test_entrypoint() {
    local script_file="$1"
    local env_name="$2"
    
    log "CHECK" "🧪 Testing entrypoint execution for $env_name..."
    
    # Test syntax
    if bash -n "$script_file"; then
        log "INFO" "✅ Syntax check passed for $env_name"
        VALIDATION_RESULTS["syntax_$env_name"]="pass"
    else
        log "ERROR" "❌ Syntax check failed for $env_name"
        VALIDATION_RESULTS["syntax_$env_name"]="fail"
        OVERALL_STATUS="fail"
        return 1
    fi
    
    # Test help/usage (if available)
    if grep -q "show_usage\|--help" "$script_file"; then
        log "DEBUG" "Help functionality detected in $env_name"
    fi
    
    # Check for environment-specific optimizations
    case "$env_name" in
        "dev")
            if grep -q "inspector\|debug" "$script_file"; then
                log "INFO" "✅ Development debugging features detected"
            fi
            ;;
        "prod")
            if grep -q "cluster\|optimize" "$script_file"; then
                log "INFO" "✅ Production optimizations detected"
            fi
            if grep -q "ulimit\|memory" "$script_file"; then
                log "INFO" "✅ Resource limits configured for production"
            fi
            ;;
    esac
}

# Generate validation report
generate_report() {
    echo ""
    echo "📊 ENTRYPOINT VALIDATION REPORT"
    echo "==============================="
    echo "Target: $TARGET_ENV"
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
            echo "All entrypoint scripts are properly configured."
            ;;
        "warn")
            echo -e "${YELLOW}⚠️ VALIDATION WARNINGS${NC}"
            echo "Entrypoint scripts have warnings but should be functional."
            echo "Review the issues above for improvements."
            ;;
        "fail")
            echo -e "${RED}❌ VALIDATION FAILED${NC}"
            echo "Entrypoint scripts have critical issues."
            echo "Fix the problems before deployment."
            ;;
    esac
    
    echo ""
    echo "💡 RECOMMENDATIONS:"
    echo "  • Ensure all environments have consistent port configuration"
    echo "  • Verify path structures match deployment expectations"
    echo "  • Test entrypoints in their target environments"
    echo "  • Review security settings for production environments"
}

# Show usage
show_usage() {
    cat <<EOF
Entrypoint Validator - Validate environment-specific entrypoint scripts

Usage: $0 [environment] [options]

Environments:
  dev         Validate development entrypoint
  staging     Validate staging entrypoint
  prod        Validate production entrypoint
  all         Validate all entrypoints (default)

Options:
  --compare-all    Compare configurations across all environments

Examples:
  $0 staging                    # Validate staging entrypoint
  $0 all --compare-all         # Validate and compare all entrypoints
  $0 prod                      # Validate production entrypoint

Validation Checks:
  • Script structure and syntax
  • Required exports and functions
  • Environment-specific configurations
  • Signal handling and cleanup
  • Security settings
  • Performance optimizations

Files Validated:
  • entrypoints/dev.sh
  • entrypoints/staging.sh
  • entrypoints/prod.sh
EOF
}

# Main function
main() {
    if [[ "${1:-}" =~ ^(-h|--help|help)$ ]]; then
        show_usage
        exit 0
    fi
    
    echo "🔍 Entrypoint Configuration Validator"
    echo "===================================="
    echo "Target: $TARGET_ENV"
    echo "Entrypoints Directory: $ENTRYPOINTS_DIR"
    echo ""
    
    # Validate target environments
    if [[ "$TARGET_ENV" == "all" ]]; then
        local envs_to_check=("${ENVIRONMENTS[@]}")
    else
        local envs_to_check=("$TARGET_ENV")
        
        # Validate environment name
        if [[ ! " ${ENVIRONMENTS[*]} " =~ " $TARGET_ENV " ]]; then
            log "ERROR" "Invalid environment: $TARGET_ENV"
            log "INFO" "Valid environments: ${ENVIRONMENTS[*]}"
            exit 1
        fi
    fi
    
    # Run validations
    for env in "${envs_to_check[@]}"; do
        local script_file="$ENTRYPOINTS_DIR/$env.sh"
        
        if [[ ! -f "$script_file" ]]; then
            log "ERROR" "Entrypoint script not found: $script_file"
            VALIDATION_RESULTS["missing_$env"]="fail"
            OVERALL_STATUS="fail"
            continue
        fi
        
        validate_entrypoint_structure "$script_file" "$env"
        test_entrypoint "$script_file" "$env"
    done
    
    # Compare configurations if requested or if validating all
    if [[ "$COMPARE_ALL" == "--compare-all" ]] || [[ "$TARGET_ENV" == "all" ]]; then
        compare_entrypoints
    fi
    
    # Generate final report
    generate_report
    
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
