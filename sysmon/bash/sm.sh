# Environment Variables
export SM_GRAFANA_PORT=3000
export SM_PROMETHEUS_PORT=9090
export SM_CADVISOR_PORT=8080
export SM_RUN_MODE=systemd  # or docker
export SM_USER=${SM_USER:-$(whoami)}

# Help Functions
sm-help() {
    echo "sm- bash functions for system-monitor Docker project."
    echo "Available commands:"
    echo "  sm_grafana_help       - Help for Grafana"
    echo "  sm_prometheus_help    - Help for Prometheus"
    echo "  sm_cadvisor_help      - Help for cAdvisor"
    echo "  sm_grafana_status     - Status of Grafana"
    echo "  sm_prometheus_status  - Status of Prometheus"
    echo "  sm_cadvisor_status    - Status of cAdvisor"
    echo "  sm_grafana_start      - Start Grafana"
    echo "  sm_prometheus_start   - Start Prometheus"
    echo "  sm_cadvisor_start     - Start cAdvisor"
    echo "  sm_grafana_stop       - Stop Grafana"
    echo "  sm_prometheus_stop    - Stop Prometheus"
    echo "  sm_cadvisor_stop      - Stop cAdvisor"
    echo "  sm_mysql_connect      - Connect to MySQL adapter"
    echo "  sm_docker_ps          - List Docker containers"
    echo "  sm_docker_up          - Create and start Docker containers"
    echo "  sm_docker_start       - Start Docker containers"
    echo "  sm_docker_stop        - Stop Docker containers"
    echo "  sm_docker_build       - Build Docker containers"
    echo "  sm_docker_bash        - Open bash in Docker container"
    echo "  sm_docker_get_ip      - Get IP of Docker container"
    echo "  sm_docker_burn_it_down - Stop and remove all Docker containers"
    echo "  sm_docker_inspect     - Inspect Docker container"
    echo "  sm_docker_restart     - Restart Docker container"
    echo "  sm_docker_logs        - Show logs of Docker container"
    echo "  sm_docker_volume_create - Create Docker volume"
    echo "  sm_docker_prune       - Prune Docker volumes"
    echo "  sm_docker_volume_inspect - Inspect Docker volume"
    echo "  sm_network_connect    - Connect Docker network"
    echo "  sm_local_env          - Load local environment variables"
    echo "  sm_local_adapter      - Run local adapter script"
    echo "  sm_install_service    - Install a systemd service"
    echo "  sm_remove_service     - Remove a systemd service"
}

# Help Details
sm_grafana_help() {
    echo "Grafana Help:"
    echo "  Critical files:"
    echo "    - Configuration: /etc/grafana/grafana.ini"
    echo "    - Data Storage: /var/lib/grafana"
    echo "    - Provisioning: /etc/grafana/provisioning"
    echo "  First-time usage:"
    echo "    - Default URL: http://localhost:${SM_GRAFANA_PORT}"
    echo "    - Default admin username: admin"
    echo "    - Default admin password: admin"
}

sm_prometheus_help() {
    echo "Prometheus Help:"
    echo "  Critical files:"
    echo "    - Configuration: /etc/prometheus/prometheus.yml"
    echo "    - Data Storage: /var/lib/prometheus"
    echo "  First-time usage:"
    echo "    - Default URL: http://localhost:${SM_PROMETHEUS_PORT}"
}

sm_cadvisor_help() {
    echo "cAdvisor Help:"
    echo "  Critical files:"
    echo "    - Data exposed: /metrics"
    echo "  First-time usage:"
    echo "    - Default URL: http://localhost:${SM_CADVISOR_PORT}"
}

# Status Functions
sm_grafana_status() {
    if pgrep -x "grafana-server" > /dev/null; then
        echo "Grafana is running via systemd"
    elif docker ps | grep -q "grafana/grafana"; then
        echo "Grafana is running via Docker"
    else
        echo "Grafana is not running"
    fi
}

sm_prometheus_status() {
    if pgrep -x "prometheus" > /dev/null; then
        echo "Prometheus is running via systemd"
    elif docker ps | grep -q "prom/prometheus"; then
        echo "Prometheus is running via Docker"
    else
        echo "Prometheus is not running"
    fi
}

sm_cadvisor_status() {
    if pgrep -x "cadvisor" > /dev/null; then
        echo "cAdvisor is running via systemd"
    elif docker ps | grep -q "gcr.io/cadvisor/cadvisor"; then
        echo "cAdvisor is running via Docker"
    else
        echo "cAdvisor is not running"
    fi
}

# Systemd Functions
sm_grafana_systemd_start() {
    systemctl start grafana
}

sm_grafana_systemd_stop() {
    systemctl stop grafana
}

sm_prometheus_systemd_start() {
    systemctl start prometheus
}

sm_prometheus_systemd_stop() {
    systemctl stop prometheus
}

sm_cadvisor_systemd_start() {
    systemctl start cadvisor
}

sm_cadvisor_systemd_stop() {
    systemctl stop cadvisor
}

# Unified Commands using SM_RUN_MODE
sm_grafana_start() {
    if [ "$SM_RUN_MODE" = "docker" ]; then
        sm_grafana_docker_start
    else
        sm_grafana_systemd_start
    fi
}

sm_grafana_stop() {
    if [ "$SM_RUN_MODE" = "docker" ]; then
        sm_grafana_docker_stop
    else
        sm_grafana_systemd_stop
    fi
}

sm_prometheus_start() {
    if [ "$SM_RUN_MODE" = "docker" ]; then
        sm_prometheus_docker_start
    else
        sm_prometheus_systemd_start
    fi
}

sm_prometheus_stop() {
    if [ "$SM_RUN_MODE" = "docker" ]; then
        sm_prometheus_docker_stop
    else
        sm_prometheus_systemd_stop
    fi
}

sm_cadvisor_start() {
    if [ "$SM_RUN_MODE" = "docker" ]; then
        sm_cadvisor_docker_start
    else
        sm_cadvisor_systemd_start
    fi
}

sm_cadvisor_stop() {
    if [ "$SM_RUN_MODE" = "docker" ]; then
        sm_cadvisor_docker_stop
    else
        sm_cadvisor_systemd_stop
    fi
}

sm_local_env(){
  export $(grep -v '^#' .env | xargs)
  echo $(grep -v '^#' .env | xargs)
}

sm_local_adapter(){
  ./adapter/app/entrypoint.sh
}

# Service Management Functions
sm_install_service() {
    local service_name=$1
    local exec_start=$2
    local service_file="/etc/systemd/system/${service_name}.service"

    cat <<EOF | sudo tee $service_file
[Unit]
Description=${service_name} Service

[Service]
ExecStart=${exec_start}
User=${SM_USER}
Restart=on-failure
StandardOutput=journal

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload
    sudo systemctl enable ${service_name}
    sudo systemctl start ${service_name}
    echo "${service_name} service installed and started."
}

sm_remove_service() {
    local service_name=$1
    local service_file="/etc/systemd/system/${service_name}.service"

    sudo systemctl stop ${service_name}
    sudo systemctl disable ${service_name}
    sudo rm -f $service_file
    sudo systemctl daemon-reload
    echo "${service_name} service removed."
}