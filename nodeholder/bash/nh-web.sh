alias sae-proxy="nh-web-create-proxy sae.nodeholder.com 80 /api $doZ 1029 api/nlp"
nh-web-build-config(){
  local meshdef="./mesh.txt"
  local destination="/etc/nginx/sites-available"
  #local dest="/etc/nginx/sites-enabled"
  #rm -f $dest/*
  cat $src/nodeholder $src/nodeholder-dev #> "$dest/all-sites"
}

nh-web-restart-server(){
  systemctl restart nginx
}

nh-web-reload-server() {
  systemctl reload nginx
}

# NH_SUB=sae-zach
# NH_DOMAIN=nodeholder
# NH_EXT=com
# NH_ROOT=""
# NH_LOCATION=""
# NH_PROTOCOL=http
# NH_IP=165.227.16.243
# NH_APP_PORT=1025
# NH_PATH=""

# server {
#    server_name SUB.DOMAIN.EXT;
#    root ROOT;
#    listen 80;
#    location LOCATION {
#        proxy_pass PROTOCOL://IP:PORT/PATH;
#    }
#}

nh-web-create-proxy() {
  local in_host=$1  # same as HTTP RFC's abs_path
  local in_port=$2  # default is 80, typically 80 or 443
  local in_path=$3  # same as abs_path defined in HTTP RFC

  local out_host=$4 # can also be an IP
  local out_port=$5
  local out_path=$6 # abs_path

  local protocol=${7:-http}

  cat << EOF
server {
    # server_name EF3432ERE3;
    server_name $in_host;
    root /dev/null;
    listen $in_port;
    location $in_path {
        proxy_pass $protocol://$out_host:$out_port/$out_path;
    }
}
EOF
}

nh-web-create-proxy-orig() {
    source nh.server
    local template=$(cat nh-server.template);
    template="${template//SUB/$NH_SUB}";
    template="${template//DOMAIN/$NH_DOMAIN}";
    template="${template//EXT/$NH_EXT}";
    template="${template//ROOT/$NH_ROOT}";
    template="${template//LOCATION/$NH_LOCATION}";
    template="${template//IP/$NH_IP}";
    template="${template//PROTOCOL/$NH_PROTOCOL}";
    template="${template//PORT/$NH_APP_PORT}";
    template="${template//PATH/$NH_PATH}";
    echo "$template"
}

#  Mediate keyed-actions into us.
mesh-set-upstream(){
  local ip=$1;
  #MESH_UPSTREAM_CONFIG=$1 # devops@$do5:/etc/nginx/sites-enables/mesh.config
  MESH_UPSTREAM_CONFIG="devops@$ip:/etc/nginx/sites-enabled/mesh.config"
}

# Forward or handle keyed-actions.
mesh-set-config(){
  #MESH_CONFIG=$1 # /etc/nginx/sites-enabled/mesh.config
  MESH_CONFIG="/etc/nginx/sites-enabled/mesh.config"
}

mesh-get-upstream(){
  cat $MESH_UPSTREAM_CONFIG
}

mesh-save-state(){
  echo "add save-state"  
}

nh-web-install-certbot(){
  # just do this in config?
  #https://certbot.eff.org/lets-encrypt/ubuntufocal-nginx.html
  sudo apt-get remove certbot
  sudo snap install --classic certbot
}

nh-web-certbot(){
  local domain=$1
  sudo certbot --nginx -d $domain
}

nh-web-certbot-renew-test(){
  # Renew is called via one of these:
  # /etc/crontab/
  # /etc/cron.*/*
  # systemctl list-timers
  sudo certbot renew --dry-run
}

# Places where cert config is stored
# /etc/letsencrypt/archive
# /etc/letsencrypt/live
# /etc/letsencrypt/renewal
nh-web-certbot-delete-from-list(){
  sudo certbot delete
}

# delete 1 domain name
nh-web-certbot-delete-by-name(){
  sudo certbot delete --cert-name $1
}
