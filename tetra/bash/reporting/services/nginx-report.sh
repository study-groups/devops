#!/usr/bin/env bash
# NGINX Data Collection and Reporting

# Collects NGINX configuration data and populates port information.
collect_nginx_data() {
    for config_file in /etc/nginx/sites-enabled/*; do
        if [ ! -f "$config_file" ]; then continue; fi
        
        local config_filename
        config_filename=$(basename "$config_file")

        # Collect listen ports
        grep -Eo '^\s*listen\s+[0-9]+' "$config_file" | awk '{print $2}' | while read -r port; do
            add_port_info "$port" "nginx" "listen" "$config_filename"
        done

        # Collect proxy_pass ports
        gawk -v cfg_file="$config_filename" '
            /proxy_pass\s/ {
                proxy_url = $2;
                gsub(";", "", proxy_url);
                url_no_slash = proxy_url;
                gsub(/\/$/, "", url_no_slash);
                
                if (url_no_slash ~ /localhost|127\.0\.0\.1/) {
                    if (match(url_no_slash, /[0-9]+$/)) {
                        port = substr(url_no_slash, RSTART, RLENGTH);
                        print port, "nginx", "proxy_pass", cfg_file
                    }
                }
            }
        ' "$config_file" | while read -r port svc action details; do
            add_port_info "$port" "$svc" "$action" "$details"
        done
    done
}

# Generates a summary report of NGINX configurations.
generate_nginx_summary() {
    echo "NGINX Port Mapping Summary"
    echo "--------------------------"
    (
        printf "%-25s | %-15s | %-28s | %s\n" "NGINX Config" "Location" "Proxy Pass" "Service Status"
        echo "--------------------------------------------------------------------------------"
        for config_file in /etc/nginx/sites-enabled/*; do
            if [ -f "$config_file" ]; then
                config_filename=$(basename "$config_file")
                gawk -v cfg_file="$config_filename" '
                BEGIN { current_location = "N/A" }
                /location\s/ {
                    match($0, /location\s+([^\{]+)/, m);
                    current_location = m[1];
                    gsub(/^[ \t]+|[ \t]+$/, "", current_location);
                }
                /proxy_pass\s/ {
                    proxy_url = $2;
                    gsub(";", "", proxy_url);
                    
                    url_no_slash = proxy_url;
                    gsub(/\/$/, "", url_no_slash);
                    port = "N/A";
                    if (url_no_slash ~ /localhost|127\.0\.0\.1/) {
                        if (match(url_no_slash, /[0-9]+$/)) {
                            port = substr(url_no_slash, RSTART, RLENGTH);
                        }
                    }
                    status = "Port " port;
                    if (port == "N/A") { status = (proxy_url ~ /^http/) ? "Remote/Other" : "Local URI"; }
                    
                    printf "%-25s | %-15s | %-28s | %s\n", cfg_file, current_location, proxy_url, status;
                }
                ' "$config_file"
            fi
        done
    )
}

# Generates a detailed report of NGINX configurations.
generate_nginx_detailed() {
    echo "Detailed NGINX Configuration Analysis"
    echo "====================================="
    for config_file in /etc/nginx/sites-enabled/*; do
        if [ -f "$config_file" ]; then
            echo "Processing NGINX config: $config_file"
            echo "--------------------------------------------------"
            cat "$config_file"
            echo -e "\n"
        fi
    done
}

# Generates a report of all active NGINX domains.
generate_domains_report() {
    echo ""
    echo "Active NGINX Domains"
    echo "--------------------"
    if [ -d "/etc/nginx/sites-enabled" ]; then
        grep -r -h 'server_name' /etc/nginx/sites-enabled/ | \
        sed -e 's/server_name//' -e 's/;//' | \
        xargs -n1 | \
        sort -u | \
        sed '/^$/d' # Remove empty lines
    else
        echo "NGINX sites-enabled directory not found."
    fi
} 