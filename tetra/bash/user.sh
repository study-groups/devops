tetra_user_create() {
    local username=${1:-$TETRA_USER}
    local userdir="$TETRA_DIR/users/$username"
    mkdir -p $userdir
    echo "Enter secrets here" > $userdir/$username.sh
    mkdir -p $userdir/apis
    mkdir -p $usrdir/keys
    tetra_ssh_keygen $userdir/keys
}

tetra_user_delete() {
    local username=${1:-$TETRA_USER}
    local path=$TETRA_DIR/users/$username
	read -p "Do you want to delete $username? (yes/no): " response
	if [ "$response" = "yes" ]; then
		# Delete the file
		rm  -i -rf $path
		echo "File deleted successfully."
	else
		echo "File deletion canceled."
	fi


}
