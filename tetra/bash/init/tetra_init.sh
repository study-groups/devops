tetra_create_tetra(){
echo
echo "  You are about to blow away TETRA_DIR=$TETRA_DIR"
echo "  ctrl-c to quit"; read
echo

rm -r $TETRA_DIR 2>/dev/null
mkdir $TETRA_DIR


echo  "$TETRA_SH" >  $TETRA_DIR/tetra.sh
echo  "$TETRA_ENV" >  $TETRA_DIR/tetra.env
echo "$TETRA_SERVERS" > $TETRA_DIR/servers.list
mkdir $TETRA_DIR/ssh
mkdir $TETRA_DIR/api
mkdir $TETRA_DIR/tls
mkdir $TETRA_DIR/enc

#echo "$TETRA_PORTS" > $TETRA_DIR/ports.list
#echo  "$TETRA_PEM" > $TETRA_DIR/tetra.pem
#mkdir $TETRA_DIR/projects/
#mkdir $TETRA_DIR/keys/
#mkdir $TETRA_DIR/role/
#mkdir $TETRA_DIR/vault/
#echo "$TETRA_PROJECT_SH" > "$TETRA_DIR/projects/$TETRA_PROJECT/tetra.sh"
#echo "$TETRA_OPENSSL" > $TETRA_DIR/vault/tetra_openssl.sh

}

tetra_create_tetra
#t2=$(doctl compute domain list-records $TETRA_T2 --format "IP_address")
#t2p=$(doctl compute droplet get $TETRA_T2 --format PrivateIPv4)
