tetra_openssl_encrypt(){
  tar -czf - $1\
	  | openssl enc -aes-256-cbc -salt \
	    -out $1.tgz.enc
}

tetra_openssl_decrypt(){
  openssl enc -d -aes-256-cbc \
	  -salt  \
	  -in $1 | tar -xzf - -C . 
}
