#!/usr/bin/env bash

# TKM Organization Management
# Handles organization-level tracking and server imports

# Source utilities
TKM_SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$TKM_SRC_DIR/tkm_utils.sh"

# Organization configuration structure under TETRA_DIR
TKM_ORGS_DIR="${TKM_DIR}/organizations"
TKM_CURRENT_ORG_FILE="${TKM_DIR}/.current_org"

# Resolve organization name (handle both primary names and aliases)
tkm_org_resolve() {
    local org_name="$1"
    
    if [[ -z "$org_name" ]]; then
        return 1
    fi
    
    local org_path="$TKM_ORGS_DIR/$org_name"
    
    # If it's a symlink, resolve to the target
    if [[ -L "$org_path" ]]; then
        basename "$(readlink "$org_path")"
    elif [[ -d "$org_path" ]]; then
        echo "$org_name"
    else
        return 1
    fi
}

# Initialize organization structure
tkm_org_init() {
    mkdir -p "$TKM_ORGS_DIR"
    
    # Initialize current org file if it doesn't exist (empty)
    if [[ ! -f "$TKM_CURRENT_ORG_FILE" ]]; then
        touch "$TKM_CURRENT_ORG_FILE"
    fi
    
    echo "TKM"
    echo "Org: $TKM_ORGS_DIR"
}

# Add a new organization
tkm_org_add() {
    local nh_name="$1"
    local do_name="$2"
    local user="$3"
    local host="$4"
    
    # No special handling for "local" - it's an environment, not an organization
    
    # Validate required parameters
    if [[ -z "$nh_name" ]]; then
        echo "Error: NH name is required" >&2
        echo "Usage: org add <nh_name> <do_name> [user] [host]" >&2
        echo "Example: org add pj pixeljam_arcade devops pj.example.com" >&2
        return 1
    fi
    
    if [[ -z "$do_name" ]]; then
        echo "Error: DO name is required" >&2
        echo "Usage: org add <nh_name> <do_name> [user] [host]" >&2
        echo "Example: org add pj pixeljam_arcade devops pj.example.com" >&2
        return 1
    fi
    
    # Set defaults if not provided
    user="${user:-devops}"
    host="${host:-\${nh_name}.example.com}"
    
    # Validate NH name
    if ! tkm_validate_env_name "$nh_name"; then
        echo "Error: Invalid NH name format" >&2
        return 1
    fi
    
    # Validate DO name
    if ! tkm_validate_env_name "$do_name"; then
        echo "Error: Invalid DO name format" >&2
        return 1
    fi
    
    # Check name lengths
    if [[ ${#nh_name} -gt 30 ]]; then
        echo "Error: NH name too long (max 30 characters)" >&2
        return 1
    fi
    
    if [[ ${#do_name} -gt 50 ]]; then
        echo "Error: DO name too long (max 50 characters)" >&2
        return 1
    fi
    
    # Use DO name as primary directory, NH name as alias
    local org_dir="$TKM_ORGS_DIR/$do_name"
    local alias_dir="$TKM_ORGS_DIR/$nh_name"
    
    if [[ -d "$org_dir" ]]; then
        echo "Organization '$do_name' already exists"
        return 1
    fi
    
    if [[ -e "$alias_dir" ]]; then
        echo "NH alias '$nh_name' already exists"
        return 1
    fi
    
    # Create organization directory structure using DO name
    mkdir -p "$org_dir"/{environments,keys,metadata}
    
    # Create symlink for NH alias (unless they're the same)
    if [[ "$nh_name" != "$do_name" ]]; then
        ln -s "$do_name" "$alias_dir"
        echo "Created alias: $nh_name → $do_name"
    fi
    
    # Create organization metadata
    cat > "$org_dir/metadata/org.conf" <<EOF
# Organization Configuration
NH_NAME="$nh_name"
DO_NAME="$do_name"
ORG_USER="$user"
ORG_HOST="$host"
ORG_CREATED="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
ORG_PROVIDER="digitalocean"
ORG_STATUS="active"
EOF
    
    # Create default environments file with tetra standard environments
    cat > "$org_dir/environments/servers.conf" <<EOF
# Server Configuration for $nh_name
# Format: ENV_NAME:PUBLIC_IP:PRIVATE_IP:FLOATING_IP:USER:PRIVILEGES:SPECS
# Tetra standard environments: local, dev, staging, prod

# Local control plane - build/deploy initiation and re-keying
local:127.0.0.1:127.0.0.1::$USER:admin,deploy,rekey:control-plane

# Development environment
dev:$host:$host::$user:admin,deploy:development

# Staging environment  
staging:staging.$host:staging.$host::$user:deploy:staging

# Production environment
prod:prod.$host:prod.$host::$user:deploy:production
EOF
    
    tkm_log "Created organization: $do_name (alias: $nh_name)" "INFO"
    echo "✅ Organization '$do_name' created successfully"
    echo "📁 Primary: $org_dir"
    if [[ "$nh_name" != "$do_name" ]]; then
        echo "🔗 Alias: $alias_dir → $do_name"
    fi
    echo "👤 User: $user"
    echo "🖥️  Host: $host"
    echo "🌍 Environments: local, dev, staging, prod (4 default environments created)"
    
    # Set as current organization if it's the first one
    if [[ ! -s "$TKM_CURRENT_ORG_FILE" ]]; then
        echo "$nh_name" > "$TKM_CURRENT_ORG_FILE"
        echo "🎯 Set as current organization"
    fi
}

# List all organizations
tkm_org_list() {
    echo "=== TKM Organizations ==="
    echo
    
    if [[ ! -d "$TKM_ORGS_DIR" ]]; then
        echo "No organizations found. Use 'addorg <name>' to create one."
        return 0
    fi
    
    echo "=== Organizations ==="
    echo
    printf "%-15s %-20s %-10s %-15s %-20s %8s\n" "PRIMARY" "ALIASES" "USER" "HOST" "SERVERS" "CURRENT"
    printf "%-15s %-20s %-10s %-15s %-20s %8s\n" "-------" "-------" "----" "----" "-------" "-------"
    
    local current_org=""
    if [[ -f "$TKM_CURRENT_ORG_FILE" ]]; then
        current_org=$(cat "$TKM_CURRENT_ORG_FILE")
    fi
    
    local org_count=0
    for org_dir in "$TKM_ORGS_DIR"/*; do
        [[ -d "$org_dir" ]] || continue

        # Skip symlinks - we only want primary organizations
        [[ -L "$org_dir" ]] && continue

        local org_name=$(basename "$org_dir")
        local org_conf="$org_dir/metadata/org.conf"
        local server_count=0
        
        # Count servers
        if [[ -f "$org_dir/environments/servers.conf" ]]; then
            server_count=$(grep -v '^#' "$org_dir/environments/servers.conf" | grep -c ':' 2>/dev/null)
            # Ensure server_count is a valid number
            if [[ ! "$server_count" =~ ^[0-9]+$ ]]; then
                server_count=0
            fi
        fi
        
        # Get organization details
        local do_name=""
        local org_user=""
        local org_host=""
        if [[ -f "$org_conf" ]]; then
            do_name=$(grep '^DO_NAME=' "$org_conf" | cut -d'"' -f2)
            org_user=$(grep '^ORG_USER=' "$org_conf" | cut -d'"' -f2)
            org_host=$(grep '^ORG_HOST=' "$org_conf" | cut -d'"' -f2)
        fi

        # Find aliases (symlinks pointing to this org)
        local aliases=""
        for potential_alias in "$TKM_ORGS_DIR"/*; do
            if [[ -L "$potential_alias" ]] && [[ "$(readlink "$potential_alias")" == "$org_name" ]]; then
                local alias_name=$(basename "$potential_alias")
                if [[ -n "$aliases" ]]; then
                    aliases="$aliases,$alias_name"
                else
                    aliases="$alias_name"
                fi
            fi
        done

        # Check if current org matches this primary or any alias
        local is_current=""
        if [[ "$org_name" == "$current_org" ]] || [[ ",$aliases," == *",$current_org,"* ]]; then
            is_current="🎯"
        fi

        printf "%-15s %-20s %-10s %-15s %-20s %8s\n" "$org_name" "${aliases:-none}" "${org_user:-devops}" "${org_host:-unknown}" "$server_count" "$is_current"
        ((org_count++))
    done
    
    if [[ "$org_count" -eq 0 ]]; then
        echo "No organizations found. Use 'addorg <name>' to create one."
    else
        echo
        echo "Total organizations: $org_count"
        if [[ -n "$current_org" ]]; then
            echo "Current organization: $current_org"
        fi
    fi
}

# Set current organization
tkm_org_set() {
    local org_name="$1"
    
    if [[ -z "$org_name" ]]; then
        echo "Usage: setorg <org_name>"
        echo "Available organizations:"
        tkm_org_list
        return 1
    fi
    
    local org_dir="$TKM_ORGS_DIR/$org_name"
    if [[ ! -d "$org_dir" ]]; then
        echo "Organization '$org_name' not found"
        echo "Available organizations:"
        tkm_org_list
        return 1
    fi
    
    echo "$org_name" > "$TKM_CURRENT_ORG_FILE"
    tkm_log "Set current organization: $org_name" "INFO"
    echo "✅ Current organization set to: $org_name"
}

# Get current organization (resolve aliases to primary names)
tkm_org_current() {
    if [[ -f "$TKM_CURRENT_ORG_FILE" ]]; then
        local org_name=$(cat "$TKM_CURRENT_ORG_FILE")
        if [[ -n "$org_name" ]]; then
            tkm_org_resolve "$org_name"
        fi
    fi
}

# Get DO name for an organization
tkm_org_get_do_name() {
    local nh_name="$1"
    local org_dir="$TKM_ORGS_DIR/$nh_name"
    local org_conf="$org_dir/metadata/org.conf"
    
    if [[ -f "$org_conf" ]]; then
        # Use grep to extract DO_NAME to avoid variable conflicts
        local do_name=$(grep '^DO_NAME=' "$org_conf" 2>/dev/null | cut -d'"' -f2)
        echo "${do_name:-$nh_name}"
    else
        echo "$nh_name"
    fi
}

# Import servers from nh_show_env_vars paste
tkm_org_import_paste() {
    local org_name="${1:-$(tkm_org_current)}"
    
    if [[ -z "$org_name" ]]; then
        echo "No organization specified and no current organization set"
        echo "Usage: importpaste [org_name]"
        return 1
    fi
    
    local org_dir="$TKM_ORGS_DIR/$org_name"
    if [[ ! -d "$org_dir" ]]; then
        echo "Organization '$org_name' not found. Create it first with: addorg $org_name"
        return 1
    fi
    
    echo "=== Import Servers from nh_show_env_vars ==="
    echo "Organization: $org_name"
    echo
    echo "Paste the output from 'nh_show_env_vars' below."
    echo "Press Ctrl+D when finished, or type 'cancel' to abort:"
    echo
    
    local paste_content=""
    local line_count=0
    
    # Read multiline input
    while IFS= read -r line; do
        if [[ "$line" == "cancel" ]]; then
            echo "Import cancelled"
            return 0
        fi
        paste_content+="$line"$'\n'
        ((line_count++))
    done
    
    if [[ -z "$paste_content" ]]; then
        echo "No content provided. Import cancelled."
        return 0
    fi
    
    echo
    echo "Processing $line_count lines of input..."
    echo
    
    # Parse the pasted content
    _tkm_org_parse_nh_output "$org_name" "$paste_content"
}

# Internal function to parse nh_show_env_vars output
_tkm_org_parse_nh_output() {
    local org_name="$1"
    local content="$2"
    local org_dir="$TKM_ORGS_DIR/$org_name"
    local servers_file="$org_dir/environments/servers.conf"
    local do_name=$(tkm_org_get_do_name "$org_name")
    
    # Create temporary file for parsing
    local temp_file=$(mktemp)
    echo "$content" > "$temp_file"
    
    # Arrays to store server data
    declare -A public_ips
    declare -A private_ips
    declare -A floating_ips
    declare -A server_specs
    
    # Parse export lines
    while IFS= read -r line; do
        # Skip non-export lines
        [[ "$line" =~ ^export ]] || continue
        
        # Extract variable name and value
        local var_line="${line#export }"
        local var_name="${var_line%%=*}"
        local var_value="${var_line#*=}"
        var_value="${var_value//\"/}"  # Remove quotes
        
        # Extract server info and specs from comments
        local specs=""
        if [[ "$line" =~ \#[[:space:]]*(.+) ]]; then
            specs="${BASH_REMATCH[1]}"
        fi
        
        # Parse variable name to extract server info
        # Match against DO name pattern (e.g., pxjam_arcade_dev01)
        if [[ "$var_name" =~ ^(.+)_([^_]+)(_(.+))?$ ]]; then
            local var_org_name="${BASH_REMATCH[1]}"
            local server_name="${BASH_REMATCH[2]}"
            local ip_type="${BASH_REMATCH[4]:-public}"
            
            # Only process if this matches our organization's DO name
            if [[ "$var_org_name" != "$do_name" ]]; then
                continue
            fi
            
            local full_server_name="${server_name}"
            
            case "$ip_type" in
                "private")
                    private_ips["$full_server_name"]="$var_value"
                    ;;
                "floating")
                    floating_ips["$full_server_name"]="$var_value"
                    ;;
                *)
                    public_ips["$full_server_name"]="$var_value"
                    if [[ -n "$specs" ]]; then
                        server_specs["$full_server_name"]="$specs"
                    fi
                    ;;
            esac
        fi
    done < "$temp_file"
    
    rm -f "$temp_file"
    
    # Generate servers configuration
    local import_count=0
    local backup_file="${servers_file}.backup.$(date +%Y%m%d_%H%M%S)"
    
    # Backup existing file
    if [[ -f "$servers_file" ]]; then
        cp "$servers_file" "$backup_file"
        echo "📦 Backed up existing servers to: $(basename "$backup_file")"
    fi
    
    # Write new configuration
    cat > "$servers_file" <<EOF
# Server Configuration for $org_name
# Format: ENV_NAME:PUBLIC_IP:PRIVATE_IP:FLOATING_IP:USER:PRIVILEGES:SPECS
# Generated from nh_show_env_vars output on $(date -u +"%Y-%m-%dT%H:%M:%SZ")

EOF
    
    # Process each server
    for server_name in "${!public_ips[@]}"; do
        local public_ip="${public_ips[$server_name]}"
        local private_ip="${private_ips[$server_name]:-}"
        local floating_ip="${floating_ips[$server_name]:-}"
        local specs="${server_specs[$server_name]:-}"
        
        # Determine environment type and privileges
        local privileges="deploy"
        if [[ "$server_name" =~ prod ]]; then
            privileges="deploy"
        elif [[ "$server_name" =~ dev ]]; then
            privileges="deploy,admin"
        elif [[ "$server_name" =~ qa ]]; then
            privileges="deploy,test"
        fi
        
        # Write server entry
        echo "$server_name:$public_ip:$private_ip:$floating_ip:tetra:$privileges:$specs" >> "$servers_file"
        ((import_count++))
        
        echo "✅ Imported: $server_name ($public_ip)"
        if [[ -n "$private_ip" ]]; then
            echo "   Private: $private_ip"
        fi
        if [[ -n "$floating_ip" ]]; then
            echo "   Floating: $floating_ip"
        fi
        if [[ -n "$specs" ]]; then
            echo "   Specs: $specs"
        fi
        echo
    done
    
    echo "=== Import Summary ==="
    echo "Organization: $org_name"
    echo "Servers imported: $import_count"
    echo "Configuration file: $servers_file"
    
    if [[ -f "$backup_file" ]]; then
        echo "Backup created: $backup_file"
    fi
    
    # Update organization metadata
    local org_conf="$org_dir/metadata/org.conf"
    if [[ -f "$org_conf" ]]; then
        # Update last import timestamp
        if grep -q "ORG_LAST_IMPORT=" "$org_conf"; then
            sed -i "s/ORG_LAST_IMPORT=.*/ORG_LAST_IMPORT=\"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"/" "$org_conf"
        else
            echo "ORG_LAST_IMPORT=\"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"" >> "$org_conf"
        fi
    fi
    
    tkm_log "Imported $import_count servers for organization: $org_name" "INFO"
    
    echo
    echo "Next steps:"
    echo "  • View servers: orgstatus $org_name"
    echo "  • Generate keys: generate all"
    echo "  • Set as current: setorg $org_name"
}

# Show organization status and servers
tkm_org_status() {
    local org_name="${1:-$(tkm_org_current)}"
    
    if [[ -z "$org_name" ]]; then
        echo "No organization specified and no current organization set"
        echo "Usage: orgstatus [org_name]"
        return 1
    fi
    
    local org_dir="$TKM_ORGS_DIR/$org_name"
    if [[ ! -d "$org_dir" ]]; then
        echo "Organization '$org_name' not found"
        return 1
    fi
    
    echo "=== Organization Status: $org_name ==="
    echo
    
    # Show organization metadata
    local org_conf="$org_dir/metadata/org.conf"
    if [[ -f "$org_conf" ]]; then
        echo "Organization Information:"
        echo "------------------------"
        source "$org_conf"
        echo "Name: $ORG_NAME"
        echo "Description: $ORG_DESCRIPTION"
        echo "Created: $ORG_CREATED"
        echo "Provider: ${ORG_PROVIDER:-unknown}"
        echo "Status: ${ORG_STATUS:-active}"
        if [[ -n "${ORG_LAST_IMPORT:-}" ]]; then
            echo "Last Import: $ORG_LAST_IMPORT"
        fi
        echo
    fi
    
    # Show servers
    local servers_file="$org_dir/environments/servers.conf"
    if [[ -f "$servers_file" ]]; then
        echo "Servers:"
        echo "--------"
        printf "%-12s %-15s %-15s %-15s %-10s %s\n" "NAME" "PUBLIC_IP" "PRIVATE_IP" "FLOATING_IP" "USER" "PRIVILEGES"
        echo "$(printf '%.80s' "$(printf '%*s' 80 '' | tr ' ' '-')")"
        
        local server_count=0
        while IFS=: read -r name public_ip private_ip floating_ip user privileges specs; do
            # Skip comments and empty lines
            [[ "$name" =~ ^#.*$ ]] && continue
            [[ -z "$name" ]] && continue
            
            printf "%-12s %-15s %-15s %-15s %-10s %s\n" \
                "$name" \
                "${public_ip:-'-'}" \
                "${private_ip:-'-'}" \
                "${floating_ip:-'-'}" \
                "${user:-'tetra'}" \
                "${privileges:-'deploy'}"
            ((server_count++))
        done < "$servers_file"
        
        echo
        echo "Total servers: $server_count"
    else
        echo "No servers configured"
        echo "Use 'importpaste' to import servers from nh_show_env_vars"
    fi
    
    # Show key statistics for this organization
    echo
    echo "Key Statistics:"
    echo "---------------"
    local org_keys_dir="$org_dir/keys"
    if [[ -d "$org_keys_dir" ]]; then
        local active_keys=$(find "$org_keys_dir" -name "*.pub" 2>/dev/null | wc -l)
        echo "Organization keys: $active_keys"
    else
        echo "Organization keys: 0"
    fi
    
    # Show global key statistics that might apply to this org
    if [[ -d "$TKM_KEYS_DIR/active" ]]; then
        local global_active=$(find "$TKM_KEYS_DIR/active" -name "*.pub" 2>/dev/null | wc -l)
        echo "Global active keys: $global_active"
    fi
}

# Remove organization
tkm_org_remove() {
    local org_name="$1"
    local force="${2:-false}"
    
    if [[ -z "$org_name" ]]; then
        echo "Usage: rmorg <org_name> [force]"
        return 1
    fi
    
    local org_dir="$TKM_ORGS_DIR/$org_name"
    if [[ ! -d "$org_dir" ]]; then
        echo "Organization '$org_name' not found"
        return 1
    fi
    
    # Check if it's the current organization
    local current_org=$(tkm_org_current)
    if [[ "$org_name" == "$current_org" ]]; then
        echo "Cannot remove current organization '$org_name'"
        echo "Set a different organization as current first"
        return 1
    fi
    
    # Safety check unless forced
    if [[ "$force" != "true" ]]; then
        echo "⚠️  This will permanently delete organization '$org_name' and all its data"
        echo "   Including: servers, keys, metadata, and configuration"
        echo
        read -p "Type 'DELETE' to confirm: " confirm
        if [[ "$confirm" != "DELETE" ]]; then
            echo "Removal cancelled"
            return 0
        fi
    fi
    
    # Create backup before removal
    local backup_dir="$TKM_DIR/backups/organizations"
    mkdir -p "$backup_dir"
    local backup_file="$backup_dir/${org_name}_$(date +%Y%m%d_%H%M%S).tar.gz"
    
    echo "📦 Creating backup..."
    if tar -czf "$backup_file" -C "$TKM_ORGS_DIR" "$org_name" 2>/dev/null; then
        echo "✅ Backup created: $backup_file"
    else
        echo "⚠️  Backup failed, but continuing with removal"
    fi
    
    # Remove organization directory
    rm -rf "$org_dir"
    
    tkm_log "Removed organization: $org_name" "INFO"
    echo "✅ Organization '$org_name' removed successfully"
    
    if [[ -f "$backup_file" ]]; then
        echo "💾 Backup available at: $backup_file"
    fi
}

# Delete organization (copy to tmp first)
tkm_org_delete() {
    local org_name="$1"
    
    if [[ -z "$org_name" ]]; then
        echo "Usage: org delete <org_name>"
        return 1
    fi
    
    local org_dir="$TKM_ORGS_DIR/$org_name"
    if [[ ! -d "$org_dir" ]]; then
        echo "Organization '$org_name' not found"
        return 1
    fi
    
    # Check if it's the current organization
    local current_org=$(tkm_org_current)
    if [[ "$org_name" == "$current_org" ]]; then
        echo "Cannot delete current organization '$org_name'"
        echo "Set a different organization as current first"
        return 1
    fi
    
    echo "=== Delete Organization: $org_name ==="
    echo
    
    # Show organization info before deletion
    echo "Organization details:"
    local org_conf="$org_dir/metadata/org.conf"
    if [[ -f "$org_conf" ]]; then
        source "$org_conf"
        echo "  Name: $ORG_NAME"
        echo "  Description: $ORG_DESCRIPTION"
        echo "  Created: $ORG_CREATED"
    fi
    
    # Count servers
    local server_count=0
    if [[ -f "$org_dir/environments/servers.conf" ]]; then
        server_count=$(grep -v '^#' "$org_dir/environments/servers.conf" | grep -c ':' 2>/dev/null)
        if [[ ! "$server_count" =~ ^[0-9]+$ ]]; then
            server_count=0
        fi
    fi
    echo "  Servers: $server_count"
    echo
    
    # Copy to tmp first
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local tmp_backup="/tmp/tkm_org_${org_name}_${timestamp}"
    
    echo "📦 Copying organization to tmp before deletion..."
    if cp -r "$org_dir" "$tmp_backup" 2>/dev/null; then
        echo "✅ Copied to: $tmp_backup"
    else
        echo "❌ Failed to copy to tmp"
        return 1
    fi
    echo
    
    # Confirm deletion
    echo "⚠️  This will permanently delete organization '$org_name'"
    echo "   A copy has been saved to: $tmp_backup"
    echo
    read -p "Type 'DELETE' to confirm: " confirm
    if [[ "$confirm" != "DELETE" ]]; then
        echo "Deletion cancelled"
        echo "Backup remains at: $tmp_backup"
        return 0
    fi
    
    # Remove organization directory
    rm -rf "$org_dir"
    
    # Clear current org if it was pointing to deleted org
    if [[ "$org_name" == "$current_org" ]]; then
        rm -f "$TKM_CURRENT_ORG_FILE"
        echo "🎯 Cleared current organization"
    fi
    
    tkm_log "Deleted organization: $org_name (backup: $tmp_backup)" "INFO"
    echo "✅ Organization '$org_name' deleted successfully"
    echo "💾 Backup available at: $tmp_backup"
    
    # Show remaining organizations
    echo
    echo "Remaining organizations:"
    tkm_org_list
}

# Organization command dispatcher
_tkm_org_dispatch() {
    local subcmd="${1:-}"
    shift || true
    
    case "$subcmd" in
        add)
            tkm_org_add "$@"
            ;;
        list|ls)
            tkm_org_list "$@"
            ;;
        set)
            tkm_org_set "$@"
            ;;
        current)
            local current=$(tkm_org_current)
            if [[ -n "$current" ]]; then
                echo "Current organization: $current"
                local do_name=$(tkm_org_get_do_name "$current")
                echo "DO name: $do_name"
                # Debug: show the actual config file
                local org_conf="$TKM_ORGS_DIR/$current/metadata/org.conf"
                if [[ -f "$org_conf" ]]; then
                    echo "Config file contents:"
                    cat "$org_conf"
                fi
            else
                echo "No current organization set"
            fi
            ;;
        status)
            tkm_org_status "$@"
            ;;
        import)
            tkm_org_import_paste "$@"
            ;;
        remove|rm)
            tkm_org_remove "$@"
            ;;
        delete|del)
            tkm_org_delete "$@"
            ;;
        help|"")
            _tkm_org_help
            ;;
        *)
            echo "Unknown org command: $subcmd"
            echo "Use 'org help' for available commands"
            return 1
            ;;
    esac
}

# Organization help
_tkm_org_help() {
    cat <<EOF
=== Organization Commands ===

Usage: org <command> [args...]

Commands:
  add <nh_name> <do_name> [user] [host]  Create new organization
  list, ls                               List all organizations
  set <name>                             Set current organization
  current                                Show current organization
  status [name]                          Show organization details
  import [name]                          Import servers from nh_show_env_vars paste
  remove <name> [force]                  Remove organization (with backup)
  delete <name>                          Delete organization (copy to tmp first)
  help                                   Show this help

Examples:
  org add pj pixeljam_arcade devops pj.example.com
  org add myorg mycompany admin server.mycompany.com
  org set pixeljam_arcade
  org import
  org status
  org list

See also: help organizations
EOF
}

# Initialize organization structure on load (silently)
tkm_org_init >/dev/null 2>&1 || true
