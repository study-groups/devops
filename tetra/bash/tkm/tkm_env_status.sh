#!/usr/bin/env bash

# TKM Environment Status Module
# Provides detailed insights into dev, staging, and production environments

# Main environment status dispatcher
tkm_env_status() {
    local input="$1"
    
    # Parse @env.command format
    if [[ "$input" =~ ^@([^.]+)\.(.+)$ ]]; then
        local env="${BASH_REMATCH[1]}"
        local cmd="${BASH_REMATCH[2]}"
        _tkm_env_status_command "$env" "$cmd"
    elif [[ "$input" =~ ^@(.+)$ ]]; then
        local env="${BASH_REMATCH[1]}"
        _tkm_env_status_overview "$env"
    else
        echo "Usage: @<environment>[.command]"
        echo "Examples: @dev, @staging.keys, @prod.health"
        return 1
    fi
}

# Show environment overview
_tkm_env_status_overview() {
    local env="$1"
    
    echo "=== Environment Status: $env ==="
    echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo
    
    # Get environment config
    local env_config
    env_config=$(grep "^${env}:" "$TKM_CONFIG_DIR/environments.conf" 2>/dev/null | head -1)
    
    if [[ -z "$env_config" ]]; then
        echo "❌ Environment '$env' not found in configuration"
        return 1
    fi
    
    IFS=: read -r env_name host user privileges <<< "$env_config"
    
    echo "Configuration:"
    echo "  Host: $host"
    echo "  User: $user"
    echo "  Privileges: $privileges"
    echo
    
    # Key status
    echo "Key Status:"
    local active_keys=$(find "$TKM_KEYS_DIR/active" -name "${env}_deploy_*.pub" 2>/dev/null | wc -l)
    local archived_keys=$(find "$TKM_KEYS_DIR/archived" -name "${env}_deploy_*.pub" 2>/dev/null | wc -l)
    
    if [[ "$active_keys" -gt 0 ]]; then
        echo "  ✅ Active Keys: $active_keys"
        
        # Show latest key info
        local latest_key=$(find "$TKM_KEYS_DIR/active" -name "${env}_deploy_*.pub" -type f | sort | tail -1)
        if [[ -n "$latest_key" ]]; then
            local key_name=$(basename "$latest_key" .pub)
            local meta_file="$TKM_KEYS_DIR/active/${key_name}.meta"
            if [[ -f "$meta_file" ]]; then
                local deployed=$(grep '"deployed"' "$meta_file" | cut -d':' -f2 | tr -d ' ,')
                local expires=$(grep '"expires"' "$meta_file" | cut -d'"' -f4)
                echo "  📅 Latest: $(basename "$latest_key") (deployed: $deployed, expires: $expires)"
            fi
        fi
    else
        echo "  ❌ Active Keys: 0"
    fi
    
    if [[ "$archived_keys" -gt 0 ]]; then
        echo "  📦 Archived Keys: $archived_keys"
    fi
    echo
    
    # Connection test
    echo "Connection Test:"
    if _tkm_test_connection "$host" "$user"; then
        echo "  ✅ SSH connection successful"
    else
        echo "  ❌ SSH connection failed"
    fi
    echo
    
    # Quick actions
    echo "Quick Actions:"
    echo "  @${env}.keys        - Detailed key analysis"
    echo "  @${env}.health      - Full health check"
    echo "  @${env}.logs        - Recent deployment logs"
    echo "  @${env}.activity    - Recent key activity"
}

# Execute specific environment status command
_tkm_env_status_command() {
    local env="$1"
    local cmd="$2"
    
    case "$cmd" in
        keys)
            _tkm_env_keys_analysis "$env"
            ;;
        connections|conn)
            _tkm_env_connection_test "$env"
            ;;
        health)
            _tkm_env_health_check "$env"
            ;;
        logs)
            _tkm_env_logs "$env"
            ;;
        activity)
            _tkm_env_activity "$env"
            ;;
        deploy-status|deploy)
            _tkm_env_deploy_status "$env"
            ;;
        overview|all)
            _tkm_env_status_overview "$env"
            ;;
        *)
            echo "Unknown status command: $cmd"
            echo "Available: overview, keys, connections, health, logs, activity, deploy-status"
            return 1
            ;;
    esac
}

# Detailed key analysis for environment
_tkm_env_keys_analysis() {
    local env="$1"
    
    echo "=== Key Analysis: $env ==="
    echo
    
    # Active keys
    echo "Active Keys:"
    echo "-----------"
    local found_active=false
    for key_file in "$TKM_KEYS_DIR/active/${env}_deploy_"*.pub; do
        [[ -f "$key_file" ]] || continue
        found_active=true
        
        local key_name=$(basename "$key_file" .pub)
        local meta_file="${key_file%.pub}.meta"
        
        echo "🔑 $(basename "$key_file")"
        
        if [[ -f "$meta_file" ]]; then
            local generated=$(grep '"generated"' "$meta_file" | cut -d'"' -f4)
            local expires=$(grep '"expires"' "$meta_file" | cut -d'"' -f4)
            local deployed=$(grep '"deployed"' "$meta_file" | cut -d':' -f2 | tr -d ' ,')
            local status=$(grep '"status"' "$meta_file" | cut -d'"' -f4)
            
            echo "   Generated: $generated"
            echo "   Expires: $expires"
            echo "   Status: $status"
            echo "   Deployed: $deployed"
            
            # Check if expired
            if [[ -n "$expires" ]]; then
                local expire_epoch=$(date -d "$expires" +%s 2>/dev/null)
                local now_epoch=$(date +%s)
                if [[ "$expire_epoch" -lt "$now_epoch" ]]; then
                    echo "   ⚠️  EXPIRED!"
                fi
            fi
        fi
        echo
    done
    
    if [[ "$found_active" == "false" ]]; then
        echo "❌ No active keys found"
    fi
    
    # Archived keys count
    local archived_count=$(find "$TKM_KEYS_DIR/archived" -name "${env}_deploy_*.pub" 2>/dev/null | wc -l)
    if [[ "$archived_count" -gt 0 ]]; then
        echo "📦 Archived Keys: $archived_count"
    fi
}

# Test connection to environment
_tkm_env_connection_test() {
    local env="$1"
    
    echo "=== Connection Test: $env ==="
    echo
    
    local env_config
    env_config=$(grep "^${env}:" "$TKM_CONFIG_DIR/environments.conf" 2>/dev/null | head -1)
    
    if [[ -z "$env_config" ]]; then
        echo "❌ Environment '$env' not configured"
        return 1
    fi
    
    IFS=: read -r env_name host user privileges <<< "$env_config"
    
    echo "Testing connection to $user@$host..."
    
    if _tkm_test_connection "$host" "$user"; then
        echo "✅ SSH connection successful"
        
        # Test key authentication
        echo
        echo "Testing key authentication..."
        if ssh -o PasswordAuthentication=no -o ConnectTimeout=5 "$user@$host" "echo 'Key auth successful'" 2>/dev/null; then
            echo "✅ Key authentication working"
        else
            echo "❌ Key authentication failed"
        fi
        
        # Test basic commands
        echo
        echo "Testing basic commands..."
        local uptime_result
        uptime_result=$(ssh -o ConnectTimeout=5 "$user@$host" "uptime" 2>/dev/null)
        if [[ -n "$uptime_result" ]]; then
            echo "✅ Command execution: $uptime_result"
        else
            echo "❌ Command execution failed"
        fi
        
    else
        echo "❌ SSH connection failed"
        echo
        echo "Troubleshooting:"
        echo "  1. Check if host is reachable: ping $host"
        echo "  2. Check SSH service: telnet $host 22"
        echo "  3. Verify SSH keys are deployed"
        echo "  4. Check firewall settings"
    fi
}

# Comprehensive health check
_tkm_env_health_check() {
    local env="$1"
    
    echo "=== Health Check: $env ==="
    echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo
    
    local issues=0
    local warnings=0
    
    # Configuration check
    echo "Configuration Health:"
    echo "--------------------"
    local env_config
    env_config=$(grep "^${env}:" "$TKM_CONFIG_DIR/environments.conf" 2>/dev/null | head -1)
    
    if [[ -n "$env_config" ]]; then
        echo "✅ Environment configured"
        IFS=: read -r env_name host user privileges <<< "$env_config"
        
        if [[ "$user" == "tetra" ]]; then
            echo "✅ User is 'tetra'"
        else
            echo "⚠️  User is '$user' (should be 'tetra')"
            ((warnings++))
        fi
    else
        echo "❌ Environment not configured"
        ((issues++))
        return 1
    fi
    
    # Key health
    echo
    echo "Key Health:"
    echo "----------"
    local active_keys=$(find "$TKM_KEYS_DIR/active" -name "${env}_deploy_*.pub" 2>/dev/null | wc -l)
    
    if [[ "$active_keys" -eq 0 ]]; then
        echo "❌ No active keys"
        ((issues++))
    elif [[ "$active_keys" -gt 3 ]]; then
        echo "⚠️  Too many active keys ($active_keys > 3)"
        ((warnings++))
    else
        echo "✅ Active keys: $active_keys"
    fi
    
    # Check for expired keys
    local expired_keys=0
    for meta_file in "$TKM_KEYS_DIR/active/${env}_deploy_"*.meta; do
        [[ -f "$meta_file" ]] || continue
        
        local expires=$(grep '"expires"' "$meta_file" | cut -d'"' -f4)
        if [[ -n "$expires" ]]; then
            local expire_epoch=$(date -d "$expires" +%s 2>/dev/null)
            local now_epoch=$(date +%s)
            if [[ "$expire_epoch" -lt "$now_epoch" ]]; then
                ((expired_keys++))
            fi
        fi
    done
    
    if [[ "$expired_keys" -gt 0 ]]; then
        echo "❌ Expired keys: $expired_keys"
        ((issues++))
    else
        echo "✅ No expired keys"
    fi
    
    # Connection health
    echo
    echo "Connection Health:"
    echo "-----------------"
    if _tkm_test_connection "$host" "$user"; then
        echo "✅ SSH connection working"
    else
        echo "❌ SSH connection failed"
        ((issues++))
    fi
    
    # Summary
    echo
    echo "Health Summary:"
    echo "==============="
    echo "Environment: $env"
    echo "Issues: $issues"
    echo "Warnings: $warnings"
    
    if [[ "$issues" -eq 0 && "$warnings" -eq 0 ]]; then
        echo "🎉 Environment is healthy!"
    elif [[ "$issues" -eq 0 ]]; then
        echo "✅ Environment is operational with $warnings warnings"
    else
        echo "❌ Environment has $issues critical issues"
    fi
}

# Show environment logs
_tkm_env_logs() {
    local env="$1"
    
    echo "=== Recent Logs: $env ==="
    echo
    
    # TKM logs related to this environment
    if [[ -f "$TKM_LOGS_DIR/tkm.log" ]]; then
        echo "TKM Operations (last 10):"
        echo "-------------------------"
        grep "$env" "$TKM_LOGS_DIR/tkm.log" | tail -10 || echo "No logs found for $env"
    else
        echo "No TKM log file found"
    fi
    
    echo
    echo "Command History (last 5):"
    echo "-------------------------"
    if [[ -f "$TKM_HISTORY_LOG" ]]; then
        grep -E "(generate|deploy|rotate|revoke).*$env" "$TKM_HISTORY_LOG" | tail -5 || echo "No command history for $env"
    else
        echo "No command history found"
    fi
}

# Show recent activity for environment
_tkm_env_activity() {
    local env="$1"
    
    echo "=== Recent Activity: $env ==="
    echo
    
    # Key generation activity
    echo "Key Activity:"
    echo "------------"
    local recent_keys=()
    for key_file in "$TKM_KEYS_DIR/active/${env}_deploy_"*.pub "$TKM_KEYS_DIR/archived/${env}_deploy_"*.pub; do
        [[ -f "$key_file" ]] || continue
        recent_keys+=("$key_file")
    done
    
    # Sort by modification time and show last 5
    if [[ "${#recent_keys[@]}" -gt 0 ]]; then
        printf '%s\n' "${recent_keys[@]}" | xargs ls -lt | head -5 | while read -r line; do
            local key_file=$(echo "$line" | awk '{print $NF}')
            local key_name=$(basename "$key_file" .pub)
            local date_info=$(echo "$line" | awk '{print $6, $7, $8}')
            echo "  🔑 $key_name ($date_info)"
        done
    else
        echo "  No keys found"
    fi
    
    echo
    echo "Use '@${env}.logs' for detailed operation logs"
}

# Show deployment status
_tkm_env_deploy_status() {
    local env="$1"
    
    echo "=== Deployment Status: $env ==="
    echo
    
    local env_config
    env_config=$(grep "^${env}:" "$TKM_CONFIG_DIR/environments.conf" 2>/dev/null | head -1)
    
    if [[ -z "$env_config" ]]; then
        echo "❌ Environment not configured"
        return 1
    fi
    
    IFS=: read -r env_name host user privileges <<< "$env_config"
    
    echo "Target: $user@$host"
    echo
    
    # Check deployed keys
    echo "Deployment Status:"
    echo "-----------------"
    local deployed_count=0
    local pending_count=0
    
    for meta_file in "$TKM_KEYS_DIR/active/${env}_deploy_"*.meta; do
        [[ -f "$meta_file" ]] || continue
        
        local key_name=$(basename "$meta_file" .meta)
        local deployed=$(grep '"deployed"' "$meta_file" | cut -d':' -f2 | tr -d ' ,')
        local status=$(grep '"status"' "$meta_file" | cut -d'"' -f4)
        
        if [[ "$deployed" == "true" ]]; then
            echo "  ✅ $key_name (deployed)"
            ((deployed_count++))
        else
            echo "  ⏳ $key_name (pending)"
            ((pending_count++))
        fi
    done
    
    echo
    echo "Summary:"
    echo "  Deployed: $deployed_count"
    echo "  Pending: $pending_count"
    
    if [[ "$pending_count" -gt 0 ]]; then
        echo
        echo "💡 Run 'deploy $env' to deploy pending keys"
    fi
}

# Helper function to test SSH connection
_tkm_test_connection() {
    local host="$1"
    local user="$2"
    
    # Quick connection test with timeout
    ssh -o ConnectTimeout=5 -o BatchMode=yes "$user@$host" "exit" 2>/dev/null
}
