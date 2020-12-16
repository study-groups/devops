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

#  Mediate keyed-actions into us.
mesh-set-upstream(){
  #MESH_UPSTREAM_CONFIG=$1 # devops@$do5:/etc/nginx/sites-enables/mesh.config
  MESH_UPSTREAM_CONFIG="devops@$do5:/etc/nginx/sites-enables/mesh.config"
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

