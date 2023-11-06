TETRA_CERTS_REMOTE="/etc/ssl/certs/tetra"

tetra_cert_help(){
  echo "TETRA_CERTS:$TETRA_CERTS"
  echo "TETRA_CERTS_REMOTE:$TETRA_CERTS_REMOTE"
  ls $TETRA_CERTS
}

tetra_cert_manual_wildcard ()
{
    echo "https://go-acme.github.io/lego/usage/cli/"
}


tetra_cert_selfsigned(){
  openssl req -x509 \
  -newkey rsa:4096 \
  -keyout _$1.key \
  -out org.crt \
  -days 365  \
  -nodes -subj "/CN=*.$1"

}

tetra_cert_nginx(){

cat <<EOF
server {

  listen 443;
  ssl on;
  ssl_certificate $TETRA_CERTS_REMOTE/$1.crt;
  ssl_certificate_key $TETRA_CERTS_REMOTE/$1.key;
  server_name $1;

}

}
EOF
}

tetra-cert-push(){
  hostname=$1
  serverIp=$2
  serverDir=${3:-"/etc/ssl/certs/tetra"}
  echo rsync -r  $TETRA_CERTS/$hostname.{crt,key} root@$serverIp:$serverDir
}

tetra-cert-nginx-restart(){
  ssh root@$TETRA_REMOTE systemctl restart nginx
}


