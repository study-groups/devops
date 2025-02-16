#!/bin/bash

# Variables
NODE_EXPORTER_VERSION="1.7.0"
NGINX_LOG_EXPORTER_VERSION="1.7.0"
USER="prometheus"
GROUP="prometheus"
NODE_EXPORTER_PORT=9100
NGINX_LOG_EXPORTER_PORT=4040
NGINX_LOG_FORMAT_NAME="prometheus"
NGINX_ACCESS_LOG="/var/log/nginx/access.log"
PROMETHEUS_CONFIG="/etc/prometheus/prometheus.yml"

# Function to create a system user
create_user() {
    if ! id "$USER" &>/dev/null; then
        sudo useradd --system --no-create-home --shell /bin/false $USER
    fi
}

# Function to install Node Exporter
install_node_exporter() {
    cd /tmp
    wget https://github.com/prometheus/node_exporter/releases/download/v$NODE_EXPORTER_VERSION/node_exporter-$NODE_EXPORTER_VERSION.linux-amd64.tar.gz
    tar -xvf node_exporter-$NODE_EXPORTER_VERSION.linux-amd64.tar.gz
    sudo mv node_exporter-$NODE_EXPORTER_VERSION.linux-amd64/node_exporter /usr/local/bin/
    sudo chown $USER:$GROUP /usr/local/bin/node_exporter

    # Create systemd service
    cat <<EOF | sudo tee /etc/systemd/system/node_exporter.service
[Unit]
Description=Node Exporter
After=network.target

[Service]
User=$USER
Group=$GROUP
Type=simple
ExecStart=/usr/local/bin/node_exporter --web.listen-address=:$NODE_EXPORTER_PORT

[Install]
WantedBy=multi-user.target
EOF

    # Start and enable Node Exporter service
    sudo systemctl daemon-reload
    sudo systemctl start node_exporter
    sudo systemctl enable node_exporter
}

# Function to configure NGINX for Prometheus log format
configure_nginx() {
    # Backup existing nginx.conf
    sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.bak

    # Add custom log format if not already present
    if ! grep -q "$NGINX_LOG_FORMAT_NAME" /etc/nginx/nginx.conf; then
        sudo sed -i "/http {/a \    log_format $NGINX_LOG_FORMAT_NAME '\$remote_addr - \$remote_user [\$time_local] \"\$request\" \$status \$body_bytes_sent \"\$http_referer\" \"\$http_user_agent\" \"\$http_x_forwarded_for\"';\n    access_log $NGINX_ACCESS_LOG $NGINX_LOG_FORMAT_NAME;" /etc/nginx/nginx.conf
    fi

    # Reload NGINX to apply changes
    sudo systemctl reload nginx
}

# Function to install NGINX Log Exporter
install_nginx_log_exporter() {
    cd /tmp
    wget https://github.com/martin-helmich/prometheus-nginxlog-exporter/releases/download/v$NGINX_LOG_EXPORTER_VERSION/prometheus-nginxlog-exporter
    sudo mv prometheus-nginxlog-exporter /usr/local/bin/
    sudo chmod +x /usr/local/bin/prometheus-nginxlog-exporter
    sudo chown $USER:$GROUP /usr/local/bin/prometheus-nginxlog-exporter

    # Create configuration file
    sudo mkdir -p /etc/prometheus-nginxlog-exporter
    cat <<EOF | sudo tee /etc/prometheus-nginxlog-exporter/config.yml
listen:
  port: $NGINX_LOG_EXPORTER_PORT
  address: "0.0.0.0"

namespaces:
  - name: nginx
    format: '\$remote_addr - \$remote_user [\$time_local] "\$request" \$status \$body_bytes_sent "\$http_referer" "\$http_user_agent" "\$http_x_forwarded_for"'
    source:
      files:
        - $NGINX_ACCESS_LOG
    labels:
      service: "nginx"
      environment: "production"
EOF
    sudo chown -R $USER:$GROUP /etc/prometheus-nginxlog-exporter

    # Create systemd service
    cat <<EOF | sudo tee /etc/systemd/system/nginxlog_exporter.service
[Unit]
Description=Prometheus NGINX Log Exporter
After=network.target

[Service]
User=$USER
Group=$GROUP
Type=simple
ExecStart=/usr/local/bin/prometheus-nginxlog-exporter -config-file /etc/prometheus-nginxlog-exporter/config.yml
Restart=always

[Install]
WantedBy=multi-user.target
EOF

    # Start and enable NGINX Log Exporter service
    sudo systemctl daemon-reload
    sudo systemctl start nginxlog_exporter
    sudo systemctl enable nginxlog_exporter
}

# Function to configure Prometheus to scrape new exporters
configure_prometheus() {
    # Backup existing Prometheus config
    sudo cp $PROMETHEUS_CONFIG ${PROMETHEUS_CONFIG}.bak

    # Add scrape configs if not already present
    if ! grep -q "node_exporter" $PROMETHEUS_CONFIG; then
        sudo sed -i "/scrape_configs:/a \  - job_name: 'node_exporter'\n    static_configs:\n      - targets: ['localhost:$NODE_EXPORTER_PORT']" $PROMETHEUS_CONFIG
    fi

    if ! grep -q "nginxlog_exporter" $PROMETHEUS_CONFIG; then
        sudo sed -i "/scrape_configs:/a \  - job_name: 'nginxlog_exporter'\n    static_configs:\n      - targets: ['localhost:$NGINX_LOG_EXPORTER_PORT']" $PROMETHEUS_CONFIG
    fi

    # Reload Prometheus to apply changes
    sudo systemctl reload prometheus
}

# Main execution
create_user
install_node_exporter
configure_nginx
install_nginx_log_exporter
configure_prometheus

echo "Installation and configuration complete."
