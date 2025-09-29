#!/usr/bin/env bash

# TSM Services Configuration
# This file defines all known services and their port assignments
# Replaces hardcoded values in tsm_patrol.sh and other TSM components

# Port Range Definitions
declare -A TSM_PORT_RANGES=(
    ["dev"]="5000-5999"
    ["staging"]="6000-6999"
    ["proxy"]="7000-7999"
    ["prod"]="8000-8999"
)

# Service Definitions
# Format: [service-env]=port
declare -A TSM_SERVICE_PORTS=(
    # Arcade Service
    ["arcade-dev"]="5800"
    ["arcade-staging"]="6800"
    ["arcade-prod"]="8800"

    # DevPages Service
    ["devpages-staging"]="6000"
    ["devpages-prod"]="8000"
    # Note: devpages-dev removed from port 5000 to avoid conflict with Control Center

    # PBase Service
    ["pbase-dev"]="5600"
    ["pbase-staging"]="6600"
    ["pbase-prod"]="8600"

    # Tetra Service
    ["tetra-dev"]="5444"
    ["tetra-staging"]="6444"
    ["tetra-prod"]="8444"

    # TServe (Single Test Server) Service
    ["tserve-dev"]="5500"
    ["tserve-staging"]="6500"
    ["tserve-prod"]="8500"
)

# Ignore Ports - Ports that should not be managed by TSM
# These are typically system services or other processes
declare -a TSM_IGNORE_PORTS=(
    "5000"  # macOS Control Center
    "22"    # SSH
    "80"    # HTTP
    "443"   # HTTPS
    "3306"  # MySQL
    "5432"  # PostgreSQL
)

# Service Metadata
declare -A TSM_SERVICE_META=(
    ["arcade"]="Web arcade gaming platform"
    ["devpages"]="Development documentation pages"
    ["pbase"]="Personal knowledge base"
    ["tetra"]="Main tetra development server"
    ["tserve"]="Single test server for quick file serving"
)

# Service Commands - Default commands for each service type
declare -A TSM_SERVICE_COMMANDS=(
    ["tserve"]="python3 -m http.server"
    ["tetra"]="npm run dev"
    ["devpages"]="npm run dev"
    ["arcade"]="npm run dev"
    ["pbase"]="npm run dev"
)

# Service Working Directories - Relative to project root
declare -A TSM_SERVICE_DIRS=(
    ["tserve"]="$TETRA_DIR/tserve"
    ["tetra"]="."
    ["devpages"]="."
    ["arcade"]="."
    ["pbase"]="."
)

# Load this configuration
tsm_load_services_config() {
    # This function can be called to reload configuration
    # Currently just exports the arrays for other scripts to use
    export TSM_PORT_RANGES
    export TSM_SERVICE_PORTS
    export TSM_IGNORE_PORTS
    export TSM_SERVICE_META
    export TSM_SERVICE_COMMANDS
    export TSM_SERVICE_DIRS
}

# Helper Functions

# Check if a port should be ignored by TSM
tsm_is_ignored_port() {
    local port="$1"
    for ignored_port in "${TSM_IGNORE_PORTS[@]}"; do
        if [[ "$port" == "$ignored_port" ]]; then
            return 0
        fi
    done
    return 1
}

# Get all services of a specific type
tsm_get_services_by_type() {
    local service_type="$1"
    for key in "${!TSM_SERVICE_PORTS[@]}"; do
        if [[ "$key" =~ ^${service_type}- ]]; then
            echo "$key"
        fi
    done
}

# Get service port
tsm_get_service_port() {
    local service="$1"
    local env="${2:-dev}"
    local service_key="$service-$env"
    echo "${TSM_SERVICE_PORTS[$service_key]:-}"
}

# Get service description
tsm_get_service_description() {
    local service="$1"
    echo "${TSM_SERVICE_META[$service]:-'No description available'}"
}

# Get service command
tsm_get_service_command() {
    local service="$1"
    echo "${TSM_SERVICE_COMMANDS[$service]:-''}"
}

# Get service directory
tsm_get_service_dir() {
    local service="$1"
    local dir="${TSM_SERVICE_DIRS[$service]:-'.'}"
    # Expand variables
    eval echo "$dir"
}

# Initialize configuration on load
tsm_load_services_config