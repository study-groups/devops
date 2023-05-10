#!/bin/bash
# Assumes you have created .env and docker-compose.yml
source .env
MAG_NAME=kingdel
HOST_NAME=kingdel
echo -e "[client]\nuser=$DB_USER\npassword=$DB_ROOT_PASSWORD" > ~/.my.cnf
sudo docker-compose up -d --build --remove-orphans || exit 1
# Normally:
#sudo docker exec nginx bash /etc/nginx/certbot.sh
#sudo chown 1000:1000 -R ./nginx/ssl/
#
bash ./update_hosts.sh
