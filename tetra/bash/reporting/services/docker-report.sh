#!/bin/bash
# Docker Data Collection and Reporting

command_exists() {
    command -v "$1" &> /dev/null
}

# Collects Docker container data and populates port information.
collect_docker_data() {
    if ! command_exists docker; then return; fi

    docker ps --format "{{.ID}}" | while read -r container_id; do
        if [ -z "$container_id" ]; then continue; fi
        
        local image_name
        image_name=$(docker inspect --format '{{.Config.Image}}' "$container_id")
        
        docker port "$container_id" | while read -r line; do
            local port_mapping
            port_mapping=($line)
            local container_port=${port_mapping[0]}
            local host_port_info=${port_mapping[2]}
            
            # Extract only the port number from the container port (e.g., 80/tcp -> 80)
            local cport
            cport=$(echo "$container_port" | cut -d'/' -f1)
            
            # Extract only the port number from the host port info (e.g., 0.0.0.0:8080 -> 8080)
            local hport
            hport=$(echo "$host_port_info" | cut -d':' -f2)

            add_port_info "$cport" "docker" "container_port" "$image_name"
            if [ -n "$hport" ]; then
                add_port_info "$hport" "docker" "host_port" "$image_name"
            fi
        done
    done
}

# Generates a summary report of running Docker containers.
generate_docker_summary() {
    if ! command_exists docker; then return; fi
    echo ""
    echo "Docker Container Summary"
    echo "------------------------"
    docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
}

# Generates a detailed report for each running Docker container.
generate_docker_detailed() {
    if ! command_exists docker; then return; fi
    
    echo ""
    echo "Detailed Docker Container Analysis"
    echo "=================================="
    
    if ! docker ps -q &>/dev/null; then
        echo "No running Docker containers found or Docker daemon is not running."
        return
    fi

    docker ps -q | while read -r id; do
        echo ""
        echo "--- Container: $(docker inspect --format '{{.Name}}' "$id" | sed 's,^/,,') ---"
        docker inspect "$id" | jq '.[0] | {Name: .Name, Image: .Config.Image, State: .State, IPAddress: .NetworkSettings.IPAddress, Ports: .NetworkSettings.Ports}'
    done
} 