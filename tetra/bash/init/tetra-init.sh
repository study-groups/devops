echo "You are about to blow away $TETRA_DIR, ctrl-c to quit"; read
rm -r $TETRA_DIR 2>/dev/null; mkdir $TETRA_DIR; mkdir $TETRA_DIR/org
echo "$TETRA_SERVERS" > $TETRA_DIR/server.list	
echo "$TETRA_INTERFACES" > $TETRA_DIR/interface.list
echo  "$TETRA_PEM" > $TETRA_DIR/tetra.pem
echo  "$TETRA_ENV" >  $TETRA_DIR/tetra.env
echo  "$TETRA_SH" >  $TETRA_DIR/tetra.sh
mkdir $TETRA_DIR/org/$TETRA_ORG
echo "$TETRA_ORG_INFO" > "$TETRA_DIR/org/$TETRA_ORG/tetra.sh"
