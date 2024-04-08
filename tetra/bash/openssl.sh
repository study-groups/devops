tetra_openssl_encrypt(){
  openssl aes-256-cbc -a -salt -in $1 -out $1.enc
}

tetra_openssl_decrypt(){
  openssl aes-256-cbc -d -a -in $1 -out $2 
}

tetra_openssl_encrypt_stdio(){
  openssl aes-256-cbc -a -salt 
}

tetra_opensll_decrypt_stdio(){
  openssl aes-256-cbc -a -d
}

tetra_htpasswd_set(){
   # used by nginx for basic security
   # typically development web is protected 
   # using a shared devops password.
   echo htpasswd -c ~$USER/htpasswd ${1:-$USER}
}
