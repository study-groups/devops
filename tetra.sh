[ -f tetra.env ] && source tetra.env
remoteEast="ssh admin@$do1"
remoteWest="ssh admin@$do2"

tetra-make-env(){
  scp admin@$do4:~/server.list ./tetra.env # dotool to tetra
  echo "TETRA_API_KEY=XXX-YYYY-ZZZ" >> ./tetra.env
}

tetra-encrypt(){
  openssl aes-256-cbc -a -salt -in $1 -out $1.enc

}
tetra-decrypt(){
  openssl aes-256-cbc -d -a -in $1 -out $2 
}


