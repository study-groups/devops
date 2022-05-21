# This file is being migrated to an excutable shell program

[ -f tetra.env ] && source tetra.env
remoteEast="ssh admin@$do1"
remoteWest="ssh admin@$do2"

#source $TETRA/*.sh

tetra-make-env(){
  scp admin@$do4:~/server.list ./tetra.env # dotool to tetra
  echo "TETRA_API_KEY=XXX-YYYY-ZZZ" >> ./tetra.env
}

tetra-make-nginx-proxy(){
(( "$#" < 2 )) && cat <<EOF
 ""
EOF


}

tetra-dev-notes(){
cat <<EOF
Good 3 part series on DNS debugging:
https://www.youtube.com/watch?v=Z8YoudlLx0k
EOF
}

