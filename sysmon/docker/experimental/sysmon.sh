sysmon_docker_list(){
docker ps --format "table {{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Status}}"

}

sysmon_docker_summarize() {
    echo "========== Docker Containers =========="
    docker ps --format "table {{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Status}}"
    echo ""

    echo "========== Docker Networks =========="
    docker network ls
    echo ""

    echo "========== Docker Volumes =========="
    docker volume ls
    echo ""

    echo "========== Mounted Volumes =========="
    for v in $(docker volume ls -q); do
        echo "Volume: $v"
        docker volume inspect "$v" | jq '.[0].Mountpoint'
        echo ""
    done

    echo "========== NGINX Log Configuration =========="
    grep access_log /etc/nginx/nginx.conf
    echo ""

    echo "========== Active SSH Logins =========="
    journalctl -u ssh -n 10 --no-pager
    echo ""

    echo "========== Fail2Ban Status =========="
    sudo fail2ban-client status
}

sysmon_docker_volumes() {
    # Determine DOCKER_VOLUMES dynamically
    export DOCKER_VOLUMES=$(docker info --format '{{ .DockerRootDir }}/volumes')
    echo "========== Docker Volume Summary =========="
    echo "Using DOCKER_VOLUMES=$DOCKER_VOLUMES"
    printf "%-20s %-50s\n" "VOLUME" "MOUNTPOINT"
    printf "%-20s %-50s\n" "--------------------" "--------------------------------------------------"

    VOLUMES=$(docker volume ls -q)

    if [[ -z "$VOLUMES" ]]; then
        echo "No Docker volumes found."
        return
    fi

    for v in $VOLUMES; do
        SHORT_ID=${v:0:12}  # Truncate long volume IDs
        MOUNTPOINT=$(docker volume inspect "$v" --format '{{ .Mountpoint }}' 2>/dev/null)

        if [[ -n "$MOUNTPOINT" ]]; then
            # Normalize mount path using DOCKER_VOLUMES
            if [[ "$MOUNTPOINT" == "$DOCKER_VOLUMES"* ]]; then
                RELATIVE_PATH="${MOUNTPOINT#$DOCKER_VOLUMES/}"
                printf "%-20s $DOCKER_VOLUMES/%s\n" "$SHORT_ID" "$RELATIVE_PATH"
            else
                printf "%-20s %s\n" "$SHORT_ID" "$MOUNTPOINT"
            fi
        else
            printf "%-20s No mount point found\n" "$SHORT_ID"
        fi
    done
}

sysmon_docker_cleanup(){
echo "Checking for unused Docker volumes..."
docker volume ls -q | while read v; do
    if ! docker ps -a --filter volume="$v" --format '{{.Names}}' | grep .; then
        echo "Removing unused volume: $v"
        docker volume rm "$v"
    fi
done
}
