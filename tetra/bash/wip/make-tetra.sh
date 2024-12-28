
#  This file: tetra-init.sh was created by tetra-make-init()
#  To initialize your shell: $> source tetra-init.sh

tetra_bash=$TETRA_BASH           # set by ? 
source $tetra_bash/bootstrap.sh

tt_user=$USER                    # set by linux
tt_org=${ORG:-"global"}          # set by user in tetra.env
tt_src=${HOSTNAME:-"tt_global"}  # set by linux
echo "tetra-tetra 0.1"    
'EOF'

cat <<'EOF' >> tetra.env
#tetra.env created by tetra-make-init()
#TETRA_API_KEY=XXX-YYYY-ZZZ
'EOF'


}

tetra-make-env(){
  scp admin@$do4:~/server.list ./tetra.env # dotool to tetra
  echo "TETRA_API_KEY=XXX-YYYY-ZZZ" >> ./tetra.env
}

tetra-make-nginx-proxy(){
(( "$#" < 2 )) && cat <<EOF
 ""
