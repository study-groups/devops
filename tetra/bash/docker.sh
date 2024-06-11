tetra_docker_start() {
    docker-compose up -d
}

tetra_docker_stop() {
    docker-compose down
}

tetra_docker_logs() {
    if [ -z "$1" ]; then
        docker-compose logs
    else
        docker-compose logs "$1"
    fi
}

tetra_docker_restart() {
    docker-compose down
    docker-compose up -d
}

tetra_docker_status() {
    docker-compose ps
}

tetra_docker_kill_all(){
  sudo docker-compose down
  sudo docker ps -q | xargs docker stop
  sudo docker ps -aq | xargs docker rm
}
# Function to start Docker Compose services for a specific environment
tetra_docker_start_env() {
    if [ -z "$1" ]; then
        echo "Usage: tetra_docker_start_env <environment_directory>"
        return 1
    fi
    (cd "$1" && docker-compose up -d)
}

# Function to stop Docker Compose services for a specific environment
tetra_docker_stop_env() {
    if [ -z "$1" ]; then
        echo "Usage: tetra_docker_stop_env <environment_directory>"
        return 1
    fi
    (cd "$1" && docker-compose down)
}

# Function to view logs for a specific environment
tetra_docker_logs_env() {
    if [ -z "$1" ]; then
        echo "Usage: tetra_docker_logs_env <environment_directory> [service_name]"
        return 1
    fi
    if [ -z "$2" ]; then
        (cd "$1" && docker-compose logs)
    else
        (cd "$1" && docker-compose logs "$2")
    fi
}

# Function to view the status of Docker Compose services for a specific environment
tetra_docker_status_env() {
    if [ -z "$1" ]; then
        echo "Usage: tetra_docker_status_env <environment_directory>"
        return 1
    fi
    (cd "$1" && docker-compose ps)
}
