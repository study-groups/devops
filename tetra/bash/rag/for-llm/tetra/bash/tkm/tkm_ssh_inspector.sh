#!/usr/bin/env bash

# TKM SSH Inspector
# Analyzes local SSH configuration and keys

# SSH Inspector main function
tkm_ssh_inspect() {
    local scope="${1:-all}"
    
    case "$scope" in
        keys)
            _tkm_inspect_ssh_keys
            ;;
        config)
            _tkm_inspect_ssh_config
            ;;
        agents)
            _tkm_inspect_ssh_agents
            ;;
        hosts)
            _tkm_inspect_known_hosts
            ;;
        permissions)
            _tkm_inspect_ssh_permissions
            ;;
        all)
            echo "=== TKM SSH Inspector Report ==="
            echo "Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
            echo
            _tkm_inspect_ssh_keys
            echo
            _tkm_inspect_ssh_config
            echo
            _tkm_inspect_ssh_agents
            echo
            _tkm_inspect_known_hosts
            echo
            _tkm_inspect_ssh_permissions
            ;;
        *)
            echo "Usage: inspect {keys|config|agents|hosts|permissions|all}"
            return 1
            ;;
    esac
}

# Inspect SSH keys in ~/.ssh
_tkm_inspect_ssh_keys() {
    echo "SSH Keys Analysis"
    echo "=================="
    
    local ssh_dir="$HOME/.ssh"
    local key_count=0
    local issues=0
    
    if [[ ! -d "$ssh_dir" ]]; then
        echo "❌ SSH directory not found: $ssh_dir"
        return 1
    fi
    
    echo "Location: $ssh_dir"
    echo
    
    # Find all private keys (files without .pub extension that have corresponding .pub files)
    for key_file in "$ssh_dir"/*; do
        [[ -f "$key_file" ]] || continue
        [[ "$key_file" == *.pub ]] && continue
        [[ "$key_file" == *config* ]] && continue
        [[ "$key_file" == *known_hosts* ]] && continue
        [[ "$key_file" == *authorized_keys* ]] && continue
        
        # Check if corresponding public key exists
        if [[ -f "${key_file}.pub" ]]; then
            ((key_count++))
            _tkm_analyze_key_pair "$key_file"
        fi
    done
    
    # Check for orphaned public keys
    echo "Orphaned Public Keys:"
    echo "--------------------"
    local orphans=0
    for pub_file in "$ssh_dir"/*.pub; do
        [[ -f "$pub_file" ]] || continue
        local private_key="${pub_file%.pub}"
        if [[ ! -f "$private_key" ]]; then
            echo "⚠️  $(basename "$pub_file") - missing private key"
            ((orphans++))
        fi
    done
    
    if [[ "$orphans" -eq 0 ]]; then
        echo "✅ No orphaned public keys found"
    fi
    
    echo
    echo "Summary: $key_count key pairs found"
}

# Analyze individual key pair
_tkm_analyze_key_pair() {
    local private_key="$1"
    local public_key="${private_key}.pub"
    local key_name=$(basename "$private_key")
    
    echo "Key: $key_name"
    echo "-------------"
    
    # Check permissions
    local priv_perms=$(stat -c %a "$private_key" 2>/dev/null || stat -f %A "$private_key" 2>/dev/null)
    local pub_perms=$(stat -c %a "$public_key" 2>/dev/null || stat -f %A "$public_key" 2>/dev/null)
    
    if [[ "$priv_perms" != "600" ]]; then
        echo "❌ Private key permissions: $priv_perms (should be 600)"
    else
        echo "✅ Private key permissions: $priv_perms"
    fi
    
    if [[ "$pub_perms" != "644" ]]; then
        echo "⚠️  Public key permissions: $pub_perms (should be 644)"
    else
        echo "✅ Public key permissions: $pub_perms"
    fi
    
    # Get key type and fingerprint
    if command -v ssh-keygen >/dev/null 2>&1; then
        local key_info=$(ssh-keygen -l -f "$public_key" 2>/dev/null)
        if [[ -n "$key_info" ]]; then
            echo "🔑 Key info: $key_info"
        fi
        
        # Check if key is encrypted
        if ssh-keygen -y -f "$private_key" >/dev/null 2>&1; then
            echo "🔓 Key is not encrypted (no passphrase)"
        else
            echo "🔒 Key appears to be encrypted (has passphrase)"
        fi
    fi
    
    # Check if key is loaded in SSH agent
    if command -v ssh-add >/dev/null 2>&1; then
        local fingerprint=$(ssh-keygen -l -f "$public_key" 2>/dev/null | awk '{print $2}')
        if ssh-add -l 2>/dev/null | grep -q "$fingerprint"; then
            echo "🔄 Key is loaded in SSH agent"
        else
            echo "💤 Key is not loaded in SSH agent"
        fi
    fi
    
    # Check file age
    local key_age_days
    if [[ "$OSTYPE" == "darwin"* ]]; then
        key_age_days=$(( ($(date +%s) - $(stat -f %B "$private_key")) / 86400 ))
    else
        key_age_days=$(( ($(date +%s) - $(stat -c %Y "$private_key")) / 86400 ))
    fi
    
    if [[ "$key_age_days" -gt 365 ]]; then
        echo "⚠️  Key age: $key_age_days days (consider rotation)"
    else
        echo "📅 Key age: $key_age_days days"
    fi
    
    echo
}

# Inspect SSH configuration
_tkm_inspect_ssh_config() {
    echo "SSH Configuration Analysis"
    echo "========================="
    
    local ssh_config="$HOME/.ssh/config"
    
    if [[ -f "$ssh_config" ]]; then
        echo "✅ SSH config found: $ssh_config"
        
        # Check permissions
        local config_perms=$(stat -c %a "$ssh_config" 2>/dev/null || stat -f %A "$ssh_config" 2>/dev/null)
        if [[ "$config_perms" != "600" ]]; then
            echo "⚠️  Config permissions: $config_perms (should be 600)"
        else
            echo "✅ Config permissions: $config_perms"
        fi
        
        # Count host entries
        local host_count=$(grep -c "^Host " "$ssh_config" 2>/dev/null || echo "0")
        echo "📋 Host entries: $host_count"
        
        # Check for common security settings
        echo
        echo "Security Settings:"
        echo "-----------------"
        
        if grep -q "PasswordAuthentication no" "$ssh_config"; then
            echo "✅ Password authentication disabled"
        else
            echo "⚠️  Password authentication not explicitly disabled"
        fi
        
        if grep -q "PubkeyAuthentication yes" "$ssh_config"; then
            echo "✅ Public key authentication enabled"
        fi
        
        if grep -q "ForwardAgent" "$ssh_config"; then
            echo "🔄 Agent forwarding configured"
        fi
        
        if grep -q "StrictHostKeyChecking" "$ssh_config"; then
            local strict_setting=$(grep "StrictHostKeyChecking" "$ssh_config" | tail -1 | awk '{print $2}')
            echo "🔒 StrictHostKeyChecking: $strict_setting"
        fi
        
    else
        echo "❌ No SSH config found at $ssh_config"
        echo "💡 Consider creating one for better security and convenience"
    fi
}

# Inspect SSH agents
_tkm_inspect_ssh_agents() {
    echo "SSH Agent Analysis"
    echo "=================="
    
    if [[ -n "$SSH_AUTH_SOCK" ]]; then
        echo "✅ SSH agent socket: $SSH_AUTH_SOCK"
        
        if command -v ssh-add >/dev/null 2>&1; then
            echo
            echo "Loaded Keys:"
            echo "-----------"
            if ssh-add -l 2>/dev/null; then
                local key_count=$(ssh-add -l 2>/dev/null | wc -l)
                echo
                echo "📊 Total keys in agent: $key_count"
            else
                echo "💤 No keys loaded in SSH agent"
            fi
        fi
    else
        echo "❌ No SSH agent running (SSH_AUTH_SOCK not set)"
        echo "💡 Consider starting ssh-agent or using keychain"
    fi
    
    # Check for running ssh-agent processes
    local agent_count=$(pgrep ssh-agent | wc -l)
    if [[ "$agent_count" -gt 0 ]]; then
        echo "🔄 Running ssh-agent processes: $agent_count"
        if [[ "$agent_count" -gt 1 ]]; then
            echo "⚠️  Multiple ssh-agent processes detected"
        fi
    fi
}

# Inspect known_hosts
_tkm_inspect_known_hosts() {
    echo "Known Hosts Analysis"
    echo "==================="
    
    local known_hosts="$HOME/.ssh/known_hosts"
    
    if [[ -f "$known_hosts" ]]; then
        echo "✅ Known hosts file: $known_hosts"
        
        # Check permissions
        local perms=$(stat -c %a "$known_hosts" 2>/dev/null || stat -f %A "$known_hosts" 2>/dev/null)
        if [[ "$perms" != "644" ]]; then
            echo "⚠️  Permissions: $perms (should be 644)"
        else
            echo "✅ Permissions: $perms"
        fi
        
        # Count entries
        local host_count=$(wc -l < "$known_hosts" 2>/dev/null || echo "0")
        echo "📊 Known hosts: $host_count entries"
        
        # Check for hashed hostnames (security feature)
        local hashed_count=$(grep -c "^|" "$known_hosts" 2>/dev/null || echo "0")
        if [[ "$hashed_count" -gt 0 ]]; then
            echo "🔒 Hashed hostnames: $hashed_count (good for privacy)"
        fi
        
        # Look for common deployment hosts
        echo
        echo "Deployment Hosts Found:"
        echo "----------------------"
        local found_hosts=0
        if [[ -f "$TKM_CONFIG_DIR/environments.conf" ]]; then
            while IFS=: read -r env_name host user privileges; do
                [[ "$env_name" =~ ^#.*$ ]] && continue
                [[ -z "$env_name" || -z "$host" ]] && continue
                if grep -q "$host" "$known_hosts" 2>/dev/null; then
                    echo "✅ $env_name ($host)"
                    ((found_hosts++))
                else
                    echo "❌ $env_name ($host) - not in known_hosts"
                fi
            done < "$TKM_CONFIG_DIR/environments.conf"
        else
            echo "⚠️  No TKM environments configured"
        fi
        
        if [[ "$found_hosts" -eq 0 ]]; then
            echo "⚠️  No configured deployment hosts found in known_hosts"
        fi
        
    else
        echo "❌ No known_hosts file found"
        echo "💡 File will be created automatically when connecting to hosts"
    fi
}

# Inspect SSH directory permissions
_tkm_inspect_ssh_permissions() {
    echo "SSH Directory Permissions"
    echo "========================"
    
    local ssh_dir="$HOME/.ssh"
    
    if [[ -d "$ssh_dir" ]]; then
        local dir_perms=$(stat -c %a "$ssh_dir" 2>/dev/null || stat -f %A "$ssh_dir" 2>/dev/null)
        if [[ "$dir_perms" != "700" ]]; then
            echo "❌ SSH directory permissions: $dir_perms (should be 700)"
        else
            echo "✅ SSH directory permissions: $dir_perms"
        fi
        
        echo
        echo "File Permissions Summary:"
        echo "------------------------"
        
        # Check all files in .ssh directory
        for file in "$ssh_dir"/*; do
            [[ -f "$file" ]] || continue
            
            local filename=$(basename "$file")
            local perms=$(stat -c %a "$file" 2>/dev/null || stat -f %A "$file" 2>/dev/null)
            local expected_perms
            
            case "$filename" in
                *.pub|known_hosts|authorized_keys)
                    expected_perms="644"
                    ;;
                config)
                    expected_perms="600"
                    ;;
                *)
                    # Assume private key
                    expected_perms="600"
                    ;;
            esac
            
            if [[ "$perms" == "$expected_perms" ]]; then
                echo "✅ $filename: $perms"
            else
                echo "❌ $filename: $perms (should be $expected_perms)"
            fi
        done
        
    else
        echo "❌ SSH directory not found: $ssh_dir"
    fi
}

# Quick SSH security scan
tkm_ssh_security_scan() {
    echo "=== TKM SSH Security Scan ==="
    echo "Host: $(hostname)"
    echo "User: $(whoami)"
    echo "SSH Directory: $HOME/.ssh"
    echo "Scan Time: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo
    
    local issues=0
    local warnings=0
    
    # Check SSH directory
    echo "Directory Security:"
    echo "------------------"
    if [[ ! -d "$HOME/.ssh" ]]; then
        echo "❌ SSH directory missing: $HOME/.ssh"
        ((issues++))
    else
        local ssh_perms=$(stat -c %a "$HOME/.ssh" 2>/dev/null || stat -f %A "$HOME/.ssh" 2>/dev/null)
        if [[ "$ssh_perms" != "700" ]]; then
            echo "❌ SSH directory permissions: $ssh_perms (should be 700)"
            ((issues++))
        else
            echo "✅ SSH directory permissions: $ssh_perms"
        fi
    fi
    echo
    
    # Check private keys
    echo "Private Key Security:"
    echo "--------------------"
    local unencrypted_keys=0
    local total_keys=0
    local key_details=()
    
    for key_file in "$HOME/.ssh"/*; do
        [[ -f "$key_file" ]] || continue
        [[ "$key_file" == *.pub ]] && continue
        [[ "$key_file" == *config* ]] && continue
        [[ "$key_file" == *known_hosts* ]] && continue
        [[ "$key_file" == *authorized_keys* ]] && continue
        
        if [[ -f "${key_file}.pub" ]]; then
            ((total_keys++))
            local key_name=$(basename "$key_file")
            local key_type=$(ssh-keygen -l -f "${key_file}.pub" 2>/dev/null | awk '{print $4}' | tr -d '()')
            local key_size=$(ssh-keygen -l -f "${key_file}.pub" 2>/dev/null | awk '{print $1}')
            
            if ssh-keygen -y -f "$key_file" >/dev/null 2>&1; then
                echo "⚠️  $key_name ($key_type $key_size bits) - No passphrase"
                ((unencrypted_keys++))
                ((warnings++))
            else
                echo "✅ $key_name ($key_type $key_size bits) - Encrypted"
            fi
        fi
    done
    
    if [[ "$total_keys" -eq 0 ]]; then
        echo "❌ No SSH key pairs found"
        ((issues++))
    else
        echo "📊 Total key pairs: $total_keys"
        if [[ "$unencrypted_keys" -gt 0 ]]; then
            echo "⚠️  Unencrypted keys: $unencrypted_keys/$total_keys"
        fi
    fi
    echo
    
    # Check SSH config security
    echo "Configuration Security:"
    echo "----------------------"
    if [[ -f "$HOME/.ssh/config" ]]; then
        echo "✅ SSH config file exists: $HOME/.ssh/config"
        
        local config_perms=$(stat -c %a "$HOME/.ssh/config" 2>/dev/null || stat -f %A "$HOME/.ssh/config" 2>/dev/null)
        if [[ "$config_perms" != "600" ]]; then
            echo "❌ Config permissions: $config_perms (should be 600)"
            ((issues++))
        else
            echo "✅ Config permissions: $config_perms"
        fi
        
        if grep -q "PasswordAuthentication no" "$HOME/.ssh/config"; then
            echo "✅ Password authentication disabled"
        else
            echo "⚠️  Password authentication not explicitly disabled"
            ((warnings++))
        fi
        
        if grep -q "PubkeyAuthentication yes" "$HOME/.ssh/config"; then
            echo "✅ Public key authentication enabled"
        fi
        
        local host_count=$(grep -c "^Host " "$HOME/.ssh/config" 2>/dev/null || echo "0")
        echo "📋 Configured hosts: $host_count"
        
    else
        echo "⚠️  No SSH config file found"
        echo "💡 Consider creating $HOME/.ssh/config for better security"
        ((warnings++))
    fi
    echo
    
    # Check SSH agent
    echo "SSH Agent Status:"
    echo "----------------"
    if [[ -n "$SSH_AUTH_SOCK" ]]; then
        echo "✅ SSH agent running: $SSH_AUTH_SOCK"
        if command -v ssh-add >/dev/null 2>&1; then
            local loaded_keys=$(ssh-add -l 2>/dev/null | wc -l)
            if [[ "$loaded_keys" -gt 0 ]]; then
                echo "🔑 Loaded keys: $loaded_keys"
            else
                echo "💤 No keys loaded in agent"
            fi
        fi
    else
        echo "⚠️  SSH agent not running"
        ((warnings++))
    fi
    echo
    
    # Check for old keys (>1 year)
    echo "Key Age Analysis:"
    echo "----------------"
    local old_keys=0
    local key_ages=()
    
    for key_file in "$HOME/.ssh"/*; do
        [[ -f "$key_file" ]] || continue
        [[ "$key_file" == *.pub ]] && continue
        [[ -f "${key_file}.pub" ]] || continue
        
        local key_name=$(basename "$key_file")
        local key_age_days
        if [[ "$OSTYPE" == "darwin"* ]]; then
            key_age_days=$(( ($(date +%s) - $(stat -f %B "$key_file")) / 86400 ))
        else
            key_age_days=$(( ($(date +%s) - $(stat -c %Y "$key_file")) / 86400 ))
        fi
        
        if [[ "$key_age_days" -gt 365 ]]; then
            echo "⚠️  $key_name: $key_age_days days old (consider rotation)"
            ((old_keys++))
            ((warnings++))
        else
            echo "✅ $key_name: $key_age_days days old"
        fi
    done
    
    if [[ "$old_keys" -eq 0 && "$total_keys" -gt 0 ]]; then
        echo "✅ All keys are less than 1 year old"
    fi
    echo
    
    # Summary
    echo "Security Summary:"
    echo "=================="
    echo "🏠 Host: $(hostname)"
    echo "👤 User: $(whoami)"
    echo "📁 SSH Directory: $HOME/.ssh"
    echo "🔑 Total Keys: $total_keys"
    echo "⚠️  Warnings: $warnings"
    echo "❌ Critical Issues: $issues"
    echo
    
    if [[ "$issues" -eq 0 && "$warnings" -eq 0 ]]; then
        echo "🎉 Excellent! SSH security scan passed with no issues"
    elif [[ "$issues" -eq 0 ]]; then
        echo "✅ SSH security scan passed - $warnings warnings found"
        echo "💡 Consider addressing warnings for improved security"
    else
        echo "❌ SSH security scan found $issues critical issues and $warnings warnings"
        echo "🔧 Please address critical issues immediately"
    fi
    
    return "$issues"
}

# SSH cleanup and maintenance
tkm_ssh_cleanup() {
    local action="${1:-dry-run}"
    
    echo "=== TKM SSH Cleanup ==="
    
    if [[ "$action" == "dry-run" ]]; then
        echo "DRY RUN - no changes will be made"
        echo "Run 'cleanup execute' to perform actual cleanup"
        echo
    fi
    
    # Find orphaned public keys
    local orphaned_pubs=()
    for pub_file in "$HOME/.ssh"/*.pub; do
        [[ -f "$pub_file" ]] || continue
        local private_key="${pub_file%.pub}"
        if [[ ! -f "$private_key" ]]; then
            orphaned_pubs+=("$pub_file")
        fi
    done
    
    if [[ "${#orphaned_pubs[@]}" -gt 0 ]]; then
        echo "Orphaned public keys found:"
        for pub in "${orphaned_pubs[@]}"; do
            echo "  $(basename "$pub")"
            if [[ "$action" == "execute" ]]; then
                rm "$pub"
                echo "    ✅ Removed"
            fi
        done
        echo
    fi
    
    # Find backup files
    local backup_files=()
    for file in "$HOME/.ssh"/*.bak "$HOME/.ssh"/*~ "$HOME/.ssh"/*.old; do
        [[ -f "$file" ]] && backup_files+=("$file")
    done
    
    if [[ "${#backup_files[@]}" -gt 0 ]]; then
        echo "Backup files found:"
        for backup in "${backup_files[@]}"; do
            echo "  $(basename "$backup")"
            if [[ "$action" == "execute" ]]; then
                rm "$backup"
                echo "    ✅ Removed"
            fi
        done
        echo
    fi
    
    if [[ "${#orphaned_pubs[@]}" -eq 0 && "${#backup_files[@]}" -eq 0 ]]; then
        echo "✅ No cleanup needed - SSH directory is clean"
    fi
}
