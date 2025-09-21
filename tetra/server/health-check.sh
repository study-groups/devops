#!/bin/bash

# Tetra Health Check - Comprehensive system and service monitoring
# Usage: ./health-check.sh [environment] [--detailed] [--json]
# Example: ./health-check.sh staging --detailed

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TETRA_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Default values
ENVIRONMENT="${1:-local}"
DETAILED_MODE=false
JSON_OUTPUT=false

# Parse arguments
for arg in "$@"; do
    case "$arg" in
        --detailed) DETAILED_MODE=true ;;
        --json) JSON_OUTPUT=true ;;
    esac
done

# Host mappings
declare -A HOSTS=(
    ["dev"]="dev@dev.pixeljamarcade.com"
    ["staging"]="staging@staging.pixeljam.com"
    ["prod"]="prod@prod.pixeljam.com"
    ["local"]="localhost"
)

# Service definitions
declare -A SERVICES=(
    ["arcade"]="arcade-${ENVIRONMENT}.service"
    ["nginx"]="nginx"
    ["postgresql"]="postgresql"
    ["redis"]="redis-server"
)

# Health check URLs
declare -A HEALTH_URLS=(
    ["dev"]="https://dev.pixeljamarcade.com/health"
    ["staging"]="https://staging.pixeljam.com/health"
    ["prod"]="https://pixeljamarcade.com/health"
    ["local"]="http://localhost:3000/health"
)

# Colors (disabled for JSON output)
if [[ "$JSON_OUTPUT" == "false" ]]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    PURPLE='\033[0;35m'
    NC='\033[0m'
else
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
    PURPLE=''
    NC=''
fi

# Results storage
declare -A RESULTS=()
OVERALL_STATUS="healthy"
START_TIME=$(date +%s)

# Logging
log() {
    if [[ "$JSON_OUTPUT" == "false" ]]; then
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
    fi
}

# Execute command locally or remotely
execute_command() {
    local host="$1"
    local command="$2"
    
    if [[ "$host" == "localhost" ]]; then
        eval "$command" 2>/dev/null
    else
        ssh -o ConnectTimeout=10 -o BatchMode=yes "$host" "$command" 2>/dev/null
    fi
}

# Check SSH connectivity
check_ssh_connectivity() {
    local host="$1"
    
    if [[ "$host" == "localhost" ]]; then
        RESULTS["ssh_connectivity"]="ok"
        return 0
    fi
    
    log "CHECK" "🔗 Testing SSH connectivity to $host..."
    
    if execute_command "$host" "echo 'SSH OK'" >/dev/null 2>&1; then
        RESULTS["ssh_connectivity"]="ok"
        log "INFO" "✅ SSH connectivity: OK"
        return 0
    else
        RESULTS["ssh_connectivity"]="failed"
        OVERALL_STATUS="unhealthy"
        log "ERROR" "❌ SSH connectivity: FAILED"
        return 1
    fi
}

# Check system resources
check_system_resources() {
    local host="$1"
    
    log "CHECK" "💻 Checking system resources..."
    
    # CPU usage
    local cpu_usage
    cpu_usage=$(execute_command "$host" "top -bn1 | grep 'Cpu(s)' | awk '{print \$2}' | cut -d'%' -f1" 2>/dev/null || echo "unknown")
    RESULTS["cpu_usage"]="$cpu_usage"
    
    # Memory usage
    local memory_info
    memory_info=$(execute_command "$host" "free -m | awk 'NR==2{printf \"%.1f\", \$3*100/\$2}'" 2>/dev/null || echo "unknown")
    RESULTS["memory_usage"]="$memory_info"
    
    # Disk usage
    local disk_usage
    disk_usage=$(execute_command "$host" "df -h / | awk 'NR==2{print \$5}' | cut -d'%' -f1" 2>/dev/null || echo "unknown")
    RESULTS["disk_usage"]="$disk_usage"
    
    # Load average
    local load_avg
    load_avg=$(execute_command "$host" "uptime | awk -F'load average:' '{print \$2}' | cut -d',' -f1 | xargs" 2>/dev/null || echo "unknown")
    RESULTS["load_average"]="$load_avg"
    
    if [[ "$DETAILED_MODE" == "true" ]]; then
        log "INFO" "💾 CPU Usage: ${cpu_usage}%"
        log "INFO" "🧠 Memory Usage: ${memory_info}%"
        log "INFO" "💿 Disk Usage: ${disk_usage}%"
        log "INFO" "⚖️ Load Average: $load_avg"
    fi
    
    # Check for critical resource usage
    if [[ "$cpu_usage" != "unknown" ]] && (( $(echo "$cpu_usage > 90" | bc -l) )); then
        OVERALL_STATUS="warning"
        log "WARN" "⚠️ High CPU usage: ${cpu_usage}%"
    fi
    
    if [[ "$memory_info" != "unknown" ]] && (( $(echo "$memory_info > 90" | bc -l) )); then
        OVERALL_STATUS="warning"
        log "WARN" "⚠️ High memory usage: ${memory_info}%"
    fi
    
    if [[ "$disk_usage" != "unknown" ]] && (( disk_usage > 90 )); then
        OVERALL_STATUS="warning"
        log "WARN" "⚠️ High disk usage: ${disk_usage}%"
    fi
}

# Check service status
check_services() {
    local host="$1"
    
    log "CHECK" "⚙️ Checking service status..."
    
    local service_count=0
    local active_count=0
    
    for service_key in "${!SERVICES[@]}"; do
        local service="${SERVICES[$service_key]}"
        
        # Skip arcade service if not matching environment
        if [[ "$service_key" == "arcade" && "$service" != "arcade-${ENVIRONMENT}.service" ]]; then
            continue
        fi
        
        ((service_count++))
        
        local status
        status=$(execute_command "$host" "systemctl is-active '$service'" 2>/dev/null || echo "inactive")
        RESULTS["service_${service_key}"]="$status"
        
        if [[ "$status" == "active" ]]; then
            ((active_count++))
            if [[ "$DETAILED_MODE" == "true" ]]; then
                log "INFO" "✅ $service_key: $status"
            fi
        else
            OVERALL_STATUS="unhealthy"
            log "ERROR" "❌ $service_key: $status"
        fi
    done
    
    RESULTS["services_total"]="$service_count"
    RESULTS["services_active"]="$active_count"
    
    if [[ "$active_count" -eq "$service_count" ]]; then
        log "INFO" "✅ All services running ($active_count/$service_count)"
    else
        log "ERROR" "❌ Services failing ($active_count/$service_count active)"
    fi
}

# Check network connectivity
check_network() {
    local host="$1"
    
    log "CHECK" "🌐 Checking network connectivity..."
    
    # Test DNS resolution
    local dns_status
    if execute_command "$host" "nslookup google.com" >/dev/null 2>&1; then
        dns_status="ok"
        if [[ "$DETAILED_MODE" == "true" ]]; then
            log "INFO" "✅ DNS resolution: OK"
        fi
    else
        dns_status="failed"
        OVERALL_STATUS="warning"
        log "WARN" "⚠️ DNS resolution: FAILED"
    fi
    RESULTS["dns_resolution"]="$dns_status"
    
    # Test internet connectivity
    local internet_status
    if execute_command "$host" "curl -s --connect-timeout 5 https://google.com" >/dev/null 2>&1; then
        internet_status="ok"
        if [[ "$DETAILED_MODE" == "true" ]]; then
            log "INFO" "✅ Internet connectivity: OK"
        fi
    else
        internet_status="failed"
        OVERALL_STATUS="warning"
        log "WARN" "⚠️ Internet connectivity: FAILED"
    fi
    RESULTS["internet_connectivity"]="$internet_status"
}

# Check application health
check_application() {
    local health_url="${HEALTH_URLS[$ENVIRONMENT]}"
    
    if [[ -z "$health_url" ]]; then
        log "WARN" "⚠️ No health URL configured for environment: $ENVIRONMENT"
        RESULTS["application_health"]="unknown"
        return
    fi
    
    log "CHECK" "🏥 Checking application health at $health_url..."
    
    local response_code
    response_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 "$health_url" 2>/dev/null || echo "000")
    
    RESULTS["application_health_code"]="$response_code"
    
    if [[ "$response_code" == "200" ]]; then
        RESULTS["application_health"]="ok"
        log "INFO" "✅ Application health: OK (HTTP $response_code)"
    else
        RESULTS["application_health"]="failed"
        OVERALL_STATUS="unhealthy"
        log "ERROR" "❌ Application health: FAILED (HTTP $response_code)"
    fi
}

# Check database connectivity
check_database() {
    local host="$1"
    
    log "CHECK" "🗄️ Checking database connectivity..."
    
    # Check PostgreSQL
    if execute_command "$host" "systemctl is-active postgresql" >/dev/null 2>&1; then
        local pg_status
        if execute_command "$host" "sudo -u postgres psql -c 'SELECT 1;'" >/dev/null 2>&1; then
            pg_status="ok"
            if [[ "$DETAILED_MODE" == "true" ]]; then
                log "INFO" "✅ PostgreSQL: OK"
            fi
        else
            pg_status="failed"
            OVERALL_STATUS="warning"
            log "WARN" "⚠️ PostgreSQL: Connection failed"
        fi
        RESULTS["postgresql"]="$pg_status"
    else
        RESULTS["postgresql"]="inactive"
        if [[ "$DETAILED_MODE" == "true" ]]; then
            log "INFO" "ℹ️ PostgreSQL: Not running"
        fi
    fi
    
    # Check Redis
    if execute_command "$host" "systemctl is-active redis-server" >/dev/null 2>&1; then
        local redis_status
        if execute_command "$host" "redis-cli ping" | grep -q "PONG" 2>/dev/null; then
            redis_status="ok"
            if [[ "$DETAILED_MODE" == "true" ]]; then
                log "INFO" "✅ Redis: OK"
            fi
        else
            redis_status="failed"
            OVERALL_STATUS="warning"
            log "WARN" "⚠️ Redis: Connection failed"
        fi
        RESULTS["redis"]="$redis_status"
    else
        RESULTS["redis"]="inactive"
        if [[ "$DETAILED_MODE" == "true" ]]; then
            log "INFO" "ℹ️ Redis: Not running"
        fi
    fi
}

# Generate JSON output
output_json() {
    local end_time=$(date +%s)
    local duration=$((end_time - START_TIME))
    
    echo "{"
    echo "  \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\","
    echo "  \"environment\": \"$ENVIRONMENT\","
    echo "  \"overall_status\": \"$OVERALL_STATUS\","
    echo "  \"duration_seconds\": $duration,"
    echo "  \"checks\": {"
    
    local first=true
    for key in $(printf '%s\n' "${!RESULTS[@]}" | sort); do
        if [[ "$first" == "true" ]]; then
            first=false
        else
            echo ","
        fi
        echo -n "    \"$key\": \"${RESULTS[$key]}\""
    done
    
    echo ""
    echo "  }"
    echo "}"
}

# Generate summary report
output_summary() {
    local end_time=$(date +%s)
    local duration=$((end_time - START_TIME))
    
    echo ""
    echo "=================================="
    echo "🏥 HEALTH CHECK SUMMARY"
    echo "=================================="
    echo "Environment: $ENVIRONMENT"
    echo "Timestamp: $(date)"
    echo "Duration: ${duration}s"
    echo "Overall Status: $OVERALL_STATUS"
    echo ""
    
    # Status indicator
    case "$OVERALL_STATUS" in
        "healthy")
            echo -e "${GREEN}✅ SYSTEM HEALTHY${NC}"
            ;;
        "warning")
            echo -e "${YELLOW}⚠️ SYSTEM WARNING${NC}"
            ;;
        "unhealthy")
            echo -e "${RED}❌ SYSTEM UNHEALTHY${NC}"
            ;;
    esac
    
    echo ""
    echo "Quick Status:"
    echo "- SSH: ${RESULTS[ssh_connectivity]:-unknown}"
    echo "- Services: ${RESULTS[services_active]:-0}/${RESULTS[services_total]:-0} active"
    echo "- Application: ${RESULTS[application_health]:-unknown}"
    echo "- CPU: ${RESULTS[cpu_usage]:-unknown}%"
    echo "- Memory: ${RESULTS[memory_usage]:-unknown}%"
    echo "- Disk: ${RESULTS[disk_usage]:-unknown}%"
}

# Show usage
show_usage() {
    cat <<EOF
Tetra Health Check - Comprehensive system monitoring

Usage: $0 [environment] [options]

Environments:
  dev         Development server
  staging     Staging server  
  prod        Production server
  local       Local machine (default)

Options:
  --detailed  Show detailed check results
  --json      Output results in JSON format

Examples:
  $0                          # Check local system
  $0 staging                  # Check staging server
  $0 prod --detailed          # Detailed production check
  $0 staging --json           # JSON output for staging

Health Checks:
  - SSH connectivity (remote environments)
  - System resources (CPU, memory, disk, load)
  - Service status (arcade, nginx, postgresql, redis)
  - Network connectivity (DNS, internet)
  - Application health endpoints
  - Database connectivity

Exit Codes:
  0  All checks passed (healthy)
  1  Some checks failed (warning/unhealthy)
  2  Critical error (unable to perform checks)
EOF
}

# Main function
main() {
    if [[ "${1:-}" =~ ^(-h|--help|help)$ ]]; then
        show_usage
        exit 0
    fi
    
    # Validate environment
    if [[ -z "${HOSTS[$ENVIRONMENT]:-}" ]]; then
        echo "Error: Invalid environment: $ENVIRONMENT" >&2
        echo "Valid environments: ${!HOSTS[*]}" >&2
        exit 2
    fi
    
    local host="${HOSTS[$ENVIRONMENT]}"
    
    if [[ "$JSON_OUTPUT" == "false" ]]; then
        echo "🏥 Starting health check for: $ENVIRONMENT"
        echo "Target: $host"
        echo "Detailed mode: $DETAILED_MODE"
        echo ""
    fi
    
    # Run health checks
    check_ssh_connectivity "$host" || true
    check_system_resources "$host" || true
    check_services "$host" || true
    check_network "$host" || true
    check_application || true
    check_database "$host" || true
    
    # Output results
    if [[ "$JSON_OUTPUT" == "true" ]]; then
        output_json
    else
        output_summary
    fi
    
    # Set exit code based on overall status
    case "$OVERALL_STATUS" in
        "healthy") exit 0 ;;
        "warning") exit 1 ;;
        "unhealthy") exit 1 ;;
        *) exit 2 ;;
    esac
}

# Handle interruption
trap 'log "ERROR" "Health check interrupted"; exit 130' INT TERM

# Run main function
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
