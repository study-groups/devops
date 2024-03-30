# Semantics is about what.
# Syntax is about who, with, where and with.
# Causality is about why.

# Common patterns: org->org->agent-action-object
# Common patterns: tetra-fc-jwasack-login-ec2

# Analysis: syn-syn-syn-sem-rel-syn
#           place-place-agent-action-on-obj

# ec2- meta-semantic, e.g. the semantical syntax. It has 
# both infrastructural (syntaxical) and domain identifying (semantic)
# connotations.

# As a developer, I want to a system for logging into multiple
# machines and maintain configuration environments based on
# the organization I'm working as an agent of.

# Entity first. Polutes tetra-, easy ui for most likely use case.
# Noun syntax becomes impicit semantics.
source $TETRA_DIR/infra/server.list

tetra-sync-to-kingdel(){
  doit="$(tetra-sync-to $HOME/tetra/ $USER kingdel.local '$HOME/tetra/')"
  echo Type '$(echo $doit)'  to execute:
  echo 
  echo  "$doit"
  echo 
}

tetra-sync-from-kingdel(){
  tetra-sync-from  kingdel.local '$HOME/tetra/' '$HOME/tetra/'  
}

tetra-sync-from-m2(){
  tetra-sync-from  m2.local '$HOME/tetra/' '$HOME/tetra/'  
}

tetra-jwasack(){
  echo "Using $TETRA_DIR"
  echo "long form: tetra-fc-jwasack-login-to-ec2"
  echo "or: jwasack-login-to-fc-ec2-from-tetra"
  #local host=jwasack.diamondnexus.com
  local host=ec2-3-144-45-51.us-east-2.compute.amazonaws.com
  ssh -i $TETRA_DIR/keys/jwasack.pem admin@$host
}

tetra-fc-mkdocs(){
  ssh -t devops@$do4_n2 "cd src/fc/developer-environment/test-suite/mkdocs; \
      bash -l"
}
tetra-do4_n2(){
  echo "Using $TETRA_DIR"
  ssh -i $TETRA_DIR/org/mricos/keys/id_rsa-ux305-3 root@$do4_n2
}

###########
# DEVNOTES
###########

tetra-create-init-definition(){
cat <<EOF
#tetra-init.sh created by tetra-create-init()
tt_user=$USER
tt_org=fc
echo "Tetra 0.1"
BASHDIR=$(dirname ${BASH_SOURCE[0]})
echo "BASHDIR=$BASHDIR"
source $BASHDIR/bootstrap.sh
EOF

}

tetra-secrets-to-env-tetra(){
cat<<'EOF'

Takes no args, relies on tetra conventions.
If system is properly configured, secrets.env.enc
will be decrypted by TETRA_ORG_KEYFILE to create
tetra.env that contains all env variables, including
passwords, that would be used by tetra-defined infra.
source $TETRA_ORG_DIR/config.env

cat $TETRA_ORG_DIR/secrets.env.enc \
     | envsubst > $TETRA_ORG_DIR/tetra-private.sh

EOF
}

