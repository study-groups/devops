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

tetra_openssl_make_pem(){
  local sshkey=$1
  local pemfile=$2
  # convert private key to PEM format
  openssl rsa -in $sshkey -outform PEM -out $pemfile
  chmod 600 $pemfile
}


# add a passphrase
tetra_keys_passphrase_check(){
  local pemfile=$1
  ssh-keygen -p -f $pemfile
}

# does it have a passphrase
tetra_keys_passphrase_add(){
  echo "Should work:  openssl rsa -in $1 -out $1"
}
