#!/usr/bin/env bash
# PM2 Data Collection and Reporting

command_exists() {
    command -v "$1" &> /dev/null
}

# Collects PM2 process data for a specific user.
# Arguments:
#   $1: The user to run the pm2 command as.
collect_pm2_data_for_user() {
    local user="$1"
    local pm2_json_file="$TEMP_DIR/pm2_data_${user}.json"

    if ! command_exists "pm2"; then
        return
    fi

    # Source the user-specific tetra.sh to set up nvm before running pm2
    local tetra_setup_script
    tetra_setup_script_path=$(eval echo ~${user}/tetra/tetra.sh)
    
    if [ ! -f "$tetra_setup_script_path" ]; then
        # Fallback for users that dont have tetra
        if sudo -u "$user" pm2 jlist 2>/dev/null | sed -n '/^\[.*$/,$p' > "$pm2_json_file" && [ -s "$pm2_json_file" ]; then
            # Data collected, now process it
            local app_names
            if app_names=$(jq -r '.[].name' < "$pm2_json_file" 2>/dev/null); then
                for app_name in $app_names; do
                    local port
                    port=$(sudo -u "$user" bash -c "pm2 describe '$app_name' | grep -oP 'port \\K\\d+'" 2>/dev/null)
                    if [[ -n "$port" ]]; then
                        add_port_info "$port" "pm2" "listen" "$app_name"
                    fi
                done
            fi
        fi
        return
    fi
    
    if sudo -u "$user" bash -c "source '$tetra_setup_script_path' &>/dev/null && pm2 jlist" 2>/dev/null | sed -n '/^\[.*$/,$p' > "$pm2_json_file" && [ -s "$pm2_json_file" ]; then
        # Data collected, now process it
        local app_names
        if app_names=$(jq -r '.[].name' < "$pm2_json_file" 2>/dev/null); then
            for app_name in $app_names; do
                local port
                port=$(sudo -u "$user" bash -c "source '$tetra_setup_script_path' &>/dev/null && pm2 describe '$app_name' | grep -oP 'port \\K\\d+'" 2>/dev/null)
                if [[ -n "$port" ]]; then
                    add_port_info "$port" "pm2" "listen" "$app_name"
                fi
            done
        fi
    fi
}

# Generates a summary report of running PM2 processes for a given user.
# Arguments:
#   $1: The user to run the pm2 command as.
generate_pm2_summary_for_user() {
    local user="$1"
    local pm2_json_file="$TEMP_DIR/pm2_data_${user}.json"

    if ! command_exists "jq"; then
        echo "jq is not installed. Cannot generate summary report."
        return
    fi

    if [ ! -s "$pm2_json_file" ]; then
        echo "No PM2 data found for user: $user"
        return
    fi

    # Validate JSON before processing
    if ! jq empty < "$pm2_json_file" 2>/dev/null; then
        echo "PM2 data for user $user is corrupted (JSON parse error)"
        return
    fi

    echo "PM2 Summary for user: $user"
    echo "--------------------------"
    jq -r '.[] | "\(.name) | \(.pm2_env.status) | \(.pm2_env.version // "N/A") | \(.pm2_env.pm_uptime) | \(.pm2_env.restart_time) restarts"' < "$pm2_json_file" | column -t -s '|'
    echo ""
}

# Generates a detailed report for each PM2 process for a given user.
# Arguments:
#   $1: The user to run the pm2 command as.
generate_pm2_detailed_for_user() {
    local user="$1"
    local pm2_json_file="$TEMP_DIR/pm2_data_${user}.json"

    if [ ! -s "$pm2_json_file" ]; then
        return
    fi

    # Validate JSON before processing
    if ! jq empty < "$pm2_json_file" 2>/dev/null; then
        echo ""
        echo "Detailed PM2 Process Analysis for user: $user"
        echo "=============================================="
        echo "PM2 data for user $user is corrupted (JSON parse error)"
        return
    fi

    echo ""
    echo "Detailed PM2 Process Analysis for user: $user"
    echo "=============================================="
    
    local app_names
    if ! app_names=$(jq -r '.[].name' < "$pm2_json_file" 2>/dev/null); then
        echo "Failed to parse PM2 process names"
        return
    fi

    local tetra_setup_script_path
    tetra_setup_script_path=$(eval echo ~${user}/tetra/tetra.sh)

    for app_name in $app_names; do
        echo ""
        echo "--- Process: $app_name ---"
        if [ -f "$tetra_setup_script_path" ]; then
            sudo -u "$user" bash -c "source '$tetra_setup_script_path' &>/dev/null && pm2 describe '$app_name'"
        else
            sudo -u "$user" pm2 describe "$app_name"
        fi
    done
} 