cat <<EOF > $TETRA_DIR/tetra.env 
TETRA_USER=username
TETRA_ORG=orgname  
TETRA_REMOTE=crytptochromatic.net
TETRA_SRC=$HOME/src/devops-study-group/tetra/bash
EOF

source $TETRA_DIR/tetra.sh

(
cd $TETRA_DIR/orgs
mv ./orgname ./$TETRA_ORG

cd $TETRA_DIR/users
mv ./username ./$TETRA_USER

cd $TETRA_DIR/users/$TETRA_USER
echo "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" > \
./apis/OPENAI_API_KEY

cd $TETRA_DIR/users/$TETRA_USER/keys
tetra_ssh_keygen_generate $TETRA_USER

cd $TETRA_DIR/orgs
cd $TETRA_ORG
dotool-create-server-list > hosts.env

source $TETRA_DIR/tetra.sh
tetra_env_update
)

# Example of adding host names from digital ocean:
#remote=$(doctl compute domain list-records $TETRA_REMOTE_NAME --format "IP_address")
#remote_p=$(doctl compute droplet get $TETRA_REMOTE_NAME --format PrivateIPv4)

