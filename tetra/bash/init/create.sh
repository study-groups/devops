tetra_create_tetra(){
    echo
    echo "  You are about to perform the following actions:"
    echo "  1. Remove TETRA_DIR=$TETRA_DIR"
    echo "  2. Copy from $TETRA_SRC/init/tetra-dir to $TETRA_DIR"
    echo "  Do you want to continue? (y/n)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo "Proceeding with operations..."
        rm -r "$TETRA_DIR" 2>/dev/null
        cp -r "$TETRA_SRC/init/tetra-dir" "$TETRA_DIR"
        echo "Operations completed."
    else
        echo "Operation cancelled."
    fi
}
tetra_create_tetra