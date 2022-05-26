tetra-make-env(){
  scp admin@$do4:~/server.list ./tetra.env # dotool to tetra
  echo "TETRA_API_KEY=XXX-YYYY-ZZZ" >> ./tetra.env
}

tetra-make-nginx-proxy(){
(( "$#" < 2 )) && cat <<EOF
 ""
EOF
}
