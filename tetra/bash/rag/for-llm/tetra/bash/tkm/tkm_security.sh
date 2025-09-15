#!/usr/bin/env bash

# TKM Security Policies and Validation
# Implements security checks and audit functions

# Security policy configuration
TKM_SECURITY_POLICIES=(
    "max_key_age_days=30"
    "min_key_strength=ed25519"
    "require_expiry=true"
    "allow_password_auth=false"
    "max_concurrent_keys=3"
    "audit_log_retention_days=90"
)

# Check if deployment is allowed
tkm_security_check_deployment() {
    local env="$1"
    local host="$2"
    local user="$3"
    
    # Verify user is 'tetra'
    if [[ "$user" != "tetra" ]]; then
        tkm_log "SECURITY: Deployment blocked - user '$user' is not 'tetra'"
        return 1
    fi
    
    # Check if host is in allowed environments
    if ! grep -q "^${env}:${host}:${user}:" "$TKM_CONFIG_DIR/environments.conf"; then
        tkm_log "SECURITY: Deployment blocked - environment '$env' not configured for $user@$host"
        return 1
    fi
    
    # Check for too many concurrent keys
    local key_count
    key_count=$(find "$TKM_KEYS_DIR/active" -name "${env}_deploy_*.pub" -type f | wc -l)
    if [[ "$key_count" -gt 3 ]]; then
        tkm_log "SECURITY: Too many concurrent keys for $env ($key_count > 3)"
        echo "Warning: Environment '$env' has $key_count keys. Consider revoking old keys."
    fi
    
    tkm_log "SECURITY: Deployment approved for $env ($user@$host)"
    return 0
}

# Run security audit
tkm_security_audit() {
    local env="${1:-all}"
    
    echo "=== TKM Security Audit ==="
    echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo
    
    local issues=0
    
    # Check for expired keys
    echo "Checking for expired keys..."
    for meta_file in "$TKM_KEYS_DIR/active"/*.meta "$TKM_KEYS_DIR/archived"/*.meta; do
        [[ -f "$meta_file" ]] || continue
        
        local expires=$(grep '"expires"' "$meta_file" | cut -d'"' -f4)
        local key_name=$(basename "$meta_file" .meta)
        
        if [[ -n "$expires" ]]; then
            local expire_epoch=$(date -d "$expires" +%s 2>/dev/null)
            local now_epoch=$(date +%s)
            
            if [[ "$expire_epoch" -lt "$now_epoch" ]]; then
                echo "❌ EXPIRED: $key_name (expired: $expires)"
                ((issues++))
            fi
        fi
    done
    
    # Check for keys without expiry
    echo "Checking for keys without expiry..."
    for meta_file in "$TKM_KEYS_DIR/active"/*.meta "$TKM_KEYS_DIR/archived"/*.meta; do
        [[ -f "$meta_file" ]] || continue
        
        if ! grep -q '"expires"' "$meta_file"; then
            local key_name=$(basename "$meta_file" .meta)
            echo "⚠️  NO EXPIRY: $key_name"
            ((issues++))
        fi
    done
    
    # Check for too many keys per environment
    echo "Checking key count per environment..."
    while IFS=: read -r env_name host user privileges; do
        [[ "$env_name" =~ ^#.*$ ]] && continue
        
        local key_count
        key_count=$(find "$TKM_KEYS_DIR/active" -name "${env_name}_deploy_*.pub" -type f | wc -l)
        
        if [[ "$key_count" -gt 3 ]]; then
            echo "⚠️  TOO MANY KEYS: $env_name has $key_count keys (max: 3)"
            ((issues++))
        fi
    done < "$TKM_CONFIG_DIR/environments.conf"
    
    # Check file permissions
    echo "Checking file permissions..."
    for key_file in "$TKM_KEYS_DIR/active"/* "$TKM_KEYS_DIR/archived"/*; do
        [[ -f "$key_file" ]] || continue
        
        if [[ "$key_file" == *.pub ]]; then
            # Public keys should be 644
            local perms=$(stat -c %a "$key_file" 2>/dev/null || stat -f %A "$key_file" 2>/dev/null)
            if [[ "$perms" != "644" ]]; then
                echo "⚠️  WRONG PERMS: $(basename "$key_file") is $perms (should be 644)"
                ((issues++))
            fi
        elif [[ "$key_file" != *.meta ]]; then
            # Private keys should be 600
            local perms=$(stat -c %a "$key_file" 2>/dev/null || stat -f %A "$key_file" 2>/dev/null)
            if [[ "$perms" != "600" ]]; then
                echo "❌ WRONG PERMS: $(basename "$key_file") is $perms (should be 600)"
                ((issues++))
            fi
        fi
    done
    
    echo
    if [[ "$issues" -eq 0 ]]; then
        echo "✅ Security audit passed - no issues found"
    else
        echo "❌ Security audit found $issues issues"
    fi
    
    tkm_log "Security audit completed - $issues issues found"
    return "$issues"
}

# Show security policies
tkm_security_show_policies() {
    echo "=== TKM Security Policies ==="
    for policy in "${TKM_SECURITY_POLICIES[@]}"; do
        echo "  $policy"
    done
    echo
    echo "Key Requirements:"
    echo "  - All deployment keys must use 'tetra' user"
    echo "  - Keys must have expiration dates"
    echo "  - Maximum 3 concurrent keys per environment"
    echo "  - Private keys must have 600 permissions"
    echo "  - Public keys must have 644 permissions"
    echo "  - All operations are logged"
}
