#!/usr/bin/env bash

# TKM Core Operations
# Handles key generation, deployment, and rotation

# Source utilities
TKM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$TKM_DIR/tkm_utils.sh"

# Generate environment-specific key pairs
tkm_generate_keys() {
    local env="${1:-all}"
    local key_type="${2:-deploy}"
    local expiry_days="${3:-30}"
    
    # Validate environment
    if [[ "$env" != "all" ]]; then
        if ! tkm_validate_env_name "$env"; then
            return 1
        fi
    fi
    
    # Validate key type
    if [[ ! "$key_type" =~ ^(deploy|admin|test)$ ]]; then
        echo "Error: Invalid key type '$key_type'. Must be: deploy, admin, or test" >&2
        return 1
    fi
    
    # Validate expiry days
    if [[ ! "$expiry_days" =~ ^[0-9]+$ ]] || [[ "$expiry_days" -lt 1 ]] || [[ "$expiry_days" -gt 365 ]]; then
        echo "Error: Invalid expiry days '$expiry_days'. Must be between 1 and 365" >&2
        return 1
    fi
    
    # Validate TKM environment
    if ! tkm_validate_environment >/dev/null 2>&1; then
        echo "Error: TKM environment validation failed. Run 'tkm info' for details" >&2
        return 1
    fi
    
    echo "=== TKM Key Generation ==="
    echo "Target: $env"
    echo "Type: $key_type"
    echo "Expiry: $expiry_days days"
    echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo
    
    tkm_log "Generating keys for environment: $env, type: $key_type" "INFO"
    
    local success_count=0
    local total_count=0
    
    if [[ "$env" == "all" ]]; then
        # Generate keys for all configured environments from current organization
        local current_org=$(tkm_org_current)
        if [[ -n "$current_org" ]]; then
            local org_servers_file="$TKM_ORGS_DIR/$current_org/environments/servers.conf"
            if [[ -f "$org_servers_file" ]]; then
                while IFS= read -r line; do
                    # Skip comments and empty lines
                    [[ "$line" =~ ^#.*$ ]] && continue
                    [[ -z "$line" ]] && continue
                    [[ "$line" =~ ^[[:space:]]*$ ]] && continue
                    
                    # Parse environment line: ENV_NAME:PUBLIC_IP:PRIVATE_IP:FLOATING_IP:USER:PRIVILEGES:SPECS
                    IFS=: read -r env_name public_ip private_ip floating_ip user privileges specs <<< "$line"
                    [[ -z "$env_name" ]] && continue
                    
                    ((total_count++))
                    if _tkm_generate_single_key "$env_name" "$key_type" "$expiry_days"; then
                        ((success_count++))
                    fi
                    echo  # Add spacing between environments
                done < "$org_servers_file"
            else
                echo "Error: No environments configured for organization: $current_org" >&2
                return 1
            fi
        else
            echo "Error: No current organization set. Use 'org set <name>' to select one." >&2
            return 1
        fi
        
        echo "=== Generation Summary ==="
        echo "✅ Successful: $success_count/$total_count"
        if [[ "$success_count" -lt "$total_count" ]]; then
            echo "❌ Failed: $((total_count - success_count))"
        fi
    else
        ((total_count++))
        if _tkm_generate_single_key "$env" "$key_type" "$expiry_days"; then
            ((success_count++))
            echo
            echo "✅ Key generation completed successfully"
        else
            echo
            echo "❌ Key generation failed"
        fi
    fi
    
    echo
    echo "Next steps:"
    if [[ "$success_count" -gt 0 ]]; then
        echo "  • Deploy keys: deploy $env"
        echo "  • Check status: status $env"
        echo "  • Environment insight: @$env"
    else
        echo "  • Check TKM logs: logs"
        echo "  • Verify TETRA_DIR: info"
    fi
}

# Internal function to generate a single key pair
_tkm_generate_single_key() {
    local env="$1"
    local key_type="$2"
    local expiry_days="$3"
    
    # Ensure directories exist
    mkdir -p "$TKM_KEYS_DIR/active" "$TKM_KEYS_DIR/archived" "$TKM_KEYS_DIR/pending"
    
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local key_name="${env}_${key_type}_${timestamp}"
    local key_path="$TKM_KEYS_DIR/active/${key_name}"
    
    echo "🔑 Generating key for environment: $env"
    echo "   Type: $key_type"
    echo "   Expires: $(date -d "+${expiry_days} days" +"%Y-%m-%d")"
    
    # Generate the key pair quietly
    if ssh-keygen -t ed25519 -f "$key_path" -C "tkm_${key_name}_expires_$(date -d "+${expiry_days} days" +%Y%m%d)" -N "" >/dev/null 2>&1; then
        
        # Set proper permissions
        chmod 600 "$key_path" 2>/dev/null
        chmod 644 "${key_path}.pub" 2>/dev/null
        
        # Create metadata file
        cat > "${key_path}.meta" <<EOF
{
    "environment": "$env",
    "key_type": "$key_type",
    "generated": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "expires": "$(date -u -d "+${expiry_days} days" +"%Y-%m-%dT%H:%M:%SZ")",
    "status": "generated",
    "deployed": false
}
EOF
        
        echo "   ✅ Generated: $(basename "$key_path")"
        echo "   📁 Location: $key_path"
        
        # Show fingerprint
        local fingerprint=$(ssh-keygen -l -f "${key_path}.pub" 2>/dev/null | awk '{print $2}')
        if [[ -n "$fingerprint" ]]; then
            echo "   🔍 Fingerprint: $fingerprint"
        fi
        
        tkm_log "Generated key: $key_name" "INFO"
        return 0
    else
        echo "   ❌ Failed to generate key for $env"
        tkm_log "Failed to generate key for $env" "ERROR"
        return 1
    fi
}

# Deploy keys to remote environments
tkm_deploy_keys() {
    local env="${1:-all}"
    local force="${2:-false}"
    
    # Validate environment
    if [[ "$env" != "all" ]]; then
        if ! tkm_validate_env_name "$env"; then
            return 1
        fi
    fi
    
    # Validate force parameter
    if [[ ! "$force" =~ ^(true|false)$ ]]; then
        echo "Error: Invalid force parameter '$force'. Must be 'true' or 'false'" >&2
        return 1
    fi
    
    # Check dependencies
    if ! command -v ssh >/dev/null 2>&1; then
        echo "Error: ssh command not found" >&2
        return 1
    fi
    
    tkm_log "Deploying keys for environment: $env" "INFO"
    
    if [[ "$env" == "all" ]]; then
        local current_org=$(tkm_org_current)
        if [[ -n "$current_org" ]]; then
            local org_servers_file="$TKM_ORGS_DIR/$current_org/environments/servers.conf"
            if [[ -f "$org_servers_file" ]]; then
                while IFS=: read -r env_name public_ip private_ip floating_ip user privileges specs; do
                    [[ "$env_name" =~ ^#.*$ ]] && continue
                    [[ -z "$env_name" ]] && continue
                    local host="${floating_ip:-${public_ip:-${private_ip:-unknown}}}"
                    _tkm_deploy_single_env "$env_name" "$host" "$user" "$force"
                done < "$org_servers_file"
            else
                echo "Error: No environments configured for organization: $current_org" >&2
                return 1
            fi
        else
            echo "Error: No current organization set. Use 'org set <name>' to select one." >&2
            return 1
        fi
    else
        local current_org=$(tkm_org_current)
        if [[ -n "$current_org" ]]; then
            local org_servers_file="$TKM_ORGS_DIR/$current_org/environments/servers.conf"
            local env_info=$(grep "^${env}:" "$org_servers_file" | head -1)
            if [[ -n "$env_info" ]]; then
                IFS=: read -r env_name public_ip private_ip floating_ip user privileges specs <<< "$env_info"
                local host="${floating_ip:-${public_ip:-${private_ip:-unknown}}}"
                _tkm_deploy_single_env "$env_name" "$host" "$user" "$force"
            else
                echo "Environment '$env' not found in configuration"
                return 1
            fi
        else
            echo "Error: No current organization set. Use 'org set <name>' to select one." >&2
            return 1
        fi
    fi
}

# Internal function to deploy keys to a single environment
_tkm_deploy_single_env() {
    local env="$1"
    local host="$2"
    local user="$3"
    local force="$4"
    
    # Find the latest key for this environment
    local latest_key
    latest_key=$(find "$TKM_KEYS_DIR/active" -name "${env}_deploy_*.pub" -type f | sort | tail -1)
    
    if [[ -z "$latest_key" ]]; then
        echo "No keys found for environment: $env"
        return 1
    fi
    
    echo "Deploying key to $user@$host: $(basename "$latest_key")"
    
    # Deploy the public key
    if tkm_security_check_deployment "$env" "$host" "$user"; then
        cat "$latest_key" | ssh "$user@$host" "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && chmod 700 ~/.ssh"
        
        # Update metadata
        local meta_file="${latest_key%.pub}.meta"
        if [[ -f "$meta_file" ]]; then
            # Update deployed status in metadata (simplified JSON update)
            sed -i 's/"deployed": false/"deployed": true/' "$meta_file"
            sed -i "s/\"status\": \"generated\"/\"status\": \"deployed\"/" "$meta_file"
        fi
        
        tkm_log "Deployed key for $env to $user@$host" "INFO"
        echo "✅ Key deployed successfully"
    else
        echo "❌ Security check failed for deployment to $env"
        return 1
    fi
}

# Rotate keys for an environment
tkm_rotate_keys() {
    local env="$1"
    local immediate="${2:-false}"
    
    # Validate required parameters
    if [[ -z "$env" ]]; then
        echo "Error: Environment name is required" >&2
        echo "Usage: tkm_rotate_keys <environment> [immediate]" >&2
        return 1
    fi
    
    # Validate environment name
    if ! tkm_validate_env_name "$env"; then
        return 1
    fi
    
    # Validate immediate parameter
    if [[ ! "$immediate" =~ ^(true|false)$ ]]; then
        echo "Error: Invalid immediate parameter '$immediate'. Must be 'true' or 'false'" >&2
        return 1
    fi
    
    tkm_log "Rotating keys for environment: $env" "INFO"
    
    # Generate new keys
    tkm_generate_keys "$env" "deploy" "30"
    
    # Deploy new keys
    tkm_deploy_keys "$env"
    
    if [[ "$immediate" == "true" ]]; then
        # Immediately revoke old keys
        _tkm_revoke_old_keys "$env"
    else
        echo "New keys deployed. Old keys will be revoked in next rotation cycle."
        echo "To immediately revoke old keys, run: tkm revoke $env"
    fi
}

# Show status of all keys
tkm_status() {
    local env="${1:-all}"
    
    echo "=== TKM Key Status ==="
    echo
    
    if [[ "$env" == "all" ]]; then
        for key_file in "$TKM_KEYS_DIR/active"/*.meta; do
            [[ -f "$key_file" ]] || continue
            _tkm_show_key_status "$key_file"
        done
        # Also check archived keys
        for key_file in "$TKM_KEYS_DIR/archived"/*.meta; do
            [[ -f "$key_file" ]] || continue
            _tkm_show_key_status "$key_file"
        done
    else
        for key_file in "$TKM_KEYS_DIR/active/${env}_"*.meta; do
            [[ -f "$key_file" ]] || continue
            _tkm_show_key_status "$key_file"
        done
        for key_file in "$TKM_KEYS_DIR/archived/${env}_"*.meta; do
            [[ -f "$key_file" ]] || continue
            _tkm_show_key_status "$key_file"
        done
    fi
}

# Internal function to show status of a single key
_tkm_show_key_status() {
    local meta_file="$1"
    local key_name=$(basename "$meta_file" .meta)
    
    # Parse metadata (simplified JSON parsing)
    local env=$(grep '"environment"' "$meta_file" | cut -d'"' -f4)
    local status=$(grep '"status"' "$meta_file" | cut -d'"' -f4)
    local deployed=$(grep '"deployed"' "$meta_file" | cut -d':' -f2 | tr -d ' ,')
    local expires=$(grep '"expires"' "$meta_file" | cut -d'"' -f4)
    
    printf "%-30s %-10s %-8s %-8s %s\n" "$key_name" "$env" "$status" "$deployed" "$expires"
}

# Revoke keys for an environment
tkm_revoke_keys() {
    local env="$1"
    local key_pattern="${2:-old}"
    
    # Validate required parameters
    if [[ -z "$env" ]]; then
        echo "Error: Environment name is required" >&2
        echo "Usage: tkm_revoke_keys <environment> [old|all|specific_key]" >&2
        return 1
    fi
    
    # Validate environment name
    if ! tkm_validate_env_name "$env"; then
        return 1
    fi
    
    # Validate key pattern
    if [[ ! "$key_pattern" =~ ^(old|all)$ ]] && [[ ! "$key_pattern" =~ ^[a-zA-Z0-9_-]+$ ]]; then
        echo "Error: Invalid key pattern '$key_pattern'. Must be 'old', 'all', or a valid key name" >&2
        return 1
    fi
    
    tkm_log "Revoking keys for environment: $env, pattern: $key_pattern" "INFO"
    
    case "$key_pattern" in
        "old")
            _tkm_revoke_old_keys "$env"
            ;;
        "all")
            _tkm_revoke_all_keys "$env"
            ;;
        *)
            _tkm_revoke_specific_key "$env" "$key_pattern"
            ;;
    esac
}

# Internal function to revoke old keys
_tkm_revoke_old_keys() {
    local env="$1"
    
    # Find all keys for this environment except the latest one
    local keys=($(find "$TKM_KEYS_DIR/active" -name "${env}_deploy_*.pub" -type f | sort))
    local key_count=${#keys[@]}
    
    if [[ "$key_count" -le 1 ]]; then
        echo "No old keys to revoke for environment: $env"
        return 0
    fi
    
    # Remove all but the latest key
    for ((i=0; i<key_count-1; i++)); do
        local key_file="${keys[$i]}"
        local base_name="${key_file%.pub}"
        
        echo "Archiving old key: $(basename "$key_file")"
        
        # Update metadata to mark as revoked
        if [[ -f "${base_name}.meta" ]]; then
            sed -i 's/"status": "deployed"/"status": "revoked"/' "${base_name}.meta"
        fi
        
        # Move to archived directory following TETRA_DIR convention
        mv "$base_name" "$TKM_KEYS_DIR/archived/" 2>/dev/null || true
        mv "$key_file" "$TKM_KEYS_DIR/archived/" 2>/dev/null || true
        mv "${base_name}.meta" "$TKM_KEYS_DIR/archived/" 2>/dev/null || true
    done
    
    tkm_log "Revoked $((key_count-1)) old keys for environment: $env" "INFO"
}

# Internal function to revoke all keys
_tkm_revoke_all_keys() {
    local env="$1"
    
    for key_file in "$TKM_KEYS_DIR/active/${env}_deploy_"*.pub; do
        [[ -f "$key_file" ]] || continue
        
        local base_name="${key_file%.pub}"
        echo "Revoking key: $(basename "$key_file")"
        
        if [[ -f "${base_name}.meta" ]]; then
            sed -i 's/"status": "deployed"/"status": "revoked"/' "${base_name}.meta"
        fi
        
        # Move to archived directory
        mv "$base_name" "$TKM_KEYS_DIR/archived/" 2>/dev/null || true
        mv "$key_file" "$TKM_KEYS_DIR/archived/" 2>/dev/null || true
        mv "${base_name}.meta" "$TKM_KEYS_DIR/archived/" 2>/dev/null || true
    done
    
    tkm_log "Revoked all keys for environment: $env" "INFO"
}

# Internal function to revoke specific key
_tkm_revoke_specific_key() {
    local env="$1"
    local key_pattern="$2"
    
    local key_file="$TKM_KEYS_DIR/active/${key_pattern}"
    
    if [[ ! -f "$key_file" && ! -f "${key_file}.pub" ]]; then
        echo "Key not found: $key_pattern"
        return 1
    fi
    
    # Handle both with and without .pub extension
    if [[ "$key_file" == *.pub ]]; then
        local base_name="${key_file%.pub}"
    else
        local base_name="$key_file"
        key_file="${key_file}.pub"
    fi
    
    echo "Revoking specific key: $(basename "$key_file")"
    
    if [[ -f "${base_name}.meta" ]]; then
        sed -i 's/"status": "deployed"/"status": "revoked"/' "${base_name}.meta"
    fi
    
    # Move to archived directory
    mv "$base_name" "$TKM_KEYS_DIR/archived/" 2>/dev/null || true
    mv "$key_file" "$TKM_KEYS_DIR/archived/" 2>/dev/null || true
    mv "${base_name}.meta" "$TKM_KEYS_DIR/archived/" 2>/dev/null || true
    
    tkm_log "Revoked specific key: $key_pattern" "INFO"
}

# Logging function
tkm_log() {
    local message="$1"
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    echo "[$timestamp] $message" >> "$TKM_LOGS_DIR/tkm.log"
}
