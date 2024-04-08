tetra_create_tetra(){
echo
echo "  You are about to blow away TETRA_DIR=$TETRA_DIR"
echo "  ctrl-c to quit"; read
echo

rm -r $TETRA_DIR 2>/dev/null
cp -r $TETRA_SRC/init/tetra-dir $TETRA_DIR

}

# Example of adding host names from digital ocean:
#t2=$(doctl compute domain list-records $TETRA_T2 --format "IP_address")
#t2_p=$(doctl compute droplet get $TETRA_T2 --format PrivateIPv4)
