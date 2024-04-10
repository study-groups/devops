tetra_create_tetra(){
	echo
	echo "  You are about to blow away TETRA_DIR=$TETRA_DIR"
	echo "  ctrl-c to quit"; read
	echo

	rm -r $TETRA_DIR 2>/dev/null
	cp -r $TETRA_SRC/init/tetra-dir $TETRA_DIR
}
tetra_create_tetra
