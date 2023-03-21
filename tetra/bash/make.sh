# tetra-make-init > tetra-init.sh
tetra-make-init(){
cat <<'EOF' > tetra-init.sh
#tetra-init.sh created by tetra-make-init()
tt_user=$USER
tt_org=fc
echo "Tetra 0.1"    
BASHDIR="$(dirname ${BASH_SOURCE[0]})"
source $BASHDIR/bootstrap.sh
'EOF'

cat <<'EOF' >> tetra.env
#tetra.env created by tetra-make-init()
#TETRA_API_KEY=XXX-YYYY-ZZZ



}

tetra-make-env(){
  scp admin@$do4:~/server.list ./tetra.env # dotool to tetra
  echo "TETRA_API_KEY=XXX-YYYY-ZZZ" >> ./tetra.env
}

tetra-make-nginx-proxy(){
(( "$#" < 2 )) && cat <<EOF
 ""
EOF
}


