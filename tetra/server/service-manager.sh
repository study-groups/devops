#!/bin/bash

# Tetra Service Manager - Unified service control script
# Usage: ./service-manager.sh [action] [service] [environment]
# Example: ./service-manager.sh restart arcade staging

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TETRA_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Service definitions
declare -A SERVICES=(
    ["arcade-dev"]="arcade-dev.service"
    ["arcade-staging"]="arcade-staging.service"
    ["arcade-prod"]="arcade-prod.service"
    ["nginx"]="nginx"
    ["postgresql"]="postgresql"
    ["redis"]="redis-server"
)

declare -A HOSTS=(
    ["dev"]="dev@dev.pixeljamarcade.com"
    ["staging"]="staging@staging.pixeljam.com"
    ["prod"]="prod@prod.pixeljam.com"
    ["local"]="localhost"
)

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
        SVC)   echo -e "${PURPLE}[SVC]${NC}   $timestamp: $message" ;;
        *)     echo "$timestamp: $message" ;;
    esac
}

error_exit() {
    log "ERROR" "$1"
    exit 1
}

# Load Tetra environment if available
load_tetra() {
    if [[ -f "$HOME/tetra/tetra.sh" ]]; then
        source "$HOME/tetra/tetra.sh" 2>/dev/null || true
        log "DEBUG" "Tetra environment loaded"
    fi
}

# Execute command locally or remotely
execute_command() {
    local host="$1"
    local command="$2"
    local description="$3"
    
    log "SVC" "$description"
    
    if [[ "$host" == "localhost" ]]; then
        eval "$command"
    else
        ssh "$host" "$command"
    fi
}

# Get service status
get_service_status() {
    local service="$1"
    local host="$2"
    
    local cmd="systemctl is-active '$service' 2>/dev/null || echo 'inactive'"
    
    if [[ "$host" == "localhost" ]]; then
        systemctl is-active "$service" 2>/dev/null || echo "inactive"
    else
        ssh "$host" "$cmd" 2>/dev/null || echo "unknown"
    fi
}

# Service control functions
start_service() {
    local service="$1"
    local host="$2"
    
    execute_command "$host" "sudo systemctl start '$service'" "🚀 Starting service: $service"
    sleep 2
    
    local status=$(get_service_status "$service" "$host")
    if [[ "$status" == "active" ]]; then
        log "INFO" "✅ Service $service started successfully"
    else
        log "ERROR" "❌ Failed to start service $service (status: $status)"
        return 1
    fi
}

stop_service() {
    local service="$1"
    local host="$2"
    
    execute_command "$host" "sudo systemctl stop '$service'" "🛑 Stopping service: $service"
    sleep 2
    
    local status=$(get_service_status "$service" "$host")
    if [[ "$status" == "inactive" ]]; then
        log "INFO" "✅ Service $service stopped successfully"
    else
        log "WARN" "⚠️ Service $service may still be running (status: $status)"
    fi
}

restart_service() {
    local service="$1"
    local host="$2"
    
    execute_command "$host" "sudo systemctl restart '$service'" "🔄 Restarting service: $service"
    sleep 3
    
    local status=$(get_service_status "$service" "$host")
    if [[ "$status" == "active" ]]; then
        log "INFO" "✅ Service $service restarted successfully"
    else
        log "ERROR" "❌ Failed to restart service $service (status: $status)"
        return 1
    fi
}

reload_service() {
    local service="$1"
    local host="$2"
    
    execute_command "$host" "sudo systemctl reload '$service'" "🔃 Reloading service: $service"
    sleep 1
    
    log "INFO" "✅ Service $service reloaded"
}

enable_service() {
    local service="$1"
    local host="$2"
    
    execute_command "$host" "sudo systemctl enable '$service'" "⚡ Enabling service: $service"
    log "INFO" "✅ Service $service enabled"
}

disable_service() {
    local service="$1"
    local host="$2"
    
    execute_command "$host" "sudo systemctl disable '$service'" "🚫 Disabling service: $service"
    log "INFO" "✅ Service $service disabled"
}

# Show service status
show_status() {
    local service="$1"
    local host="$2"
    
    log "SVC" "📊 Service status for: $service"
    
    if [[ "$host" == "localhost" ]]; then
        systemctl status "$service" --no-pager --lines=10
    else
        ssh "$host" "systemctl status '$service' --no-pager --lines=10"
    fi
}

# Show service logs
show_logs() {
    local service="$1"
    local host="$2"
    local lines="${3:-50}"
    
    log "SVC" "📋 Recent logs for: $service (last $lines lines)"
    
    if [[ "$host" == "localhost" ]]; then
        journalctl -u "$service" --no-pager -n "$lines"
    else
        ssh "$host" "journalctl -u '$service' --no-pager -n '$lines'"
    fi
}

# List all services
list_services() {
    local env="$1"
    local host="${HOSTS[$env]}"
    
    log "SVC" "📋 Listing services on $env ($host)"
    
    echo ""
    printf "%-20s %-10s %-15s %s\n" "SERVICE" "STATUS" "ENABLED" "DESCRIPTION"
    echo "=================================================================="
    
    for service_key in "${!SERVICES[@]}"; do
        local service="${SERVICES[$service_key]}"
        
        # Skip services not relevant to this environment
        if [[ "$service_key" != *"$env"* ]] && [[ "$service_key" != "nginx" ]] && [[ "$service_key" != "postgresql" ]] && [[ "$service_key" != "redis" ]]; then
            continue
        fi
        
        local status=$(get_service_status "$service" "$host")
        local enabled="unknown"
        
        if [[ "$host" == "localhost" ]]; then
            enabled=$(systemctl is-enabled "$service" 2>/dev/null || echo "disabled")
        else
            enabled=$(ssh "$host" "systemctl is-enabled '$service' 2>/dev/null || echo 'disabled'")
        fi
        
        # Color code status
        local status_display="$status"
        case "$status" in
            "active") status_display="${GREEN}active${NC}" ;;
            "inactive") status_display="${RED}inactive${NC}" ;;
            "failed") status_display="${RED}failed${NC}" ;;
            *) status_display="${YELLOW}$status${NC}" ;;
        esac
        
        printf "%-20s %-20s %-15s %s\n" "$service_key" "$status_display" "$enabled" "$service"
    done
    
    echo ""
}

# Health check
health_check() {
    local env="$1"
    local host="${HOSTS[$env]}"
    
    log "SVC" "🏥 Running health check on $env"
    
    local total_services=0
    local active_services=0
    local failed_services=()
    
    for service_key in "${!SERVICES[@]}"; do
        local service="${SERVICES[$service_key]}"
        
        # Skip services not relevant to this environment
        if [[ "$service_key" != *"$env"* ]] && [[ "$service_key" != "nginx" ]] && [[ "$service_key" != "postgresql" ]] && [[ "$service_key" != "redis" ]]; then
            continue
        fi
        
        ((total_services++))
        local status=$(get_service_status "$service" "$host")
        
        if [[ "$status" == "active" ]]; then
            ((active_services++))
            log "INFO" "✅ $service_key: $status"
        else
            failed_services+=("$service_key:$status")
            log "WARN" "❌ $service_key: $status"
        fi
    done
    
    echo ""
    log "SVC" "📊 Health Check Summary:"
    log "INFO" "Total services: $total_services"
    log "INFO" "Active services: $active_services"
    log "INFO" "Failed services: $((total_services - active_services))"
    
    if [[ ${#failed_services[@]} -gt 0 ]]; then
        echo ""
        log "WARN" "Failed services:"
        for failed in "${failed_services[@]}"; do
            echo "  - $failed"
        done
        return 1
    fi
    
    log "INFO" "✅ All services healthy"
    return 0
}

# Show usage
show_usage() {
    cat <<EOF
Tetra Service Manager - Unified service control

Usage: $0 [action] [service] [environment]

Actions:
  start       Start a service
  stop        Stop a service  
  restart     Restart a service
  reload      Reload a service configuration
  enable      Enable a service (auto-start)
  disable     Disable a service
  status      Show service status
  logs        Show service logs
  list        List all services
  health      Run health check on all services

Services:
  arcade-dev      Development arcade service
  arcade-staging  Staging arcade service  
  arcade-prod     Production arcade service
  nginx           Nginx web server
  postgresql      PostgreSQL database
  redis           Redis cache server

Environments:
  dev         Development server
  staging     Staging server
  prod        Production server
  local       Local machine

Examples:
  $0 restart arcade-staging staging    # Restart staging arcade service
  $0 status nginx local               # Check local nginx status
  $0 logs arcade-prod prod 100       # Show last 100 lines of prod logs
  $0 list staging                     # List all services on staging
  $0 health prod                      # Run health check on production
  $0 start arcade-dev dev             # Start development service

Notes:
  - Requires SSH access to remote environments
  - Requires sudo privileges for service management
  - Use 'local' environment for local machine operations
EOF
}

# Main function
main() {
    local action="${1:-help}"
    local service="${2:-}"
    local environment="${3:-local}"
    local extra="${4:-}"
    
    # Load Tetra environment
    load_tetra
    
    case "$action" in
        "help"|"-h"|"--help")
            show_usage
            exit 0
            ;;
        "list")
            if [[ -z "$service" ]]; then
                environment="$service"
            fi
            if [[ -z "${HOSTS[$environment]:-}" ]]; then
                error_exit "Invalid environment: $environment"
            fi
            list_services "$environment"
            ;;
        "health")
            if [[ -z "$service" ]]; then
                environment="$service"
            fi
            if [[ -z "${HOSTS[$environment]:-}" ]]; then
                error_exit "Invalid environment: $environment"
            fi
            health_check "$environment"
            ;;
        "start"|"stop"|"restart"|"reload"|"enable"|"disable")
            if [[ -z "$service" ]]; then
                error_exit "Service name required for action: $action"
            fi
            if [[ -z "${SERVICES[$service]:-}" ]]; then
                error_exit "Unknown service: $service"
            fi
            if [[ -z "${HOSTS[$environment]:-}" ]]; then
                error_exit "Invalid environment: $environment"
            fi
            
            local service_name="${SERVICES[$service]}"
            local host="${HOSTS[$environment]}"
            
            case "$action" in
                "start") start_service "$service_name" "$host" ;;
                "stop") stop_service "$service_name" "$host" ;;
                "restart") restart_service "$service_name" "$host" ;;
                "reload") reload_service "$service_name" "$host" ;;
                "enable") enable_service "$service_name" "$host" ;;
                "disable") disable_service "$service_name" "$host" ;;
            esac
            ;;
        "status")
            if [[ -z "$service" ]]; then
                error_exit "Service name required for status check"
            fi
            if [[ -z "${SERVICES[$service]:-}" ]]; then
                error_exit "Unknown service: $service"
            fi
            if [[ -z "${HOSTS[$environment]:-}" ]]; then
                error_exit "Invalid environment: $environment"
            fi
            
            local service_name="${SERVICES[$service]}"
            local host="${HOSTS[$environment]}"
            show_status "$service_name" "$host"
            ;;
        "logs")
            if [[ -z "$service" ]]; then
                error_exit "Service name required for logs"
            fi
            if [[ -z "${SERVICES[$service]:-}" ]]; then
                error_exit "Unknown service: $service"
            fi
            if [[ -z "${HOSTS[$environment]:-}" ]]; then
                error_exit "Invalid environment: $environment"
            fi
            
            local service_name="${SERVICES[$service]}"
            local host="${HOSTS[$environment]}"
            local lines="${extra:-50}"
            show_logs "$service_name" "$host" "$lines"
            ;;
        *)
            error_exit "Unknown action: $action. Use 'help' for usage information."
            ;;
    esac
}

# Handle interruption
trap 'log "ERROR" "Service operation interrupted"; exit 130' INT TERM

# Run main function
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
