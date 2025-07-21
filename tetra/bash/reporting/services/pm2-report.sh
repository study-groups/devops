#!/bin/bash
# PM2 Data Collection and Reporting

command_exists() {
    command -v "$1" &> /dev/null
}

# Collects PM2 process data and populates port information.
collect_pm2_data() {
    if ! command_exists pm2; then return; fi

    local pm2_info
    pm2_info=$(pm2 jlist 2>/dev/null)
    if [ -z "$pm2_info" ]; then return; fi

    echo "$pm2_info" | jq -c '.[]' | while read -r process_json; do
        local name port
        name=$(echo "$process_json" | jq -r '.name')
        port=$(echo "$process_json" | jq -r '.pm2_env.PORT // .pm2_env.port // ""')
        
        if [ -n "$port" ]; then
            add_port_info "$port" "pm2" "listen" "$name"
        fi
    done
}

# Generates a summary report of running PM2 processes.
generate_pm2_summary() {
    if ! command_exists pm2; then return; fi
    echo ""
    echo "PM2 Process Summary"
    echo "-------------------"
    pm2 list
}

# Generates a detailed report for each PM2 process.
generate_pm2_detailed() {
    if ! command_exists pm2; then return; fi
    
    echo ""
    echo "Detailed PM2 Process Analysis"
    echo "============================="
    
    local pm2_info
    pm2_info=$(pm2 jlist 2>/dev/null)
    if [ -z "$pm2_info" ] || [ "$(echo "$pm2_info" | jq 'length')" -eq 0 ]; then
        echo "No PM2 processes found."
        return
    fi

    echo "$pm2_info" | jq -r '.[].name' | while read -r name; do
        echo ""
        echo "--- Process: $name ---"
        pm2 describe "$name"
    done
} 