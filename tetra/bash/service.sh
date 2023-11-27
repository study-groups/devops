# Default variables
TETRA_PORT=4404
TETRA_SERVICE_SRC=$HOME/src/devops-study-group/tetra/php

# Create Service for Python Flask app
tetra_service_create() {
    cat << EOF > /etc/systemd/system/tetra.service
[Unit]
Description=Tetra Service

[Service]
ExecStart=/usr/bin/python3 $TETRA_SERVICE_SRC/tetra.py
Restart=always

[Install]
WantedBy=multi-user.target
EOF
}

# Start Service for Python Flask app
tetra_service_start() {
    systemctl daemon-reload
    systemctl enable tetra
    systemctl start tetra
}

# Stop Service for Python Flask app
tetra_service_stop() {
    systemctl stop tetra
}

# Remove Service for Python Flask app
tetra_service_remove() {
    systemctl stop tetra
    systemctl disable tetra
    rm /etc/systemd/system/tetra.service
    systemctl daemon-reload
}

# Create Service for PHP
tetra_service_create_php() {
    cat << EOF > /etc/nginx/sites-available/tetra
server {
    listen $TETRA_PORT;
    root $TETRA_SERVICE_SRC;
    index index.php;

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php7.x-fpm.sock;
    }
}
EOF
    ln -s /etc/nginx/sites-available/tetra /etc/nginx/sites-enabled/
}

# Start Service for PHP
tetra_service_start_php() {
    systemctl restart nginx
    systemctl restart php-fpm
}

# Stop Service for PHP
tetra_service_stop_php() {
    systemctl stop nginx
    systemctl stop php-fpm
}

# Remove Service for PHP
tetra_service_remove_php() {
    systemctl stop nginx
    systemctl disable nginx
    systemctl stop php-fpm
    systemctl disable php-fpm
    rm /etc/nginx/sites-available/tetra
    rm /etc/nginx/sites-enabled/tetra
    systemctl daemon-reload
}

# Help function to display summary
tetra_service_help() {
    echo "tetra_service_create: Creates a systemd service for a Flask app."
    echo "tetra_service_start: Starts the Flask app service."
    echo "tetra_service_stop: Stops the Flask app service."
    echo "tetra_service_remove: Removes the Flask app service."
    echo "tetra_service_create_php: Sets up Nginx to serve a PHP app."
    echo "tetra_service_start_php: Starts Nginx and PHP-FPM for the PHP app."
    echo "tetra_service_stop_php: Stops Nginx and PHP-FPM for the PHP app."
    echo "tetra_service_remove_php: Removes the Nginx and PHP-FPM configuration for the PHP app."
}

