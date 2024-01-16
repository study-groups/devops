[ -z "$TETRA_DIR" ] && echo "Error: TETRA_DIR not set. Exiting." && return 1
[ -z "$TETRA_DOCKER" ] && TETRA_DOCKER="$TETRA_DIR/docker"

tetra_docker_php_refresh() {
    [ -z "$TETRA_DOCKER" ] && echo "Error: TETRA_DOCKER not set. Exiting."
    export _TETRA_PHP="${TETRA_DOCKER}/${serviceName}"
}

tetra_docker_php_destroy(){
    local dir=$_TETRA_PHP
    [ -z "$dir" ] && "$dir does not exist." && return 0;
    read -p "About to blow away $dir, <ret> to continue."
    rm -rf $dir
}

tetra_docker_php_create() {
    local serviceName=${1:-php}
    export _TETRA_PHP="${TETRA_DOCKER}/${serviceName}"

    echo "Creating PHP Docker environment using TETRA_DIR=$TETRA_DIR"
    _tetra_docker_php_setup_dir "${_TETRA_PHP}"
    _tetra_docker_php_create_dockerfile "${_TETRA_PHP}"
    _tetra_docker_php_update_compose "${serviceName}" "${_TETRA_PHP}"
    _tetra_docker_php_create_entrypoint "${_TETRA_PHP}"
    _tetra_docker_php_create_index "${_TETRA_PHP}"
}


_tetra_docker_php_setup_dir() {
    mkdir -p "$1"
    cd "$1"
}

_tetra_docker_php_create_dockerfile() {
    cat > "$1/Dockerfile" <<EOF
FROM php:8.0-apache
COPY . /var/www/html
COPY entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/entrypoint.sh
ENTRYPOINT ["entrypoint.sh"]
CMD ["apache2-foreground"]
EOF
}

_tetra_docker_php_update_compose() {
    cat >> "${TETRA_DOCKER}/docker-compose.yml" <<EOF
  # Start ${1}
  ${1}:
    build: ${2}
    ports:
      - "4444:80"
    volumes:
      - ${2}:/var/www/html
  # End ${1}
EOF
}

_tetra_docker_php_create_entrypoint() {
    cat > "$1/entrypoint.sh" <<EOF
#!/bin/bash
exec apache2-foreground
EOF
    chmod +x "$1/entrypoint.sh"
}

_tetra_docker_php_create_index() {
    echo "<?php phpinfo();" > "$1/index.php"
}


tetra_docker_php_start() {
    (
        cd "${TETRA_DOCKER}"
        docker-compose up -d ${_TETRA_PHP}
    )
}

# Stop the PHP Docker environment
tetra_docker_php_stop() {
    (
        cd "${TETRA_DOCKER}"
        docker-compose down ${_TETRA_PHP}
    )
}

# Check the status of the PHP Docker environment
tetra_docker_php_status() {
    (
        cd "${TETRA_DOCKER}"
        docker-compose ps ${_TETRA_PHP}
    )
}

# Check the logs of the PHP Docker environment
tetra_docker_php_log() {
    (
        cd "${TETRA_DOCKER}"
        docker-compose logs ${_TETRA_PHP}
    )
}

# Print helper information about the PHP Docker environment
tetra_docker_php_help() {
    echo
    echo "TETRA_DIR: Set in ~/tetra/tetra.sh"
    echo "TETRA_DOCKER: Directory for Docker projects. Default is TETRA_DIR/docker"
    echo "_TETRA_PHP: Where the PHP project was or will be created"
    echo
    echo "Functions available:"
    echo "  tetra_docker_php_create [serviceName] - Sets up a PHP Docker environment"
    echo "  tetra_docker_php_start - Starts the PHP Docker environment"
    echo "  tetra_docker_php_stop - Stops the PHP Docker environment"
    echo "  tetra_docker_php_status - Shows the status of the PHP Docker environment"
    echo "  tetra_docker_php_log - Displays logs for the PHP Docker environment"
    echo
}

tetra_docker_php_refresh
