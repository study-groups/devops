#!/usr/bin/env bash

# TKM System Import Script
# Imports system definitions from environment variables or direct input

# Source TKM
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
source "$SCRIPT_DIR/../tkm.sh"

import_pixeljam_systems() {
    echo "=== Importing PixelJam Arcade Systems ==="
    echo
    
    # Your current system definitions from environment variables
    local systems=(
        "qa01:146.190.151.245:tetra:deploy,test"
        "prod01:64.23.151.249:tetra:deploy"
        "dev01:137.184.226.163:tetra:deploy,admin"
    )
    
    echo "Systems to import:"
    for system in "${systems[@]}"; do
        IFS=: read -r name ip user privileges <<< "$system"
        echo "  $name -> $user@$ip ($privileges)"
    done
    echo
    
    read -p "Import these systems? (y/N): " confirm
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        for system in "${systems[@]}"; do
            IFS=: read -r name ip user privileges <<< "$system"
            
            # Check if environment already exists
            if grep -q "^${name}:" "$TKM_CONFIG_DIR/environments.conf"; then
                echo "⚠️  Environment '$name' already exists, updating..."
                # Remove existing entry
                grep -v "^${name}:" "$TKM_CONFIG_DIR/environments.conf" > "$TKM_CONFIG_DIR/environments.conf.tmp"
                mv "$TKM_CONFIG_DIR/environments.conf.tmp" "$TKM_CONFIG_DIR/environments.conf"
            fi
            
            # Add new entry
            echo "$name:$ip:$user:$privileges" >> "$TKM_CONFIG_DIR/environments.conf"
            echo "✅ Added: $name ($user@$ip)"
        done
        
        echo
        echo "=== Updated Environment Configuration ==="
        cat "$TKM_CONFIG_DIR/environments.conf"
    else
        echo "Import cancelled"
    fi
}

# Function to add a single system interactively
add_system_interactive() {
    echo "=== Add System Interactively ==="
    echo
    
    read -p "Environment name (e.g., staging, qa02): " env_name
    read -p "IP address or hostname: " host
    read -p "Username (default: tetra): " user
    user="${user:-tetra}"
    read -p "Privileges (default: deploy): " privileges
    privileges="${privileges:-deploy}"
    
    echo
    echo "System to add:"
    echo "  Name: $env_name"
    echo "  Host: $host"
    echo "  User: $user"
    echo "  Privileges: $privileges"
    echo
    
    read -p "Add this system? (y/N): " confirm
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        # Check if environment already exists
        if grep -q "^${env_name}:" "$TKM_CONFIG_DIR/environments.conf"; then
            echo "⚠️  Environment '$env_name' already exists, updating..."
            grep -v "^${env_name}:" "$TKM_CONFIG_DIR/environments.conf" > "$TKM_CONFIG_DIR/environments.conf.tmp"
            mv "$TKM_CONFIG_DIR/environments.conf.tmp" "$TKM_CONFIG_DIR/environments.conf"
        fi
        
        echo "$env_name:$host:$user:$privileges" >> "$TKM_CONFIG_DIR/environments.conf"
        echo "✅ Added: $env_name ($user@$host)"
        
        echo
        echo "=== Updated Environment Configuration ==="
        cat "$TKM_CONFIG_DIR/environments.conf"
    else
        echo "Add cancelled"
    fi
}

# Function to update staging specifically
update_staging() {
    echo "=== Update Staging Configuration ==="
    echo
    
    # From your env vars, I don't see a specific staging IP
    # Let's use qa01 as staging for now, or you can specify
    echo "Current staging configuration:"
    grep "^staging:" "$TKM_CONFIG_DIR/environments.conf" || echo "No staging found"
    echo
    
    echo "Options:"
    echo "1. Use qa01 (146.190.151.245) as staging"
    echo "2. Enter custom staging IP"
    echo "3. Keep current staging.pixeljamarcade.com"
    echo
    
    read -p "Choose option (1-3): " choice
    
    case "$choice" in
        1)
            # Update staging to use qa01 IP
            grep -v "^staging:" "$TKM_CONFIG_DIR/environments.conf" > "$TKM_CONFIG_DIR/environments.conf.tmp"
            mv "$TKM_CONFIG_DIR/environments.conf.tmp" "$TKM_CONFIG_DIR/environments.conf"
            echo "staging:146.190.151.245:tetra:deploy" >> "$TKM_CONFIG_DIR/environments.conf"
            echo "✅ Updated staging to use qa01 IP (146.190.151.245)"
            ;;
        2)
            read -p "Enter staging IP address: " staging_ip
            grep -v "^staging:" "$TKM_CONFIG_DIR/environments.conf" > "$TKM_CONFIG_DIR/environments.conf.tmp"
            mv "$TKM_CONFIG_DIR/environments.conf.tmp" "$TKM_CONFIG_DIR/environments.conf"
            echo "staging:$staging_ip:tetra:deploy" >> "$TKM_CONFIG_DIR/environments.conf"
            echo "✅ Updated staging to use $staging_ip"
            ;;
        3)
            echo "Keeping current staging configuration"
            ;;
        *)
            echo "Invalid choice"
            return 1
            ;;
    esac
    
    echo
    echo "=== Updated Environment Configuration ==="
    cat "$TKM_CONFIG_DIR/environments.conf"
}

# Main menu
main() {
    echo "TKM System Import Tool"
    echo "====================="
    echo
    echo "Options:"
    echo "1. Import PixelJam systems from your env vars"
    echo "2. Add system interactively"
    echo "3. Update staging configuration"
    echo "4. Show current environments"
    echo "5. Exit"
    echo
    
    read -p "Choose option (1-5): " choice
    
    case "$choice" in
        1) import_pixeljam_systems ;;
        2) add_system_interactive ;;
        3) update_staging ;;
        4) 
            echo "=== Current Environments ==="
            cat "$TKM_CONFIG_DIR/environments.conf"
            ;;
        5) echo "Goodbye!" ;;
        *) echo "Invalid choice" ;;
    esac
}

# Run main if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
