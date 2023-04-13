sm-up(){
  sudo docker compose up -d
}

sm-logs(){
  sudo docker compose logs -f --tail=200 
}

sm-grafana-login(){
  echo "username: admin, pw: o*p*l*e"
}
sm-docker-volume-create-grafana-storage(){
  suod docker volume create grafana-storage
}

sm-docker-prune(){
  echo "Remove all local volumes not used by at least one container."
  sudo docker volume prune
}

sm-docker-volume-inspect(){
  sudo docker volume inspect grafana-storage
}

