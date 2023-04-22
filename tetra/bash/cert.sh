TETRA_CERTS_REMOTE="/etc/ssl/certs/tetra"

tetra-cert-help(){
  echo "TETRA_CERTS:$TETRA_CERTS"
  echo "TETRA_CERTS_REMOTE:$TETRA_CERTS_REMOTE"
  ls $TETRA_CERTS
}

tetra-cert-manual-wildcard ()
{
    echo "https://go-acme.github.io/lego/usage/cli/"
}

tetra-cert-nginx(){

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
  ssh root@$$TETRA_REMOTE systemctl restart nginx
}


