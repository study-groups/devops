#!/bin/bash
# PM2 Data Collection and Reporting

command_exists() {
    command -v "$1" &> /dev/null
}

# Collects PM2 process data for a specific user.
# Arguments:
#   $1: The user to run the pm2 command as.
collect_pm2_data_for_user() {
    local user="$1"
    if ! command_exists pm2; then return; fi

    # Use sudo to run pm2 commands as the specified user
    local pm2_info
    pm2_info=$(sudo -u "$user" pm2 jlist 2>/dev/null)
    if [ -z "$pm2_info" ]; then return; fi

    echo "$pm2_info" | jq -c '.[]' | while read -r process_json; do
        local name port
        name=$(echo "$process_json" | jq -r '.name')
        port=$(echo "$process_json" | jq -r '.pm2_env.PORT // .pm2_env.port // ""')
        
        if [ -n "$port" ]; then
            # Add the user context to the details
            add_port_info "$port" "pm2" "listen" "$name ($user)"
        fi
    done
}

# Generates a summary report of running PM2 processes for a given user.
# Arguments:
#   $1: The user to run the pm2 command as.
generate_pm2_summary_for_user() {
    local user="$1"
    if ! command_exists pm2; then return; fi
    
    # Check if the user has any pm2 processes
    if ! sudo -u "$user" pm2 jlist 2>/dev/null | jq -e '. | length > 0' >/dev/null; then
        return
    fi

    echo ""
    echo "PM2 Process Summary (User: $user)"
    echo "---------------------------------"
    sudo -u "$user" pm2 list
}

# Generates a detailed report for each PM2 process for a given user.
# Arguments:
#   $1: The user to run the pm2 command as.
generate_pm2_detailed_for_user() {
    local user="$1"
    if ! command_exists pm2; then return; fi
    
    local pm2_info
    pm2_info=$(sudo -u "$user" pm2 jlist 2>/dev/null)
    if [ -z "$pm2_info" ] || [ "$(echo "$pm2_info" | jq 'length')" -eq 0 ]; then
        return
    fi

    echo ""
    echo "Detailed PM2 Process Analysis (User: $user)"
    echo "=========================================="

    echo "$pm2_info" | jq -r '.[].name' | while read -r name; do
        echo ""
        echo "--- Process: $name ---"
        sudo -u "$user" pm2 describe "$name"
    done
} 