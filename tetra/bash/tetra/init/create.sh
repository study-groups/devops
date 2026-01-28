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
    cp -r "$TETRA_SRC/bash/tetra/init/tetra-dir" "$TETRA_DIR"
    echo "Operations completed."
    source $TETRA_DIR/tetra.sh
}


tetra_create_infra(){
  TETRA_INFRA=$TETRA_DIR/infra
  mkdir -p $TETRA_INFRA
  tetra_doctl_get_droplets # writes to $TETRA_INFRA/droplets.json
  tetra_infra_hosts > $TETRA_INFRA/hosts.sh
  tetra_infra_floating >> $TETRA_INFRA/hosts.sh
  tetra_infra_ports > $TETRA_INFRA/ports.sh
  tetra_infra_services > $TETRA_INFRA/services.sh
}

