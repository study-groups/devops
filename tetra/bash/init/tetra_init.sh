tetra_create_tetra(){
echo "You are about to blow away $TETRA_DIR, ctrl-c to quit"; read
rm -r $TETRA_DIR 2>/dev/null
mkdir $TETRA_DIR
echo  "$TETRA_SH" >  $TETRA_DIR/tetra.sh
echo  "$TETRA_ENV" >  $TETRA_DIR/tetra.env
echo "$TETRA_SERVERS" > $TETRA_DIR/servers.list
#echo "$TETRA_PORTS" > $TETRA_DIR/ports.list
#echo  "$TETRA_PEM" > $TETRA_DIR/tetra.pem

#mkdir $TETRA_DIR/projects/
#mkdir $TETRA_DIR/keys/
#mkdir $TETRA_DIR/role/
#mkdir $TETRA_DIR/vault/
#echo "$TETRA_PROJECT_SH" > "$TETRA_DIR/projects/$TETRA_PROJECT/tetra.sh"
#echo "$TETRA_OPENSSL" > $TETRA_DIR/vault/tetra_openssl.sh


if [[ $OSTYPE == 'darwin'* ]]; then
  # colima allows docker commands without Docker Desktop for mac 
  colima delete
  colima start --arch x86_64
fi
}

tetra_create_tetra
