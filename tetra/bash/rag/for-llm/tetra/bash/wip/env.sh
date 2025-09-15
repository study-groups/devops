tetra_env() {
    local all=false
    local var
    local is_exported

    # Check if '-a' flag is present
    if [[ "$1" == "-a" ]]; then
        all=true
    fi

    # List all environment variables
    for var in $(compgen -v); do
        # Check for variables starting with TETRA or _TETRA
        if [[ $var == TETRA* ]] || 
           { [[ $var == _TETRA* ]] && [[ $all == true ]]; }; then
            
            # Check if the variable is exported and append comment
            is_exported=$(declare -p $var 2>/dev/null | 
                         grep -q 'declare -x' && echo " # exported" || echo "")

            # Echo the variable and its value with export comment
            echo "${var}=${!var}${is_exported}"
        fi
    done
}

tetra_env_clear() {
    for var in $(compgen -v); do
        if [[ $var == _TETRA* ]] || [[ $var == TETRA* ]]; then
            unset "$var"
        fi
    done
}

tetra_env_update(){
   echo "Using TETRA_DIR: $TETRA_DIR"
   echo "Using TETRA_ORG: $TETRA_ORG"
   echo "Using TETRA_USER: $TETRA_USER"
   (
       cd $TETRA_DIR/env
       rm ./hosts.env ./ports.env
       ln -s $TETRA_DIR/orgs/$TETRA_ORG/hosts.env
       ln -s $TETRA_DIR/orgs/$TETRA_ORG/ports.env
       ln -s $TETRA_DIR/users/$TETRA_USER/$TETRA_USER.env
   ) 
   _tetra_env_load
   _tetra_env_update_apis
}

_tetra_env_load(){
    for f in $(ls $TETRA_DIR/env/*.env);
        do source $f;
    done;
}

_tetra_env_update_apis(){
    echo
    echo "Updating env with ${TETRA_USER}'s API values"
    for f in $TETRA_DIR/users/$TETRA_USER/apis/*; do
        filename=$(basename "$f")
        value=$(cat "$f")
        echo "${filename}=${value}" > "$TETRA_DIR/env/${filename}.env"
    done;
}
