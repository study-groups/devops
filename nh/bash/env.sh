nh_make_short_vars() {
    local counter
    local new_var_name
    local env_var_name
    local env_var_value

    # Get all variables and filter out functions
    while IFS='=' read -r env_var_name env_var_value; do
        # Remove leading 'declare -- ' and possible leading and trailing quotes from the value
        env_var_value="${env_var_value#*\'}"
        env_var_value="${env_var_value%\'*}"
        
        # Check if the variable name contains at least one underscore
        if [[ "$env_var_name" == *_* ]]; then
            # Create a shorter variable name by taking the first letter of each word
            new_var_name=$(echo "$env_var_name" | awk -F'_' '{for (i=1; i<=NF; i++) printf("%s", substr($i, 1, 1))}')
            
            # Initialize counter
            counter=1
            
            # Check for duplication and append number if needed
            while [[ -n "${!new_var_name}" || "$(declare -p $new_var_name 2>/dev/null)" ]]; do
                new_var_name="${new_var_name}_${counter}"
                counter=$((counter + 1))
            done
            
            # Echo the new variable assignment
            echo "${new_var_name}='${env_var_value}'"
        fi
    done < <(declare -p | grep 'declare --' | awk -F'=' '{print $1 "=" $2}')
}

nh_make_short_func_vars() {
    local counter
    local new_func_name
    local func_name

    # Get all functions
    for func_name in $(declare -F | awk '{print $3}'); do
        # Check if the function name contains at least one underscore
        if [[ "$func_name" == *_* ]]; then
            # Create a shorter function name by taking the first letter of each word
            new_func_name=$(echo "$func_name" | awk -F'_' '{for (i=1; i<=NF; i++) printf("%s", substr($i, 1, 1))}')
            
            # Initialize counter
            counter=1
            
            # Check for duplication and append number if needed
            while declare -F "$new_func_name" > /dev/null 2>&1; do
                new_func_name="${new_func_name}_${counter}"
                counter=$((counter + 1))
            done
            
            # Echo the new function assignment
            echo "alias ${new_func_name}=${func_name}"
        fi
    done
}

