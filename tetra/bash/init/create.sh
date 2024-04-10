tetra_create_tetra(){
    # Ensure TETRA_DIR is set and not empty
    [ -z "$TETRA_DIR" ] && { echo "TETRA_DIR is not set."; exit 1; }

    # Check if TETRA_DIR is in the home directory of the current user
    if [ "$(dirname "$TETRA_DIR")" != "$HOME" ]; then
        echo "TETRA_DIR is not in the home directory of the current user."
        exit 1
    fi

    echo "Proceeding with operations..."
    rm -r "$TETRA_DIR" 2>/dev/null
    cp -r "$TETRA_SRC/init/tetra-dir" "$TETRA_DIR"
    echo "Operations completed."
}
