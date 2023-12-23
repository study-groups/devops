tetra_docker_php_make() {
    local serviceName=${1:-php}
    export TETRA_DOCKER_PHP="${TETRA_DOCKER_DIR}/${serviceName}"

    (
        mkdir -p "${TETRA_DOCKER_PHP}"
        cd "${TETRA_DOCKER_PHP}"

        cat > Dockerfile <<EOF
FROM php:8.0-apache
COPY . /var/www/html
COPY entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/entrypoint.sh
ENTRYPOINT ["entrypoint.sh"]
CMD ["apache2-foreground"]
EOF

        cat >> "${TETRA_DOCKER_DIR}/docker-compose.yml" <<EOF
  ${serviceName}:
    build: ${TETRA_DOCKER_PHP}
    ports:
      - "4444:80"
    volumes:
      - ${TETRA_DOCKER_PHP}:/var/www/html
EOF

        cat > entrypoint.sh <<EOF
#!/bin/bash
exec apache2-foreground
EOF
        chmod +x entrypoint.sh

        echo "<?php phpinfo();" > index.php
    )
}

tetra_docker_php_start() {
    (
        cd "${TETRA_DOCKER_DIR}"
        docker-compose up -d ${TETRA_DOCKER_PHP}
    )
}

tetra_docker_php_stop() {
    (
        cd "${TETRA_DOCKER_DIR}"
        docker-compose down ${TETRA_DOCKER_PHP}
    )
}

tetra_docker_php_status() {
    (
        cd "${TETRA_DOCKER_DIR}"
        docker-compose ps ${TETRA_DOCKER_PHP}
    )
}

tetra_docker_php_log() {
    (
        cd "${TETRA_DOCKER_DIR}"
        docker-compose logs ${TETRA_DOCKER_PHP}
    )
}

tetra_docker_php_help() {
    echo "TETRA_DOCKER_DIR: Directory for Docker projects"
    echo "TETRA_DOCKER_PHP: Specific directory for the PHP project"
    echo "Functions available:"
    echo "  tetra_docker_php_make [serviceName] - Sets up PHP Docker environment"
    echo "  tetra_docker_php_start - Starts the PHP Docker container"
    echo "  tetra_docker_php_stop - Stops the PHP Docker container"
    echo "  tetra_docker_php_status - Shows the status of the PHP Docker container"
    echo "  tetra_docker_php_log - Displays logs for the PHP Docker container"
}

tetra_docker_generate_picoui_php() {
    (
        cd "${TETRA_DOCKER_PHP}"
        cat > picoui.php <<EOF
<?php
session_start();

\$endpoint = \$_SERVER['REQUEST_URI'];

switch (\$endpoint) {
    case '/saveState':
        handleSaveState();
        break;
    case '/loadState':
        handleLoadState();
        break;
    default:
        if (file_exists(__DIR__ . \$endpoint)) {
            return false;
        } else {
            echo "404 Not Found";
            http_response_code(404);
        }
        break;
}

function handleSaveState() {
    \$input = json_decode(file_get_contents('php://input'), true);
    \$_SESSION['picoState'] = \$input;
    echo json_encode(['status' => 'success']);
}

function handleLoadState() {
    header('Content-Type: application/json');
    echo json_encode(\$_SESSION['picoState'] ?? ['count' => 0]);
}
EOF
    )
}
