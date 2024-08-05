
# Docker Functions
sm_grafana_docker_start() {
    docker run -d \
        --name=grafana \
        -p ${SM_GRAFANA_PORT}:3000 \
        -v /var/lib/grafana:/var/lib/grafana \
        -v /etc/grafana/provisioning:/etc/grafana/provisioning \
        grafana/grafana:latest
}

sm_grafana_docker_stop() {
    docker stop grafana && \
    docker rm grafana
}

sm_prometheus_docker_start() {
    docker run -d \
        --name=prometheus \
        -p ${SM_PROMETHEUS_PORT}:9090 \
        -v /var/lib/prometheus:/prometheus \
        -v /etc/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml \
        prom/prometheus:latest
}

sm_prometheus_docker_stop() {
    docker stop prometheus && \
    docker rm prometheus
}

sm_cadvisor_docker_start() {
    docker run -d \
        --name=cadvisor \
        -p ${SM_CADVISOR_PORT}:8080 \
        -v /:/rootfs:ro \
        -v /var/run:/var/run:rw \
        -v /sys/fs/cgroup:/sys/fs/cgroup:ro \
        -v /var/lib/docker/:/var/lib/docker:ro \
        gcr.io/cadvisor/cadvisor:latest
}

sm_cadvisor_docker_stop() {
    docker stop cadvisor && \
    docker rm cadvisor
}



# Additional Functions from smtool.sh
sm_mysql_connect(){
  mysql -P 3306 -h 172.29.0.2  -u magento_admin -pXXXXXXXXX
}

sm_docker_ps(){
  sudo docker ps
}

sm_docker_up(){
  sudo docker compose up -d $1
}

sm_docker_start(){
  sudo docker compose start $1
}

sm_docker_stop(){
  sudo docker compose stop $1
}

sm_docker_build(){
  sudo docker compose build $1
}

sm_docker_bash(){
  sudo docker exec -it $1 /bin/bash
}

sm_docker_get_ip(){
  local container=${1:-"adapter"}
  network_name=system-monitor_web-network
  ip=$(sudo docker inspect -f  \
        "{{with index .NetworkSettings.Networks \"$network_name\"}} \
        {{.IPAddress}}{{end}}" $container)
  echo $ip
}

sm_docker_burn_it_down(){
  (
  sudo docker stop $(sudo docker ps -a -q)
  sudo docker rm -y $(sudo docker ps -a -q)
  sudo docker network prune
  )
}

sm_docker_inspect(){
  sudo docker inspect $1
}

sm_docker_restart(){
  sudo docker restart $1
}

sm_docker_logs(){
  sudo docker compose logs  --tail=200  $1 -f
}

sm_docker_volume_create(){
  sudo docker volume create grafana-storage
}

sm_docker_prune(){
  echo "Remove all local volumes not used by at least one container."
  sudo docker volume prune
}

sm_docker_volume_inspect(){
  sudo docker volume inspect grafana-storage
}

sm_network_connect(){
  echo "connecting developer-environment_web-network to adapter"
  sudo docker network connect developer-environment_web-network adapter
}
