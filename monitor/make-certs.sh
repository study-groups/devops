cert-symlink(){
  sudo docker exec -it -u root nginx /bin/bash -c " \
  rm /usr/local/sbin/certbot
  ln -s /etc/nginx/certbot-selfsign.sh  /usr/local/sbin/certbot
"
}

cert-run(){
  sudo docker exec -it -u root nginx /bin/bash -c "$@"
}
cert-bash(){
  sudo docker exec -it  nginx /bin/bash
}

#cert-symlink
cert-in-container(){

  sudo docker exec -it -u admin nginx /bin/bash -c " \
whoami
which certbot
cd /etc/nginx
pwd
read
source /etc/nginx/certbot.sh
"
}
cert-local(){

  [ -d /usr/local/sbin/certbot ] && \
      mv /usr/local/sbin/certbot /tmp/certbot.$(date +%s)

  ln -s $(realpath ./files/certbot-selfsign.sh) \
      /usr/local/sbin/certbot

}
