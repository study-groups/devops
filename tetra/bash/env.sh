tetra-env() {
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

tetra-env-clear() {
    for var in $(compgen -v); do
        if [[ $var == _TETRA* ]] || [[ $var == TETRA* ]]; then
            unset "$var"
        fi
    done
}

