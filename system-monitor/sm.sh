export MYSQL_SERVER=mysql_adapter
export HOST_NAME=kingdel
export MAG_NAME=kingel

sm-help(){
  echo "sm- bash functions for system-monitor Docker project." 
}

# 172.29.0.2 is mysql adaptor container
sm-mysql-connect(){
  mysql -P 3306 -h 172.29.0.2  -u magento_admin -pXXXXXXXXX
}

sm-ps(){
  sudo docker ps
}

sm-up(){
  # creates and starts
  sudo docker compose up -d $1
}

sm-start(){
  sudo docker compose start $1
}

sm-stop(){
  sudo docker compose stop $1
}

sm-build(){
  sudo docker compose build $1
}
sm-bash(){
  sudo docker exec -it $1 /bin/bash
}

sm-get-ip(){
  network_name=`sudo docker network ls --format "{{.Name}}" | grep web-network`
  ip=`sudo docker inspect -f '{{ $network := index .NetworkSettings.Networks "'$network_name'" }}{{ $network.IPAddress}}' $1`
  echo $ip 
}

sm-burn-it-down(){
  (
  sudo docker stop $(sudo docker ps -a -q)
  sudo docker rm -y $(sudo docker ps -a -q)
  sudo docker network prune
  )
}
sm-inspect(){
  sudo docker inspect $1
}

sm-restart(){
  sudo docker restart $1
}

sm-logs(){
  sudo docker compose logs  --tail=200  $1 -f
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


sm-mysql-info () 
{ 
    echo "Using ~/.my.cnf";
    cat ~/.my.cnf;
    cat <<EOF

  Docker code relies on:

  DB_HOST: $DB_HOST
  DB_NAME: $DB_NAME
  DB_TABLE: $DB_TABLE
  DB_ROOT_PASSWORD=$DB_ROOT_PASSWORD

  datestr = "$(date "+%a %d %b %Y %I:%M:%S %p %Z")"
  command = date "+%a %d %b %Y %I:%M:%S %p %Z"

EOF

}


# Must be in system-monitor dir containing docker-compose.yml

sm-local-env(){
  export $(grep -v '^#' .env | xargs)
  echo $(grep -v '^#' .env | xargs)
}

sm-local-adapter(){
  ./adapter/app/entrypoint.sh
}
