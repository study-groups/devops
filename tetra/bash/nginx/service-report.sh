#!/bin/bash
echo "NGINX, Systemd, PM2 (coming) Interworking Service Report"
NGINX_SITES_ENABLED="/etc/nginx/sites-enabled"
SERVICE_DIR="/etc/systemd/system"
REPORT_FILE="nginx_service_report.txt"

# Create or clear the report file
> "$REPORT_FILE"

echo "NGINX and Systemd Service Interworking Report" >> "$REPORT_FILE"
echo "==============================================" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Function to extract information from service files
extract_service_info() {
    local service_file="$1"
    local service_owner=$(stat -c '%U' "$service_file")  # Get the owner of the service file

    echo "  Matching service for port $port" >> "$REPORT_FILE"
    echo "    Owner: $service_owner" >> "$REPORT_FILE"
    echo "    Service: $service_file" >> "$REPORT_FILE"

    # Extract Environment variables
    env_vars=$(grep -E '^Environment=' "$service_file")
    if [[ -z "$env_vars" ]]; then
        echo "    Environment: Not defined" >> "$REPORT_FILE"
    else
        echo "    Environment:" >> "$REPORT_FILE"
        echo "$env_vars" | sed 's/^/       /' >> "$REPORT_FILE"
    fi

    # Extract WorkingDirectory (pwd)
    working_dir=$(grep -E '^WorkingDirectory=' "$service_file")
    if [[ -z "$working_dir" ]]; then
        echo "    Working Directory: Not defined" >> "$REPORT_FILE"
    else
        echo "    Working Directory: $(echo $working_dir | cut -d'=' -f2)" >> "$REPORT_FILE"
    fi

    # Extract ExecStart
    exec_start=$(grep -E '^ExecStart=' "$service_file")
    if [[ -z "$exec_start" ]]; then
        echo "    ExecStart: Not defined" >> "$REPORT_FILE"
    else
        echo "    ExecStart: $(echo $exec_start | cut -d'=' -f2)" >> "$REPORT_FILE"
    fi

    # Extract User
    user=$(grep -E '^User=' "$service_file")
    if [[ -z "$user" ]]; then
        echo "    User: Not defined" >> "$REPORT_FILE"
    else
        echo "    User: $(echo $user | cut -d'=' -f2)" >> "$REPORT_FILE"
    fi

    # Extract Group
    group=$(grep -E '^Group=' "$service_file")
    if [[ -z "$group" ]]; then
        echo "    Group: Not defined" >> "$REPORT_FILE"
    else
        echo "    Group: $(echo $group | cut -d'=' -f2)" >> "$REPORT_FILE"
    fi
    
    echo "" >> "$REPORT_FILE"
}

# Function to check if a port is managed by Docker
check_docker_service() {
    local port="$1"

    # Use docker ps to list containers and check for exposed ports
    container_id=$(docker ps --filter "publish=$port" --format "{{.ID}}")

    if [[ -n "$container_id" ]]; then
        echo "  Docker container found for port $port:" >> "$REPORT_FILE"
        docker inspect "$container_id" | grep -E '"Hostname":|"IPAddress":|"Ports":|"Networks":' >> "$REPORT_FILE"
        return 0
    else
        echo "  No Docker container found for port $port" >> "$REPORT_FILE"
        return 1
    fi
}

# Function to process NGINX config files and match services
process_nginx_config() {
    local nginx_file="$1"
    local nginx_file_path="/etc/nginx/sites-enabled/$nginx_file"
    echo "NGINX config: $nginx_file_path" >> "$REPORT_FILE"

    # Extract listen ports
    listen_ports=$(grep -Eo '^\s*listen\s+[0-9]+' "$nginx_file_path" | awk '{print $2}' | sort | uniq)
    
    if [[ -n "$listen_ports" ]]; then
        echo "listen:" >> "$REPORT_FILE"
        echo "    $(echo $listen_ports | tr '\n' ', ' | sed 's/, $//')" >> "$REPORT_FILE"
    fi

    # First summarize proxy_pass and mark services as missing if not found
    echo "proxy:" >> "$REPORT_FILE"
    
    awk '/location\s*\//,/^\s*\}/' "$nginx_file_path" | while read -r line; do
        if echo "$line" | grep -q 'location'; then
            location=$(echo "$line" | grep -oP '(?<=location\s).*?(?=\s*\{)')
        fi
        if echo "$line" | grep -q 'proxy_pass'; then
            proxy_pass=$(echo "$line" | grep -Eo 'proxy_pass http://localhost:[0-9]+')
            port=$(echo "$proxy_pass" | grep -Eo '[0-9]+')
            echo -n "    $proxy_pass (location $location)" >> "$REPORT_FILE"

            # Check for matching systemd service or Docker container
            found_service=0
            find "$SERVICE_DIR" -type f -name "*.service" | while read -r service_file; do
                if grep -q "$port" "$service_file"; then
                    found_service=1
                fi
            done

            if [[ $found_service -eq 0 ]]; then
                if check_docker_service "$port"; then
                    echo "" >> "$REPORT_FILE"
                else
                    echo "  ** NO SERVICE FOUND **" >> "$REPORT_FILE"
                fi
            else
                echo "" >> "$REPORT_FILE"
            fi
        fi
    done

    echo "------" >> "$REPORT_FILE"
}

# Function to process NGINX config files and match services
process_proxy_details() {
    local nginx_file="$1"
    local nginx_file_path="/etc/nginx/sites-enabled/$nginx_file"

    awk '/location\s*\//,/^\s*\}/' "$nginx_file_path" | while read -r line; do
        if echo "$line" | grep -q 'proxy_pass'; then
            proxy_pass=$(echo "$line" | grep -Eo 'proxy_pass http://localhost:[0-9]+')
            location=$(echo "$line" | grep -B1 "$proxy_pass" | grep -oP '(?<=location\s).*?(?=\s*\{)')
            port=$(echo "$proxy_pass" | grep -Eo '[0-9]+')

            echo "  Matching service for port $port" >> "$REPORT_FILE"
            found_service=0
            find "$SERVICE_DIR" -type f -name "*.service" | while read -r service_file; do
                if grep -q "$port" "$service_file"; then
                    extract_service_info "$service_file"
                    found_service=1
                fi
            done

            if [[ $found_service -eq 0 ]]; then
                check_docker_service "$port"
            fi
        fi
    done

    echo "------" >> "$REPORT_FILE"
}

# Process all nginx config files in /etc/nginx/sites-enabled
process_all_nginx_configs() {
    for file in $(ls /etc/nginx/sites-enabled); do
        process_nginx_config "$file"
    done
}

# Process all proxy details for matching services
process_all_proxy_details() {
    for file in $(ls /etc/nginx/sites-enabled); do
        process_proxy_details "$file"
    done
}

# Generate summary of proxy and listen configuration
process_all_nginx_configs

# Generate detailed information for each proxy and matched service
process_all_proxy_details

# Output the report
echo "Report generated at: $REPORT_FILE"
