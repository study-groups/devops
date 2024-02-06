tetra-encrypt(){
  openssl aes-256-cbc -a -salt -in $1 -out $1.enc
}

tetra-decrypt(){
  openssl aes-256-cbc -d -a -in $1 -out $2 
}

tetra-encrypt-stdio(){
  openssl aes-256-cbc -a -salt 
}

tetra-decrypt-stdio(){
  openssl aes-256-cbc -a -d
}

tetra-htpasswd-set(){
   # used by nginx for basic security
   # typically development web is protected 
   # using a shared devops password.
   echo htpasswd -c ~$USER/htpasswd ${1:-$USER}
}
