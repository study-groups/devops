#!/usr/bin/env bash

# TSM Doctor - Port diagnostics and conflict resolution
# Scans ports, identifies conflicts, and helps resolve them

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Helper functions
log() { echo -e "${BLUE}[DOCTOR]${NC} $1"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
error() { echo -e "${RED}❌ $1${NC}"; }
success() { echo -e "${GREEN}✅ $1${NC}"; }
info() { echo -e "${CYAN}ℹ️  $1${NC}"; }

# Check if lsof is available
check_dependencies() {
    if ! command -v lsof >/dev/null 2>&1; then
        error "lsof command not found. Install with: brew install lsof"
        return 1
    fi
}

# Scan common development ports
scan_common_ports() {
    local ports=(3000 3001 4000 4001 5000 5001 8000 8080 8888 9000)

    log "Scanning common development ports..."
    echo
    printf "%-6s %-8s %-20s %-10s %s\n" "PORT" "STATUS" "PROCESS" "PID" "COMMAND"
    printf "%-6s %-8s %-20s %-10s %s\n" "----" "------" "-------" "---" "-------"

    for port in "${ports[@]}"; do
        local result=$(lsof -ti :$port 2>/dev/null)
        if [[ -n "$result" ]]; then
            local pid="$result"
            local process=$(ps -p $pid -o comm= 2>/dev/null || echo "unknown")
            local cmd=$(ps -p $pid -o args= 2>/dev/null | cut -c1-40 || echo "unknown")
            printf "%-6s ${RED}%-8s${NC} %-20s %-10s %s\n" "$port" "USED" "$process" "$pid" "$cmd"
        else
            printf "%-6s ${GREEN}%-8s${NC} %-20s %-10s %s\n" "$port" "FREE" "-" "-" "-"
        fi
    done
    echo
}

# Scan specific port
scan_port() {
    local port="$1"

    if [[ ! "$port" =~ ^[0-9]+$ ]]; then
        error "Invalid port number: $port"
        return 1
    fi

    log "Scanning port $port..."

    local result=$(lsof -ti :$port 2>/dev/null)
    if [[ -n "$result" ]]; then
        local pid="$result"
        local process=$(ps -p $pid -o comm= 2>/dev/null || echo "unknown")
        local cmd=$(ps -p $pid -o args= 2>/dev/null || echo "unknown")
        local user=$(ps -p $pid -o user= 2>/dev/null || echo "unknown")

        warn "Port $port is in use"
        echo "  PID:     $pid"
        echo "  Process: $process"
        echo "  User:    $user"
        echo "  Command: $cmd"
        echo

        # Check if it's a TSM process
        if tsm list 2>/dev/null | grep -q "$pid"; then
            info "This is a TSM-managed process"
            echo "  Use: tsm stop <process-name>"
        else
            info "This is NOT a TSM-managed process"
            echo "  Use: tsm doctor --kill $port"
            echo "  Or:  kill $pid"
        fi

        return 1
    else
        success "Port $port is free"
        return 0
    fi
}

# Kill process using a port
kill_port_process() {
    local port="$1"
    local force="$2"

    if [[ ! "$port" =~ ^[0-9]+$ ]]; then
        error "Invalid port number: $port"
        return 1
    fi

    local result=$(lsof -ti :$port 2>/dev/null)
    if [[ -z "$result" ]]; then
        info "Port $port is already free"
        return 0
    fi

    local pid="$result"
    local process=$(ps -p $pid -o comm= 2>/dev/null || echo "unknown")
    local cmd=$(ps -p $pid -o args= 2>/dev/null || echo "unknown")

    log "Found process using port $port:"
    echo "  PID:     $pid"
    echo "  Process: $process"
    echo "  Command: $cmd"
    echo

    # Check if it's a TSM process
    if tsm list 2>/dev/null | grep -q "$pid"; then
        warn "This is a TSM-managed process. Use 'tsm stop <process-name>' instead."
        return 1
    fi

    # Confirm unless force flag
    if [[ "$force" != "true" ]]; then
        echo -n "Kill process $pid using port $port? (y/N): "
        read -r response
        if [[ ! "$response" =~ ^[Yy]$ ]]; then
            info "Cancelled"
            return 0
        fi
    fi

    # Try graceful kill first
    log "Sending SIGTERM to process $pid..."
    if kill "$pid" 2>/dev/null; then
        sleep 2

        # Check if still running
        if kill -0 "$pid" 2>/dev/null; then
            warn "Process still running, sending SIGKILL..."
            kill -9 "$pid" 2>/dev/null
            sleep 1
        fi

        # Verify it's gone
        if ! kill -0 "$pid" 2>/dev/null; then
            success "Process $pid killed successfully"

            # Double-check port is free
            if [[ -z "$(lsof -ti :$port 2>/dev/null)" ]]; then
                success "Port $port is now free"
            else
                warn "Port $port still shows as in use (may take a moment to clear)"
            fi
        else
            error "Failed to kill process $pid"
            return 1
        fi
    else
        error "Failed to send signal to process $pid"
        return 1
    fi
}

# Diagnose environment loading issues
diagnose_env_loading() {
    local env_file="${1:-env/local.env}"

    log "Diagnosing environment file loading: $env_file"
    echo

    # Check if file exists
    if [[ ! -f "$env_file" ]]; then
        error "Environment file not found: $env_file"
        echo "  Checked from: $(pwd)"
        echo "  Try: tetra env init local"
        return 1
    fi

    success "Environment file exists: $env_file"

    # Check file permissions
    if [[ ! -r "$env_file" ]]; then
        error "Environment file is not readable"
        echo "  Try: chmod 644 $env_file"
        return 1
    fi

    success "Environment file is readable"

    # Check for PORT variable
    if grep -q "^export PORT=" "$env_file"; then
        local port_value=$(grep "^export PORT=" "$env_file" | cut -d'=' -f2)
        success "PORT variable found: $port_value"

        # Check if that port is available
        local port_num="${port_value//[^0-9]/}"
        if [[ -n "$port_num" ]]; then
            if scan_port "$port_num" >/dev/null 2>&1; then
                success "Target port $port_num is available"
            else
                warn "Target port $port_num is in use - this may cause TSM to use fallback port"
                scan_port "$port_num"
            fi
        fi
    else
        warn "No PORT variable found in $env_file"
        echo "  TSM may default to port 3000"
        echo "  Add: export PORT=4000"
    fi

    # Check for other common variables
    local required_vars=("NODE_ENV" "PD_DIR")
    for var in "${required_vars[@]}"; do
        if grep -q "^export $var=" "$env_file"; then
            success "$var variable found"
        else
            warn "$var variable not found in $env_file"
        fi
    done

    # Test sourcing the file
    log "Testing environment file sourcing..."
    if (source "$env_file" 2>/dev/null); then
        success "Environment file sources without errors"

        # Show extracted variables
        echo "  Extracted variables:"
        (source "$env_file" 2>/dev/null && env | grep -E "^(PORT|NODE_ENV|PD_DIR)=" | sed 's/^/    /')
    else
        error "Environment file has syntax errors"
        echo "  Try: bash -n $env_file"
    fi
}

# Main doctor command
tetra_tsm_doctor() {
    local subcommand="$1"
    shift

    check_dependencies || return 1

    case "$subcommand" in
        "scan"|"ports"|"")
            scan_common_ports
            ;;
        "port")
            local port="$1"
            if [[ -z "$port" ]]; then
                error "Port number required"
                echo "Usage: tsm doctor port <port-number>"
                return 1
            fi
            scan_port "$port"
            ;;
        "kill")
            local port="$1"
            local force="$2"
            if [[ -z "$port" ]]; then
                error "Port number required"
                echo "Usage: tsm doctor kill <port-number> [--force]"
                return 1
            fi
            kill_port_process "$port" "$([[ "$force" == "--force" ]] && echo "true" || echo "false")"
            ;;
        "env")
            local env_file="$1"
            diagnose_env_loading "$env_file"
            ;;
        "help"|"-h"|"--help")
            cat <<EOF
TSM Doctor - Port diagnostics and conflict resolution

Usage:
  tsm doctor [scan]              Scan common development ports
  tsm doctor port <number>       Check specific port
  tsm doctor kill <port> [--force]  Kill process using port
  tsm doctor env [file]          Diagnose environment file loading
  tsm doctor help                Show this help

Examples:
  tsm doctor                     # Scan common ports
  tsm doctor port 4000           # Check if port 4000 is free
  tsm doctor kill 4000           # Kill process using port 4000
  tsm doctor kill 3000 --force   # Kill without confirmation
  tsm doctor env env/local.env   # Check environment file

Common Issues:
  - Port conflicts preventing service startup
  - Environment variables not loading
  - TSM defaulting to unexpected ports
  - Processes left running after crashes
EOF
            ;;
        *)
            error "Unknown subcommand: $subcommand"
            echo "Use 'tsm doctor help' for usage information"
            return 1
            ;;
    esac
}

# Export the function if this script is sourced
if [[ "${BASH_SOURCE[0]}" != "${0}" ]]; then
    export -f tetra_tsm_doctor
fi