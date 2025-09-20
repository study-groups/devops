#!/usr/bin/env bash

# TKM Utilities Module
# Provides safe file operations, validation, and common utilities

# Safe file update with atomic operations and backup
tkm_safe_file_update() {
    local target_file="$1"
    local content="$2"
    local create_backup="${3:-true}"
    
    # Validate inputs
    if [[ -z "$target_file" ]]; then
        tkm_log "No target file specified" "ERROR"
        return 1
    fi
    
    if [[ -z "$content" ]]; then
        tkm_log "No content provided" "ERROR"
        return 1
    fi
    
    # Create backup if file exists and backup is requested
    local backup_file=""
    if [[ "$create_backup" == "true" && -f "$target_file" ]]; then
        backup_file="${target_file}.backup.$(date +%s)"
        if ! cp "$target_file" "$backup_file" 2>/dev/null; then
            tkm_log "Failed to create backup of $target_file" "ERROR"
            return 1
        fi
    fi
    
    # Write to temporary file first
    local temp_file=$(mktemp) || {
        tkm_log "Failed to create temporary file" "ERROR"
        return 1
    }
    
    # Ensure temp file is cleaned up on exit
    trap "rm -f '$temp_file'" EXIT
    
    # Write content to temp file
    if ! echo "$content" > "$temp_file"; then
        tkm_log "Failed to write content to temporary file" "ERROR"
        return 1
    fi
    
    # Validate content if it's JSON
    if [[ "$target_file" == *.json ]]; then
        if command -v jq >/dev/null 2>&1; then
            if ! jq empty "$temp_file" 2>/dev/null; then
                tkm_log "Generated content is not valid JSON" "ERROR"
                return 1
            fi
        fi
    fi
    
    # Atomic move
    if ! mv "$temp_file" "$target_file"; then
        tkm_log "Failed to update $target_file" "ERROR"
        # Restore backup if it exists
        if [[ -n "$backup_file" && -f "$backup_file" ]]; then
            mv "$backup_file" "$target_file"
            tkm_log "Restored backup file" "WARNING"
        fi
        return 1
    fi
    
    # Clean up backup after successful update (keep only most recent)
    if [[ -n "$backup_file" ]]; then
        # Keep backup but remove older ones
        find "$(dirname "$target_file")" -name "$(basename "$target_file").backup.*" -type f | \
            sort -r | tail -n +4 | xargs rm -f 2>/dev/null || true
    fi
    
    tkm_log "Successfully updated file: $target_file"
    return 0
}

# Safe JSON file update using jq
tkm_safe_json_update() {
    local target_file="$1"
    local jq_filter="$2"
    local input_data="${3:-{}}"
    
    if [[ -z "$target_file" || -z "$jq_filter" ]]; then
        echo "Error: Missing required parameters for JSON update" >&2
        return 1
    fi
    
    if ! command -v jq >/dev/null 2>&1; then
        echo "Error: jq is required for safe JSON operations" >&2
        return 1
    fi
    
    # Generate JSON content using jq
    local json_content
    if ! json_content=$(echo "$input_data" | jq "$jq_filter" 2>/dev/null); then
        echo "Error: Failed to generate JSON with filter: $jq_filter" >&2
        return 1
    fi
    
    # Use safe file update
    tkm_safe_file_update "$target_file" "$json_content" true
}

# Get current organization name with fallback
tkm_get_current_org_name() {
    local current_org=""
    
    # Try to get from current org file
    if [[ -f "$TKM_CURRENT_ORG_FILE" ]]; then
        current_org=$(cat "$TKM_CURRENT_ORG_FILE" 2>/dev/null | tr -d '\n\r')
    fi
    
    # If we have a current org, get its DO name
    if [[ -n "$current_org" ]]; then
        local org_conf="$TKM_ORGS_DIR/$current_org/metadata/org.conf"
        if [[ -f "$org_conf" ]]; then
            local do_name=$(grep '^DO_NAME=' "$org_conf" 2>/dev/null | cut -d'"' -f2)
            if [[ -n "$do_name" ]]; then
                echo "$do_name"
                return 0
            fi
        fi
        # Fallback to NH name if DO name not found
        echo "$current_org"
        return 0
    fi
    
    # Fallback to default if no organization is set
    echo "default_org"
    return 0
}

# Validate environment name
tkm_validate_env_name() {
    local env_name="$1"
    
    if [[ -z "$env_name" ]]; then
        echo "Error: Environment name cannot be empty" >&2
        return 1
    fi
    
    if [[ ! "$env_name" =~ ^[a-zA-Z0-9_-]+$ ]]; then
        echo "Error: Environment name must contain only letters, numbers, underscores, and dashes" >&2
        return 1
    fi
    
    if [[ ${#env_name} -gt 50 ]]; then
        echo "Error: Environment name too long (max 50 characters)" >&2
        return 1
    fi
    
    return 0
}

# Validate IP address
tkm_validate_ip() {
    local ip="$1"
    local allow_empty="${2:-false}"
    
    if [[ -z "$ip" ]]; then
        if [[ "$allow_empty" == "true" ]]; then
            return 0
        else
            echo "Error: IP address cannot be empty" >&2
            return 1
        fi
    fi
    
    # Basic IP validation (IPv4)
    if [[ "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        local IFS='.'
        local -a ip_parts=($ip)
        for part in "${ip_parts[@]}"; do
            if [[ $part -gt 255 ]]; then
                echo "Error: Invalid IP address: $ip" >&2
                return 1
            fi
        done
        return 0
    else
        echo "Error: Invalid IP address format: $ip" >&2
        return 1
    fi
}

# Get unified environment configuration
tkm_get_environments() {
    local output_format="${1:-simple}"  # simple|detailed|json
    
    # Try organization-specific configuration first
    local current_org=$(tkm_get_current_org_name)
    local org_servers_file="$TKM_ORGS_DIR/$current_org/environments/servers.conf"
    
    if [[ -f "$org_servers_file" ]]; then
        _tkm_parse_org_servers "$org_servers_file" "$output_format"
    elif [[ -f "$TKM_CONFIG_DIR/environments.conf" ]]; then
        _tkm_parse_basic_environments "$TKM_CONFIG_DIR/environments.conf" "$output_format"
    else
        echo "Error: No environment configuration found" >&2
        return 1
    fi
}

# Parse organization servers file
_tkm_parse_org_servers() {
    local servers_file="$1"
    local output_format="$2"
    
    while IFS=: read -r env_name public_ip private_ip floating_ip user privileges specs; do
        # Skip comments and empty lines
        [[ "$env_name" =~ ^#.*$ ]] && continue
        [[ -z "$env_name" ]] && continue
        
        case "$output_format" in
            simple)
                echo "$env_name:$public_ip:$user:$privileges"
                ;;
            detailed)
                echo "$env_name:$public_ip:$private_ip:$floating_ip:$user:$privileges:$specs"
                ;;
            json)
                jq -n \
                    --arg name "$env_name" \
                    --arg public_ip "$public_ip" \
                    --arg private_ip "$private_ip" \
                    --arg floating_ip "$floating_ip" \
                    --arg user "$user" \
                    --arg privileges "$privileges" \
                    --arg specs "$specs" \
                    '{
                        name: $name,
                        public_ip: $public_ip,
                        private_ip: $private_ip,
                        floating_ip: $floating_ip,
                        user: $user,
                        privileges: $privileges,
                        specs: $specs
                    }'
                ;;
        esac
    done < "$servers_file"
}

# Parse basic environments file
_tkm_parse_basic_environments() {
    local env_file="$1"
    local output_format="$2"
    
    while IFS=: read -r env_name host user privileges; do
        # Skip comments and empty lines
        [[ "$env_name" =~ ^#.*$ ]] && continue
        [[ -z "$env_name" ]] && continue
        
        case "$output_format" in
            simple)
                echo "$env_name:$host:$user:$privileges"
                ;;
            detailed)
                echo "$env_name:$host:::$user:$privileges:"
                ;;
            json)
                jq -n \
                    --arg name "$env_name" \
                    --arg public_ip "$host" \
                    --arg user "$user" \
                    --arg privileges "$privileges" \
                    '{
                        name: $name,
                        public_ip: $public_ip,
                        private_ip: "",
                        floating_ip: "",
                        user: $user,
                        privileges: $privileges,
                        specs: ""
                    }'
                ;;
        esac
    done < "$env_file"
}

# Logging function with levels
tkm_log() {
    local message="$1"
    local level="${2:-INFO}"
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    # Ensure log directory exists
    mkdir -p "$TKM_LOGS_DIR" 2>/dev/null || true
    
    echo "[$timestamp] [$level] $message" >> "$TKM_LOGS_DIR/tkm.log"
    
    # Color codes
    local RED='\033[0;31m'
    local NC='\033[0m' # No Color
    
    # Also log to stderr for ERROR level with color
    if [[ "$level" == "ERROR" ]]; then
        echo -e "${RED}[$timestamp] [$level] $message${NC}" >&2
    fi
}

# Check if required dependencies are available
tkm_check_dependencies() {
    local missing_deps=()
    local required_commands=("ssh-keygen" "ssh" "date" "find" "grep" "awk")
    local optional_commands=("jq" "python3")
    
    echo "Checking TKM dependencies..."
    
    # Check required commands
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" >/dev/null 2>&1; then
            missing_deps+=("$cmd (required)")
        fi
    done
    
    # Check optional commands
    for cmd in "${optional_commands[@]}"; do
        if ! command -v "$cmd" >/dev/null 2>&1; then
            echo "⚠️  Optional dependency missing: $cmd"
        fi
    done
    
    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        echo "❌ Missing required dependencies:"
        printf "  %s\n" "${missing_deps[@]}"
        return 1
    else
        echo "✅ All required dependencies available"
        return 0
    fi
}

# Validate TKM environment
tkm_validate_environment() {
    local issues=0
    
    echo "Validating TKM environment..."
    
    # Check TETRA_DIR
    if [[ -z "$TETRA_DIR" ]]; then
        echo "❌ TETRA_DIR environment variable not set"
        ((issues++))
    elif [[ ! -d "$TETRA_DIR" ]]; then
        echo "❌ TETRA_DIR directory does not exist: $TETRA_DIR"
        ((issues++))
    else
        echo "✅ TETRA_DIR: $TETRA_DIR"
    fi
    
    # Check TKM directories
    local required_dirs=("$TKM_DIR" "$TKM_KEYS_DIR" "$TKM_CONFIG_DIR" "$TKM_LOGS_DIR")
    for dir in "${required_dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            echo "❌ Required directory missing: $dir"
            ((issues++))
        fi
    done
    
    # Check dependencies
    if ! tkm_check_dependencies >/dev/null 2>&1; then
        ((issues++))
    fi
    
    if [[ $issues -eq 0 ]]; then
        echo "✅ TKM environment validation passed"
        return 0
    else
        echo "❌ TKM environment validation failed with $issues issues"
        return 1
    fi
}

# Create a temporary file with proper cleanup
tkm_mktemp() {
    local template="${1:-tkm.XXXXXX}"
    local temp_file
    
    if temp_file=$(mktemp -t "$template" 2>/dev/null); then
        echo "$temp_file"
        return 0
    else
        echo "Error: Failed to create temporary file" >&2
        return 1
    fi
}

# Safe directory creation
tkm_mkdir_safe() {
    local dir_path="$1"
    local mode="${2:-755}"
    
    if [[ -z "$dir_path" ]]; then
        echo "Error: Directory path cannot be empty" >&2
        return 1
    fi
    
    if [[ -e "$dir_path" && ! -d "$dir_path" ]]; then
        echo "Error: Path exists but is not a directory: $dir_path" >&2
        return 1
    fi
    
    if ! mkdir -p "$dir_path" 2>/dev/null; then
        echo "Error: Failed to create directory: $dir_path" >&2
        return 1
    fi
    
    if ! chmod "$mode" "$dir_path" 2>/dev/null; then
        echo "Warning: Failed to set permissions on directory: $dir_path" >&2
    fi
    
    return 0
}
