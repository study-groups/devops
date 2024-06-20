nh_make_short_vars_orig() {

    local counter
    local new_var_name
    local env_var_name
    local env_var_value

    # Define an ignore list
    local ignore_list=("evn" "evv" "nvn" "env_var_value" "new_var_name" "counter" "new_var_name" "env_var_name" "env_var_value" "ignore_list")
    
    # Get all variables and filter out functions
    while IFS='=' read -r env_var_name env_var_value; do
        # Ignore variables that start with a capital letter
        if [[ "$env_var_name" =~ ^[A-Z] ]]; then
            continue
        fi

        # Ignore variables in the ignore list
        if [[ " ${ignore_list[@]} " =~ " ${env_var_name} " ]]; then
            continue
        fi

        # Check if the variable name contains at least one underscore
        if [[ "$env_var_name" == *_* ]]; then
            # Remove leading and trailing quotes from the value
            env_var_value="${env_var_value#\"}"
            env_var_value="${env_var_value%\"}"
            
            # Create a shorter variable name by taking the first letter of each segment
            new_var_name=$(echo "$env_var_name" | awk -F'_' '{for (i=1; i<=NF; i++) printf("%s", substr($i, 1, 1))}')
            
            # Initialize counter
            counter=1
            
            # Check for duplication and append number if needed
            while declare -p "$new_var_name" &>/dev/null; do
                new_var_name="${new_var_name}_${counter}"
                counter=$((counter + 1))
            done
            
            # Echo the new variable assignment with the original name as a comment
            echo "${new_var_name}='${env_var_value}' # ${env_var_name}"
        fi
    done < <(declare -p | grep 'declare --' | awk '{sub(/declare -- /, ""); print $0}')
}
nh_make_short_func_vars() {
    local counter
    local new_func_name
    local func_name

    # Get all functions
    for func_name in $(declare -F | awk '{print $3}'); do
        # Ignore functions that start with a capital letter
        if [[ "$func_name" =~ ^[A-Z] ]]; then
            continue
        fi

        # Check if the function name contains at least one underscore
        if [[ "$func_name" == *_* ]]; then
            # Create a shorter function name by taking the first letter of each segment
            new_func_name=$(echo "$func_name" | awk -F'_' '{for (i=1; i<=NF; i++) printf("%s", substr($i, 1, 1))}')
            
            # Initialize counter
            counter=1
            
            # Check for duplication and append number if needed
            while declare -F "$new_func_name" &>/dev/null; do
                new_func_name="${new_func_name}_${counter}"
                counter=$((counter + 1))
            done
            
            # Echo the new function alias with the original name as a comment
            echo "alias ${new_func_name}='${func_name}' # ${func_name}"
        fi
    done
}
