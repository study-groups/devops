TETRA_PEM=$(echo "run tetra-pem-gen")
TETRA_ENV=$(echo "add env vars here")
TETRA_SH=$(echo "add tetra bash here")
TETRA_PROJECT=$TETRA_DIR/projects/phmedia
TETRA_T2="do1"
TETRA_SERVERS=$(cat <<EOF
t1=0.0.0.0
t1p=127.0.0.1
t2=$(doctl compute domain list-records $TETRA_T2 --format "IP_address")
t2p=$(doctl compute droplet get $TETRA_T2 --format PrivateIPv4)
EOF
)

TETRA_PORTS=$(cat <<EOF
tetra=4000
php=4001
nodejs=4002
python=4003
EOF
)

TETRA_ORG_INFO=$(cat<<EOF
  This text will go into tetra/org/tt/tetra.sh.
EOF
)
